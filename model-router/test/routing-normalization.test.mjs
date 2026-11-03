import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";

const home = await mkdtemp(join(tmpdir(), "model-router-normalization-"));
process.env.COPILOT_HOME = home;
const artifacts = join(home, "extensions", "model-router", "artifacts");
await mkdir(artifacts, { recursive: true });

const {
    ROUTING_FILE,
    catalogDiagnostics,
    loadRouting,
    resolveModelId,
    saveRouting,
    setDefaultCatalogLoader,
} = await import("../routing.mjs");

const PROVIDER = "c086edfb-7e83-4b80-a34e-3fd2b0c988bf";
const CANONICAL = `${PROVIDER}/qwen3.8-flash`;

/** A single-provider catalog: bare basenames are unique inside it. */
const providerCatalog = () => [
    {
        id: PROVIDER,
        label: "BYOK provider",
        models: [
            { id: CANONICAL },
            { id: `${PROVIDER}/glm5.3-flash` },
            { id: "copilot-model" },
        ],
    },
];

after(async () => {
    await rm(home, { recursive: true, force: true });
});

/** Runs `body` with the given catalog installed, then clears it again. */
async function withCatalog(catalog, body) {
    setDefaultCatalogLoader(catalog ? async () => catalog : null);
    try {
        return await body();
    } finally {
        setDefaultCatalogLoader(null);
    }
}

test("resolveModelId heals a bare id only when the catalog match is unique", () => {
    const models = providerCatalog().flatMap((group) => group.models);
    assert.equal(resolveModelId(CANONICAL, models), CANONICAL);
    assert.equal(resolveModelId("qwen3.8-flash", models), CANONICAL);
    assert.equal(resolveModelId("copilot-model", models), "copilot-model");
    // A provider-qualified id is never remapped onto another provider.
    assert.equal(resolveModelId("other/qwen3.8-flash", models), "other/qwen3.8-flash");
    // Ambiguous basename: two providers expose the same model.
    const ambiguous = [
        { models: [{ id: "p1/qwen3.8-flash" }] },
        { models: [{ id: "p2/qwen3.8-flash" }] },
    ].flatMap((group) => group.models);
    assert.equal(resolveModelId("qwen3.8-flash", ambiguous), "qwen3.8-flash");
    // No catalog, unknown name, and non-string inputs are strict no-ops.
    assert.equal(resolveModelId("qwen3.8-flash", []), "qwen3.8-flash");
    assert.equal(resolveModelId("not-a-model", models), "not-a-model");
    assert.equal(resolveModelId("", models), "");
    assert.equal(resolveModelId(undefined, models), undefined);
});

test("saveRouting persists the catalog-canonical id for a bare patch", async () => {
    await withCatalog(providerCatalog(), async () => {
        const routing = await saveRouting({
            roles: {
                plan: { model: "qwen3.8-flash", effort: "low", fallback: ["glm5.3-flash", "unknown/x"] },
            },
            subagents: {
                agents: { explore: { model: "qwen3.8-flash", modelPolicy: "required" } },
            },
        });

        assert.equal(routing.roles.plan.model, CANONICAL);
        // Fallback ids heal too; an unresolvable id stays verbatim, order kept.
        assert.deepEqual(routing.roles.plan.fallback, [`${PROVIDER}/glm5.3-flash`, "unknown/x"]);
        assert.equal(routing.subagents.agents.explore.model, CANONICAL);

        const onDisk = JSON.parse(await readFile(ROUTING_FILE, "utf8"));
        assert.equal(onDisk.roles.plan.model, CANONICAL);
        assert.deepEqual(onDisk.roles.plan.fallback, [`${PROVIDER}/glm5.3-flash`, "unknown/x"]);
        assert.equal(onDisk.subagents.agents.explore.model, CANONICAL);
    });
});

test("saveRouting leaves already-prefixed ids untouched", async () => {
    await withCatalog(providerCatalog(), async () => {
        const routing = await saveRouting({
            roles: { verify: { model: CANONICAL, effort: "medium" } },
        });
        assert.equal(routing.roles.verify.model, CANONICAL);
    });
});

test("saveRouting keeps an ambiguous bare id verbatim instead of guessing", async () => {
    const twoProviders = [
        { id: "p1", models: [{ id: "p1/qwen3.8-flash" }] },
        { id: "p2", models: [{ id: "p2/qwen3.8-flash" }] },
    ];
    await withCatalog(twoProviders, async () => {
        const routing = await saveRouting({
            roles: { execute: { model: "qwen3.8-flash", fallback: ["qwen3.8-flash"] } },
        });
        assert.equal(routing.roles.execute.model, "qwen3.8-flash");
        assert.deepEqual(routing.roles.execute.fallback, ["qwen3.8-flash"]);
    });
});

test("saveRouting does nothing to ids when no catalog is available", async () => {
    await withCatalog(null, async () => {
        const routing = await saveRouting({
            roles: { execute: { model: "qwen3.8-flash", fallback: ["glm5.3-flash"] } },
        });
        assert.equal(routing.roles.execute.model, "qwen3.8-flash");
        assert.deepEqual(routing.roles.execute.fallback, ["glm5.3-flash"]);
    });

    await withCatalog([{ id: "empty", models: [] }], async () => {
        const routing = await saveRouting({ roles: { execute: { model: "qwen3.8-flash" } } });
        assert.equal(routing.roles.execute.model, "qwen3.8-flash");
    });
});

test("loadRouting heals a bare routing.json in memory without rewriting the file", async () => {
    const bare = JSON.stringify({
        version: 1,
        roles: { plan: { model: "qwen3.8-flash", effort: "low", fallback: ["glm5.3-flash"] } },
        subagents: { agents: { explore: { model: "qwen3.8-flash", modelPolicy: "required" } } },
    });
    await writeFile(ROUTING_FILE, bare, "utf8");

    await withCatalog(providerCatalog(), async () => {
        const routing = await loadRouting();
        assert.equal(routing.roles.plan.model, CANONICAL);
        assert.deepEqual(routing.roles.plan.fallback, [`${PROVIDER}/glm5.3-flash`]);
        assert.equal(routing.subagents.agents.explore.model, CANONICAL);
        // The read path must not write: the persisted file is byte-identical.
        assert.equal(await readFile(ROUTING_FILE, "utf8"), bare);
    });

    // Without a catalog the same file loads verbatim.
    await withCatalog(null, async () => {
        const routing = await loadRouting();
        assert.equal(routing.roles.plan.model, "qwen3.8-flash");
    });
});

test("catalog diagnostics report availability for subagent pins", () => {
    const routing = {
        roles: { orchestrate: { model: "byok/deepseek-v4-flash" } },
        subagents: {
            agents: {
                explore: { model: "byok/qwen3.8-flash", modelPolicy: "required" },
                task: { model: "byok/not-listed", modelPolicy: "preferred" },
                research: {},
            },
        },
    };
    const live = catalogDiagnostics(routing, {
        source: "live",
        fetchedAt: "2026-11-02T00:00:00.000Z",
        providers: [{
            id: "byok",
            label: "BYOK",
            models: [{ id: "byok/deepseek-v4-flash" }, { id: "byok/qwen3.8-flash" }],
        }],
    });
    assert.equal(live.roles.orchestrate.available, true);
    assert.equal(live.subagents.explore.model, "byok/qwen3.8-flash");
    assert.equal(live.subagents.explore.modelPolicy, "required");
    assert.equal(live.subagents.explore.available, true);
    assert.equal(live.subagents.task.available, false);
    assert.equal(live.subagents.task.modelPolicy, "preferred");
    // Entries without a pinned model are not diagnostics.
    assert.equal("research" in live.subagents, false);

    const fallback = catalogDiagnostics(routing, {
        source: "fallback",
        providers: [{ models: [{ id: "byok/qwen3.8-flash" }] }],
    });
    assert.equal(fallback.roles.orchestrate.available, null);
    assert.equal(fallback.subagents.explore.available, null);
    assert.equal(fallback.subagents.task.available, null);
});
