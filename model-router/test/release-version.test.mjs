// Tests for scripts/release-version.mjs. Mirrors build-data.test.mjs: an
// installed copy (install.ps1) has model-router/test/ but no scripts/, so the
// sentinel below skips these tests there and the import stays lazy so the
// module still loads.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts", "release-version.mjs");

const REPO_ONLY_SKIP = existsSync(SCRIPT)
    ? false
    : "installed copy: scripts/release-version.mjs is not present (repo-only test)";

test("nextVersion bumps only the patch component", { skip: REPO_ONLY_SKIP }, async () => {
    const { nextVersion } = await import("../../scripts/release-version.mjs");
    assert.equal(nextVersion("1.0.0"), "1.0.1");
    assert.equal(nextVersion("0.9.12"), "0.9.13");
    assert.equal(nextVersion(" 2.3.4 "), "2.3.5");
});

test("nextVersion rejects anything that is not a bare x.y.z", { skip: REPO_ONLY_SKIP }, async () => {
    const { nextVersion } = await import("../../scripts/release-version.mjs");
    for (const bad of ["1.0", "v1.0.0", "1.0.0-rc.1", "", "latest", undefined, null]) {
        assert.throws(() => nextVersion(bad), /not a release version/);
    }
});

test("CLI prints the next version and exits 0", { skip: REPO_ONLY_SKIP }, () => {
    const res = spawnSync(process.execPath, [SCRIPT, "1.2.3"], { cwd: REPO_ROOT, encoding: "utf8" });
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout.trim(), "1.2.4");
});

test("CLI rejects an invalid version with exit 1", { skip: REPO_ONLY_SKIP }, () => {
    const res = spawnSync(process.execPath, [SCRIPT, "nope"], { cwd: REPO_ROOT, encoding: "utf8" });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /not a release version/);
});
