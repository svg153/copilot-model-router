// Client section "core: boot, dom helpers, formatting, filtering, scoring" (split from renderer.mjs, issue #13).
export const CLIENT_CORE = String.raw`var state = JSON.parse(JSON.stringify(BOOT.routing));
var ROUTER_TOKEN = BOOT.routerToken || "";
var catalogSnapshot = BOOT.catalog || {};
var catalogDiagnostics = BOOT.catalogDiagnostics || {};
var catalog = catalogGroups(catalogSnapshot);
var benchRows = (BOOT.benchmarks && BOOT.benchmarks.rows) || [];
var benchMeta = (BOOT.benchmarks && BOOT.benchmarks.meta) || null;
var benchSource = (BOOT.benchmarks && BOOT.benchmarks.source) || "none";
var repoUrl = (BOOT.benchmarks && BOOT.benchmarks.repoUrl) || "";
var snapshotUrl = (BOOT.benchmarks && BOOT.benchmarks.snapshotUrl) || "";
var effortLevels = BOOT.effortLevels || [];
var subagentTypes = BOOT.subagentTypes || [];
var modelPolicies = BOOT.modelPolicies || [];
var dirty = false;
var selectedId = null;
var benchSort = { key: "total", dir: -1 };
// Which models the recommendations, the chart and the 3D view are allowed to
// use. "picked" is keyed by the snapshot's normalised id and null means "all".
var filters = { provider: "all", picked: null };
// The leaderboard carries every model the public benchmark scored, most of
// which you cannot pick. The table and the 3D map open on your own models; the
// toggle widens both to the full field for context.
var onlyMine = true;

// 3D-only filters, so the map can be narrowed without touching the tables.
var sceneVendors = null;      // null = every vendor; otherwise a set of names
var sceneShowUnpriced = true; // hollow spheres sitting in the side lane
var sceneShowEstimated = true; // rows whose note was inferred from the family

var SVG_NS = "http://www.w3.org/2000/svg";

// The extension hands over { providers: [...] }; accept either that envelope or
// a bare array so the panel keeps working if the shape is ever flattened.
function catalogGroups(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.providers)) return value.providers;
  return [];
}

function el(tag, props, children) {
  var node = document.createElement(tag);
  if (props) {
    Object.keys(props).forEach(function (key) {
      var value = props[key];
      if (value === undefined || value === null) return;
      if (key === "dataset") { Object.assign(node.dataset, value); return; }
      if (key === "attrs") {
        Object.keys(value).forEach(function (name) {
          if (value[name] === undefined || value[name] === null) return;
          node.setAttribute(name, String(value[name]));
        });
        return;
      }
      if (key === "style" && typeof value === "object") { Object.assign(node.style, value); return; }
      if (key === "text") { node.textContent = value; return; }
      node[key] = value;
    });
  }
  appendAll(node, children);
  return node;
}

function svgEl(tag, attrs, children) {
  var node = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (value === undefined || value === null) return;
      node.setAttribute(key, String(value));
    });
  }
  appendAll(node, children);
  return node;
}

function svgText(tag, attrs, text) {
  var node = svgEl(tag, attrs);
  node.textContent = text;
  return node;
}

function appendAll(node, children) {
  if (!children) return;
  var list = Array.isArray(children) ? children : [children];
  list.forEach(function (child) {
    if (child === null || child === undefined || child === false) return;
    node.append(child);
  });
}

function clear(id) {
  var node = document.getElementById(id);
  if (node) node.replaceChildren();
  return node;
}

// --- formatting -------------------------------------------------------------

var CAPABILITIES = {
  total: "Nota global",
  reasoning: "Razonamiento",
  coding: "Código",
  agent: "Agente y herramientas",
  tau: "Diálogo con herramientas (τ-bench)",
  terminal: "Terminal",
  liveCodeBench: "Código en vivo",
  education: "Educación",
  medical: "Medicina",
  finance: "Finanzas",
  law: "Legal",
  language: "Idioma"
};

var VENDOR_FALLBACK = "Sin identificar";

function num(value, digits, suffix) {
  if (typeof value !== "number" || !isFinite(value)) return "—";
  var text = value.toFixed(digits === undefined ? 1 : digits);
  return suffix ? text + suffix : text;
}

function money(value) {
  if (typeof value !== "number" || !isFinite(value)) return "—";
  if (value === 0) return "gratis";
  if (value < 0.01) return "$" + value.toFixed(4);
  if (value < 10) return "$" + value.toFixed(2);
  return "$" + value.toFixed(1);
}

function contextLabel(tokens) {
  if (typeof tokens !== "number" || !tokens) return "—";
  if (tokens >= 1000000) return (tokens / 1000000).toFixed(tokens % 1000000 ? 1 : 0) + "M";
  return Math.round(tokens / 1000) + "K";
}

function vendorOf(model) {
  return model.vendor || VENDOR_FALLBACK;
}

/**
 * A curated hue per known vendor, so two vendors never land on the same colour
 * by accident. Anything unknown falls back to a golden-angle spread of its own
 * hash, which keeps neighbours far apart instead of clustering in the greens.
 */
var VENDOR_HUES = {
  Anthropic: 24, OpenAI: 158, Google: 210, Alibaba: 275, DeepSeek: 195,
  "Z.ai": 340, Xiaomi: 42, "Moonshot AI": 302, ByteDance: 175, Tencent: 228,
  xAI: 0, Baidu: 252, MiniMax: 315, Meta: 205, Microsoft: 190, Mistral: 30,
  Cohere: 285, Perplexity: 165, StepFun: 120, NVIDIA: 95, Amazon: 62,
  "GitHub Copilot": 265, AI21: 350
};

function vendorHue(vendor) {
  var key = String(vendor || "?");
  if (Object.prototype.hasOwnProperty.call(VENDOR_HUES, key)) return VENDOR_HUES[key];
  var h = 0;
  for (var i = 0; i < key.length; i++) h = (h * 131 + key.charCodeAt(i)) >>> 0;
  return Math.round((h * 137.508) % 360);
}

function vendorColor(vendor) {
  return "hsl(" + vendorHue(vendor) + " 68% 48%)";
}

/**
 * three.js setStyle() only understands comma-separated hsl(), so the CSS form
 * above silently resolves to white. Hand it an integer instead.
 */
function hslToHex(h, s, l) {
  var sat = s / 100, lum = l / 100;
  var c = (1 - Math.abs(2 * lum - 1)) * sat;
  var hp = (((h % 360) + 360) % 360) / 60;
  var x = c * (1 - Math.abs((hp % 2) - 1));
  var r = 0, g = 0, b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  var m = lum - c / 2;
  return ((Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255)) >>> 0;
}

function vendorHex(vendor) {
  return hslToHex(vendorHue(vendor), 68, 48);
}

var TIER_LABEL = { low: "bajo", medium: "medio", high: "alto", very_high: "muy alto", byok: "externo", unknown: "?" };

function tierChip(tier) {
  return el("span", { className: "chip", dataset: { tier: tier || "unknown" }, textContent: TIER_LABEL[tier] || tier || "?" });
}

function hasModel(id) {
  return catalog.some(function (group) {
    return group.models.some(function (model) { return model.id === id; });
  });
}

function findModel(id) {
  for (var i = 0; i < catalog.length; i++) {
    var group = catalog[i];
    for (var j = 0; j < group.models.length; j++) {
      if (group.models[j].id === id) return group.models[j];
    }
  }
  // La tabla de benchmarks y el 3D llevan la clave normalizada, no el id crudo.
  for (var k = 0; k < catalog.length; k++) {
    var models = catalog[k].models;
    for (var m = 0; m < models.length; m++) {
      if (modelKey(models[m]) === id) return models[m];
    }
  }
  return null;
}

/**
 * Effort levels the given model actually supports. The snapshot carries a
 * per-model effortOptions list; when it is missing or unknown we must not
 * pretend to know, so every level stays selectable.
 */
function effortOptionsFor(id) {
  var model = findModel(id);
  if (model && Array.isArray(model.effortOptions) && model.effortOptions.length) return model.effortOptions;
  return effortLevels;
}

function findBenchRow(id) {
  var rows = scoredRows();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) return rows[i];
  }
  return null;
}

function allModels() {
  return catalog.reduce(function (acc, group) { return acc.concat(group.models); }, []);
}

// --- filtering --------------------------------------------------------------

/**
 * Mirrors normalizeKey() in enrichment.mjs. The snapshot keys models by a
 * lowercased alphanumeric-only form, so "claude-opus-5.5" and the leaderboard's
 * "claudeopus55" have to be reduced the same way before they can be matched.
 */
function normalizeKey(value) {
  return String(value === null || value === undefined ? "" : value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function modelKey(model) {
  return model.key || normalizeKey(model.id);
}

/** A BYOK id is "<provider>/<model>"; a Copilot id has no slash. */
function providerOf(model) {
  var slash = model.id.indexOf("/");
  return slash > 0 ? model.id.slice(0, slash) : "copilot";
}

function providerLabel(id) {
  for (var i = 0; i < catalog.length; i++) {
    if (catalog[i].id === id) return catalog[i].label;
  }
  return id;
}

/** The models every ranking, chart and scene works from. */
function activeModels() {
  var list = allModels();
  if (filters.provider !== "all") {
    list = list.filter(function (model) { return providerOf(model) === filters.provider; });
  }
  if (filters.picked) {
    list = list.filter(function (model) { return filters.picked[modelKey(model)] === true; });
  }
  return list;
}

function isPicked(key) {
  return !filters.picked || filters.picked[key] === true;
}

function filterActive() {
  return filters.provider !== "all" || filters.picked !== null;
}

/** Keys of the active models, or null when nothing is filtered. */
function activeKeySet() {
  if (!filterActive()) return null;
  var set = {};
  activeModels().forEach(function (model) { set[modelKey(model)] = true; });
  return set;
}

var mineKeys = null;

function isMine(key) {
  if (!mineKeys) {
    mineKeys = {};
    allModels().forEach(function (model) { mineKeys[modelKey(model)] = true; });
  }
  return mineKeys[key] === true;
}

function invalidateMineKeys() {
  mineKeys = null;
}

/**
 * Flips one model in or out of the selection. The first click on an unfiltered
 * panel seeds the set with everything currently visible, so a single click
 * removes one model instead of reducing the list to one.
 */
function togglePick(key) {
  var visible = activeModels().map(function (model) { return modelKey(model); });
  var next = {};
  if (filters.picked) {
    Object.keys(filters.picked).forEach(function (k) { if (filters.picked[k]) next[k] = true; });
  } else {
    visible.forEach(function (k) { next[k] = true; });
  }
  if (next[key]) delete next[key]; else next[key] = true;
  filters.picked = Object.keys(next).length ? next : null;
  renderFiltered();
}

function clearFilters() {
  filters = { provider: "all", picked: null };
  onlyMine = true;
  sceneVendors = null;
  sceneShowUnpriced = true;
  sceneShowEstimated = true;
  renderFiltered();
}

function toggleClass(node, name, on) {
  if (on) node.classList.add(name); else node.classList.remove(name);
}

function toggleButton(labelText, pressed, onClick, extra) {
  var button = el("button", {
    className: "toggle",
    type: "button",
    attrs: { "aria-pressed": pressed ? "true" : "false" },
    onclick: onClick
  });
  if (extra) button.append(extra);
  button.append(document.createTextNode(labelText));
  return button;
}

function providerCounts() {
  var counts = {};
  allModels().forEach(function (model) {
    var id = providerOf(model);
    counts[id] = (counts[id] || 0) + 1;
  });
  return counts;
}

function renderFilterBar() {
  var counts = providerCounts();
  var ids = Object.keys(counts).sort(function (a, b) {
    if (a === "copilot") return -1;
    if (b === "copilot") return 1;
    return providerLabel(a).localeCompare(providerLabel(b));
  });

  var providers = clear("providerFilter");
  providers.append(toggleButton("Todos (" + allModels().length + ")", filters.provider === "all",
    function () { filters.provider = "all"; filters.picked = null; renderFiltered(); }));
  ids.forEach(function (id) {
    providers.append(toggleButton(providerLabel(id) + " (" + counts[id] + ")", filters.provider === id, function () {
      filters.provider = id;
      // A selection made under another provider would leave an empty list.
      filters.picked = null;
      renderFiltered();
    }));
  });

  var host = clear("modelFilter");
  var visible = activeModels();
  if (!visible.length) {
    host.append(el("span", { className: "small muted", textContent: "Ningún modelo seleccionado." }));
  } else {
    visible.forEach(function (model) {
      var key = modelKey(model);
      var swatch = el("span", { className: "swatch", style: { background: vendorColor(vendorOf(model)) } });
      host.append(toggleButton(model.label, isPicked(key), function () { togglePick(key); }, swatch));
    });
  }

  var actions = clear("filterActions");
  actions.append(el("button", {
    className: "toggle", type: "button", textContent: "Todos",
    onclick: function () { filters.picked = null; renderFiltered(); }
  }));
  actions.append(el("button", {
    className: "toggle", type: "button", textContent: "Ninguno",
    onclick: function () { filters.picked = {}; renderFiltered(); }
  }));
  actions.append(toggleButton("Solo mis modelos", onlyMine, function () {
    onlyMine = !onlyMine;
    renderFiltered();
  }));
  actions.append(el("button", {
    className: "toggle", type: "button", textContent: "Quitar filtros",
    onclick: clearFilters
  }));

  renderFilterNote();
}

function renderFilterNote() {
  var total = allModels().length;
  var visible = activeModels().length;
  var parts = [];
  if (!filterActive()) {
    parts.push("Sin filtro: las recomendaciones, el gráfico y la tabla usan los " + total + " modelos que tienes.");
    parts.push("Elige un proveedor o desmarca modelos para ver qué conviene dentro de ese subconjunto.");
  } else {
    parts.push("Filtro activo: " + visible + " de " + total + " modelos.");
    if (filters.provider !== "all") parts.push("Proveedor: " + providerLabel(filters.provider) + ".");
    if (filters.picked) parts.push("Selección manual de modelos.");
    parts.push("Las recomendaciones de la pestaña Enrutado se están calculando solo con estos modelos.");
  }
  parts.push("Las notas salen del ranking público; si tu modelo no está medido directamente, " +
    "se estima a partir de variantes de su familia y se marca con ~. Un modelo sin ninguna " +
    "referencia se evalúa solo por precio y velocidad, y la tarjeta lo avisa.");
  parts.push(onlyMine
    ? "La tabla y el mapa 3D muestran solo los modelos que puedes elegir; quita el boton Solo mis modelos para ver todo el campo publico."
    : "La tabla y el mapa 3D muestran todo el campo publico; las filas y esferas resaltadas son los modelos que tienes.");
  document.getElementById("filterNote").textContent = parts.join(" ");
}

function renderFilterBanner() {
  var host = document.getElementById("filterBanner");
  if (!host) return;
  clear("filterBanner");
  if (!filterActive()) { host.style.display = "none"; return; }
  host.style.display = "";
  var providerInfo = "";
    if (filters.provider !== "all") {
      var pid = filters.provider;
      var plabel = providerLabel(pid);
      // Show full provider ID when the label is a generated fallback (starts with "Proveedor externo").
      var showId = plabel.indexOf("Proveedor externo") === 0;
      providerInfo = " (" + plabel + (showId ? " — ID: " + pid + ")" : ")");
    }
    host.append(el("span", {
      textContent: "Estas recomendaciones usan " + activeModels().length + " de " + allModels().length +
        " modelos" + providerInfo + "."
    }));
  host.append(el("button", {
    className: "toggle", type: "button", textContent: "Quitar filtros", onclick: clearFilters
  }));
}

/** Re-renders everything that depends on the active filter. */
function renderFiltered() {
  invalidateMineKeys();
  renderFilterBar();
  renderFilterBanner();
  renderRecommendations();
  renderScatter();
  renderBenchTable();
  renderSceneLegend();
  sceneSignature = null;
  var panel = document.querySelector('[data-panel="scene"]');
  if (three || (panel && panel.dataset.active === "true")) ensureScene();
}

function setStatus(text, tone) {
  var node = document.getElementById("status");
  node.textContent = text || "";
  if (tone) node.dataset.tone = tone; else delete node.dataset.tone;
}

function markDirty() {
  dirty = true;
  setStatus("Hay cambios sin guardar.", "warn");
}

// --- scoring ----------------------------------------------------------------

function costScore(model) {
  if (model.external) {
    if (typeof model.blendedCost !== "number") return 50;
    return Math.max(0, Math.min(100, 100 - (model.blendedCost / 8) * 100));
  }
  var table = { low: 100, byok: 100, medium: 60, high: 25, very_high: 5 };
  var value = table[model.tier];
  return typeof value === "number" ? value : 50;
}

function speedScore(model) {
  var tps = model.speed ? model.speed.outputTps : null;
  if (typeof tps !== "number" || !isFinite(tps)) return null;
  return Math.max(0, Math.min(100, (tps / 200) * 100));
}

/**
 * Roles and what each one is judged on. "keys" are benchmark capabilities,
 * "weights" say how much quality, cost and speed matter for that role.
 */
var ROLE_PLAYBOOK = [
  {
    type: "explore",
    what: "Busca y lee muchos archivos. Mucho volumen y poca profundidad.",
    keys: ["total"],
    weights: { capability: 0.35, cost: 0.5, speed: 0.15 },
    why: "Se lanza decenas de veces por tarea, así que manda el precio. La calidad solo tiene que bastar para no perder el hilo."
  },
  {
    type: "task",
    what: "Ejecuta una tarea acotada de principio a fin.",
    keys: ["total", "agent"],
    weights: { capability: 0.6, cost: 0.3, speed: 0.1 },
    why: "El equilibrio: se repite mucho, pero un fallo obliga a repetir el trabajo entero."
  },
  {
    type: "general-purpose",
    what: "Trabajo abierto que puede necesitar herramientas y varios pasos.",
    keys: ["total", "agent", "tau"],
    weights: { capability: 0.65, cost: 0.25, speed: 0.1 },
    why: "Además de razonar tiene que saber encadenar llamadas a herramientas sin perderse."
  },
  {
    type: "code-review",
    what: "Lee un cambio y busca fallos reales.",
    keys: ["coding", "liveCodeBench"],
    weights: { capability: 0.9, cost: 0.05, speed: 0.05 },
    why: "Aquí sí compensa pagar: un fallo que se escapa cuesta mucho más que la diferencia de precio."
  },
  {
    type: "research",
    what: "Investiga en la web y en el repositorio, y sintetiza.",
    keys: ["tau", "agent", "total"],
    weights: { capability: 0.6, cost: 0.3, speed: 0.1 },
    why: "Son muchas llamadas encadenadas: importa la fiabilidad siguiendo instrucciones con herramientas."
  },
  {
    type: "security-review",
    what: "Busca vulnerabilidades explotables.",
    keys: ["reasoning", "total"],
    weights: { capability: 0.85, cost: 0.1, speed: 0.05 },
    why: "El caso donde el razonamiento profundo pesa más que el precio. Mejor el modelo más capaz que tengas."
  }
];

function rolePlaybook(type) {
  for (var i = 0; i < ROLE_PLAYBOOK.length; i++) {
    if (ROLE_PLAYBOOK[i].type === type) return ROLE_PLAYBOOK[i];
  }
  return {
    type: type,
    what: "Subagente personalizado.",
    keys: ["total"],
    weights: { capability: 0.6, cost: 0.3, speed: 0.1 },
    why: "Sin perfil propio: se juzga por nota global, precio y velocidad."
  };
}

function rankFor(playbook) {
  var keys = playbook.keys;
  var rows = activeModels().map(function (model) {
    var raw = {};
    keys.forEach(function (key) {
      var value = model.bench ? model.bench[key] : null;
      if (typeof value === "number" && isFinite(value)) raw[key] = value;
    });
    var values = Object.keys(raw).map(function (key) { return raw[key]; });
    return {
      model: model,
      raw: raw,
      capabilityRaw: values.length ? mean(values, null) : null,
      cost: costScore(model),
      speed: speedScore(model)
    };
  });

  // Each benchmark key is normalised against the widest set we have — the
  // public leaderboard plus the user's own models — and a model is only ever
  // compared on a key against other models that report that same key. Averaging
  // raw scores across keys was unsound: with uneven coverage a mid model
  // measured on liveCodeBench could outrank a stronger one measured on coding.
  var keyScales = {};
  keys.forEach(function (key) {
    var values = [];
    (benchRows || []).forEach(function (row) {
      var value = row.bench ? row.bench[key] : null;
      if (typeof value === "number" && isFinite(value)) values.push(value);
    });
    rows.forEach(function (row) {
      if (typeof row.raw[key] === "number") values.push(row.raw[key]);
    });
    keyScales[key] = values.length
      ? { min: Math.min.apply(null, values), max: Math.max.apply(null, values) }
      : null;
  });

  var knownRaw = rows
    .map(function (row) { return row.capabilityRaw; })
    .filter(function (value) { return typeof value === "number" && isFinite(value); });

  // A model with no benchmark data must not win by omission. Dropping the
  // capability term made every cheap unmeasured model top every ranking, which
  // reads as "this is the best model for security review" when the truth is
  // "we have no idea". Unknown axes get the average of the models we do know,
  // so the score stays comparable, and the row is flagged as estimated.
  var capabilityFallback = mean(knownRaw, 50);
  var speedFallback = mean(rows.map(function (row) { return row.speed; }), 50);

  rows.forEach(function (row) {
    var parts = Object.keys(row.raw).map(function (key) {
      var scale = keyScales[key];
      if (!scale) return null;
      var span = scale.max - scale.min;
      return span > 0 ? ((row.raw[key] - scale.min) / span) * 100 : 50;
    }).filter(function (value) { return typeof value === "number"; });

    row.estimated = !parts.length;
    row.speedEstimated = row.speed === null;
    row.capability = parts.length ? mean(parts, 50) : capabilityFallback;
    row.score =
      row.capability * playbook.weights.capability +
      row.cost * playbook.weights.cost +
      (row.speed === null ? speedFallback : row.speed) * playbook.weights.speed;
  });

  return rows.sort(function (a, b) { return b.score - a.score; });
}

// Average of the finite values, or the fallback when there are none.
function mean(values, fallback) {
  var known = values.filter(function (value) { return typeof value === "number" && isFinite(value); });
  if (!known.length) return fallback;
  return known.reduce(function (a, b) { return a + b; }, 0) / known.length;
}
`;
