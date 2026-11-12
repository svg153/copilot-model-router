import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEnrichment } from "../enrichment.mjs";

// A hand-built index shaped exactly like buildIndex()'s output, so the family
// estimation logic is tested without depending on which models the current
// snapshot happens to measure.
function makeIndex(models) {
    const keys = Object.keys(models);
    return {
        models,
        aliases: {},
        keys,
        benchKeys: keys.filter((key) => models[key]?.bench && Object.keys(models[key].bench).length),
        generatedAt: null,
    };
}

test("a scored sibling variant supplies the estimate (prefix match)", () => {
    const index = makeIndex({
        deepseekv4flash0424: { label: "DeepSeek-V4-Flash-0424", vendor: "DeepSeek", bench: { total: 77 } },
    });
    const enriched = applyEnrichment({ id: "deepseek-v4-flash" }, index);
    assert.equal(enriched.benchEstimated, true);
    assert.equal(enriched.bench.total, 77);
    assert.match(enriched.benchNote, /Estimado a partir de DeepSeek-V4-Flash-0424/);
    assert.doesNotMatch(enriched.benchNote, /otra generaci/i);
});

test("an unmeasured model falls back to the same family of another generation", () => {
    const index = makeIndex({
        gpt6luna: { label: "gpt-6-luna", vendor: "OpenAI", bench: { total: 80, coding: 70 } },
    });
    // gpt-5.6-luna is nowhere in the sources; stripping version digits makes it
    // match gpt-6-luna, and the note has to say so plainly.
    const enriched = applyEnrichment({ id: "openai/gpt-5.6-luna" }, index);
    assert.equal(enriched.benchEstimated, true);
    assert.equal(enriched.bench.total, 80);
    assert.match(enriched.benchNote, /otra generación/);
});

test("cross-generation guessing needs a real family name, not a bare prefix", () => {
    const index = makeIndex({
        gpt6luna: { label: "gpt-6-luna", vendor: "OpenAI", bench: { total: 80 } },
    });
    // "gpt-5.6" strips to "gpt": too broad to attribute to any single family.
    const enriched = applyEnrichment({ id: "openai/gpt-5.6" }, index);
    assert.equal(enriched.bench, null);
    assert.equal(enriched.benchEstimated, false);
});

test("a directly measured model never takes the estimate path", () => {
    const index = makeIndex({
        gpt6luna: { label: "gpt-6-luna", vendor: "OpenAI", bench: { total: 80 } },
        gpt56luna: { label: "GPT-5.6 Luna", vendor: "OpenAI", bench: { total: 74 } },
    });
    const enriched = applyEnrichment({ id: "openai/gpt-5.6-luna" }, index);
    assert.equal(enriched.bench.total, 74);
    assert.equal(enriched.benchEstimated, false);
    assert.equal(enriched.benchNote, null);
});
