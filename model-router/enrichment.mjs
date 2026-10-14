// Public model metadata (vendor, price, benchmarks, speed) joined onto the
// session's live catalog.
//
// The runtime tells us which models exist and what they cost against the
// Copilot plan, but it says nothing about who makes a BYOK model, what it costs
// per token, or how well it scores. That information comes from a snapshot built
// by scripts/build-data.mjs and refreshed weekly by a GitHub Action.
//
// Resolution order, so a fresh machine with no network still gets a full panel:
//   1. downloaded copy in artifacts/ (freshest, TTL-bounded)
//   2. the snapshot committed next to this file (always present, works offline)
//   3. heuristics on the model id (for a model newer than the snapshot)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export const SNAPSHOT_FILE = join(HERE, "data", "models-enriched.json");

/** Repo the weekly Action pushes the snapshot to. */
export const SNAPSHOT_REPO = "svg153/copilot-model-router";
export const SNAPSHOT_URL = `https://raw.githubusercontent.com/${SNAPSHOT_REPO}/main/model-router/data/models-enriched.json`;

/** A week matches the Action's cadence; the file changes slowly. */
export const SNAPSHOT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Last-resort vendor guess when neither the runtime nor the snapshot knows a
 * model. Keys are matched as substrings of the id with separators stripped, so
 * "claude-opus-5.5" and "Claude Opus 5.5" both hit `claude`.
 */
const VENDOR_HINTS = [
    ["claude", "Anthropic"],
    ["opus", "Anthropic"],
    ["sonnet", "Anthropic"],
    ["haiku", "Anthropic"],
    ["gpt", "OpenAI"],
    ["openai", "OpenAI"],
    ["o1", "OpenAI"],
    ["o3", "OpenAI"],
    ["gemini", "Google"],
    ["gemma", "Google"],
    ["palm", "Google"],
    ["grok", "xAI"],
    ["deepseek", "DeepSeek"],
    ["qwen", "Alibaba"],
    ["glm", "Z.ai"],
    ["mimo", "Xiaomi"],
    ["kimi", "Moonshot AI"],
    ["moonshot", "Moonshot AI"],
    ["minimax", "MiniMax"],
    ["llama", "Meta"],
    ["mistral", "Mistral"],
    ["magistral", "Mistral"],
    ["codestral", "Mistral"],
    ["command", "Cohere"],
    ["nova", "Amazon"],
    ["phi", "Microsoft"],
    ["mai", "Microsoft"],
    ["hydrafusion", "GitHub Copilot"],
    ["nemotron", "NVIDIA"],
    ["sonar", "Perplexity"],
    ["jamba", "AI21"],
    ["step", "StepFun"],
    ["ernie", "Baidu"],
    ["hunyuan", "Tencent"],
    ["doubao", "ByteDance"],
    ["seed", "ByteDance"],
];

/**
 * The same normalization the build script uses. Both sides must agree or the
 * join silently misses, so this is duplicated deliberately rather than imported
 * (the script is not shipped with the extension).
 */
export function normalizeKey(value) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}

export function inferVendor(modelId) {
    const bare = String(modelId ?? "").split("/").pop() || "";
    const key = normalizeKey(bare);
    if (!key) return null;
    for (const [hint, vendor] of VENDOR_HINTS) {
        if (key.includes(hint)) return vendor;
    }
    return null;
}

function buildIndex(snapshot) {
    const models = snapshot?.models && typeof snapshot.models === "object" ? snapshot.models : {};
    const aliases = snapshot?.aliases && typeof snapshot.aliases === "object" ? snapshot.aliases : {};
    return { models, aliases, keys: Object.keys(models), generatedAt: snapshot?.meta?.generatedAt ?? null };
}

/**
 * Looks a runtime model id up in the snapshot.
 *
 * Exact match first. Failing that, a family match: the runtime often names a
 * family ("qwen3.6") where the snapshot only has sized variants
 * ("qwen3.6-27B"), so a unique-prefix match is still better than nothing — but
 * only the fields every candidate agrees on are trusted, so a family match can
 * supply a vendor but never a wrong price.
 */
export function lookupModel(index, modelId) {
    if (!index || !modelId) return null;
    const bare = String(modelId).split("/").pop();
    const key = normalizeKey(bare);
    if (!key) return null;

    if (index.models[key]) return { entry: index.models[key], match: "exact" };
    const aliased = index.aliases[key];
    if (aliased && index.models[aliased]) return { entry: index.models[aliased], match: "exact" };

    const narrower = [];
    const broader = [];
    for (const candidate of index.keys) {
        if (candidate === key || candidate.length < 4) continue;
        if (candidate.startsWith(key)) narrower.push(candidate);
        else if (key.startsWith(candidate)) broader.push(candidate);
    }
    const family = narrower.length ? narrower : broader;
    if (!family.length) return null;

    const entries = family.map((candidate) => index.models[candidate]).filter(Boolean);
    if (!entries.length) return null;

    const vendors = new Set(entries.map((entry) => entry.vendor).filter(Boolean));
    const tiers = new Set(entries.map((entry) => entry.tier).filter(Boolean));
    const blended = new Set(entries.map((entry) => entry.blendedCost).filter((v) => typeof v === "number"));

    const entry = { familyMatch: true, vendor: vendors.size === 1 ? [...vendors][0] : null };
    if (tiers.size === 1 && blended.size === 1) {
        entry.tier = [...tiers][0];
        entry.blendedCost = [...blended][0];
    }
    return { entry, match: "family" };
}

/**
 * Merges snapshot fields onto one catalog model. Runtime values win where the
 * runtime actually knows something (it is authoritative for Copilot billing and
 * for the vendor it reports); the snapshot fills the gaps.
 */
export function applyEnrichment(model, index) {
    const hit = lookupModel(index, model.id);
    const entry = hit?.entry ?? null;
    const exact = hit?.match === "exact";
    const heuristic = inferVendor(model.id);

    const vendor = (exact && entry?.vendor) || model.vendor || entry?.vendor || heuristic || null;

    return {
        ...model,
        // The normalized key the benchmark snapshot uses, so the client can match
        // a catalog model against a public leaderboard row without guessing.
        key: normalizeKey(model.id),
        vendor,
        // How the vendor was established, so the UI can be honest about guesses.
        vendorSource: model.vendor
            ? "runtime"
            : exact && entry?.vendor
              ? "snapshot"
              : entry?.vendor
                ? "family"
                : heuristic
                  ? "heuristic"
                  : null,
        tier: entry?.tier || model.tier,
        enrichment: hit?.match ?? null,
        context: entry?.context ?? null,
        reasoning: entry?.reasoning ?? null,
        effortOptions: entry?.effortOptions ?? null,
        cost: entry?.cost ?? null,
        blendedCost: entry?.blendedCost ?? null,
        bench: entry?.bench ?? null,
        rank: entry?.rank ?? null,
        rawBenchmarks: entry?.rawBenchmarks ?? null,
        speed: entry?.speed ?? null,
        latencyS: entry?.latencyS ?? null,
        costPer1kCny: entry?.costPer1kCny ?? null,
        releaseDate: entry?.releaseDate ?? null,
        openWeights: entry?.openWeights ?? null,
        family: entry?.family ?? null,
        familyMatch: entry?.familyMatch === true,
        sources: entry?.sources ?? [],
    };
}

async function readJson(file) {
    try {
        return JSON.parse(await readFile(file, "utf8"));
    } catch {
        return null;
    }
}

async function fetchSnapshot(url, timeoutMs = 8000) {
    try {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(timeoutMs),
            headers: { "user-agent": "copilot-model-router" },
        });
        if (!response.ok) return null;
        const parsed = await response.json();
        return parsed?.models ? parsed : null;
    } catch {
        return null;
    }
}

let cache = null;

/** Newer of two snapshots, ignoring ones with no usable body. */
function newest(candidates) {
    return candidates
        .filter((snapshot) => snapshot?.models && Object.keys(snapshot.models).length)
        .sort(
            (a, b) =>
                Date.parse(b?.meta?.generatedAt ?? 0) - Date.parse(a?.meta?.generatedAt ?? 0)
        )[0] ?? null;
}

/**
 * Loads the snapshot, refreshing from GitHub when the copy on hand is older than
 * the TTL. Never throws: a panel with stale data beats a panel that fails.
 */
export async function loadEnrichment({ force = false, cacheFile = null } = {}) {
    if (cache && !force) return cache;

    const bundled = await readJson(SNAPSHOT_FILE);
    const downloaded = cacheFile ? await readJson(cacheFile) : null;
    let snapshot = newest([bundled, downloaded]) ?? bundled;

    const age = Date.now() - Date.parse(snapshot?.meta?.generatedAt ?? 0);
    if (force || !Number.isFinite(age) || age > SNAPSHOT_TTL_MS) {
        const remote = await fetchSnapshot(SNAPSHOT_URL);
        const better = newest([snapshot, remote]);
        if (better && better !== snapshot) {
            snapshot = better;
            if (cacheFile) {
                try {
                    await mkdir(dirname(cacheFile), { recursive: true });
                    await writeFile(cacheFile, JSON.stringify(snapshot), "utf8");
                } catch {
                    // A read-only home directory just means we re-fetch next time.
                }
            }
        }
    }

    cache = {
        index: buildIndex(snapshot),
        meta: snapshot?.meta ?? null,
        snapshot,
        source: snapshot && snapshot === bundled ? "bundled" : snapshot ? "downloaded" : "none",
    };
    return cache;
}

export function resetEnrichmentCache() {
    cache = null;
}

/**
 * Compact leaderboard for the canvas: only the models the snapshot actually has
 * scores for, best first. Keeping this derived (rather than shipping the raw
 * snapshot to the iframe) keeps the payload an order of magnitude smaller.
 */
export function benchmarkRows(snapshot) {
    const models = snapshot?.models && typeof snapshot.models === "object" ? snapshot.models : {};
    const rows = [];
    for (const [id, entry] of Object.entries(models)) {
        const bench = entry?.bench;
        if (!bench || !Object.keys(bench).length) continue;
        rows.push({
            id,
            label: entry.label || id,
            vendor: entry.vendor ?? null,
            tier: entry.tier ?? null,
            blendedCost: entry.blendedCost ?? null,
            context: entry.context ?? null,
            releaseDate: entry.releaseDate ?? null,
            reasoning: entry.reasoning ?? null,
            bench,
            rank: entry.rank ?? null,
            speed: entry.speed ?? null,
            latencyS: entry.latencyS ?? null,
            sources: entry.sources ?? [],
        });
    }
    return rows.sort(
        (a, b) => (b.bench.total ?? -1) - (a.bench.total ?? -1) || a.label.localeCompare(b.label)
    );
}
