import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";

const home = await mkdtemp(join(tmpdir(), "model-router-workflow-"));
process.env.COPILOT_HOME = home;
await mkdir(join(home, "extensions", "model-router", "artifacts"), { recursive: true });

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === "@github/copilot-sdk/extension") {
            return {
                url: "data:text/javascript,export%20const%20defineWorkflow%20%3D%20(definition)%20%3D%3E%20definition%3B",
                shortCircuit: true,
            };
        }
        return nextResolve(specifier, context);
    },
});

const { planThenExecute } = await import("../workflow.mjs");

after(async () => {
    await rm(home, { recursive: true, force: true });
});

function context(args, orchestrateOutput) {
    const calls = [];
    const phases = [];
    return {
        calls,
        phases,
        ctx: {
            args,
            runId: "test-run",
            phase: (phase) => phases.push(phase),
            log: () => {},
            agent: async (prompt, options) => {
                calls.push({ prompt, ...options });
                if (options.label === "orchestrate") return orchestrateOutput;
                if (options.label === "plan") return "Detailed plan";
                if (options.label.startsWith("exec:")) return `Completed ${options.label}`;
                if (options.label === "verify") return "Verified";
                throw new Error(`Unexpected stage: ${options.label}`);
            },
            pipeline: async (units, runUnit) =>
                Promise.all(units.map((unit, index) => runUnit([], unit, index))),
        },
    };
}

test("workflow schema and execution include all four stages and preserve model overrides", async () => {
    const stages = context(
        {
            task: "Implement the feature",
            targets: ["user target"],
            orchestrateModel: "custom/orchestrate",
            planModel: "custom/plan",
            workerModel: "custom/execute",
            verifyModel: "custom/verify",
        },
        {
            summary: "Separate routing persistence from workflow execution.",
            targets: ["routing.mjs: add the role", "workflow.mjs: route the stage"],
        }
    );

    const result = await planThenExecute.run(stages.ctx);
    assert.equal(result.ok, true);
    assert.deepEqual(stages.phases, ["Orchestrate", "Plan", "Execute", "Verify"]);
    assert.deepEqual(stages.calls.map(({ label, model, reasoningEffort }) => ({
        label, model, reasoningEffort,
    })), [
        { label: "orchestrate", model: "custom/orchestrate", reasoningEffort: "high" },
        { label: "plan", model: "custom/plan", reasoningEffort: "max" },
        { label: "exec:0", model: "custom/execute", reasoningEffort: "low" },
        { label: "verify", model: "custom/verify", reasoningEffort: "medium" },
    ]);
    assert.deepEqual(result.targets, ["user target"]);
    assert.deepEqual(result.planningTargets, [
        "routing.mjs: add the role",
        "workflow.mjs: route the stage",
        "user target",
    ]);
    assert.match(stages.calls[0].prompt, /Do not implement changes/);
    assert.match(stages.calls[0].prompt, /pairwise non-overlapping/);
    assert.match(stages.calls[0].prompt, /Group work with dependencies or shared-file conflicts into one target/);
    assert.match(stages.calls[1].prompt, /very detailed plan/);
    assert.match(stages.calls[1].prompt, /Keep parallel execution targets pairwise non-overlapping/);
    assert.match(stages.calls[1].prompt, /routing\.mjs: add the role/);
    assert.equal(planThenExecute.meta.phases.length, 4);
    assert.ok(planThenExecute.meta.argsSchema.properties.orchestrateModel);
});

test("workflow stops before planning if Orchestrate returns invalid output", async () => {
    const stages = context({ task: "Implement the feature" }, { summary: "missing targets" });
    const result = await planThenExecute.run(stages.ctx);
    assert.equal(result.ok, false);
    assert.equal(result.stage, "orchestrate");
    assert.ok(result.orchestrateModel.endsWith("deepseek-v4-flash"));
    assert.equal(result.reason, "Invalid orchestration decomposition or targets");
    assert.deepEqual(stages.phases, ["Orchestrate"]);
    assert.equal(stages.calls.length, 1);
});
