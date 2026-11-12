// Tests for P1-1 "Guardar protegido": content-fingerprint revisions, 412
// conflict on stale saves, single-step undo via routing.json.bak, and the
// /defaults preview the reset modal diffs against.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";

// Same isolation as extension.test.mjs: COPILOT_HOME must be set before the
// import so routing.mjs resolves ARTIFACT_DIR to a throwaway directory.
const home = await mkdtemp(join(tmpdir(), "model-router-save-protection-"));
process.env.COPILOT_HOME = home;
const artifacts = join(home, "extensions", "model-router", "artifacts");
await mkdir(artifacts, { recursive: true });
const routingFile = join(artifacts, "routing.json");
const backupFile = `${routingFile}.bak`;
await writeFile(
    routingFile,
    JSON.stringify({
        version: 1,
        roles: { plan: { model: "custom/plan", effort: "high" } },
        subagents: { agents: {} },
    })
);

const { startServer } = await import("../server.mjs");

let entry;
let appliedCount = 0;

before(async () => {
    entry = await startServer({
        fetchCatalog: async () => ({ providers: [], source: "fallback", fetchedAt: "2026-11-12T00:00:00.000Z" }),
        fetchBenchmarks: async () => ({ rows: [], meta: {}, source: "none" }),
        applySubagentSettings: async () => {
            appliedCount += 1;
            return true;
        },
    });
});

after(async () => {
    await new Promise((resolve) => entry.server.close(resolve));
    await rm(home, { recursive: true, force: true });
});

const base = () => entry.url;
const postJson = (path, body) =>
    fetch(`${base()}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Router-Token": entry.token },
        body: JSON.stringify(body ?? {}),
    });

test("GET /routing exposes a content revision alongside the config", async () => {
    const res = await fetch(`${base()}routing`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(String(body.revision), /^[0-9a-f]{16}$|^absent$/);
});

test("POST /routing with a stale baseRevision returns 412 and does not write", async () => {
    const stale = "deadbeefdeadbeef";
    const res = await postJson("routing", { roles: { plan: { model: "custom/other" } }, baseRevision: stale });
    assert.equal(res.status, 412);
    const body = await res.json();
    assert.equal(body.conflict, true);
    assert.equal(body.routing.roles.plan.model, "custom/plan");
    assert.match(String(body.revision), /^[0-9a-f]{16}$|^absent$/);
    const onDisk = JSON.parse(await readFile(routingFile, "utf8"));
    assert.equal(onDisk.roles.plan.model, "custom/plan");
});

test("POST /routing with the current baseRevision saves and advances the revision", async () => {
    const { revision } = await (await fetch(`${base()}routing`)).json();
    const res = await postJson("routing", { roles: { plan: { model: "custom/next" } }, baseRevision: revision });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.routing.roles.plan.model, "custom/next");
    assert.notEqual(body.revision, revision);
    const again = await (await fetch(`${base()}routing`)).json();
    assert.equal(again.revision, body.revision);
});

test("POST /undo restores the previous state exactly once per swap, then reapplies", async () => {
    const before = appliedCount;
    const current = JSON.parse(await readFile(routingFile, "utf8"));
    assert.equal(current.roles.plan.model, "custom/next");

    const res = await postJson("undo");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.routing.roles.plan.model, "custom/plan");
    assert.equal(appliedCount, before + 1);

    // The swap kept the discarded state in the backup: a second undo replays it.
    const redo = await postJson("undo");
    assert.equal(redo.status, 200);
    const redoBody = await redo.json();
    assert.equal(redoBody.routing.roles.plan.model, "custom/next");
});

test("POST /undo without a backup fails with a human-readable 400", async () => {
    await unlink(backupFile).catch(() => {});
    const res = await postJson("undo");
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /versión anterior/i);
});

test("GET /defaults previews the reset target without touching disk", async () => {
    const onDiskBefore = await readFile(routingFile, "utf8");
    const res = await fetch(`${base()}defaults`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.routing.version, 1);
    assert.ok(body.routing.roles && body.routing.subagents);
    assert.equal(await readFile(routingFile, "utf8"), onDiskBefore);
});
