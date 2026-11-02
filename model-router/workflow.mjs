// Orchestrate decomposes the task, Plan details it, Execute implements it, and
// Verify checks it. Each stage pins its configured model rather than using Auto.

import { defineWorkflow } from "@github/copilot-sdk/extension";
import { loadRouting } from "./routing.mjs";

function asText(value) {
    if (value === null || value === undefined) return null;
    return typeof value === "string" ? value : JSON.stringify(value);
}

function orchestratePrompt(task, targets) {
    return [
        "You are the orchestration stage of a cost-routed workflow.",
        "Decompose the task and identify concrete planning targets, dependencies, and scope boundaries.",
        "Each target must be a self-contained, pairwise non-overlapping work unit safe to execute in parallel.",
        "Group work with dependencies or shared-file conflicts into one target; mention ordering and dependencies in summary.",
        "Do not implement changes, edit files, or execute implementation commands.",
        "Return only a JSON object with summary (a non-empty string describing decomposition and dependencies)",
        "and targets (a non-empty array of self-contained strings naming files, symbols, or work units).",
        "Keep supplied targets intact; describe their dependencies and scope in the summary.",
        `Task: ${task}`,
        targets.length ? `Supplied targets:\n${targets.map((t) => `- ${t}`).join("\n")}` : "",
    ].filter(Boolean).join("\n");
}

function planPrompt(task, targets, orchestration) {
    return [
        "You are the planning stage of a cost-routed workflow. Produce a plan only; do not execute it.",
        "Return a numbered list of concrete, independently executable steps.",
        "Each step must be self-contained: name the files, symbols, or commands involved.",
        "Produce a very detailed plan: cover dependencies, implementation details, edge cases,",
        "acceptance criteria, and exact validation commands for each target.",
        "Keep parallel execution targets pairwise non-overlapping; group dependent or conflicting changes together.",
        "Do not edit files or execute implementation commands.",
        "State any assumption you had to make. Flag steps that are risky or irreversible.",
        "",
        `Task: ${task}`,
        `Orchestration:\n${orchestration.summary}`,
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
            "Orchestrate task decomposition, produce a detailed plan, execute units, then independently verify. " +
            "args: { task: string, targets?: string[], orchestrateModel?: string, planModel?: string, workerModel?: string, verifyModel?: string, verify?: boolean }",
        phases: [{ title: "Orchestrate" }, { title: "Plan" }, { title: "Execute" }, { title: "Verify" }],
        argsSchema: {
            type: "object",
            required: ["task"],
            properties: {
                task: { type: "string" },
                targets: { type: "array", items: { type: "string" } },
                orchestrateModel: { type: "string" },
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

        const suppliedTargets = Array.isArray(ctx.args.targets)
            ? ctx.args.targets.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim())
            : [];
        const orchestrateModel = ctx.args.orchestrateModel || routing.roles.orchestrate.model;
        const planModel = ctx.args.planModel || routing.roles.plan.model;
        const workerModel = ctx.args.workerModel || routing.roles.execute.model;
        const verifyModel = ctx.args.verifyModel || routing.roles.verify.model;

        ctx.phase("Orchestrate");
        ctx.log(`Orchestrate stage on ${orchestrateModel}`);
        const output = await ctx.agent(orchestratePrompt(task, suppliedTargets), {
            label: "orchestrate",
            model: orchestrateModel,
            reasoningEffort: routing.roles.orchestrate.effort,
        });
        let orchestration;
        try {
            orchestration = typeof output === "string" ? JSON.parse(output) : output;
        } catch (error) {
            ctx.log(`Orchestrate stage returned invalid JSON: ${error.message}`);
            return { ok: false, stage: "orchestrate", orchestrateModel, reason: "Invalid orchestration JSON" };
        }
        if (!orchestration || typeof orchestration.summary !== "string" || !orchestration.summary.trim() ||
            !Array.isArray(orchestration.targets) || !orchestration.targets.length ||
            orchestration.targets.some((target) => typeof target !== "string" || !target.trim())) {
            ctx.log("Orchestrate stage returned no valid decomposition or targets; aborting before Plan.");
            return { ok: false, stage: "orchestrate", orchestrateModel, reason: "Invalid orchestration decomposition or targets" };
        }
        orchestration = {
            summary: orchestration.summary.trim(),
            targets: orchestration.targets.map((target) => target.trim()),
        };
        const planningTargets = [...new Set([...orchestration.targets, ...suppliedTargets])];
        const targets = suppliedTargets.length ? suppliedTargets : orchestration.targets;

        ctx.phase("Plan");
        ctx.log(`Plan stage on ${planModel}`);
        const plan = asText(
            await ctx.agent(planPrompt(task, planningTargets, orchestration), {
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
        const units = targets;
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
            models: { orchestrate: orchestrateModel, plan: planModel, execute: workerModel, verify: verifyModel },
            orchestration,
            planningTargets,
            targets,
            plan,
            results,
            verification,
            droppedUnits: dropped,
        };
    },
});
