// Regenerates test/__golden__/renderer.html from the current renderer modules.
// Run from the model-router directory: node scripts/regen-golden.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const { renderHtml } = await import("../renderer/index.mjs");
const { FIXTURE } = await import("../test/fixtures/renderer-state.mjs");

const out = join(HERE, "..", "test", "__golden__", "renderer.html");
writeFileSync(out, renderHtml(FIXTURE), "utf8");
console.log("golden regenerated:", out);
