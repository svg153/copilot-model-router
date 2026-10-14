// The plan-then-execute workflow: an expensive model plans, cheap models
// execute in parallel, a third model verifies. Every stage pins its own model
// so the routing is deterministic rather than left to Auto.

import { defineWorkflow } from "@github/copilot-sdk/extension";
import { loadRouting } from "./routing.mjs";

function asText(value) {
    if (value === null || value === undefined) return null;
    return typeof value === "string" ? value : JSON.stringify(value);
}

function planPrompt(task, targets) {
    return [
        "You are the planning stage of a cost-routed workflow. Produce a plan only; do not execute it.",
        "Return a numbered list of concrete, independently executable steps.",
        "Each step must be self-contained: name the files, symbols, or commands involved.",
        "State any assumption you had to make. Flag steps that are risky or irreversible.",
        "",
        `Task: ${task}`,
        targets.length ? `Targets:\n${targets.map((t) => `- ${t}`).join("\n")}` : "",
    ]
        .filter(Boolean)
        .join("\n");
}

function executePrompt(task, plan, unit) {
    return [
        "You are the execution stage of a cost-routed workflow. Do the work, do not re-plan.",
        "Follow the plan where it applies to your unit. If the plan is wrong for your unit, say so plainly.",
        "Keep the answer short: what you changed or found, and anything the verifier must check.",
        "",
        `Overall task: ${task}`,
        `Plan:\n${plan}`,
        "",
        `Your unit:\n${unit}`,
    ].join("\n");
}

function verifyPrompt(task, plan, results) {
    const body = results
        .map((r) => `--- unit: ${r.unit} ---\n${r.output ?? "(no output returned)"}`)
        .join("\n\n");
    return [
        "You are the verification stage of a cost-routed workflow.",
        "You did not write any of this. Check it against the task and the plan, and report disagreements.",
        "For each unit state: agrees / disagrees / cannot tell, with the specific reason.",
        "Also state which plan steps the workers did not cover.",
        "End with a one-line verdict and the single most important follow-up.",
        "",
        `Task: ${task}`,
        `Plan the workers were given:\n${plan}`,
        `Worker output:\n${body}`,
    ].join("\n");
}

export const planThenExecute = defineWorkflow({
    meta: {
        name: "plan-then-execute",
        description:
            "Plan with a premium model, execute the units in parallel on cheap models, then verify with a third model. " +
            "args: { task: string, targets?: string[], planModel?: string, workerModel?: string, verifyModel?: string, verify?: boolean }",
        phases: [{ title: "Plan" }, { title: "Execute" }, { title: "Verify" }],
        argsSchema: {
            type: "object",
            required: ["task"],
            properties: {
                task: { type: "string" },
                targets: { type: "array", items: { type: "string" } },
                planModel: { type: "string" },
                workerModel: { type: "string" },
                verifyModel: { type: "string" },
                verify: { type: "boolean" },
            },
        },
    },
    run: async (ctx) => {
        const routing = await loadRouting();

        const task = typeof ctx.args.task === "string" ? ctx.args.task.trim() : "";
        if (!task) {
            ctx.log("plan-then-execute: no task supplied");
            return { ok: false, reason: "args.task is required" };
        }

        const targets = Array.isArray(ctx.args.targets)
            ? ctx.args.targets.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim())
            : [];
        const planModel = ctx.args.planModel || routing.roles.plan.model;
        const workerModel = ctx.args.workerModel || routing.roles.execute.model;
        const verifyModel = ctx.args.verifyModel || routing.roles.verify.model;

        ctx.phase("Plan");
        ctx.log(`Plan stage on ${planModel}`);
        const plan = asText(
            await ctx.agent(planPrompt(task, targets), {
                label: "plan",
                model: planModel,
                reasoningEffort: routing.roles.plan.effort,
            })
        );
        if (!plan) {
            ctx.log("Plan stage returned nothing; aborting before spending worker credits.");
            return { ok: false, stage: "plan", planModel };
        }

        ctx.phase("Execute");
        const units = targets.length ? targets : [task];
        ctx.log(`Execute stage: ${units.length} unit(s) on ${workerModel}`);
        const executed = await ctx.pipeline(units, (previous, item, index) =>
            ctx.agent(executePrompt(task, plan, String(item)), {
                label: `exec:${index}`,
                model: workerModel,
                reasoningEffort: routing.roles.execute.effort,
            })
        );

        const results = executed.map((output, index) => ({
            unit: String(units[index]),
            output: asText(output),
        }));
        const dropped = results.filter((r) => r.output === null).length;
        if (dropped > 0) {
            ctx.log(`Dropped ${dropped} of ${results.length} unit(s): the subagent returned nothing.`);
        }

        let verification = null;
        if (ctx.args.verify !== false) {
            ctx.phase("Verify");
            ctx.log(`Verify stage on ${verifyModel}`);
            verification = asText(
                await ctx.agent(verifyPrompt(task, plan, results), {
                    label: "verify",
                    model: verifyModel,
                    reasoningEffort: routing.roles.verify.effort,
                })
            );
        }

        ctx.log(`plan-then-execute complete: ${ctx.runId}`);
        return {
            ok: true,
            task,
            models: { plan: planModel, execute: workerModel, verify: verifyModel },
            plan,
            results,
            verification,
            droppedUnits: dropped,
        };
    },
});
