import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts", "build-data.mjs");

function run(args, env = {}) {
    return spawnSync(process.execPath, [SCRIPT, ...args], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        env: { ...process.env, ...env },
    });
}

test("--verify checks every committed artifact against data/manifest.json", () => {
    const res = run(["--verify"]);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /All \d+ artifacts match/);
    assert.doesNotMatch(res.stdout, /FAIL/);
});

test("--verify exits 2 when the manifest is missing", () => {
    const res = run(["--verify"], { MODEL_ROUTER_DATA_OUT: join(tmpdir(), "mr-no-such-dir", "models-enriched.json") });
    assert.equal(res.status, 2);
    assert.match(res.stdout + res.stderr, /cannot read manifest/i);
});

test("manifest.json records sha256 per artifact and per downloaded source", () => {
    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "model-router", "data", "manifest.json"), "utf8"));
    assert.equal(manifest.algorithm, "sha256");
    assert.ok(manifest.artifacts["model-router/data/models-enriched.json"]?.sha256.match(/^[0-9a-f]{64}$/));
    assert.ok(manifest.artifacts["model-router/vendor/three.module.min.js"]?.sha256.match(/^[0-9a-f]{64}$/));
    assert.ok(Object.keys(manifest.sources).length >= 2);
    for (const [url, info] of Object.entries(manifest.sources)) {
        assert.match(info.sha256, /^[0-9a-f]{64}$/, url);
    }
});
