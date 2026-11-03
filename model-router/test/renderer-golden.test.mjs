// Golden test: pins the exact HTML produced by the renderer so the module
// split (issue #13) can be proven byte-identical. Regenerate the golden file
// only together with an intentional, reviewed HTML change:
//   node -e "import('./model-router/renderer/index.mjs').then(m => ...)"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const { renderHtml } = await import("../renderer/index.mjs");
const { FIXTURE } = await import("./fixtures/renderer-state.mjs");

test("renderer output is byte-identical to the committed golden html", () => {
    const golden = readFileSync(join(HERE, "__golden__", "renderer.html"), "utf8");
    const rendered = renderHtml(FIXTURE);
    assert.equal(rendered.length, golden.length);
    assert.ok(rendered === golden, "rendered html differs from golden");
});
