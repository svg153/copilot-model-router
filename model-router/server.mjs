// Loopback HTTP server for the Model Router canvas.
//
// Split out of extension.mjs so the request handler can be exercised in tests
// without the Copilot SDK runtime: everything that needs the live session
// (catalog fetch, benchmark fetch, subagent settings push) is injected as an
// already-bound dependency.

import { createServer } from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    EFFORT_LEVELS,
    BUILTIN_SUBAGENT_TYPES,
    MODEL_POLICIES,
    catalogDiagnostics,
    loadRouting,
    resetRouting,
    saveRouting,
} from "./routing.mjs";
import { renderHtml } from "./renderer/index.mjs";

const MAX_BODY_BYTES = 256 * 1024;

const HERE = dirname(fileURLToPath(import.meta.url));

/** Bundled third-party assets (three.js), served to the 3D tab. See vendor/README.md. */
const VENDOR_DIR = join(HERE, "vendor");

function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(body);
}

/**
 * Constant-time token comparison. Hashing first fixes both lengths so
 * timingSafeEqual never throws, and the compare leaks nothing about the
 * secret regardless of how far the attacker's guess gets.
 */
function tokenMatches(candidate, expected) {
    const hash = (value) =>
        createHash("sha256").update(typeof value === "string" ? value : String(value ?? "")).digest();
    return timingSafeEqual(hash(candidate), hash(expected));
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

function broadcastRouting(entry, routing) {
    const payload = `event: routing\ndata: ${JSON.stringify(routing)}\n\n`;
    for (const client of entry.clients) client.write(payload);
}

/**
 * Boot a loopback server on an ephemeral port.
 *
 * deps: { fetchCatalog, fetchBenchmarks, applySubagentSettings } — each already
 * bound to the live session by extension.mjs.
 */
export async function startServer(deps) {
    const { fetchCatalog, fetchBenchmarks, applySubagentSettings } = deps;
    const entry = { server: null, url: "", clients: new Set(), token: "" };
    // Per-instance secret handed to the canvas only through the rendered HTML.
    // Mutations must echo it back, so other local processes or rebound DNS
    // names cannot rewrite the routing policy. No Access-Control-Allow-Origin
    // header is ever sent: cross-origin pages cannot read or touch this server.
    const token = randomBytes(16).toString("hex");
    entry.token = token;
    let boundPort = 0;

    const server = createServer(async (req, res) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");

        // DNS-rebinding guard: only answer for the loopback host we bound to.
        const host = req.headers.host ?? "";
        if (boundPort && host !== `127.0.0.1:${boundPort}`) {
            sendJson(res, 403, { error: "unexpected Host" });
            return;
        }

        if (req.method === "POST" && !tokenMatches(req.headers["x-router-token"], token)) {
            sendJson(res, 403, { error: "missing or invalid X-Router-Token" });
            return;
        }

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
            const catalog = await fetchCatalog({
                refresh: url.searchParams.get("refresh") === "1",
                providerLabels: routing.providerLabels,
            });
            sendJson(res, 200, { catalog, diagnostics: catalogDiagnostics(routing, catalog) });
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
                const applied = await applySubagentSettings(routing);
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
            const catalog = await fetchCatalog({ providerLabels: routing.providerLabels });
            const benchmarks = await fetchBenchmarks();
            res.writeHead(200, {
                "Content-Type": "text/html; charset=utf-8",
                // frame-ancestors 'none': an external page that guesses the
                // ephemeral loopback port must not iframe the canvas and drive
                // it with the BOOT.routerToken it can read there. The inline
                // allowances cover exactly what renderHtml emits (inline module
                // scripts + <style>); everything else stays same-origin.
                "Content-Security-Policy":
                    "default-src 'self'; script-src 'self' 'unsafe-inline'; " +
                    "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
                    "font-src 'self' data:; connect-src 'self'; worker-src blob: 'self'; " +
                    "object-src 'none'; frame-ancestors 'none'",
            });
            res.end(
                renderHtml({
                    routing,
                    catalog,
                    catalogDiagnostics: catalogDiagnostics(routing, catalog),
                    benchmarks,
                    effortLevels: EFFORT_LEVELS,
                    subagentTypes: BUILTIN_SUBAGENT_TYPES,
                    modelPolicies: MODEL_POLICIES,
                    routerToken: token,
                })
            );
            return;
        }

        sendJson(res, 404, { error: "not found" });
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    boundPort = port;
    entry.server = server;
    entry.url = `http://127.0.0.1:${port}/`;
    return entry;
}
