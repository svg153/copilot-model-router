// Model catalog, routing policy persistence, and the subagent-settings projector.
//
// Everything here is plain data so both the canvas renderer and the workflow
// body can share one source of truth.

import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { applyEnrichment } from "./enrichment.mjs";

export const COPILOT_HOME = process.env.COPILOT_HOME || join(homedir(), ".copilot");
export const ARTIFACT_DIR = join(COPILOT_HOME, "extensions", "model-router", "artifacts");
export const ROUTING_FILE = join(ARTIFACT_DIR, "routing.json");

/**
 * Price tiers the runtime reports for GitHub-hosted models. Tiers are relative
 * token cost, not absolute prices, which is what matters for routing.
 */
export const PRICE_TIERS = ["low", "medium", "high", "very_high"];

/** Tiers the injected policy tells the agent to keep out of bulk work. */
export const EXPENSIVE_TIERS = new Set(["high", "very_high"]);

/**
 * A second, provider-prefixed model source is optional. Ids from such a provider
 * look like `<provider>/<model>`, which is how the runtime disambiguates them
 * from GitHub-hosted models, so nothing here has to know the provider id — it is
 * only needed as a *default* for machines that want out-of-box cheap routing.
 *
 *   setx MODEL_ROUTER_PROVIDER_ID "<id>"
 *   setx MODEL_ROUTER_PROVIDER_LABEL "<display name>"
 */
export const EXTERNAL_PROVIDER_ID = process.env.MODEL_ROUTER_PROVIDER_ID || "";
export const EXTERNAL_PROVIDER_LABEL = process.env.MODEL_ROUTER_PROVIDER_LABEL || "";

/**
 * Display labels for model providers, keyed by provider id.
 *
 * The runtime labels GitHub-hosted models itself but reports no label for a
 * registry BYOK provider, so those names come from here. They are persisted in
 * routing.json and editable from the canvas, so the name on screen is the user's
 * rather than something baked into this file.
 */
export const DEFAULT_PROVIDER_LABELS = {
    copilot: "GitHub Copilot",
    ...(EXTERNAL_PROVIDER_ID
        ? { [EXTERNAL_PROVIDER_ID]: EXTERNAL_PROVIDER_LABEL || EXTERNAL_PROVIDER_ID }
        : {}),
};

/**
 * The catalog is fetched live from the session (see normalizeCatalog). This is
 * only what the canvas shows when that call fails — a session without auth, or
 * an older runtime — so the panel still renders something useful.
 */
export const FALLBACK_MODELS = [
    { id: "claude-opus-5.5", label: "Claude Opus 5.5", tier: "high" },
    { id: "claude-haiku-5.5", label: "Claude Haiku 5.5", tier: "low" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini", tier: "low" },
];

export function buildFallbackCatalog(providerLabels = DEFAULT_PROVIDER_LABELS) {
    const groups = new Map();
    for (const model of FALLBACK_MODELS) {
        const slash = model.id.indexOf("/");
        const providerId = slash > 0 ? model.id.slice(0, slash) : "copilot";
        let group = groups.get(providerId);
        if (!group) {
            group = {
                id: providerId,
                label: providerLabels[providerId] || providerId,
                ordering: slash > 0 ? 1 : 0,
                models: [],
            };
            groups.set(providerId, group);
        }
        group.models.push(model);
    }
    return [...groups.values()];
}

/**
 * Normalizes the session's own model list (session.rpc.model.list) into the
 * catalog shape the canvas renders and the policy text reasons about.
 *
 * Nothing about which models exist is hard-coded here: ids, display names,
 * vendors and price tiers all come from the runtime, so a model added to the
 * plan (or a provider added to the machine) shows up without touching this file.
 * BYOK models are recognized by the `provider/model` id shape the runtime gives
 * them, so no provider id has to be maintained either.
 *
 * `enrichment` is the public snapshot loaded by enrichment.mjs. It only fills
 * gaps the runtime leaves — notably the vendor and per-token price of a BYOK
 * model — so passing null simply yields the runtime's own view.
 */
export function normalizeCatalog(modelList, providerLabels = DEFAULT_PROVIDER_LABELS, enrichment = null) {
    const entries = Array.isArray(modelList?.list) ? modelList.list : [];
    const prices = new Map(
        (Array.isArray(modelList?.modelPriceCategories) ? modelList.modelPriceCategories : [])
            .filter((entry) => entry?.id)
            .map((entry) => [entry.id, entry.priceCategory])
    );
    const known = new Map(
        (Array.isArray(modelList?.providers) ? modelList.providers : [])
            .filter((entry) => entry?.id)
            .map((entry) => [entry.id, entry])
    );

    const groups = new Map();

    for (const entry of entries) {
        if (!entry || typeof entry !== "object" || typeof entry.id !== "string") continue;
        if (entry.model_picker_enabled === false) continue;

        const slash = entry.id.indexOf("/");
        const isByok = slash > 0;
        const providerId = isByok ? entry.id.slice(0, slash) : "copilot";
        const descriptor = known.get(providerId);

        let group = groups.get(providerId);
        if (!group) {
            group = {
                id: providerId,
                label:
                    descriptor?.label ||
                    providerLabels[providerId] ||
                    (isByok ? providerId : "GitHub Copilot"),
                ordering: descriptor?.ordering ?? (isByok ? 1 : 0),
                models: [],
            };
            groups.set(providerId, group);
        }

        const base = {
            id: entry.id,
            // A BYOK entry reports its own provider-qualified id as the display
            // name, so use the model half of the id instead.
            label: isByok ? entry.id.slice(slash + 1) : entry.name || entry.id,
            vendor: entry.vendor || null,
            // Prefer the per-model field: the price-category map omits some
            // models (HydraFusion among them). A BYOK model is not metered
            // against the Copilot plan and reports neither, so the snapshot's
            // inferred tier is what fills that in.
            tier:
                entry.model_picker_price_category ||
                prices.get(entry.id) ||
                (isByok ? "byok" : "unknown"),
            external: isByok,
        };

        group.models.push(
            enrichment?.index ? applyEnrichment(base, enrichment.index) : base
        );
    }

    const providers = [...groups.values()].sort(
        (a, b) => a.ordering - b.ordering || a.label.localeCompare(b.label)
    );
    for (const provider of providers) {
        provider.models.sort((a, b) => a.label.localeCompare(b.label));
    }
    return providers;
}

/** Model ids the policy should steer bulk work away from. */
export function expensiveModelIds(catalog) {
    return catalog
        .flatMap((group) => group.models)
        .filter((model) => EXPENSIVE_TIERS.has(model.tier))
        .map((model) => model.id);
}

export const EFFORT_LEVELS = ["none", "low", "medium", "high", "xhigh", "max"];

/**
 * How strictly a pinned subagent model is enforced (AgentModelPolicy in the SDK).
 *
 * "required" refuses an explicit model override, so a caller cannot escalate a
 * subagent to a premium model. "preferred" is advisory: the pin is the default
 * but an explicit model wins. Absent means the runtime default applies.
 */
export const MODEL_POLICIES = ["required", "preferred"];

/** Built-in subagent types this extension pins a model for. */
export const BUILTIN_SUBAGENT_TYPES = [
    "explore",
    "task",
    "general-purpose",
    "code-review",
    "research",
    "security-review",
];

// Generic cheap defaults for a machine with no second provider configured.
// With MODEL_ROUTER_PROVIDER_ID set, default execution goes to that provider.
const CHEAP = EXTERNAL_PROVIDER_ID ? `${EXTERNAL_PROVIDER_ID}/deepseek-v4-flash` : "claude-haiku-5.5";
const CHEAP_ALT = EXTERNAL_PROVIDER_ID ? `${EXTERNAL_PROVIDER_ID}/qwen3.6` : "gpt-5.4-mini";

export const DEFAULT_ROUTING = {
    version: 1,
    // Provider display names, so the canvas can label a BYOK group without this
    // file having to know the provider id.
    providerLabels: { ...DEFAULT_PROVIDER_LABELS },
    roles: {
        plan: { model: "claude-opus-5.5", effort: "high" },
        execute: { model: CHEAP, effort: "low" },
        verify: { model: CHEAP_ALT, effort: "medium" },
    },
    // Applied to the live session through session.rpc.tools.updateSubagentSettings.
    //
    // modelPolicy "required" means the agent cannot override these pins: an explicit
    // model passed to the task tool is refused instead of escalating to a premium
    // model. Use "preferred" to make them advisory again.
    subagents: {
        agents: Object.fromEntries(
            BUILTIN_SUBAGENT_TYPES.map((type) => [
                type,
                {
                    model: CHEAP,
                    effortLevel: "low",
                    contextTier: "inherit",
                    modelPolicy: "required",
                },
            ])
        ),
        maxConcurrency: 4,
    },
};

/** Human-readable policy injected into the session so the agent routes deliberately. */
export function policyProse(routing, catalog = []) {
    const agents = BUILTIN_SUBAGENT_TYPES.map((type) => ({
        type,
        entry: routing.subagents?.agents?.[type],
    })).filter(({ entry }) => entry?.model);

    const enforced = agents.filter(({ entry }) => entry.modelPolicy === "required");
    const advisory = agents.filter(({ entry }) => entry.modelPolicy !== "required");

    const lines = [
        ...enforced.map(({ type, entry }) => `- ${type} -> ${entry.model} (enforced)`),
        ...advisory.map(({ type, entry }) => `- ${type} -> ${entry.model} (advisory)`),
    ];

    const enforcement = [];
    if (enforced.length) {
        enforcement.push(
            `Enforced (modelPolicy=required) for ${enforced.map(({ type }) => type).join(", ")}: ` +
                "spawning one of those subagent types always uses the pinned model, and an explicit model override is refused."
        );
    }
    if (advisory.length) {
        enforcement.push(
            `Advisory (modelPolicy=preferred) for ${advisory.map(({ type }) => type).join(", ")}: ` +
                "the pin is the default, but an explicit model override wins."
        );
    }

    const expensive = expensiveModelIds(catalog);
    const free = catalog
        .flatMap((group) => group.models)
        .filter((model) => model.external && !EXPENSIVE_TIERS.has(model.tier))
        .map((model) => model.id);

    const budget = [];
    if (expensive.length) {
        budget.push(
            `Avoid these high/very-high cost models unless the task genuinely needs them: ${expensive.join(", ")}.`
        );
    }
    if (free.length) {
        budget.push(
            `These models come from the second provider and are not billed against the Copilot plan, ` +
                `so prefer them for bulk work: ${free.join(", ")}.`
        );
    }

    return [
        "<model-routing-policy>",
        "Model routing is configured for this machine. Follow it instead of leaving model choice to Auto.",
        `- Planning / architecture / hard reasoning -> ${routing.roles.plan.model}`,
        `- Bulk execution, searching, summarizing, mechanical edits -> ${routing.roles.execute.model}`,
        `- Verification and cross-checking -> ${routing.roles.verify.model}`,
        "Pinned subagent types:",
        ...lines,
        ...enforcement,
        ...budget,
        `For the plan-then-execute workflow, invoke run_dynamic_workflow with name "plan-then-execute".`,
        "Do not switch the session to Auto for bulk work; Auto escalates to premium models.",
        "</model-routing-policy>",
    ].join("\n");
}

/**
 * Field-level merge for one agent entry; a null field unsets it.
 *
 * Used for canvas patches, where a partial entry (say just `model`) must keep
 * the fields it does not mention.
 */
function mergeAgentEntry(current, patch) {
    const merged = { ...current };
    for (const [field, value] of Object.entries(patch ?? {})) {
        if (value === null) delete merged[field];
        else merged[field] = value;
    }
    return merged;
}

/**
 * `replaceAgentEntries` is for merging a *persisted* file over the defaults: an
 * agent the file mentions wins wholesale, so unsetting a field there is not
 * silently refilled by the default for that same agent.
 */
function mergeRouting(base, patch, { replaceAgentEntries = false } = {}) {
    if (!patch || typeof patch !== "object") return base;
    const out = {
        version: base.version,
        providerLabels: { ...(base.providerLabels ?? {}) },
        roles: { ...base.roles },
        subagents: {
            ...base.subagents,
            agents: { ...(base.subagents?.agents ?? {}) },
        },
    };
    if (patch.providerLabels && typeof patch.providerLabels === "object") {
        for (const [id, label] of Object.entries(patch.providerLabels)) {
            if (label === null) delete out.providerLabels[id];
            else if (typeof label === "string" && label.trim()) out.providerLabels[id] = label.trim();
        }
    }
    for (const role of ["plan", "execute", "verify"]) {
        if (patch.roles?.[role]) out.roles[role] = { ...out.roles[role], ...patch.roles[role] };
    }
    if (patch.subagents?.agents) {
        for (const [type, entry] of Object.entries(patch.subagents.agents)) {
            if (entry === null) {
                delete out.subagents.agents[type];
                continue;
            }
            out.subagents.agents[type] = replaceAgentEntries
                ? { ...entry }
                : mergeAgentEntry(out.subagents.agents[type], entry);
        }
    }
    if (Array.isArray(patch.subagents?.disabledSubagents)) {
        out.subagents.disabledSubagents = patch.subagents.disabledSubagents;
    }
    for (const key of ["maxConcurrency", "maxDepth"]) {
        const value = patch.subagents?.[key];
        if (value === null) delete out.subagents[key];
        else if (Number.isInteger(value) && value > 0) out.subagents[key] = value;
    }
    return out;
}

export async function loadRouting() {
    try {
        const raw = await readFile(ROUTING_FILE, "utf8");
        return mergeRouting(DEFAULT_ROUTING, JSON.parse(raw), { replaceAgentEntries: true });
    } catch {
        // Missing or corrupt config falls back to defaults rather than failing a run.
        return mergeRouting(DEFAULT_ROUTING, null);
    }
}

export async function saveRouting(patch) {
    const next = mergeRouting(await loadRouting(), patch);
    await mkdir(dirname(ROUTING_FILE), { recursive: true });
    const tmp = `${ROUTING_FILE}.tmp`;
    await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    await rename(tmp, ROUTING_FILE);
    return next;
}

export async function resetRouting() {
    await mkdir(dirname(ROUTING_FILE), { recursive: true });
    await writeFile(ROUTING_FILE, `${JSON.stringify(DEFAULT_ROUTING, null, 2)}\n`, "utf8");
    return mergeRouting(DEFAULT_ROUTING, null);
}

/**
 * Projects the routing config onto the SubagentSettings wire shape.
 * `contextTier: "inherit"` is dropped when absent so the runtime default applies.
 */
export function toSubagentSettings(routing) {
    const agents = {};
    for (const [type, entry] of Object.entries(routing.subagents?.agents ?? {})) {
        if (!entry?.model) continue;
        const wire = { model: entry.model };
        if (entry.effortLevel) wire.effortLevel = entry.effortLevel;
        if (entry.contextTier) wire.contextTier = entry.contextTier;
        if (entry.modelPolicy) wire.modelPolicy = entry.modelPolicy;
        agents[type] = wire;
    }
    const settings = { agents };
    if (Array.isArray(routing.subagents?.disabledSubagents)) {
        settings.disabledSubagents = routing.subagents.disabledSubagents;
    }
    if (Number.isInteger(routing.subagents?.maxConcurrency)) {
        settings.maxConcurrency = routing.subagents.maxConcurrency;
    }
    if (Number.isInteger(routing.subagents?.maxDepth)) {
        settings.maxDepth = routing.subagents.maxDepth;
    }
    return settings;
}
