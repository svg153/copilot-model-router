/**
 * Canvas HTML for the model router.
 *
 * The page is a single document with five tabs. It never talks to the host:
 * everything is served by the loopback server in extension.mjs, which injects
 * the initial state through `BOOT` and exposes `/routing`, `/catalog`, `/data`
 * and `/events`.
 *
 * Benchmarks, vendors and prices come from the public snapshot described in
 * ../README.md. Nothing here is specific to a provider or an account.
 */

import { STYLES } from "./styles.mjs";
import { BODY } from "./body.mjs";
import { CLIENT_CORE } from "./client-core.mjs";
import { CLIENT_ROUTING } from "./client-routing.mjs";
import { CLIENT_CATALOG } from "./client-catalog.mjs";
import { CLIENT_BENCH } from "./client-bench.mjs";
import { CLIENT_SCENE } from "./client-scene.mjs";
import { CLIENT_GUIDE } from "./client-guide.mjs";
import { CLIENT_ACTIONS } from "./client-actions.mjs";
const CLIENT = "\n" + [CLIENT_CORE, CLIENT_ROUTING, CLIENT_CATALOG, CLIENT_BENCH, CLIENT_SCENE, CLIENT_GUIDE, CLIENT_ACTIONS].join("\n") + "\n";

/** Serialize a value for embedding inside an inline <script> block. */
export function escapeJsonForScript(value) {
    return JSON.stringify(value ?? null)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}


/**
 * @param {object} options
 * @param {object} options.routing       persisted routing document
 * @param {Array}  options.catalog       normalized catalog groups
 * @param {object} options.benchmarks    { rows, meta, source, repoUrl, snapshotUrl }
 * @param {string[]} options.effortLevels
 * @param {string[]} options.subagentTypes
 * @param {string[]} options.modelPolicies
 */
export function renderHtml({ routing, catalog, catalogDiagnostics, benchmarks, effortLevels, subagentTypes, modelPolicies, routerToken }) {
    const boot = {
        routing,
        catalog,
        catalogDiagnostics,
        benchmarks: benchmarks ?? { rows: [], meta: null, source: "none" },
        effortLevels,
        subagentTypes,
        modelPolicies,
        // Per-server secret; POSTs must echo it back (see server.mjs guard).
        routerToken: routerToken ?? "",
    };

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Model Router</title>
<style>${STYLES}</style>
</head>
<body>
${BODY}
<script>
const BOOT = ${escapeJsonForScript(boot)};
${CLIENT}
</script>
</body>
</html>
`;
}
