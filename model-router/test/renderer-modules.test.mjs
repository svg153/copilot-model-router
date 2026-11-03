// Per-module renderer tests (issue #35): the golden test pins the whole HTML
// document, these tests localize a regression to the module that broke —
// each client section must be embedded, in order, and the inline-script
// JSON escaping must never let a payload close the <script> block.
import { test } from "node:test";
import assert from "node:assert/strict";

const { renderHtml, escapeJsonForScript } = await import("../renderer/index.mjs");
const { STYLES } = await import("../renderer/styles.mjs");
const { BODY } = await import("../renderer/body.mjs");
const { CLIENT_CORE } = await import("../renderer/client-core.mjs");
const { CLIENT_ROUTING } = await import("../renderer/client-routing.mjs");
const { CLIENT_CATALOG } = await import("../renderer/client-catalog.mjs");
const { CLIENT_BENCH } = await import("../renderer/client-bench.mjs");
const { CLIENT_SCENE } = await import("../renderer/client-scene.mjs");
const { CLIENT_GUIDE } = await import("../renderer/client-guide.mjs");
const { CLIENT_ACTIONS } = await import("../renderer/client-actions.mjs");
const { FIXTURE } = await import("./fixtures/renderer-state.mjs");

// Same order as the CLIENT join inside renderer/index.mjs.
const CLIENT_MODULES = {
    "client-core": CLIENT_CORE,
    "client-routing": CLIENT_ROUTING,
    "client-catalog": CLIENT_CATALOG,
    "client-bench": CLIENT_BENCH,
    "client-scene": CLIENT_SCENE,
    "client-guide": CLIENT_GUIDE,
    "client-actions": CLIENT_ACTIONS,
};

function firstLine(src) {
    return src.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
}

test("escapeJsonForScript escapes angle brackets so a value cannot close the inline script", () => {
    assert.equal(
        escapeJsonForScript({ payload: "</script><img src=x onerror=alert(1)>" }),
        '{"payload":"\\u003c/script\\u003e\\u003cimg src=x onerror=alert(1)\\u003e"}'
    );
});

test("escapeJsonForScript escapes the U+2028/U+2029 line separators", () => {
    assert.equal(escapeJsonForScript("a\u2028b\u2029c"), '"a\\u2028b\\u2029c"');
});

test("escapeJsonForScript maps null and undefined to null", () => {
    assert.equal(escapeJsonForScript(null), "null");
    assert.equal(escapeJsonForScript(undefined), "null");
});

test("renderHtml embeds every client module section", () => {
    const html = renderHtml(FIXTURE);
    for (const [name, src] of Object.entries(CLIENT_MODULES)) {
        const marker = firstLine(src);
        assert.ok(marker.length > 0, `${name} exports no content`);
        assert.ok(html.includes(marker), `renderHtml is missing the ${name} section`);
    }
});

test("renderHtml composes the client modules in declared order", () => {
    const html = renderHtml(FIXTURE);
    let previous = -1;
    for (const [name, src] of Object.entries(CLIENT_MODULES)) {
        const at = html.indexOf(firstLine(src));
        assert.ok(at > previous, `${name} section is out of order`);
        previous = at;
    }
});

test("renderHtml embeds the style and body sections", () => {
    const html = renderHtml(FIXTURE);
    assert.ok(html.includes(firstLine(STYLES)), "renderHtml is missing the styles section");
    assert.ok(html.includes(firstLine(BODY)), "renderHtml is missing the body section");
});

test("renderHtml BOOT payload cannot break out of the inline script", () => {
    const html = renderHtml({
        ...FIXTURE,
        routing: { ...FIXTURE.routing, note: "</script><img src=x onerror=alert(1)>" },
    });
    assert.ok(!html.includes("</script><img"), "raw script-close payload leaked into the html");
    assert.ok(html.includes("\\u003c/script"), "escaped payload missing from the BOOT json");
});
