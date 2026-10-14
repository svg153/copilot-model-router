// Extension: model-router
//
// Three things in one extension:
//   1. A canvas panel showing and editing the model routing policy.
//   2. The "plan-then-execute" Dynamic Workflow: a premium model plans, cheap
//      models execute in parallel, a third model verifies.
//   3. Session-start wiring that pins the subagent models on the live session
//      and tells the agent which model to use for what.
//
// Routing config lives at $COPILOT_HOME/extensions/model-router/artifacts/routing.json
// so it is user-global and inspectable on disk.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { joinSession, createCanvas } from "@github/copilot-sdk/extension";
import {
    ARTIFACT_DIR,
    BUILTIN_SUBAGENT_TYPES,
    DEFAULT_PROVIDER_LABELS,
    EFFORT_LEVELS,
    MODEL_POLICIES,
    buildFallbackCatalog,
    loadRouting,
    normalizeCatalog,
    policyProse,
    resetRouting,
    saveRouting,
    toSubagentSettings,
} from "./routing.mjs";
import {
    SNAPSHOT_REPO,
    SNAPSHOT_URL,
    benchmarkRows,
    loadEnrichment,
    resetEnrichmentCache,
} from "./enrichment.mjs";
import { renderHtml } from "./renderer.mjs";
import { planThenExecute } from "./workflow.mjs";

const MAX_BODY_BYTES = 256 * 1024;

const HERE = dirname(fileURLToPath(import.meta.url));

/** Bundled third-party assets (three.js), served to the 3D tab. See vendor/README.md. */
const VENDOR_DIR = join(HERE, "vendor");

/** Machine-local copy of the downloaded snapshot, so the TTL survives restarts. */
const ENRICHMENT_CACHE_FILE = join(ARTIFACT_DIR, "models-enriched.cache.json");

/** One loopback server per open canvas instance: instanceId -> { server, url, clients } */
const servers = new Map();

function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on("data", (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error("request body too large"));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8");
            if (!raw) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(raw));
            } catch {
                reject(new Error("request body is not valid JSON"));
            }
        });
        req.on("error", reject);
    });
}

async function applySubagentSettings(session, routing) {
    try {
        await session.rpc.tools.updateSubagentSettings({ subagents: toSubagentSettings(routing) });
        return true;
    } catch (error) {
        await session.log(
            `model-router: could not apply subagent settings (${error?.message ?? error}). ` +
                "The routing policy text is still in effect.",
            { level: "warning" }
        );
        return false;
    }
}

function broadcastRouting(entry, routing) {
    const payload = `event: routing\ndata: ${JSON.stringify(routing)}\n\n`;
    for (const client of entry.clients) client.write(payload);
}

/**
 * The catalog is read from the session itself, so the canvas shows the models
 * the user's plan and providers actually expose rather than a list maintained in
 * this repo. Cached because the underlying call reaches out to CAPI; falls back
 * to a small static list when the call fails (no auth, older runtime).
 *
 * Public metadata (vendor, per-token price, benchmarks) is joined on from the
 * snapshot; see enrichment.mjs for where that comes from and how it degrades.
 */
const CATALOG_TTL_MS = 60_000;
const catalogCache = { value: null, at: 0 };

async function fetchCatalog(session, { refresh = false, providerLabels, refreshData = false } = {}) {
    const labels = providerLabels ?? DEFAULT_PROVIDER_LABELS;
    const now = Date.now();
    if (!refresh && !refreshData && catalogCache.value && now - catalogCache.at < CATALOG_TTL_MS) {
        return catalogCache.value;
    }

    if (refreshData) resetEnrichmentCache();
    const enrichment = await loadEnrichment({
        force: refreshData,
        cacheFile: ENRICHMENT_CACHE_FILE,
    });

    try {
        const modelList = await session.rpc.model.list({ skipCache: refresh || refreshData });
        const providers = normalizeCatalog(modelList, labels, enrichment);
        if (!providers.length) throw new Error("the session returned an empty model list");
        catalogCache.value = {
            providers,
            source: "live",
            fetchedAt: new Date(now).toISOString(),
            data: enrichment.meta,
            dataSource: enrichment.source,
        };
    } catch (error) {
        await session.log(
            `model-router: could not read the live model list (${error?.message ?? error}); ` +
                "showing the fallback catalog.",
            { level: "warning" }
        );
        catalogCache.value = {
            providers: buildFallbackCatalog(labels),
            source: "fallback",
            fetchedAt: new Date(now).toISOString(),
            data: enrichment.meta,
            dataSource: enrichment.source,
        };
    }

    catalogCache.at = now;
    return catalogCache.value;
}

/** The public benchmark leaderboard the canvas's Benchmarks tab renders. */
const benchmarkCache = { value: null, at: 0 };

async function fetchBenchmarks({ refresh = false } = {}) {
    const now = Date.now();
    if (!refresh && benchmarkCache.value && now - benchmarkCache.at < CATALOG_TTL_MS) {
        return benchmarkCache.value;
    }
    if (refresh) resetEnrichmentCache();

    const enrichment = await loadEnrichment({ force: refresh, cacheFile: ENRICHMENT_CACHE_FILE });
    benchmarkCache.value = {
        rows: benchmarkRows(enrichment.snapshot),
        meta: enrichment.meta,
        source: enrichment.source,
        repoUrl: `https://github.com/${SNAPSHOT_REPO}`,
        snapshotUrl: SNAPSHOT_URL,
    };
    benchmarkCache.at = now;
    return benchmarkCache.value;
}

async function startServer(session) {
    const entry = { server: null, url: "", clients: new Set() };

    const server = createServer(async (req, res) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");

        if (req.method === "GET" && url.pathname === "/events") {
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            });
            res.write(": connected\n\n");
            entry.clients.add(res);
            req.on("close", () => entry.clients.delete(res));
            return;
        }

        if (req.method === "GET" && url.pathname === "/routing") {
            sendJson(res, 200, { routing: await loadRouting() });
            return;
        }

        if (req.method === "GET" && url.pathname === "/catalog") {
            const routing = await loadRouting();
            const catalog = await fetchCatalog(session, {
                refresh: url.searchParams.get("refresh") === "1",
                providerLabels: routing.providerLabels,
            });
            sendJson(res, 200, { catalog });
            return;
        }

        if (req.method === "GET" && url.pathname === "/data") {
            sendJson(
                res,
                200,
                await fetchBenchmarks({ refresh: url.searchParams.get("refresh") === "1" })
            );
            return;
        }

        if (req.method === "POST" && (url.pathname === "/routing" || url.pathname === "/reset")) {
            try {
                const isReset = url.pathname === "/reset";
                const routing = isReset ? await resetRouting() : await saveRouting(await readBody(req));
                broadcastRouting(entry, routing);
                const applied = await applySubagentSettings(session, routing);
                sendJson(res, 200, { routing, applied });
            } catch (error) {
                sendJson(res, 400, { error: String(error?.message ?? error) });
            }
            return;
        }

        if (req.method === "GET" && url.pathname.startsWith("/vendor/")) {
            const name = url.pathname.slice("/vendor/".length);
            // Basename only, .js only: never let a request walk out of vendor/.
            if (!/^[A-Za-z0-9._-]+\.js$/.test(name) || name.includes("..")) {
                sendJson(res, 404, { error: "not found" });
                return;
            }
            try {
                const source = await readFile(join(VENDOR_DIR, name));
                res.writeHead(200, {
                    "Content-Type": "text/javascript; charset=utf-8",
                    "Cache-Control": "public, max-age=86400",
                });
                res.end(source);
            } catch {
                sendJson(res, 404, { error: `${name} is not bundled` });
            }
            return;
        }

        if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
            const routing = await loadRouting();
            const catalog = await fetchCatalog(session, { providerLabels: routing.providerLabels });
            const benchmarks = await fetchBenchmarks();
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(
                renderHtml({
                    routing,
                    catalog,
                    benchmarks,
                    effortLevels: EFFORT_LEVELS,
                    subagentTypes: BUILTIN_SUBAGENT_TYPES,
                    modelPolicies: MODEL_POLICIES,
                })
            );
            return;
        }

        sendJson(res, 404, { error: "not found" });
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    entry.server = server;
    entry.url = `http://127.0.0.1:${port}/`;
    return entry;
}

const session = await joinSession({
    workflows: [planThenExecute],
    hooks: {
        onSessionStart: async () => {
            const routing = await loadRouting();
            await applySubagentSettings(session, routing);
            const catalog = await fetchCatalog(session, { providerLabels: routing.providerLabels });
            return { additionalContext: policyProse(routing, catalog.providers) };
        },
    },
    canvases: [
        createCanvas({
            id: "model-router",
            displayName: "Model Router",
            description:
                "Shows and edits which model handles planning, bulk execution, verification, and each pinned subagent type.",
            inputSchema: { type: "object", properties: {} },
            actions: [
                {
                    name: "get_routing",
                    description: "Read the current model routing policy and the available model catalog.",
                    handler: async () => {
                        const routing = await loadRouting();
                        const catalog = await fetchCatalog(session, {
                            providerLabels: routing.providerLabels,
                        });
                        return {
                            routing,
                            catalog,
                            subagentTypes: BUILTIN_SUBAGENT_TYPES,
                            modelPolicies: MODEL_POLICIES,
                        };
                    },
                },
                {
                    name: "get_catalog",
                    description:
                        "List the models and providers available to this session, read live from the runtime.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            refresh: {
                                type: "boolean",
                                description: "Bypass the cache and re-read the list from the runtime.",
                            },
                        },
                    },
                    handler: async (ctx) => {
                        const routing = await loadRouting();
                        return await fetchCatalog(session, {
                            refresh: ctx.input?.refresh === true,
                            providerLabels: routing.providerLabels,
                        });
                    },
                },
                {
                    name: "get_benchmarks",
                    description:
                        "Public benchmark scores (reasoning, coding, agent, latency) for models, with vendor and price.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            refresh: {
                                type: "boolean",
                                description: "Re-download the snapshot instead of using the cached one.",
                            },
                        },
                    },
                    handler: async (ctx) => await fetchBenchmarks({ refresh: ctx.input?.refresh === true }),
                },
                {
                    name: "refresh_data",
                    description:
                        "Re-download the public model metadata snapshot and re-read the live model catalog.",
                    handler: async () => {
                        const routing = await loadRouting();
                        const [catalog, benchmarks] = await Promise.all([
                            fetchCatalog(session, {
                                refreshData: true,
                                providerLabels: routing.providerLabels,
                            }),
                            fetchBenchmarks({ refresh: true }),
                        ]);
                        return { catalog, benchmarks };
                    },
                },
                {
                    name: "set_routing",
                    description:
                        "Merge a routing patch. Shape: { roles?: { plan|execute|verify: { model, effort } }, " +
                        "subagents?: { agents?: { <type>: { model, effortLevel, contextTier, modelPolicy } }, " +
                        "maxConcurrency?, maxDepth? } }.",
                    inputSchema: { type: "object", properties: {} },
                    handler: async (ctx) => {
                        const routing = await saveRouting(ctx.input ?? {});
                        await applySubagentSettings(session, routing);
                        return { routing };
                    },
                },
                {
                    name: "reset_routing",
                    description: "Restore the built-in default routing policy.",
                    handler: async () => {
                        const routing = await resetRouting();
                        await applySubagentSettings(session, routing);
                        return { routing };
                    },
                },
                {
                    name: "apply_subagent_settings",
                    description: "Re-apply the persisted routing to the live session's subagent settings.",
                    handler: async () => {
                        const routing = await loadRouting();
                        const applied = await applySubagentSettings(session, routing);
                        return { applied, subagents: toSubagentSettings(routing) };
                    },
                },
            ],
            // Boot a loopback server on an ephemeral port and hand the URL to
            // the host. Re-opens with the same instanceId reuse the server.
            open: async (ctx) => {
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer(session);
                    servers.set(ctx.instanceId, entry);
                }
                return { title: "Model Router", status: "live", url: entry.url };
            },
            // Tear the per-instance server down so ports are not leaked.
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (!entry) return;
                servers.delete(ctx.instanceId);
                for (const client of entry.clients) client.end();
                await new Promise((resolve) => entry.server.close(() => resolve()));
            },
        }),
    ],
});

// onSessionStart only fires on start/resume, so apply once at load time too —
// that covers an extension loaded into an already-running session.
const initialRouting = await loadRouting();
await applySubagentSettings(session, initialRouting);
const initialCatalog = await fetchCatalog(session, {
    providerLabels: initialRouting.providerLabels,
});
const modelCount = initialCatalog.providers.reduce((total, group) => total + group.models.length, 0);
await session.log(
    `model-router: plan-then-execute workflow registered; routing policy active; ` +
        `${modelCount} models from ${initialCatalog.providers.length} provider(s) (${initialCatalog.source}).`
);
