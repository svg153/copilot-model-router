// Fixed renderer state shared by the golden test and the golden generator.
export const FIXTURE = {
    routerToken: "golden-test-token",
    routing: {
        version: 2,
        roles: {
            orchestrate: { model: "auto", reasoningEffort: "high" },
            plan: { model: "custom/opus", reasoningEffort: "high" },
            execute: { model: "custom/sonnet", reasoningEffort: "medium" },
            verify: { model: "custom/haiku", reasoningEffort: "low" },
        },
        subagents: {
            explore: { model: "custom/flash", reasoningEffort: "low", required: true },
        },
    },
    catalog: {
        "custom provider": {
            models: [
                { id: "custom/flash", label: "Flash", vendor: "custom", tier: "cheap", context: 128000, cost: { input: 0.1, output: 0.4 }, reasoning: true },
            ],
        },
    },
    catalogDiagnostics: { live: ["custom/flash"], missing: [], fallback: [] },
    benchmarks: null,
    effortLevels: ["minimal", "low", "medium", "high", "xhigh", "max"],
    subagentTypes: ["explore", "task", "code-review"],
    modelPolicies: ["required", "preferred", "inherit"],
};
