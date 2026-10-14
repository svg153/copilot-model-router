// Builds data/models-enriched.json from public, key-free sources.
//
// The canvas needs three kinds of fact about a model that the runtime's own
// catalog does not report: who makes it, what it costs, and how good it is at
// the tasks the subagents do. None of that is available from one place, and
// none of it is available from an API that needs a key, so this script joins
// three sources that are free and continuously maintained upstream:
//
//   1. models.dev/api.json              -> vendor, price, reasoning, effort, context
//   2. jeinlee1991/chinese-llm-benchmark -> real per-capability benchmark scores
//   3. verseles/showdown                 -> output speed and time-to-first-token
//
// Run it with `node scripts/build-data.mjs`. The GitHub workflow
// .github/workflows/refresh-data.yml runs it weekly and commits the result, so
// an installed extension can just download the snapshot instead of doing any of
// this itself.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_FILE =
    process.env.MODEL_ROUTER_DATA_OUT || join(HERE, "..", "model-router", "data", "models-enriched.json");

const JEINLEE_BASE = "https://raw.githubusercontent.com/jeinlee1991/chinese-llm-benchmark/main/";

const SOURCE_URLS = {
    modelsDev: "https://models.dev/api.json",
    showdown: "https://raw.githubusercontent.com/verseles/showdown/main/data/showdown.json",
    jeinlee: JEINLEE_BASE,
};

// Provenance travels with the generated file: whoever copies only the JSON still
// gets the origin, the licence and what exactly was taken from each source.
const SOURCE_LICENSES = {
    modelsDev: {
        name: "models.dev",
        repository: "https://github.com/anomalyco/models.dev",
        license: "MIT",
        licenseUrl: "https://github.com/anomalyco/models.dev/blob/main/LICENSE",
        taken: "Vendor names, per-million-token prices, context size and capability flags.",
    },
    showdown: {
        name: "showdown",
        repository: "https://github.com/verseles/showdown",
        license: "AGPL-3.0",
        licenseUrl: "https://github.com/verseles/showdown/blob/main/LICENSE",
        taken: "Numeric throughput and time-to-first-token measurements only. No code, no text.",
    },
    jeinlee: {
        name: "chinese-llm-benchmark",
        repository: "https://github.com/jeinlee1991/chinese-llm-benchmark",
        license: "No licence declared",
        licenseUrl: "https://github.com/jeinlee1991/chinese-llm-benchmark",
        taken: "Numeric benchmark scores only. No code, no text, no table layout.",
    },
};

const log = (...args) => console.log(...args);

// The benchmark repo publishes one markdown table per capability. `reasonmodel`
// is the broad one (a total plus per-domain columns); the rest are single
// capability tables that also carry latency, token spend and cost per 1000
// calls. Values are the capability names the canvas reasons about.
const JEINLEE_TABLES = {
    "leaderboard/reasonmodel.md": null, // multi-column, handled specially
    "leaderboard/coding.md": "coding",
    "leaderboard/livecodebench.md": "liveCodeBench",
    "leaderboard/TAU.md": "tau",
    "leaderboard/Terminal-Bench-2.0.md": "terminal",
    "leaderboard/agent与工具调用.md": "agent",
};

// Columns of leaderboard/reasonmodel.md, mapped to capability keys.
const REASONMODEL_COLUMNS = {
    总分: "total",
    教育: "education",
    医疗与心理健康: "medical",
    金融: "finance",
    法律与行政公务: "law",
    推理与数学计算: "reasoning",
    语言与指令遵从: "language",
    "agent与工具调用": "agent",
    coding: "coding",
};

// Vendor names as the benchmark repo writes them. It is a Chinese project, so
// the same company appears under an ASCII id in some tables and a Chinese name
// in others; both have to land on one display name.
const VENDOR_NAMES = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
    xai: "xAI",
    meta: "Meta",
    mistral: "Mistral",
    minimax: "MiniMax",
    cohere: "Cohere",
    nvidia: "NVIDIA",
    microsoft: "Microsoft",
    amazon: "Amazon",
    databricks: "Databricks",
    ai21: "AI21",
    deepseek: "DeepSeek",
    zai: "Z.ai",
    zhipu: "Z.ai",
    alibaba: "Alibaba",
    moonshot: "Moonshot AI",
    moonshotai: "Moonshot AI",
    xiaomi: "Xiaomi",
    tencent: "Tencent",
    bytedance: "ByteDance",
    baidu: "Baidu",
    iflytek: "iFlytek",
    sensetime: "SenseTime",
    meituan: "Meituan",
    stepfun: "StepFun",
    "01ai": "01.AI",
    baichuan: "Baichuan",
    modelbest: "ModelBest",
    阿里巴巴: "Alibaba",
    深度求索: "DeepSeek",
    月之暗面: "Moonshot AI",
    智谱: "Z.ai",
    小米: "Xiaomi",
    腾讯: "Tencent",
    字节跳动: "ByteDance",
    豆包: "ByteDance",
    百度: "Baidu",
    科大讯飞: "iFlytek",
    商汤: "SenseTime",
    美团: "Meituan",
    阶跃星辰: "StepFun",
    零一万物: "01.AI",
    百川智能: "Baichuan",
    面壁智能: "ModelBest",
    微软: "Microsoft",
    英伟达: "NVIDIA",
    亚马逊: "Amazon",
};

// models.dev provider id -> the company that actually makes the model. Used to
// pick the authoritative entry when a model is resold by dozens of gateways.
const PROVIDER_VENDOR = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
    "google-vertex": "Google",
    "google-vertex-anthropic": "Anthropic",
    xai: "xAI",
    deepseek: "DeepSeek",
    zai: "Z.ai",
    zhipuai: "Z.ai",
    alibaba: "Alibaba",
    "alibaba-cn": "Alibaba",
    moonshotai: "Moonshot AI",
    "moonshotai-cn": "Moonshot AI",
    xiaomi: "Xiaomi",
    "xiaomi-token-plan-cn": "Xiaomi",
    "xiaomi-token-plan-ams": "Xiaomi",
    "xiaomi-token-plan-sgp": "Xiaomi",
    minimax: "MiniMax",
    "minimax-cn": "MiniMax",
    meta: "Meta",
    "meta-llama": "Meta",
    mistral: "Mistral",
    cohere: "Cohere",
    amazon: "Amazon",
    "amazon-bedrock": "Amazon",
    microsoft: "Microsoft",
    azure: "Microsoft",
    "azure-cognitive-services": "Microsoft",
    "github-copilot": "Microsoft",
    nvidia: "NVIDIA",
    perplexity: "Perplexity",
    ai21: "AI21",
    stepfun: "StepFun",
    "stepfun-ai": "StepFun",
    baidu: "Baidu",
    qianfan: "Baidu",
    tencent: "Tencent",
    volcengine: "ByteDance",
    bytedance: "ByteDance",
    iflytek: "iFlytek",
    sensetime: "SenseTime",
    meituan: "Meituan",
};

// Regional and plan-specific provider ids carry the same models; prefer the
// global one so the cost figures are not a regional reseller's markup.
function providerRank(id) {
    let rank = 0;
    if (/-cn$|-sgp$|-ams$/.test(id)) rank += 2;
    if (/token-plan|coding-plan|plan-/.test(id)) rank += 3;
    return rank;
}

// Last-resort vendor detection from a model id. Used when no source names the
// vendor, which is the normal case for a brand-new model and the only case for
// a bring-your-own-key model. Order matters: more specific prefixes first.
const VENDOR_HINTS = [
    [/^(claude|anthropic)/, "Anthropic"],
    [/^(gpt|chatgpt|codex|davinci|o[1-9])/, "OpenAI"],
    [/^(gemini|gemma|palm)/, "Google"],
    [/^grok/, "xAI"],
    [/^deepseek/, "DeepSeek"],
    [/^(glm|chatglm)/, "Z.ai"],
    [/^(qwen|qwq|qvq)/, "Alibaba"],
    [/^(kimi|moonshot)/, "Moonshot AI"],
    [/^mimo/, "Xiaomi"],
    [/^(minimax|abab)/, "MiniMax"],
    [/^llama/, "Meta"],
    [/^(mistral|mixtral|codestral|magistral|devstral|pixtral)/, "Mistral"],
    [/^command/, "Cohere"],
    [/^phi/, "Microsoft"],
    [/^ernie/, "Baidu"],
    [/^(hunyuan|hy[0-9])/, "Tencent"],
    [/^(doubao|seed)/, "ByteDance"],
    [/^step/, "StepFun"],
    [/^longcat/, "Meituan"],
    [/^nova/, "Amazon"],
    [/^sonar/, "Perplexity"],
    [/^hydrafusion/, "GitHub Copilot"],
    [/^mai-code/, "Microsoft"],
];

const normalizeId = (value) =>
    String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");

function vendorFor(id) {
    const key = normalizeId(id);
    for (const [pattern, name] of VENDOR_HINTS) {
        if (pattern.test(key)) return name;
    }
    return null;
}

function canonicalVendor(raw) {
    if (typeof raw !== "string" && typeof raw !== "number") return null;
    const trimmed = String(raw).trim();
    if (!trimmed || /^(nan|null|undefined|n\/?a|--?)$/i.test(trimmed)) return null;
    const key = trimmed.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
    return VENDOR_NAMES[key] || VENDOR_NAMES[trimmed] || trimmed;
}

/** "76.3%" -> 76.3, "/" -> null, "" -> null. */
function parseScore(value) {
    const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
}

async function fetchText(url) {
    const response = await fetch(url, { headers: { "user-agent": "copilot-model-router" } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
    return response.text();
}

const fetchJson = async (url) => JSON.parse(await fetchText(url));

/** Splits a GitHub-flavoured markdown table into headers plus cell rows. */
function parseMarkdownTable(text) {
    const lines = String(text)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("|"));
    if (lines.length < 2) return null;
    const split = (line) =>
        line
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim());
    const headers = split(lines[0]);
    const rows = lines
        .slice(1)
        .filter((line) => !/^\|[\s:|-]+\|$/.test(line))
        .map(split)
        .filter((cells) => cells.length >= headers.length - 2);
    return { headers, rows };
}

const columnIndex = (headers, ...needles) =>
    headers.findIndex((header) => needles.some((needle) => header.includes(needle)));

// Every benchmark row is keyed by the same normalized id the canvas looks up
// with, so a runtime id and a benchmark id only have to agree once, here.
function recordFor(index, rawName) {
    const cleaned = String(rawName ?? "")
        .replace(/\((?:new|新)\)/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    const key = normalizeId(cleaned);
    if (!key) return null;
    let record = index.get(key);
    if (!record) {
        record = { id: key, label: cleaned, vendor: null, bench: {}, rank: {} };
        index.set(key, record);
    }
    return record;
}

async function collectBenchmarks() {
    const index = new Map();
    const fetched = [];

    for (const [path, capability] of Object.entries(JEINLEE_TABLES)) {
        let table;
        try {
            table = parseMarkdownTable(await fetchText(JEINLEE_BASE + encodeURI(path)));
        } catch (error) {
            log(`  ! ${path}: ${error.message}`);
            continue;
        }
        if (!table) {
            log(`  ! ${path}: no table found`);
            continue;
        }
        fetched.push(path);

        const vendorCol = columnIndex(table.headers, "机构", "厂商");
        const modelCol = columnIndex(table.headers, "大模型", "模型");
        const rankCol = columnIndex(table.headers, "排名");
        if (modelCol < 0) continue;

        // Multi-column table (reasonmodel): one row carries every capability.
        if (capability === null) {
            const scoreCols = Object.entries(REASONMODEL_COLUMNS)
                .map(([header, key]) => [columnIndex(table.headers, header), key])
                .filter(([col]) => col >= 0);
            const timeCol = columnIndex(table.headers, "平均耗时");
            const costCol = columnIndex(table.headers, "输出价格");
            for (const cells of table.rows) {
                const record = recordFor(index, cells[modelCol]);
                if (!record) continue;
                record.vendor = canonicalVendor(cells[vendorCol]) || record.vendor;
                for (const [col, key] of scoreCols) {
                    const score = parseScore(cells[col]);
                    if (score !== null) record.bench[key] = score;
                }
                const rank = parseScore(cells[rankCol]);
                if (rank !== null) record.rank.total = rank;
                const price = parseScore(cells[costCol]);
                if (price !== null) record.outputPriceCny = price;
                const seconds = parseScore(cells[timeCol]);
                if (seconds !== null) record.latencyS = seconds;
            }
            continue;
        }

        // Single-capability table: the score column is the one carrying 准确率.
        const scoreCol = columnIndex(table.headers, "准确率", "分数", "得分");
        if (scoreCol < 0) continue;
        const timeCol = columnIndex(table.headers, "平均耗时");
        const tokenCol = columnIndex(table.headers, "平均消耗token");
        const costCol = columnIndex(table.headers, "花费/千次");
        for (const cells of table.rows) {
            const record = recordFor(index, cells[modelCol]);
            if (!record) continue;
            record.vendor = canonicalVendor(cells[vendorCol]) || record.vendor;
            const score = parseScore(cells[scoreCol]);
            if (score !== null) record.bench[capability] = score;
            const rank = parseScore(cells[rankCol]);
            if (rank !== null) record.rank[capability] = rank;
            const seconds = parseScore(cells[timeCol]);
            if (seconds !== null) record.latencyS = seconds;
            const tokens = parseScore(cells[tokenCol]);
            if (tokens !== null) record.avgTokens = tokens;
            const cost = parseScore(cells[costCol]);
            if (cost !== null) record.costPer1kCny = cost;
        }
    }

    log(`  jeinlee1991: ${index.size} models from ${fetched.length}/${Object.keys(JEINLEE_TABLES).length} tables`);
    return { index, fetched };
}

async function collectModelsDev() {
    const index = new Map();
    const payload = await fetchJson(SOURCE_URLS.modelsDev);
    let scanned = 0;

    for (const provider of Object.values(payload).sort((a, b) => providerRank(a.id) - providerRank(b.id))) {
        if (!provider || typeof provider !== "object") continue;
        const origin = PROVIDER_VENDOR[provider.id];
        if (!origin) continue;
        for (const model of Object.values(provider.models || {})) {
            if (!model?.id) continue;
            const key = normalizeId(String(model.id).split("/").pop());
            if (!key) continue;
            scanned += 1;

            // models.dev aggregates thousands of models across every gateway and
            // reseller. Keep only the entry published by the company that
            // actually makes the model, so the price and context window come
            // from the authoritative source instead of a marked-up middleman.
            if (index.has(key)) continue;
            if (vendorFor(key) !== origin) continue;

            const effort = (model.reasoning_options || []).find((option) => option?.type === "effort");
            index.set(key, {
                id: key,
                label: model.name || model.id,
                vendor: origin,
                family: model.family || null,
                releaseDate: model.release_date || null,
                cost: model.cost
                    ? {
                          input: model.cost.input ?? null,
                          output: model.cost.output ?? null,
                          cacheRead: model.cost.cache_read ?? null,
                          cacheWrite: model.cost.cache_write ?? null,
                      }
                    : null,
                reasoning: model.reasoning === true,
                effortOptions: effort?.values || null,
                context: model.limit?.context ?? null,
                openWeights: model.open_weights === true,
            });
        }
    }
    log(`  models.dev: ${scanned} entries scanned, ${index.size} unique ids kept`);
    return index;
}

async function collectShowdown() {
    const index = new Map();
    const payload = await fetchJson(SOURCE_URLS.showdown);
    const models = Array.isArray(payload) ? payload : payload.models || [];
    for (const model of models) {
        const key = normalizeId(model?.id);
        if (!key) continue;
        const picked = {};
        for (const [name, value] of Object.entries(model.benchmark_scores || {})) {
            if (typeof value === "number") picked[name] = value;
        }
        index.set(key, {
            id: key,
            label: model.name || model.id,
            vendor: canonicalVendor(model.provider) || vendorFor(key),
            releaseDate: model.release_date || null,
            cost: model.pricing
                ? {
                      input: model.pricing.input_per_1m ?? null,
                      output: model.pricing.output_per_1m ?? null,
                      cacheRead: null,
                      cacheWrite: null,
                  }
                : null,
            speed: model.performance
                ? {
                      outputTps: model.performance.output_speed_tps ?? null,
                      ttftMs: model.performance.latency_ttft_ms ?? null,
                  }
                : null,
            rawBenchmarks: Object.keys(picked).length ? picked : null,
        });
    }
    log(`  showdown: ${index.size} entries`);
    return index;
}

/** Blended USD per million tokens, used to infer a price tier. */
function blendedCost(cost) {
    if (!cost) return null;
    const input = typeof cost.input === "number" ? cost.input : null;
    const output = typeof cost.output === "number" ? cost.output : null;
    if (input === null && output === null) return null;
    if (input === null) return output;
    if (output === null) return input;
    // Real traffic is input-heavy, so weight input higher than output.
    return input * 0.75 + output * 0.25;
}

// Price tier from real per-token cost. A bring-your-own-key model has no price
// category from the runtime, so this is what gives it a comparable tier instead
// of an opaque "byok" label.
function tierForCost(cost) {
    const blended = blendedCost(cost);
    if (blended === null) return null;
    if (blended < 0.5) return "low";
    if (blended < 3) return "medium";
    if (blended < 15) return "high";
    return "very_high";
}

function merge({ modelsDev, showdown, benchmarks }) {
    const ids = new Set([...modelsDev.keys(), ...showdown.keys(), ...benchmarks.keys()]);
    const models = {};

    for (const id of ids) {
        const meta = modelsDev.get(id);
        const speedEntry = showdown.get(id);
        const bench = benchmarks.get(id);
        const sources = [];
        if (meta) sources.push("models.dev");
        if (speedEntry) sources.push("showdown");
        if (bench) sources.push("jeinlee1991");

        const cost = meta?.cost || speedEntry?.cost || null;
        const blended = blendedCost(cost);

        models[id] = {
            label: bench?.label || meta?.label || speedEntry?.label || id,
            vendor: meta?.vendor || speedEntry?.vendor || bench?.vendor || vendorFor(id) || null,
            family: meta?.family || null,
            releaseDate: meta?.releaseDate || speedEntry?.releaseDate || null,
            cost,
            blendedCost: blended === null ? null : Number(blended.toFixed(4)),
            tier: tierForCost(cost),
            reasoning: meta?.reasoning ?? null,
            effortOptions: meta?.effortOptions || null,
            context: meta?.context ?? null,
            openWeights: meta?.openWeights ?? null,
            speed: speedEntry?.speed || null,
            latencyS: bench?.latencyS ?? null,
            avgTokens: bench?.avgTokens ?? null,
            costPer1kCny: bench?.costPer1kCny ?? null,
            outputPriceCny: bench?.outputPriceCny ?? null,
            bench: bench && Object.keys(bench.bench).length ? bench.bench : null,
            rank: bench && Object.keys(bench.rank).length ? bench.rank : null,
            rawBenchmarks: speedEntry?.rawBenchmarks || null,
            sources,
        };
    }

    // Drop entries that carry nothing the canvas can show.
    for (const [id, model] of Object.entries(models)) {
        const useful =
            model.vendor || model.cost || model.bench || model.rawBenchmarks || model.speed?.outputTps || model.context;
        if (!useful) delete models[id];
    }

    // Extra spellings that normalize to an existing key, so a runtime id written
    // differently (`deepseek-v4-flash` vs `deepseekv4flash`) still resolves.
    const aliases = {};
    for (const [id, model] of Object.entries(models)) {
        for (const name of new Set([model.label, id])) {
            const alias = normalizeId(name);
            if (alias && alias !== id && !models[alias]) aliases[alias] = id;
        }
    }

    return { models, aliases };
}

async function main() {
    log("Collecting sources…");
    const results = {};

    for (const [name, run] of [
        ["modelsDev", collectModelsDev],
        ["showdown", collectShowdown],
        ["benchmarks", collectBenchmarks],
    ]) {
        try {
            results[name] = await run();
        } catch (error) {
            log(`  ! ${name} failed: ${error.message}`);
            results[name] = name === "benchmarks" ? { index: new Map(), fetched: [] } : new Map();
        }
    }

    const { models, aliases } = merge({
        modelsDev: results.modelsDev,
        showdown: results.showdown,
        benchmarks: results.benchmarks.index,
    });

    const all = Object.values(models);
    const counts = {
        models: all.length,
        withVendor: all.filter((model) => model.vendor).length,
        withCost: all.filter((model) => model.cost).length,
        withBenchmarks: all.filter((model) => model.bench).length,
        withSpeed: all.filter((model) => model.speed?.outputTps).length,
    };

    const payload = {
        meta: {
            schema: 1,
            generatedAt: new Date().toISOString(),
            sources: Object.entries(SOURCE_URLS).map(([id, url]) => ({ id, url })),
            licenses: Object.fromEntries(
                Object.entries(SOURCE_LICENSES).map(([id, info]) => [id, { ...info, url: SOURCE_URLS[id] }]),
            ),
            notice:
                "Numeric facts only, reproduced with attribution. No source code, prose, table layout or " +
                "creative arrangement is copied, and no upstream file is redistributed. Each source keeps " +
                "all of its rights; see meta.licenses. This file is a derived compilation with its own " +
                "structure, built by scripts/build-data.mjs.",
            tables: results.benchmarks.fetched,
            counts,
        },
        models,
        aliases,
    };

    await mkdir(dirname(OUT_FILE), { recursive: true });

    // Keep the file byte-identical when only the timestamp moved, so the
    // scheduled workflow does not commit an empty refresh every week.
    try {
        const previous = JSON.parse(await readFile(OUT_FILE, "utf8"));
        const withoutTimestamp = (value) => JSON.stringify({ ...value, meta: { ...value.meta, generatedAt: null } });
        if (previous?.meta?.generatedAt && withoutTimestamp(previous) === withoutTimestamp(payload)) {
            payload.meta.generatedAt = previous.meta.generatedAt;
            log("  no upstream change; keeping the previous timestamp");
        }
    } catch {
        // No previous snapshot, or it is unreadable: write a fresh one.
    }

    const json = JSON.stringify(payload);
    await writeFile(OUT_FILE, json + "\n", "utf8");

    log("");
    log(`Wrote ${OUT_FILE}`);
    log(`  ${counts.models} models · ${counts.withVendor} vendor · ${counts.withCost} cost · ${counts.withBenchmarks} benchmarks · ${counts.withSpeed} speed`);
    log(`  ${(json.length / 1024).toFixed(0)} KB`);
}

await main();
