// Computes the next patch version for the extension manifest (package.json).
// The release workflow runs it as `node scripts/release-version.mjs <current>`;
// model-router/test/release-version.test.mjs covers it with a lazy import so
// installed copies (install.ps1 does not copy scripts/) skip instead of failing
// to load.

import { pathToFileURL } from "node:url";

const SEMVER = /^\d+\.\d+\.\d+$/;

export function nextVersion(current) {
    const normalized = String(current).trim();
    if (!SEMVER.test(normalized)) {
        throw new Error(`not a release version (expected x.y.z): ${current}`);
    }
    const [major, minor, patch] = normalized.split(".").map(Number);
    return `${major}.${minor}.${patch + 1}`;
}

const isCli = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isCli) {
    if (process.argv[2] === undefined) {
        console.error("usage: node scripts/release-version.mjs <x.y.z>");
        process.exit(1);
    }
    try {
        console.log(nextVersion(process.argv[2]));
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}
