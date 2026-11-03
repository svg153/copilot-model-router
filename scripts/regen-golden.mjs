// Regenerate model-router/test/__golden__/renderer.html from the shared renderer
// fixture, so refreshing the golden is one reviewed command instead of a
// hand-rolled one-liner.
//
// Usage (from anywhere): node scripts/regen-golden.mjs
// Commit the regenerated golden only together with an intentional, reviewed
// renderer change; the golden test then pins it byte-for-byte.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const GOLDEN = join(ROOT, "model-router", "test", "__golden__", "renderer.html");

const { renderHtml } = await import(
    pathToFileURL(join(ROOT, "model-router", "renderer", "index.mjs")).href
);
const { FIXTURE } = await import(
    pathToFileURL(join(ROOT, "model-router", "test", "fixtures", "renderer-state.mjs")).href
);

const html = renderHtml(FIXTURE);
writeFileSync(GOLDEN, html);
console.log(
    `regen-golden: wrote ${Buffer.byteLength(html, "utf8")} bytes to model-router/test/__golden__/renderer.html`
);
