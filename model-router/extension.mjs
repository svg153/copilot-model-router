// Extension: model-router
//
// Three things in one extension:
//   1. A canvas panel showing and editing the model routing policy.
//   2. The "plan-then-execute" Dynamic Workflow: orchestrate, plan, execute,
//      and independently verify using four configured stage models.
//   3. Session-start wiring that pins the subagent models on the live session
//      and tells the agent which model to use for what.
//
// Routing config lives at $COPILOT_HOME/extensions/model-router/artifacts/routing.json
// so it is user-global and inspectable on disk.

import { join } from "node:path";
import { joinSession, createCanvas } from "@github/copilot-sdk/extension";
import {
    ARTIFACT_DIR,
    BUILTIN_SUBAGENT_TYPES,
    DEFAULT_PROVIDER_LABELS,
    MODEL_POLICIES,
    buildFallbackCatalog,
    catalogDiagnostics,
    loadRouting,
    normalizeCatalog,
    policyProse,
    resetRouting,
    saveRouting,
    setDefaultCatalogLoader,
    toSubagentSettings,
} from "./routing.mjs";
import {
    SNAPSHOT_REPO,
    SNAPSHOT_URL,
    benchmarkRows,
    loadEnrichment,
    resetEnrichmentCache,
} from "./enrichment.mjs";
import { planThenExecute } from "./workflow.mjs";
import { startServer as startHttpServer } from "./server.mjs";

/** Machine-local copy of the downloaded snapshot, so the TTL survives restarts. */
const ENRICHMENT_CACHE_FILE = join(ARTIFACT_DIR, "models-enriched.cache.json");

/** One loopback server per open canvas instance: instanceId -> { server, url, clients } */
const servers = new Map();

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
            fetchedAt: new Date().toISOString(),
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
            fetchedAt: new Date().toISOString(),
            diagnostic:
                "The session model-list RPC failed or returned no model entries; see the extension log for the runtime error. " +
                "The fallback catalog is display-only and cannot confirm availability.",
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
    // HTTP layer lives in server.mjs so it can be tested without the SDK runtime.
    return startHttpServer({
        fetchCatalog: (opts) => fetchCatalog(session, opts),
        fetchBenchmarks,
        applySubagentSettings: (routing) => applySubagentSettings(session, routing),
    });
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
                "Shows and edits which model handles orchestration, planning, bulk execution, verification, and each pinned subagent type.",
            inputSchema: { type: "object", properties: {} },
            actions: [
                {
                    name: "get_routing",
                    description: "Read routing and the models exposed by this session's runtime, with configured-role availability diagnostics.",
                    handler: async () => {
                        const routing = await loadRouting();
                        const catalog = await fetchCatalog(session, {
                            providerLabels: routing.providerLabels,
                        });
                        return {
                            routing,
                            catalog,
                            diagnostics: catalogDiagnostics(routing, catalog),
                            subagentTypes: BUILTIN_SUBAGENT_TYPES,
                            modelPolicies: MODEL_POLICIES,
                        };
                    },
                },
                {
                    name: "get_catalog",
                    description:
                        "List models exposed by this session runtime. This does not read app provider settings or verify provider credentials.",
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
                        const catalog = await fetchCatalog(session, {
                            refresh: ctx.input?.refresh === true,
                            providerLabels: routing.providerLabels,
                        });
                        return { ...catalog, diagnostics: catalogDiagnostics(routing, catalog) };
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
                        "Merge a routing patch. Shape: { roles?: { orchestrate|plan|execute|verify: { model, effort } }, " +
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
//
// Registered before the first loadRouting() so a machine with no saved config
// derives its defaults from the catalog it actually has.
setDefaultCatalogLoader(async () => (await fetchCatalog(session, {})).providers);
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
