import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts", "build-data.mjs");

// install.ps1 copies model-router/ without scripts/, and every lookup below is
// repo-root-relative: in an installed copy spawnSync would fail with ENOENT.
// The SCRIPT path doubles as the repo-layout sentinel, so skip instead.
const REPO_ONLY_SKIP = existsSync(SCRIPT)
    ? false
    : "installed copy: scripts/build-data.mjs is not present (repo-only test)";

function run(args, env = {}) {
    return spawnSync(process.execPath, [SCRIPT, ...args], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        env: { ...process.env, ...env },
    });
}

test("--verify checks every committed artifact against data/manifest.json", { skip: REPO_ONLY_SKIP }, () => {
    const res = run(["--verify"]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /All \d+ artifacts match/);
    assert.doesNotMatch(res.stdout, /FAIL/);
});

test("--verify exits 2 when the manifest is missing", { skip: REPO_ONLY_SKIP }, () => {
    const res = run(["--verify"], { MODEL_ROUTER_DATA_OUT: join(tmpdir(), "mr-no-such-dir", "models-enriched.json") });
    assert.equal(res.status, 2);
    assert.match(res.stdout + res.stderr, /cannot read manifest/i);
});

test("manifest.json records sha256 per artifact and per downloaded source", { skip: REPO_ONLY_SKIP }, () => {
    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "model-router", "data", "manifest.json"), "utf8"));
    assert.equal(manifest.algorithm, "sha256");
    assert.ok(manifest.artifacts["model-router/data/models-enriched.json"]?.sha256.match(/^[0-9a-f]{64}$/));
    assert.ok(manifest.artifacts["model-router/vendor/three.module.min.js"]?.sha256.match(/^[0-9a-f]{64}$/));
    assert.ok(Object.keys(manifest.sources).length >= 2);
    for (const [url, info] of Object.entries(manifest.sources)) {
        assert.match(info.sha256, /^[0-9a-f]{64}$/, url);
    }
});

// Timestamp preservation is the no-op-refresh guarantee: a rebuild with
// unchanged content must emit byte-identical output (so the scheduled
// workflow has no diff to open a PR for), while any changed hash must get a
// fresh stamp (so real upstream changes are never dropped). The helper is
// imported lazily so installed copies without scripts/ still skip cleanly.

test("unchanged content reuses the previous timestamp byte-for-byte", { skip: REPO_ONLY_SKIP }, async () => {
    const { preservePreviousTimestamp } = await import("../../scripts/timestamps.mjs");

    const previousManifest = {
        schema: 1,
        generatedAt: "2026-10-01T00:00:00.000Z",
        algorithm: "sha256",
        artifacts: { "model-router/data/models-enriched.json": { sha256: "a".repeat(64), bytes: 42 } },
        sources: { "https://models.dev/api.json": { sha256: "b".repeat(64) } },
    };
    const freshManifest = { ...structuredClone(previousManifest), generatedAt: "2026-11-03T04:00:00.000Z" };
    assert.equal(preservePreviousTimestamp(freshManifest, previousManifest, ["generatedAt"]), true);
    assert.equal(JSON.stringify(freshManifest), JSON.stringify(previousManifest));

    const previousPayload = {
        meta: { schema: 1, generatedAt: "2026-10-01T00:00:00.000Z", counts: { models: 1 } },
        models: [{ id: "m", vendor: "Anthropic" }],
    };
    const freshPayload = { ...previousPayload, meta: { ...previousPayload.meta, generatedAt: "2026-11-03T04:00:00.000Z" } };
    assert.equal(preservePreviousTimestamp(freshPayload, previousPayload, ["meta", "generatedAt"]), true);
    assert.equal(JSON.stringify(freshPayload), JSON.stringify(previousPayload));
});

test("a changed artifact or source hash gets a fresh timestamp", { skip: REPO_ONLY_SKIP }, async () => {
    const { preservePreviousTimestamp } = await import("../../scripts/timestamps.mjs");
    const previous = {
        schema: 1,
        generatedAt: "2026-10-01T00:00:00.000Z",
        algorithm: "sha256",
        artifacts: { "model-router/data/models-enriched.json": { sha256: "a".repeat(64), bytes: 42 } },
        sources: { "https://models.dev/api.json": { sha256: "b".repeat(64) } },
    };

    const changedArtifact = {
        ...structuredClone(previous),
        generatedAt: "2026-11-03T04:00:00.000Z",
        artifacts: { "model-router/data/models-enriched.json": { sha256: "c".repeat(64), bytes: 42 } },
    };
    assert.equal(preservePreviousTimestamp(changedArtifact, previous, ["generatedAt"]), false);
    assert.equal(changedArtifact.generatedAt, "2026-11-03T04:00:00.000Z");

    const changedSource = {
        ...structuredClone(previous),
        generatedAt: "2026-11-03T04:00:00.000Z",
        sources: { "https://models.dev/api.json": { sha256: "d".repeat(64) } },
    };
    assert.equal(preservePreviousTimestamp(changedSource, previous, ["generatedAt"]), false);
    assert.equal(changedSource.generatedAt, "2026-11-03T04:00:00.000Z");
});

test("a missing or unstamped previous document keeps the fresh timestamp", { skip: REPO_ONLY_SKIP }, async () => {
    const { preservePreviousTimestamp } = await import("../../scripts/timestamps.mjs");
    const fresh = { generatedAt: "2026-11-03T04:00:00.000Z", schema: 1 };
    assert.equal(preservePreviousTimestamp({ ...fresh }, { schema: 1, generatedAt: null }, ["generatedAt"]), false);
    assert.equal(preservePreviousTimestamp({ ...fresh }, {}, ["generatedAt"]), false);
    assert.equal(preservePreviousTimestamp({ ...fresh }, null, ["generatedAt"]), false);
    assert.equal(fresh.generatedAt, "2026-11-03T04:00:00.000Z");
});
