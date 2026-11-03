import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import { Script } from "node:vm";

const home = await mkdtemp(join(tmpdir(), "model-router-routing-"));
process.env.COPILOT_HOME = home;
const artifacts = join(home, "extensions", "model-router", "artifacts");
await mkdir(artifacts, { recursive: true });

const { DEFAULT_ROUTING, catalogDiagnostics, defaultRoutingFor, loadRouting, policyProse, saveRouting, toSubagentSettings } =
    await import("../routing.mjs");
const { renderHtml } = await import("../renderer.mjs");

before(async () => {
    await writeFile(join(artifacts, "routing.json"), JSON.stringify({
        version: 1,
        roles: {
            plan: { model: "custom/plan", effort: "high" },
            execute: { model: "custom/execute", effort: "low" },
            verify: { model: "custom/verify", effort: "medium" },
        },
        subagents: {
            agents: { explore: { model: "custom/explorer", modelPolicy: "preferred" } },
            maxConcurrency: 2,
        },
    }));
});

after(async () => {
    await rm(home, { recursive: true, force: true });
});

test("defaults route the four stages to the requested models and effort levels", () => {
    for (const [role, model, effort] of [
        ["orchestrate", "deepseek-v4-flash", "high"],
        ["plan", "glm5.3-flash", "max"],
        ["execute", "qwen3.8-flash", "low"],
        ["verify", "mimo-v2.6-flash", "medium"],
    ]) {
        assert.ok(DEFAULT_ROUTING.roles[role].model.endsWith(model));
        assert.equal(DEFAULT_ROUTING.roles[role].effort, effort);
    }
});

test("catalog-derived defaults keep the requested model ids when unavailable", () => {
    const routing = defaultRoutingFor([{
        models: [{ id: "copilot-model", tier: "low" }],
    }]);
    assert.deepEqual(routing.roles, DEFAULT_ROUTING.roles);
    assert.ok(routing.subagents.agents.explore.model.endsWith("qwen3.8-flash"));
});

test("catalog diagnostics distinguish live-listed IDs from missing and fallback IDs", () => {
    const routing = {
        roles: {
            orchestrate: { model: "byok/deepseek-v4-flash" },
            plan: { model: "byok/glm5.3-flash" },
            execute: { model: "byok/qwen3.8-flash" },
            verify: { model: "byok/mimo-v2.6-flash" },
        },
    };
    const liveCatalog = {
        source: "live",
        fetchedAt: "2026-11-02T00:00:00.000Z",
        providers: [{
            id: "byok",
            label: "Custom provider",
            models: [
                { id: "byok/deepseek-v4-flash" },
                { id: "byok/qwen3.8-flash" },
            ],
        }],
    };
    const live = catalogDiagnostics(routing, liveCatalog);
    assert.equal(live.source, "live");
    assert.equal(live.fetchedAt, liveCatalog.fetchedAt);
    assert.equal(live.modelCount, 2);
    assert.deepEqual(live.providers, [{ id: "byok", label: "Custom provider", modelCount: 2 }]);
    assert.equal(live.roles.orchestrate.available, true);
    assert.equal(live.roles.plan.available, false);
    assert.equal(live.roles.execute.available, true);
    assert.equal(live.roles.verify.available, false);

    const fallback = catalogDiagnostics(routing, {
        source: "fallback",
        providers: [{ models: [{ id: "byok/deepseek-v4-flash" }] }],
    });
    assert.equal(fallback.roles.orchestrate.available, null);
});

test("legacy routing files gain Orchestrate defaults without losing user settings", async () => {
    const routing = await loadRouting();
    assert.deepEqual(routing.roles.orchestrate, DEFAULT_ROUTING.roles.orchestrate);
    assert.deepEqual(routing.roles.plan, { model: "custom/plan", effort: "high" });
    assert.deepEqual(routing.roles.execute, { model: "custom/execute", effort: "low" });
    assert.deepEqual(routing.roles.verify, { model: "custom/verify", effort: "medium" });
    assert.deepEqual(routing.subagents.agents.explore, {
        model: "custom/explorer",
        modelPolicy: "preferred",
    });
    assert.equal(routing.subagents.maxConcurrency, 2);
});

test("routing patches update Orchestrate and retain the other configured roles", async () => {
    const routing = await saveRouting({
        roles: { orchestrate: { model: "custom/orchestrator", effort: "xhigh" } },
    });
    assert.deepEqual(routing.roles.orchestrate, {
        model: "custom/orchestrator",
        effort: "xhigh",
    });
    assert.equal(routing.roles.plan.model, "custom/plan");
});

test("policy and canvas surface all four workflow stages", async () => {
    const routing = await loadRouting();
    const policy = policyProse(routing);
    for (const role of ["orchestrate", "plan", "execute", "verify"]) {
        assert.ok(policy.includes(`roles.${role}`) || policy.includes(routing.roles[role].model));
    }
    assert.match(policy, /must not implement changes/);

    const html = renderHtml({
        routing,
        catalog: {
            source: "live",
            fetchedAt: "2026-11-02T00:00:00.000Z",
            providers: [{
                id: "custom-provider",
                label: "Custom provider",
                models: [{ id: "custom-provider/model-exact", label: "Model exact" }],
            }],
        },
        catalogDiagnostics: {
            source: "live",
            fetchedAt: "2026-11-02T00:00:00.000Z",
            modelCount: 1,
            providers: [{ id: "custom-provider", label: "Custom provider", modelCount: 1 }],
        },
        effortLevels: ["low", "max"],
        subagentTypes: [],
        modelPolicies: [],
    });
    assert.match(html, /orchestrate → plan → execute → verify/);
    assert.match(html, /\["orchestrate", "plan", "execute", "verify"\]/);
    assert.match(html, /Live session catalog and route diagnostics/);
    assert.match(html, /Refresh live model list/);
    assert.match(html, /Add or verify a model provider/);
    assert.match(html, /does not verify provider credentials or a successful inference request/);
    assert.match(html, /custom-provider\/model-exact/);
    assert.match(html, /Custom provider/);
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script, "rendered page should include its client script");
    assert.doesNotThrow(() => new Script(script), "rendered client script should parse");
});

test("policy prose renders fallback chains as permission and subagent settings drop them", () => {
    const routing = {
        version: 1,
        roles: {
            orchestrate: { model: "prov/a", effort: "high", fallback: ["prov/b", "prov/c"] },
            plan: { model: "prov/b", effort: "medium" },
            execute: { model: "prov/c", effort: "low", fallback: [] },
            verify: { model: "prov/d", effort: "medium" },
        },
        subagents: {
            agents: {
                task: { model: "prov/t", modelPolicy: "required", fallback: ["prov/t2"] },
            },
        },
    };
    const policy = policyProse(routing);
    assert.match(policy, /prov\/a \(reasoning effort: high\) \(if it does not respond, you may also use: prov\/b, prov\/c\)/);
    assert.match(policy, /task -> prov\/t \(enforced\) \(if it does not respond, you may also use: prov\/t2\)/);
    // Empty fallback and absent fallback render no suffix.
    assert.ok(!policy.includes("prov/c (if"));
    assert.ok(!policy.includes("prov/b (reasoning effort: medium) (if"));

    // Wire shape must not gain unsupported fallback fields.
    const wire = toSubagentSettings(routing);
    assert.deepEqual(wire.agents.task, { model: "prov/t", modelPolicy: "required" });
});
