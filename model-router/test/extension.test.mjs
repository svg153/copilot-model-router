import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";

// Isolate the routing file the same way routing.test.mjs does; must be set
// before importing server.mjs (routing.mjs resolves ARTIFACT_DIR at import).
const home = await mkdtemp(join(tmpdir(), "model-router-server-"));
process.env.COPILOT_HOME = home;
const artifacts = join(home, "extensions", "model-router", "artifacts");
await mkdir(artifacts, { recursive: true });
const routingFile = join(artifacts, "routing.json");
await writeFile(
    routingFile,
    JSON.stringify({
        version: 1,
        roles: {
            orchestrate: { model: "custom/orch", effort: "high" },
            plan: { model: "custom/plan", effort: "high" },
            execute: { model: "custom/execute", effort: "low" },
            verify: { model: "custom/verify", effort: "medium" },
        },
        subagents: { agents: {} },
    })
);

const { startServer } = await import("../server.mjs");

const stubCatalog = {
    providers: [{ id: "custom", label: "Custom", models: [{ id: "custom/plan", label: "Plan" }] }],
    source: "fallback",
    fetchedAt: "2026-11-02T00:00:00.000Z",
};

let entry;
let appliedCalls = 0;

before(async () => {
    entry = await startServer({
        fetchCatalog: async () => stubCatalog,
        fetchBenchmarks: async () => ({ rows: [], meta: {}, source: "none" }),
        applySubagentSettings: async () => {
            appliedCalls += 1;
            return true;
        },
    });
});

after(async () => {
    await new Promise((resolve) => entry.server.close(resolve));
    await rm(home, { recursive: true, force: true });
});

const base = () => entry.url;

test("GET /routing returns the persisted routing config", async () => {
    const res = await fetch(`${base()}routing`);
    assert.equal(res.status, 200);
    const { routing } = await res.json();
    assert.equal(routing.roles.plan.model, "custom/plan");
});

test("POST /routing round-trips: save, read back, persist on disk, apply settings", async () => {
    const res = await fetch(`${base()}routing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Router-Token": entry.token },
        body: JSON.stringify({ roles: { plan: { model: "custom/next" } } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.applied, true);
    assert.equal(body.routing.roles.plan.model, "custom/next");

    const again = await (await fetch(`${base()}routing`)).json();
    assert.equal(again.routing.roles.plan.model, "custom/next");

    const onDisk = JSON.parse(await readFile(routingFile, "utf8"));
    assert.equal(onDisk.roles.plan.model, "custom/next");
    assert.equal(appliedCalls, 1);

    // Other roles are untouched by a partial patch.
    assert.equal(again.routing.roles.execute.model, "custom/execute");
});

test("POST /routing rejects invalid JSON with 400 and does not apply settings", async () => {
    const before = appliedCalls;
    const res = await fetch(`${base()}routing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Router-Token": entry.token },
        body: "{not-json",
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /valid JSON/);
    assert.equal(appliedCalls, before);
});

test("/vendor serves bundled js only and blocks path traversal", async () => {
    const ok = await fetch(`${base()}vendor/three.module.min.js`);
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get("content-type"), /javascript/);

    const missing = await fetch(`${base()}vendor/nope.js`);
    assert.equal(missing.status, 404);

    // Encoded traversal stays inside the guard: never resolves outside vendor/.
    const traversal = await fetch(`${base()}vendor/%2e%2e%2frouting.mjs`);
    assert.equal(traversal.status, 404);

    const nonJs = await fetch(`${base()}vendor/README.md`);
    assert.equal(nonJs.status, 404);
});

test("GET / renders the canvas html; unknown paths 404", async () => {
    const html = await fetch(`${base()}index.html`);
    assert.equal(html.status, 200);
    assert.match(html.headers.get("content-type"), /text\/html/);
    const text = await html.text();
    assert.match(text, /<model-router|Model Router|model-routing/i);

    const nope = await fetch(`${base()}definitely-not-a-route`);
    assert.equal(nope.status, 404);
});

test("mutations require the per-server token; 403 without it", async () => {
    const noToken = await fetch(`${base()}routing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: { plan: { model: "evil/x" } } }),
    });
    assert.equal(noToken.status, 403);

    const wrongToken = await fetch(`${base()}routing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Router-Token": "deadbeef" },
        body: JSON.stringify({ roles: { plan: { model: "evil/x" } } }),
    });
    assert.equal(wrongToken.status, 403);

    // The rejected writes must not have landed.
    const routing = (await (await fetch(`${base()}routing`)).json()).routing;
    assert.notEqual(routing.roles.plan.model, "evil/x");
});

test("served html embeds the token so the canvas can echo it back", async () => {
    const text = await (await fetch(`${base()}index.html`)).text();
    assert.ok(text.includes(entry.token), "BOOT should carry the per-server token");
});

test("spoofed Host header (DNS rebinding) is rejected", async () => {
    const { request } = await import("node:http");
    const { port } = new URL(entry.url);
    const status = await new Promise((resolve, reject) => {
        const req = request(
            { host: "127.0.0.1", port, path: "/routing", headers: { Host: "evil.example" } },
            (res) => {
                res.resume();
                resolve(res.statusCode);
            }
        );
        req.on("error", reject);
        req.end();
    });
    assert.equal(status, 403);
});

test("no Access-Control-Allow-Origin header is ever sent", async () => {
    for (const path of ["routing", "index.html", "vendor/three.module.min.js"]) {
        const res = await fetch(`${base()}${path}`);
        await res.arrayBuffer();
        assert.equal(res.headers.get("access-control-allow-origin"), null, path);
    }
});

test("canvas HTML carries Content-Security-Policy with frame-ancestors 'none'", async () => {
    const res = await fetch(`${base()}`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    const csp = res.headers.get("content-security-policy");
    assert.ok(csp, "CSP header missing on GET /");
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /default-src 'self'/);
});
