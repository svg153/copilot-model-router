// Module resolution hooks for workflow.test.mjs: used in-thread via
// module.registerHooks when available (Node >=22.15), otherwise registered as a
// hooks module via module.register() (Node >=20.6). Stubs the extension SDK so
// workflow.mjs can be imported and tested without installing dependencies.
export function resolve(specifier, context, nextResolve) {
    if (specifier === "@github/copilot-sdk/extension") {
        return {
            url: "data:text/javascript,export%20const%20defineWorkflow%20%3D%20(definition)%20%3D%3E%20definition%3B",
            shortCircuit: true,
        };
    }
    return nextResolve(specifier, context);
}
