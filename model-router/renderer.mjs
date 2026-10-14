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

/** Serialize a value for embedding inside an inline <script> block. */
function escapeJsonForScript(value) {
    return JSON.stringify(value ?? null)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}

const STYLES = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body {
    margin: 0;
    padding: 0 20px 40px;
    background: var(--background-color-default, #ffffff);
    color: var(--text-color-default, #1f2328);
    font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
    font-size: var(--text-body-medium, 14px);
    line-height: var(--leading-body-medium, 20px);
}
header { padding: 20px 0 12px; }
h1 {
    margin: 0 0 4px;
    font-size: var(--text-title-large, 26px);
    font-weight: var(--font-weight-semibold, 600);
    line-height: var(--leading-title-large, 32px);
}
h2 { margin: 0 0 4px; font-size: 16px; font-weight: var(--font-weight-semibold, 600); }
h3 { margin: 0 0 2px; font-size: 13px; font-weight: var(--font-weight-semibold, 600); }
p { margin: 0 0 10px; }
a { color: var(--color-focus-outline, #0969da); }
code, .mono {
    font-family: var(--font-mono, "SFMono-Regular", Consolas, "Liberation Mono", monospace);
    font-size: 12px;
}
.sub { color: var(--text-color-muted, #59636e); margin: 0; }
.muted { color: var(--text-color-muted, #59636e); }
.small { font-size: 12px; }
.tiny { font-size: 11px; }
.warn-line { color: var(--true-color-yellow, #9a6700); }
.section { margin: 0 0 26px; }
.section > .sub { margin-bottom: 12px; }

.bar-top {
    position: sticky; top: 0; z-index: 5;
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
    padding: 10px 0; margin-bottom: 4px;
    background: var(--background-color-default, #ffffff);
    border-bottom: 1px solid var(--border-color-default, #d1d9e0);
}
.status { color: var(--text-color-muted, #59636e); font-size: 12px; }
.status[data-tone="ok"] { color: var(--true-color-green, #1a7f37); }
.status[data-tone="warn"] { color: var(--true-color-yellow, #9a6700); }
.status[data-tone="err"] { color: var(--true-color-red, #cf222e); }

button, select, input {
    font: inherit;
    color: inherit;
    background: var(--background-color-default, #ffffff);
    border: 1px solid var(--border-color-default, #d1d9e0);
    border-radius: 6px;
    padding: 4px 8px;
}
button { cursor: pointer; }
button:hover { background: var(--background-color-muted, #f6f8fa); }
button.primary {
    background: var(--color-focus-outline, #0969da);
    border-color: var(--color-focus-outline, #0969da);
    color: var(--color-white, #ffffff);
}
button.primary:hover { filter: brightness(1.08); }
button.mini { padding: 2px 7px; font-size: 11px; }
select { max-width: 100%; }

.tabs { display: flex; flex-wrap: wrap; gap: 2px; border-bottom: 1px solid var(--border-color-default, #d1d9e0); margin-bottom: 18px; }
.tabs button {
    border: 0; border-bottom: 2px solid transparent; border-radius: 0;
    background: transparent; padding: 9px 13px;
    color: var(--text-color-muted, #59636e);
}
.tabs button[aria-selected="true"] {
    color: var(--text-color-default, #1f2328);
    border-bottom-color: var(--color-focus-outline, #0969da);
    font-weight: var(--font-weight-semibold, 600);
}
.panel { display: none; }
.panel[data-active="true"] { display: block; }

table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid var(--border-color-default, #d1d9e0); }
th {
    position: sticky; top: 0; z-index: 1;
    background: var(--background-color-default, #ffffff);
    font-size: 11px; text-transform: uppercase; letter-spacing: .03em;
    color: var(--text-color-muted, #59636e); font-weight: var(--font-weight-semibold, 600);
}
th.sortable { cursor: pointer; user-select: none; }
th.sortable:hover { color: var(--text-color-default, #1f2328); }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
.tablewrap { max-height: 440px; overflow: auto; border: 1px solid var(--border-color-default, #d1d9e0); border-radius: 8px; }
tr.mine td { background: var(--background-color-muted, #f6f8fa); }

.chip {
    display: inline-block; padding: 0 6px; border-radius: 10px;
    font-size: 10px; line-height: 16px; text-transform: uppercase; letter-spacing: .04em;
    border: 1px solid var(--border-color-default, #d1d9e0);
    color: var(--text-color-muted, #59636e);
}
.chip[data-tier="low"] { border-color: var(--true-color-green, #1a7f37); color: var(--true-color-green, #1a7f37); }
.chip[data-tier="medium"] { border-color: var(--true-color-yellow, #9a6700); color: var(--true-color-yellow, #9a6700); }
.chip[data-tier="high"], .chip[data-tier="very_high"] { border-color: var(--true-color-red, #cf222e); color: var(--true-color-red, #cf222e); }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; vertical-align: middle; }

.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 10px; }
.card { border: 1px solid var(--border-color-default, #d1d9e0); border-radius: 8px; padding: 12px; }
.card.mine { border-color: var(--color-focus-outline, #0969da); }
.card .what { color: var(--text-color-muted, #59636e); font-size: 12px; margin: 0 0 10px; }
.pick { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.pick .who { font-weight: var(--font-weight-semibold, 600); }
.pick .score { font-variant-numeric: tabular-nums; color: var(--text-color-muted, #59636e); font-size: 12px; }

.bar { display: block; height: 6px; border-radius: 3px; background: var(--border-color-default, #d1d9e0); overflow: hidden; }
.bar > i { display: block; height: 100%; background: var(--color-focus-outline, #0969da); }
.meter { display: grid; grid-template-columns: 132px 1fr 54px; gap: 8px; align-items: center; font-size: 12px; margin-bottom: 6px; }
.meter .val { text-align: right; font-variant-numeric: tabular-nums; color: var(--text-color-muted, #59636e); }

dl.defs { margin: 0; }
dl.defs dt { font-weight: var(--font-weight-semibold, 600); margin-top: 12px; }
dl.defs dd { margin: 2px 0 0; color: var(--text-color-muted, #59636e); }

.scene { position: relative; width: 100%; height: 440px; border: 1px solid var(--border-color-default, #d1d9e0); border-radius: 8px; overflow: hidden; }
.scene canvas { display: block; }
.tip {
    position: absolute; display: none; pointer-events: none; z-index: 3;
    max-width: 260px; padding: 6px 9px; border-radius: 6px; font-size: 11px;
    background: var(--background-color-default, #ffffff);
    border: 1px solid var(--border-color-default, #d1d9e0);
    box-shadow: 0 3px 10px rgba(0, 0, 0, .16);
}
.legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 11px; color: var(--text-color-muted, #59636e); margin-top: 8px; }
.note {
    border-left: 3px solid var(--border-color-default, #d1d9e0);
    padding: 2px 0 2px 10px; margin: 10px 0;
    color: var(--text-color-muted, #59636e); font-size: 12px;
}
.scrollx { overflow-x: auto; }
.empty-row td {
    padding: 16px 10px; color: var(--text-color-muted, #59636e);
    font-style: italic; text-align: center;
}
.est {
    color: var(--true-color-yellow, #9a6700);
    font-weight: var(--font-weight-semibold, 600); cursor: help;
}

.filters {
    display: grid; gap: 10px; margin-bottom: 18px; padding: 12px;
    border: 1px solid var(--border-color-default, #d1d9e0); border-radius: 8px;
    background: var(--background-color-muted, #f6f8fa);
}
.filters-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.filters-label {
    min-width: 78px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em;
    color: var(--text-color-muted, #59636e); font-weight: var(--font-weight-semibold, 600);
}
.toggle {
    padding: 2px 9px; border-radius: 12px; font-size: 11px; line-height: 18px; cursor: pointer;
    border: 1px solid var(--border-color-default, #d1d9e0);
    background: var(--background-color-default, #ffffff); color: var(--text-color-default, #1f2328);
}
.toggle:hover { border-color: var(--color-focus-outline, #0969da); }
.toggle[aria-pressed="true"] {
    background: var(--color-focus-outline, #0969da);
    border-color: var(--color-focus-outline, #0969da); color: #ffffff;
}
.toggle[aria-pressed="false"] { opacity: .5; }
.toggle .swatch {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    margin-right: 5px; vertical-align: middle; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .18);
}
.banner {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 12px;
    padding: 6px 10px; border-left: 3px solid var(--color-focus-outline, #0969da);
    border-radius: 0 6px 6px 0; font-size: 12px;
    background: var(--background-color-muted, #f6f8fa);
}
.axis-key { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 8px; font-size: 11px; color: var(--text-color-muted, #59636e); }
.axis-key b { font-weight: var(--font-weight-semibold, 600); color: var(--text-color-default, #1f2328); }
.axis-key .swatch {
    display: inline-block; width: 9px; height: 9px; border-radius: 2px;
    margin-right: 5px; vertical-align: middle;
}
`;

const BODY = `
<header>
  <h1>Model Router</h1>
  <p class="sub">
    Decide qué modelo atiende cada tarea: los del plan de GitHub Copilot para lo que exige calidad,
    y los del proveedor externo (tu propia clave, sin coste por petición premium) para el trabajo masivo.
  </p>
</header>

<div class="bar-top">
  <button id="apply" class="primary">Guardar y aplicar</button>
  <button id="reset">Restaurar valores por defecto</button>
  <button id="refresh">Actualizar datos</button>
  <span id="status" class="status"></span>
</div>

<nav class="tabs" id="tabs">
  <button data-tab="routing" aria-selected="true">Enrutado</button>
  <button data-tab="catalog" aria-selected="false">Catálogo</button>
  <button data-tab="bench" aria-selected="false">Comparativa</button>
  <button data-tab="scene" aria-selected="false">3D</button>
  <button data-tab="guide" aria-selected="false">Guía</button>
</nav>

<section class="panel" data-panel="routing" data-active="true">
  <div class="banner" id="filterBanner" style="display:none"></div>
  <div class="section">
    <h2>Roles del workflow</h2>
    <p class="sub">
      El workflow <span class="mono">plan → execute → verify</span> reparte el trabajo en tres momentos.
      Aquí decides qué modelo y con qué esfuerzo atiende cada uno.
    </p>
    <div id="roles"></div>
  </div>

  <div class="section">
    <h2>Subagentes fijados</h2>
    <p class="sub">
      Los subagentes que lanza el agente principal (búsquedas, revisiones, investigaciones).
      Fijar un modelo aquí evita que cada llamada elija por su cuenta uno más caro.
    </p>
    <div id="subagents"></div>
  </div>

  <div class="section">
    <h2>Qué significa cada ajuste</h2>
    <dl class="defs" id="routingDefs"></dl>
  </div>
</section>

<section class="panel" data-panel="catalog">
  <div class="section">
    <h2>Catálogo en vivo</h2>
    <p class="sub" id="catalogSub">Se lee del propio runtime, así que refleja exactamente los modelos que tienes disponibles.</p>
    <div id="catalogMeta" class="note"></div>
    <div class="tablewrap"><table id="catalogTable"></table></div>
  </div>
  <div class="section">
    <h2>Columnas</h2>
    <dl class="defs" id="catalogDefs"></dl>
  </div>
</section>

<section class="panel" data-panel="bench">
  <div class="section">
    <h2>Qué modelo conviene para cada tarea</h2>
    <p class="sub">
      La recomendación combina <strong>calidad</strong> (notas de benchmarks públicos), <strong>coste</strong>
      y <strong>velocidad</strong>, con un peso distinto según lo que haga el subagente. No hay una sola
      respuesta correcta: hay una respuesta correcta para cada tipo de trabajo.
    </p>
    <p class="sub">
      La puntuación de <strong>encaje</strong> va de 0 a 100 y se lee así: la calidad se mide solo con los
      benchmarks que de verdad evaluan esa tarea (por ejemplo <code>coding</code> para revisar código), y se
      compara contra los 88 modelos del ranking público para que 100 sea el mejor medido y 0 el peor. El coste
      y la velocidad entran con el peso que indique cada tarjeta. Los modelos que <strong>no</strong> aparecen en
      ningún benchmark reciben la media de los medidos en lugar de una ventaja: antes un modelo sin datos
      ganaba por barato, lo cual no era información, era ruido. Cuando el ganador no tiene datos se avisa en
      la propia tarjeta.
    </p>
    <div class="filters">
      <div class="filters-row">
        <span class="filters-label">Proveedor</span>
        <span id="providerFilter"></span>
      </div>
      <div class="filters-row">
        <span class="filters-label">Modelos</span>
        <span id="modelFilter"></span>
      </div>
      <div class="filters-row">
        <span class="filters-label">Atajos</span>
        <span id="filterActions"></span>
      </div>
      <div class="note" id="filterNote" style="margin:0"></div>
    </div>

    <div class="cards" id="recs"></div>
  </div>

  <div class="section">
    <h2>Perfil del modelo seleccionado</h2>
    <p class="sub" id="profileSub">Haz clic en cualquier fila de la tabla de abajo para ver su perfil.</p>
    <div id="profile"></div>
  </div>

  <div class="section">
    <h2>Coste frente a calidad</h2>
    <p class="sub">
      Cada punto es un modelo. Cuanto más a la izquierda, más barato; cuanto más arriba, mejor nota global.
      Lo ideal está arriba a la izquierda: bueno y barato.
    </p>
    <div class="scrollx"><div id="scatter"></div></div>
    <div class="legend" id="scatterLegend"></div>
    <div class="note">
      En los modelos del plan de Copilot el precio que se muestra es el <strong>precio de referencia de la API</strong>,
      no lo que te cobra tu suscripción. Para esos modelos lo que cuenta de verdad es su categoría de precio
      (<span class="mono">bajo</span>, <span class="mono">medio</span>, <span class="mono">alto</span>), que sí es
      la que consume tu cuota.
    </div>
  </div>

  <div class="section">
    <h2>Tabla completa de benchmarks</h2>
    <p class="sub" id="benchSub">Haz clic en una cabecera para ordenar.</p>
    <div class="tablewrap"><table id="benchTable"></table></div>
    <div class="note" id="benchMeta"></div>
  </div>
</section>

<section class="panel" data-panel="scene">
  <div class="section">
    <h2>Mapa 3D del panorama</h2>
    <p class="sub">
      Arrastra para girar, usa la rueda para acercarte y pasa el ratón por encima de una esfera para ver el modelo.
      Es la misma información que la pestaña Comparativa, pero vista como un terreno: se entiende de un vistazo
      dónde está la frontera buena y barata.
    </p>
    <div class="bar-top" style="margin-bottom:10px">
      <button id="sceneReset">Reencuadrar</button>
      <button id="sceneSpin" aria-pressed="false">Girar solo</button>
      <span id="sceneStatus" class="status"></span>
    </div>
    <div class="scene" id="scene3d"><div class="tip" id="sceneTip"></div></div>
    <div class="axis-key" id="sceneAxes"></div>
    <div class="legend" id="sceneLegend"></div>
    <dl class="defs">
      <dt>Eje horizontal (x)</dt>
      <dd>Precio. A la izquierda lo barato, a la derecha lo caro. La escala es logarítmica, porque las diferencias de precio son enormes. Se marca en <b>ámbar</b>.</dd>
      <dt>Eje vertical (y)</dt>
      <dd>Nota global del benchmark. Arriba los mejores. Se marca en <b>verde</b>.</dd>
      <dt>Profundidad (z)</dt>
      <dd>Velocidad de salida, en tokens por segundo. Delante lo rápido, detrás lo lento. Se marca en <b>azul</b>.</dd>
      <dt>Marco de referencia</dt>
      <dd>
        La caja, la rejilla del suelo y las tres flechas giran junto con las esferas, y los rótulos de los
        extremos siempre miran a la cámara. Así no pierdes la orientación por mucho que gires: cada flecha
        lleva escrito qué mide y en qué sentido crece, con los valores en los dos extremos.
      </dd>
      <dt>Tamaño de la esfera</dt>
      <dd>Nota global: cuanto más grande, mejor.</dd>
      <dt>Color</dt>
      <dd>Fabricante. Las esferas con halo son los modelos que tienes disponibles ahora mismo.</dd>
      <dt>Esferas huecas</dt>
      <dd>
        Modelos que el benchmark público midió pero para los que no hay precio público. No pueden colocarse
        en un eje de precio, así que van en su propio carril, a la derecha de la caja, con una línea
        discontinua y el rótulo <b>sin precio público</b>. Se dibujan huecas para que nunca se lean como el
        modelo más caro.
      </dd>
    </dl>
  </div>
</section>

<section class="panel" data-panel="guide">
  <div class="section">
    <h2>Guía rápida</h2>
    <p class="sub">Todo lo que hace este panel, explicado sin dar nada por sabido.</p>
    <dl class="defs" id="guideDefs"></dl>
  </div>
  <div class="section">
    <h2>De dónde salen los datos</h2>
    <dl class="defs" id="sourceDefs"></dl>
    <div class="note" id="sourceMeta"></div>
  </div>
  <div class="section">
    <h2>Traer tu propia clave</h2>
    <p class="sub">
      Los modelos que aparecen bajo un segundo proveedor no los sirve GitHub: se facturan contra la cuenta
      de ese proveedor, con la clave que hayas configurado en la aplicación. Por eso en este panel se marcan
      como <span class="mono">externo</span> y su precio se muestra en dólares de API, no en categorías del plan.
      Son la pieza clave del ahorro: el trabajo repetitivo se va ahí y la cuota premium se reserva para pensar.
    </p>
  </div>
</section>
`;

/**
 * @param {object} options
 * @param {object} options.routing       persisted routing document
 * @param {Array}  options.catalog       normalized catalog groups
 * @param {object} options.benchmarks    { rows, meta, source, repoUrl, snapshotUrl }
 * @param {string[]} options.effortLevels
 * @param {string[]} options.subagentTypes
 * @param {string[]} options.modelPolicies
 */
export function renderHtml({ routing, catalog, benchmarks, effortLevels, subagentTypes, modelPolicies }) {
    const boot = {
        routing,
        catalog,
        benchmarks: benchmarks ?? { rows: [], meta: null, source: "none" },
        effortLevels,
        subagentTypes,
        modelPolicies,
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

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const CLIENT = String.raw`
var state = JSON.parse(JSON.stringify(BOOT.routing));
var catalog = catalogGroups(BOOT.catalog);
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
// which you cannot pick. The table opens on your own models; the toggle widens
// it to the full field for context.
var benchOnlyMine = true;

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
  benchOnlyMine = true;
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
  actions.append(toggleButton("Solo mis modelos en la tabla", benchOnlyMine, function () {
    benchOnlyMine = !benchOnlyMine;
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
  document.getElementById("filterNote").textContent = parts.join(" ");
}

function renderFilterBanner() {
  var host = document.getElementById("filterBanner");
  if (!host) return;
  clear("filterBanner");
  if (!filterActive()) { host.style.display = "none"; return; }
  host.style.display = "";
  host.append(el("span", {
    textContent: "Estas recomendaciones usan " + activeModels().length + " de " + allModels().length +
      " modelos" + (filters.provider !== "all" ? " (" + providerLabel(filters.provider) + ")" : "") + "."
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

// --- routing tab ------------------------------------------------------------

function modelSelect(current, onChange) {
  var select = el("select", { onchange: function (event) { onChange(event.target.value); } });
  catalog.forEach(function (group) {
    var optgroup = el("optgroup", { label: group.label + (group.id === "copilot" ? "" : " (clave propia)") });
    group.models.forEach(function (model) {
      var option = el("option", {
        value: model.id,
        textContent: model.label + "  ·  " + vendorOf(model) + "  ·  " + (TIER_LABEL[model.tier] || model.tier || "?")
      });
      if (model.id === current) option.selected = true;
      optgroup.append(option);
    });
    select.append(optgroup);
  });
  if (current && !hasModel(current)) {
    select.prepend(el("option", { value: current, textContent: current + " (no está en el catálogo)", selected: true }));
  }
  return select;
}

function selectFrom(values, current, onChange) {
  var select = el("select", { onchange: function (event) { onChange(event.target.value); } });
  var found = false;
  values.forEach(function (value) {
    var option = el("option", { value: value, textContent: value });
    if (value === current) { option.selected = true; found = true; }
    select.append(option);
  });
  if (!found) select.prepend(el("option", { value: "", textContent: "(sin definir)", selected: true }));
  return select;
}

function renderRoles() {
  var host = clear("roles");
  ["plan", "execute", "verify"].forEach(function (role) {
    var entry = (state.roles && state.roles[role]) || {};
    var row = el("div", { className: "meter", style: { gridTemplateColumns: "76px minmax(0, 2.2fr) minmax(0, 1fr)" } }, [
      el("strong", { textContent: role }),
      modelSelect(entry.model, function (value) {
        state.roles[role] = Object.assign({}, entry, { model: value });
        markDirty();
      }),
      selectFrom(effortLevels, entry.effort, function (value) {
        state.roles[role] = Object.assign({}, entry, { effort: value });
        markDirty();
      })
    ]);
    host.append(row);
  });
}

function renderSubagents() {
  var host = clear("subagents");
  var agents = (state.subagents && state.subagents.agents) || {};

  var head = el("div", { className: "meter", style: { gridTemplateColumns: "150px minmax(0, 2.2fr) 92px 118px" } }, [
    el("span", { className: "tiny muted", textContent: "Subagente" }),
    el("span", { className: "tiny muted", textContent: "Modelo fijado" }),
    el("span", { className: "tiny muted", textContent: "Esfuerzo" }),
    el("span", { className: "tiny muted", textContent: "Exigencia" })
  ]);
  host.append(head);

  subagentTypes.forEach(function (type) {
    var entry = agents[type] || {};
    var row = el("div", { className: "meter", style: { gridTemplateColumns: "150px minmax(0, 2.2fr) 92px 118px" } }, [
      el("span", { className: "mono", textContent: type }),
      modelSelect(entry.model, function (value) {
        agents[type] = Object.assign({}, entry, { model: value });
        state.subagents.agents = agents;
        markDirty();
        renderRecommendations();
      }),
      selectFrom(effortLevels, entry.effortLevel, function (value) {
        agents[type] = Object.assign({}, entry, { effortLevel: value });
        state.subagents.agents = agents;
        markDirty();
      }),
      selectFrom(modelPolicies.concat(["inherit"]), entry.modelPolicy, function (value) {
        var next = Object.assign({}, entry);
        if (value === "inherit") delete next.modelPolicy; else next.modelPolicy = value;
        agents[type] = next;
        state.subagents.agents = agents;
        markDirty();
      })
    ]);
    host.append(row);
  });

  host.append(el("div", { className: "meter", style: { gridTemplateColumns: "150px minmax(0, 2.2fr) 92px 118px" } }, [
    el("span", { className: "mono", textContent: "maxConcurrency" }),
    el("input", {
      type: "number", min: 1, max: 16, value: (state.subagents && state.subagents.maxConcurrency) || 4,
      onchange: function (event) {
        state.subagents.maxConcurrency = Math.max(1, Math.min(16, Number(event.target.value) || 1));
        markDirty();
      }
    })
  ]));
}

function defs(hostId, entries) {
  var host = clear(hostId);
  entries.forEach(function (pair) {
    host.append(el("dt", { textContent: pair[0] }));
    var dd = el("dd");
    if (pair[2]) {
      dd.append(document.createTextNode(pair[1] + " "));
      dd.append(el("a", { href: pair[2], target: "_blank", rel: "noreferrer noopener", textContent: pair[2] }));
    } else {
      dd.textContent = pair[1];
    }
    host.append(dd);
  });
}

function renderRoutingDefs() {
  defs("routingDefs", [
    ["Modelo", "Qué modelo atiende ese papel. Los del plan de Copilot consumen tu cuota; los de clave propia se facturan aparte."],
    ["Esfuerzo (effort)", "Cuánto tiempo de cómputo dedica el modelo a pensar antes de responder. Subirlo mejora los problemas difíciles y encarece cada llamada; bajarlo responde antes y gasta menos. " +
      effortLevels.join(" · ") + "."],
    ["Exigencia (modelPolicy) — required", "El modelo fijado es obligatorio. Si alguien pide otro modelo para ese subagente, se rechaza. Es lo que impide que una llamada suelta escale a un modelo premium."],
    ["Exigencia (modelPolicy) — preferred", "El modelo fijado es solo la opción por defecto: una petición explícita de otro modelo gana. Úsalo cuando quieras una sugerencia, no una regla."],
    ["Exigencia (modelPolicy) — inherit", "Sin opinión propia: se aplica lo que tenga configurado el runtime. Es el valor que se escribe cuando eliges esta opción."],
    ["maxConcurrency", "Cuántos subagentes pueden ejecutarse a la vez. Más alto termina antes y dispara el gasto; más bajo es más barato y más lento."]
  ]);
}

// --- catalog tab ------------------------------------------------------------

function renderCatalog() {
  var table = clear("catalogTable");
  var head = el("thead");
  head.append(el("tr", null, [
    el("th", { textContent: "Modelo" }),
    el("th", { textContent: "Proveedor" }),
    el("th", { textContent: "Fabricante" }),
    el("th", { textContent: "Origen del dato", className: "tiny" }),
    el("th", { textContent: "Precio" }),
    el("th", { textContent: "Contexto" }),
    el("th", { textContent: "Global", className: "num" })
  ]));
  table.append(head);

  var body = el("tbody");
  catalog.forEach(function (group) {
    body.append(el("tr", null, [
      el("td", { colSpan: 7, className: "small muted", textContent: group.label + " — " + group.models.length + " modelos" })
    ]));
    group.models.forEach(function (model) {
      var origin = model.vendorSource === "runtime" ? "runtime"
        : model.vendorSource === "snapshot" ? "snapshot"
        : model.vendorSource === "family" ? "inferido por familia"
        : model.vendorSource === "heuristic" ? "inferido por nombre"
        : "desconocido";
      body.append(el("tr", null, [
        el("td", null, [
          el("div", { className: "mono", textContent: model.label }),
          model.id !== model.label ? el("div", { className: "tiny muted", textContent: model.id }) : null
        ]),
        el("td", { className: "small", textContent: group.label }),
        el("td", { className: "small" }, [
          el("span", { className: "dot", style: { background: vendorColor(vendorOf(model)) } }),
          el("span", { textContent: " " + vendorOf(model) })
        ]),
        el("td", { className: "tiny muted", textContent: origin }),
        el("td", null, [tierChip(model.tier)]),
        el("td", { className: "small", textContent: contextLabel(model.context) }),
        el("td", { className: "num small", textContent: model.bench && typeof model.bench.total === "number" ? num(model.bench.total) : "—" })
      ]));
    });
  });
  table.append(body);

  var external = allModels().filter(function (model) { return model.external; }).length;
  document.getElementById("catalogSub").textContent =
    allModels().length + " modelos en " + catalog.length + " proveedor(es), de los cuales " + external +
    " vienen de una clave propia. Se leen del propio runtime, así que reflejan exactamente lo que tienes disponible.";

  var withVendor = allModels().filter(function (model) { return model.vendor; }).length;
  document.getElementById("catalogMeta").textContent =
    "Fabricante identificado en " + withVendor + " de " + allModels().length + " modelos. " +
    "El dato sale del runtime cuando lo trae, y si no se busca en la instantánea pública; " +
    "cuando tampoco está ahí se infiere por familia o por el nombre del identificador.";
}

function renderCatalogDefs() {
  defs("catalogDefs", [
    ["Proveedor", "Quién sirve el modelo. GitHub Copilot, o el proveedor externo cuya clave tengas configurada."],
    ["Fabricante", "Quién lo construyó. Se muestra aparte del proveedor porque un mismo fabricante puede llegar por varias vías."],
    ["Origen del dato", "De dónde ha salido el fabricante: del runtime, de la instantánea pública, de la familia del modelo o de una heurística sobre el identificador."],
    ["Precio", "Categoría de precio del plan en los modelos de Copilot; en los de clave propia, el precio de API que publica el fabricante."],
    ["Contexto", "Cuántos tokens caben en una sola conversación. Más contexto permite analizar proyectos enteros, y también encarece cada llamada."],
    ["Global", "Nota media de los benchmarks públicos. Un guion significa que ese modelo todavía no aparece en ninguno."]
  ]);
}

// --- benchmarks tab ---------------------------------------------------------

function bar(value, max) {
  var pct = Math.max(0, Math.min(100, (value / (max || 100)) * 100));
  return el("span", { className: "bar" }, [el("i", { style: { width: pct + "%" } })]);
}

function renderRecommendations() {
  var host = clear("recs");
  var agents = (state.subagents && state.subagents.agents) || {};

  ROLE_PLAYBOOK.forEach(function (playbook) {
    var ranked = rankFor(playbook);
    var best = ranked[0];
    var pinned = agents[playbook.type] ? agents[playbook.type].model : null;
    var pinnedModel = pinned ? findModel(pinned) : null;
    var matches = pinned === best.model.id;

    var card = el("div", { className: "card" + (matches ? " mine" : "") }, [
      el("h3", { className: "mono", textContent: playbook.type }),
      el("p", { className: "what", textContent: playbook.what }),
      el("div", { className: "pick" }, [
        el("span", { className: "who", textContent: best.model.label }),
        el("span", { className: "score", textContent: num(best.score, 0) + " / 100 de encaje" })
      ]),
      bar(best.score, 100),
      el("p", { className: "tiny muted", style: { margin: "6px 0 8px" },
        textContent: vendorOf(best.model) + " · " + (best.capabilityRaw === null ? "sin benchmark público" : "calidad media " + num(best.capabilityRaw) + " en " + playbook.keys.join(" + ")) +
          " · " + (best.model.external ? money(best.model.blendedCost) + "/1M" : "categoría " + (TIER_LABEL[best.model.tier] || "?")) })
    ]);

    if (best.estimated) {
      card.append(el("p", { className: "tiny warn-line", style: { margin: "0 0 8px" },
        textContent: "Sin datos públicos de calidad para este modelo: la puntuación sale de precio y velocidad, así que trátala como una apuesta, no como una medida." }));
    }

    var others = ranked.slice(1, 4).map(function (row) {
      return el("div", { className: "meter", style: { gridTemplateColumns: "1fr 90px 34px" } }, [
        el("span", { className: "small", textContent: row.model.label + (row.estimated ? " (sin datos)" : "") }),
        bar(row.score, 100),
        el("span", { className: "val", textContent: num(row.score, 0) })
      ]);
    });
    card.append(el("div", { style: { marginTop: "10px" } }, others));

    card.append(el("p", { className: "tiny muted", style: { margin: "8px 0 10px" }, textContent: playbook.why }));

    var pinLine = el("div", { className: "small" }, [
      el("span", { className: "muted", textContent: "Fijado ahora: " }),
      el("span", { className: "mono", textContent: pinned || "(sin definir)" })
    ]);
    if (pinnedModel && !pinnedModel.external && !best.model.external && typeof pinnedModel.blendedCost === "number" && typeof best.model.blendedCost === "number" && best.model.blendedCost > 0) {
      var factor = pinnedModel.blendedCost / best.model.blendedCost;
      if (factor >= 1.6) {
        card.append(el("p", { className: "tiny", style: { margin: "4px 0 0" },
          textContent: "Ojo: el modelo que tienes fijado cuesta unas " + factor.toFixed(1) + " veces más por token que el recomendado." }));
      }
    }
    card.append(pinLine);

    if (!matches) {
      card.append(el("button", {
        className: "mini primary", style: { marginTop: "8px" },
        textContent: "Fijar " + best.model.label,
        onclick: function () {
          agents[playbook.type] = Object.assign({}, agents[playbook.type] || {}, { model: best.model.id });
          state.subagents.agents = agents;
          markDirty();
          renderRecommendations();
          renderSubagents();
        }
      }));
    } else {
      card.append(el("p", { className: "tiny", style: { margin: "8px 0 0" }, textContent: "Ya coincide con la recomendación." }));
    }

    host.append(card);
  });
}

function renderProfile() {
  var host = clear("profile");
  var model = selectedId ? findModel(selectedId) : null;
  var fromBench = false;
  if (!model && selectedId) {
    model = findBenchRow(selectedId);
    fromBench = !!model;
  }
  if (!model) {
    document.getElementById("profileSub").textContent = "Haz clic en cualquier fila de la tabla de abajo para ver su perfil.";
    host.append(el("p", { className: "small muted", textContent: "Sin modelo seleccionado." }));
    return;
  }

  document.getElementById("profileSub").textContent = model.label + " — " + vendorOf(model) +
    (fromBench ? " (solo en el ranking público; no está en tu catálogo)"
      : model.external ? " (clave propia)" : " (plan de Copilot)");

  var keys = Object.keys(model.bench || {});
  if (!keys.length) {
    host.append(el("p", { className: "small muted", textContent: "Este modelo todavía no tiene notas públicas de benchmark." }));
  } else {
    if (model.benchEstimated) {
      host.append(el("p", { className: "small warn-line", style: { marginTop: "0" },
        textContent: "~ " + (model.benchNote || "Nota estimada a partir de variantes de la misma familia") +
          ". Es una estimación, no una medida directa del benchmark." }));
    }
    keys.forEach(function (key) {
      var value = model.bench[key];
      if (typeof value !== "number") return;
      host.append(el("div", { className: "meter" }, [
        el("span", { textContent: CAPABILITIES[key] || key }),
        bar(value, 100),
        el("span", { className: "val", textContent: num(value) })
      ]));
    });
  }

  var facts = [
    ["Fabricante", vendorOf(model)],
    ["Familia", model.family || "—"],
    ["Precio de referencia", typeof model.blendedCost === "number" ? money(model.blendedCost) + " por 1M de tokens" : "—"],
    ["Entrada / salida", model.cost ? money(model.cost.input) + " / " + money(model.cost.output) : "—"],
    ["Contexto", contextLabel(model.context) + " tokens"],
    ["Velocidad", model.speed && typeof model.speed.outputTps === "number" ? num(model.speed.outputTps, 0) + " tokens/s" : "—"],
    ["Primer token", typeof model.latencyS === "number" ? num(model.latencyS, 2) + " s" : (model.speed && typeof model.speed.ttftMs === "number" ? num(model.speed.ttftMs / 1000, 2) + " s" : "—")],
    ["Razonamiento", model.reasoning === true ? "sí" : model.reasoning === false ? "no" : "—"],
    ["Esfuerzos admitidos", model.effortOptions && model.effortOptions.length ? model.effortOptions.join(" · ") : "—"],
    ["Pesos abiertos", model.openWeights === true ? "sí" : model.openWeights === false ? "no" : "—"],
    ["Publicado", model.releaseDate || "—"]
  ];
  var list = el("dl", { className: "defs", style: { marginTop: "14px" } });
  facts.forEach(function (pair) {
    list.append(el("dt", { textContent: pair[0] }));
    list.append(el("dd", { textContent: pair[1] }));
  });
  host.append(list);

  if (model.rank && typeof model.rank.total === "number") {
    host.append(el("p", { className: "small muted", style: { marginTop: "10px" },
      textContent: "Posición " + model.rank.total + " en la clasificación global de la instantánea." }));
  }
}

function scatterPoints() {
  return activeModels().filter(function (model) {
    return typeof model.blendedCost === "number" && model.bench && typeof model.bench.total === "number";
  });
}

function renderScatter() {
  var host = clear("scatter");
  var legend = clear("scatterLegend");
  var points = scatterPoints();
  if (points.length < 2) {
    host.append(el("p", { className: "small muted", textContent: "No hay suficientes modelos con precio y nota a la vez." }));
    return;
  }

  var W = 660, H = 320, P = { l: 46, r: 16, t: 14, b: 36 };
  var xs = points.map(function (m) { return Math.log10(m.blendedCost + 0.05); });
  var ys = points.map(function (m) { return m.bench.total; });
  var xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
  var yMin = Math.min.apply(null, ys) - 3, yMax = Math.max.apply(null, ys) + 3;
  function sx(v) { return P.l + ((v - xMin) / ((xMax - xMin) || 1)) * (W - P.l - P.r); }
  function sy(v) { return H - P.b - ((v - yMin) / ((yMax - yMin) || 1)) * (H - P.t - P.b); }

  var root = svgEl("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", height: H, role: "img" });
  root.append(svgEl("rect", { x: P.l, y: P.t, width: W - P.l - P.r, height: H - P.t - P.b, fill: "none", stroke: "currentColor", "stroke-opacity": 0.18 }));

  [0.1, 0.3, 1, 3, 10, 30].forEach(function (price) {
    var v = Math.log10(price + 0.05);
    if (v < xMin || v > xMax) return;
    var x = sx(v);
    root.append(svgEl("line", { x1: x, y1: P.t, x2: x, y2: H - P.b, stroke: "currentColor", "stroke-opacity": 0.12 }));
    root.append(svgText("text", { x: x, y: H - P.b + 14, "font-size": 10, "text-anchor": "middle", fill: "currentColor", "fill-opacity": 0.6 }, "$" + price));
  });

  var yStep = 10;
  for (var y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
    var yPos = sy(y);
    root.append(svgEl("line", { x1: P.l, y1: yPos, x2: W - P.r, y2: yPos, stroke: "currentColor", "stroke-opacity": 0.12 }));
    root.append(svgText("text", { x: P.l - 6, y: yPos + 3, "font-size": 10, "text-anchor": "end", fill: "currentColor", "fill-opacity": 0.6 }, String(y)));
  }

  root.append(svgText("text", { x: P.l + (W - P.l - P.r) / 2, y: H - 4, "font-size": 11, "text-anchor": "middle", fill: "currentColor", "fill-opacity": 0.7 }, "Precio de referencia por 1M de tokens (escala logarítmica)"));
  root.append(svgText("text", { x: 12, y: P.t + (H - P.t - P.b) / 2, "font-size": 11, "text-anchor": "middle", fill: "currentColor", "fill-opacity": 0.7, transform: "rotate(-90 12 " + (P.t + (H - P.t - P.b) / 2) + ")" }, "Nota global"));

  var vendors = {};
  points.forEach(function (model) {
    var vendor = vendorOf(model);
    vendors[vendor] = true;
    var cx = sx(Math.log10(model.blendedCost + 0.05));
    var cy = sy(model.bench.total);
    var dot = svgEl("circle", {
      cx: cx, cy: cy, r: 5.5,
      fill: vendorColor(vendor), "fill-opacity": 0.85,
      stroke: model.external ? "currentColor" : "none", "stroke-width": model.external ? 1.5 : 0
    });
    dot.append(svgText("title", null, model.label + " — " + vendor + "\n" + money(model.blendedCost) + "/1M · global " + num(model.bench.total)));
    dot.style.cursor = "pointer";
    dot.addEventListener("click", function () { selectedId = model.id; renderProfile(); });
    root.append(dot);
  });

  host.append(root);
  Object.keys(vendors).sort().forEach(function (vendor) {
    legend.append(el("span", null, [
      el("span", { className: "dot", style: { background: vendorColor(vendor) } }),
      el("span", { textContent: " " + vendor })
    ]));
  });
}

/**
 * Leaderboard rows plus the models you can actually pick that the leaderboard
 * never scored directly but whose family supplied an estimate. Without the
 * second half a filtered table can come back empty for a model you are able to
 * choose, which reads as missing data rather than as a gap in the source.
 */
function scoredRows() {
  var rows = benchRows.slice();
  var seen = {};
  benchRows.forEach(function (row) { seen[row.id] = true; });
  allModels().forEach(function (model) {
    var key = modelKey(model);
    if (seen[key] || !model.bench || typeof model.bench.total !== "number") return;
    seen[key] = true;
    rows.push({
      id: key,
      label: model.label || key,
      vendor: model.vendor || null,
      tier: model.tier || null,
      blendedCost: typeof model.blendedCost === "number" ? model.blendedCost : null,
      context: model.context || null,
      releaseDate: model.releaseDate || null,
      reasoning: model.reasoning || null,
      bench: model.bench,
      rank: model.rank || null,
      speed: model.speed || null,
      latencyS: typeof model.latencyS === "number" ? model.latencyS : null,
      sources: model.sources || [],
      estimated: model.benchEstimated === true,
      note: model.benchNote || null
    });
  });
  return rows;
}

function benchValue(row, key) {
  if (key === "label") return row.label;
  if (key === "vendor") return row.vendor || "";
  if (key === "cost") return typeof row.blendedCost === "number" ? row.blendedCost : null;
  if (key === "speed") return row.speed && typeof row.speed.outputTps === "number" ? row.speed.outputTps : null;
  return row.bench && typeof row.bench[key] === "number" ? row.bench[key] : null;
}

function renderBenchTable() {
  var table = clear("benchTable");
  var columns = [
    ["label", "Modelo", "text"],
    ["vendor", "Fabricante", "text"],
    ["total", "Global", "num"],
    ["coding", "Código", "num"],
    ["agent", "Agente", "num"],
    ["reasoning", "Razon.", "num"],
    ["tau", "τ-bench", "num"],
    ["terminal", "Terminal", "num"],
    ["cost", "Precio", "num"],
    ["speed", "Tok/s", "num"]
  ];

  var head = el("thead");
  var headRow = el("tr");
  columns.forEach(function (column) {
    var active = benchSort.key === column[0];
    var arrow = active ? (benchSort.dir < 0 ? " ▾" : " ▴") : "";
    headRow.append(el("th", {
      className: (column[2] === "num" ? "num " : "") + "sortable",
      textContent: column[1] + arrow,
      onclick: function () {
        if (benchSort.key === column[0]) benchSort.dir *= -1;
        else benchSort = { key: column[0], dir: column[2] === "num" ? -1 : 1 };
        renderBenchTable();
      }
    }));
  });
  head.append(headRow);
  table.append(head);

  var mine = {};
  allModels().forEach(function (model) { mine[modelKey(model)] = true; });

  var limit = activeKeySet();
  var scored = scoredRows();
  var rows = scored.filter(function (row) {
    if (benchOnlyMine && !mine[row.id]) return false;
    if (limit && !limit[row.id]) return false;
    return true;
  }).sort(function (a, b) {
    var av = benchValue(a, benchSort.key), bv = benchValue(b, benchSort.key);
    if (typeof av === "string" || typeof bv === "string") {
      return String(av || "").localeCompare(String(bv || "")) * benchSort.dir;
    }
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * benchSort.dir;
  });

  var body = el("tbody");
  rows.forEach(function (row) {
    var tr = el("tr", { className: mine[row.id] ? "mine" : "", style: { cursor: "pointer" },
      onclick: function () { selectedId = row.id; renderProfile(); } });
    columns.forEach(function (column) {
      var value = benchValue(row, column[0]);
      var text = column[0] === "cost" ? money(value)
        : column[0] === "speed" ? num(value, 0)
        : column[2] === "num" ? num(value)
        : (value || "—");
      var cell = el("td", { className: column[2] === "num" ? "num small" : "small", textContent: text });
      if (column[0] === "label" && row.estimated) {
        cell.append(el("span", {
          className: "est",
          textContent: " ~",
          title: row.note || "Nota estimada a partir de variantes de la misma familia"
        }));
      }
      if (column[0] === "vendor" && row.vendor) {
        cell.replaceChildren(
          el("span", { className: "dot", style: { background: vendorColor(row.vendor) } }),
          el("span", { textContent: " " + row.vendor })
        );
      }
      tr.append(cell);
    });
    body.append(tr);
  });
  var estimatedShown = rows.filter(function (row) { return row.estimated; }).length;
  if (!rows.length) {
    body.append(el("tr", { className: "empty-row" }, [
      el("td", {
        colSpan: columns.length,
        textContent: benchOnlyMine
          ? "Ninguno de los modelos que puedes elegir tiene notas públicas ni una estimación por familia. Desactiva el botón de arriba para ver los " + scored.length + " modelos que sí están medidos, aunque no puedas escogerlos."
          : "Ninguno de los modelos filtrados tiene notas de benchmarks públicos todavía."
      })
    ]));
  }
  table.append(body);

  var sub = rows.length + " de " + scored.length + " modelos con notas" +
    (benchOnlyMine ? " · solo los que puedes elegir" : " · todo el campo público") +
    (limit ? " · filtrados" : "") + ".";
  if (!benchOnlyMine) sub += " Las filas resaltadas son modelos que tienes disponibles.";
  if (estimatedShown) sub += " Los marcados con ~ son estimaciones por familia, no medidas directas.";
  document.getElementById("benchSub").textContent = sub;
}

function renderBenchMeta() {
  var parts = [];
  if (benchMeta && benchMeta.generatedAt) parts.push("Instantánea generada el " + benchMeta.generatedAt.slice(0, 10) + ".");
  if (benchSource === "downloaded") parts.push("Descargada del repositorio público.");
  else if (benchSource === "bundled") parts.push("Usando la copia incluida con la extensión.");
  else parts.push("Sin datos: no se pudo leer ninguna instantánea.");
  if (benchMeta && benchMeta.counts) {
    parts.push(benchMeta.counts.models + " modelos, " + benchMeta.counts.withBenchmarks + " con benchmark, " + benchMeta.counts.withVendor + " con fabricante.");
  }
  if (benchMeta && benchMeta.sources && benchMeta.sources.length) {
    parts.push("Fuentes: " + benchMeta.sources.map(function (source) {
      return typeof source === "string" ? source : (source.id || source.url || "?");
    }).join(", ") + ".");
  }
  if (repoUrl) parts.push("Origen: " + repoUrl);
  document.getElementById("benchMeta").textContent = parts.join(" ");
}

// --- 3D tab -----------------------------------------------------------------

var three = null;
var sceneSignature = null;
var sceneFailedFor = null;
var sceneResetView = null;
var sceneSetSpin = null;
var sceneResize = null;
var sceneButtonsWired = false;

/** Rebuild only when the filter really changed, not on every tab switch. */
function currentSceneSignature() {
  var picked = "all";
  if (filters.picked) {
    picked = Object.keys(filters.picked).filter(function (key) { return filters.picked[key]; }).sort().join(",");
  }
  return filters.provider + "|" + picked + "|" + benchRows.length + "|" + allModels().length;
}

/**
 * Every scored row is always plotted, so the landscape and the reference
 * frame stay comparable. The filter only decides which ones get a ring and
 * which ones fade into the background.
 */
function scenePoints() {
  var limit = activeKeySet();
  return scoredRows().filter(function (row) {
    return row.bench && typeof row.bench.total === "number";
  }).map(function (row) {
    var active = !limit || limit[row.id] === true;
    return {
      id: row.id,
      label: row.label,
      vendor: row.vendor || VENDOR_FALLBACK,
      total: row.bench.total,
      cost: typeof row.blendedCost === "number" ? row.blendedCost : null,
      speed: row.speed && typeof row.speed.outputTps === "number" ? row.speed.outputTps : null,
      estimated: row.estimated === true,
      mine: active && isMine(row.id),
      dim: !active
    };
  });
}

function buildScene(THREE) {
  var host = document.getElementById("scene3d");
  var tip = document.getElementById("sceneTip");
  var points = scenePoints();
  if (!points.length) {
    host.append(el("p", { className: "small muted", style: { padding: "16px" }, textContent: "No hay datos de benchmark para dibujar." }));
    return null;
  }

  var width = host.clientWidth || 660;
  var height = host.clientHeight || 440;
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  host.insertBefore(renderer.domElement, tip);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 4000);

  var costs = points.filter(function (p) { return p.cost !== null; }).map(function (p) { return Math.log10(p.cost + 0.05); });
  var speeds = points.filter(function (p) { return p.speed !== null; }).map(function (p) { return p.speed; });
  var xMin = costs.length ? Math.min.apply(null, costs) : 0;
  var xMax = costs.length ? Math.max.apply(null, costs) : 1;
  var zMax = speeds.length ? Math.max.apply(null, speeds) : 1;
  // The vertical scale spans the measured range instead of a fixed 0-100, so
  // the axis ticks land exactly on the worst and the best measured model.
  var totals = points.map(function (p) { return p.total; });
  var yMin = totals.length ? Math.min.apply(null, totals) : 40;
  var yMax = totals.length ? Math.max.apply(null, totals) : 90;

  var span = 200;
  // A sphere with no public price cannot be placed on a log-price axis. Parking
  // it at the axis maximum made it look like the most expensive model in the
  // field, so unpriced models get their own lane past the price box instead.
  var xEnd = span * 0.5;
  var laneX = xEnd;
  function px(point) {
    if (point.cost === null) return laneX;
    var v = Math.log10(point.cost + 0.05);
    return ((v - xMin) / ((xMax - xMin) || 1) - 0.5) * span;
  }
  function py(point) { return ((point.total - yMin) / ((yMax - yMin) || 1) - 0.5) * span * 0.7; }
  function pz(point) { return ((point.speed === null ? 0 : point.speed) / (zMax || 1) - 0.5) * span * 0.6; }

  var group = new THREE.Group();
  scene.add(group);

  var geometry = new THREE.SphereGeometry(1, 16, 12);
  var pickable = [];
  function pointRadius(point) { return 2.6 + (point.total / 100) * 5.4; }
  var maxTotal = totals.length ? Math.max.apply(null, totals) : 100;
  laneX = xEnd + (2.6 + (maxTotal / 100) * 5.4) * 3.6;
  points.forEach(function (point) {
    var radius = pointRadius(point);
    var unpriced = point.cost === null;
    var material = new THREE.MeshBasicMaterial({
      color: vendorHex(point.vendor),
      transparent: true,
      opacity: point.dim ? 0.16 : unpriced ? 0.5 : point.mine ? 0.98 : 0.62,
      // A hollow shell reads as "not on this scale" instead of as a value.
      wireframe: unpriced
    });
    var mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(px(point), py(point), pz(point));
    mesh.scale.setScalar(radius);
    mesh.userData = point;
    group.add(mesh);
    pickable.push(mesh);

    if (point.mine) {
      var ring = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.45 })
      );
      ring.position.copy(mesh.position);
      ring.scale.setScalar(radius * 1.25);
      group.add(ring);
    }
  });

  // The frame is derived from the point positions themselves, expanded by the
  // largest sphere, so the wireframe, the floor grid, the arrows and the tick
  // labels all agree with where the spheres actually sit.
  var dataBox = new THREE.Box3();
  // Unpriced spheres live in their own lane outside the price box and must not
  // stretch it, or the price axis would look like it reaches further than it
  // does. Their height and depth still have to fall inside the frame.
  var priced = points.filter(function (point) { return point.cost !== null; });
  (priced.length ? priced : points).forEach(function (point) {
    dataBox.expandByPoint(new THREE.Vector3(px(point), py(point), pz(point)));
  });
  if (priced.length && priced.length !== points.length) {
    points.forEach(function (point) {
      dataBox.expandByPoint(new THREE.Vector3(dataBox.min.x, py(point), pz(point)));
      dataBox.expandByPoint(new THREE.Vector3(dataBox.max.x, py(point), pz(point)));
    });
  }
  var biggest = 0;
  points.forEach(function (point) { biggest = Math.max(biggest, pointRadius(point)); });
  dataBox.expandByScalar(biggest * 1.05);

  var center = dataBox.getCenter(new THREE.Vector3());
  var size = dataBox.getSize(new THREE.Vector3());
  var sphereSize = size.length() || span;
  var radius = sphereSize * 1.15;

  var AXIS = {
    x: { hex: 0xf0a000, css: "#a86a00", title: "Precio (log) →" },
    y: { hex: 0x1a9c4a, css: "#157f3c", title: "↑ Nota global" },
    z: { hex: 0x2f7ae5, css: "#2461b8", title: "Velocidad (tok/s) →" }
  };
  var LABEL_H = sphereSize * 0.052;
  var LABEL_FONT = "600 44px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  // Sprites always face the camera, so the labels stay readable while rotating.
  function makeLabel(text, cssColor, worldHeight) {
    var pad = 14, font = 44;
    var probe = document.createElement("canvas").getContext("2d");
    probe.font = LABEL_FONT;
    var canvas = document.createElement("canvas");
    canvas.width = Math.ceil(probe.measureText(text).width) + pad * 2;
    canvas.height = font + pad * 2;
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 2;
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(1, 1, w - 2, h - 2, 12);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(0, 0, w, h);
    }
    ctx.font = LABEL_FONT;
    ctx.fillStyle = cssColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 + 2);

    var texture = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace && "colorSpace" in texture) texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture, transparent: true, depthTest: false, depthWrite: false
    }));
    sprite.scale.set(worldHeight * (w / h), worldHeight, 1);
    sprite.renderOrder = 20;
    return sprite;
  }

  var frame = new THREE.Group();
  scene.add(frame);

  var boxHelper = new THREE.Box3Helper(dataBox, AXIS.y.hex);
  boxHelper.material.transparent = true;
  boxHelper.material.opacity = 0.24;
  boxHelper.material.depthWrite = false;
  frame.add(boxHelper);

  var grid = new THREE.GridHelper(Math.max(size.x, size.z) * 1.4, 10, 0x8c96a3, 0xc4ccd6);
  grid.position.set(center.x, dataBox.min.y, center.z);
  grid.material.transparent = true;
  grid.material.opacity = 0.32;
  grid.material.depthWrite = false;
  frame.add(grid);

  var pad = sphereSize * 0.05;
  var origin = new THREE.Vector3(dataBox.min.x - pad, dataBox.min.y, dataBox.min.z - pad);
  [
    { dir: new THREE.Vector3(1, 0, 0), len: size.x + pad * 2, cfg: AXIS.x },
    { dir: new THREE.Vector3(0, 1, 0), len: size.y + pad * 2, cfg: AXIS.y },
    { dir: new THREE.Vector3(0, 0, 1), len: size.z + pad * 2, cfg: AXIS.z }
  ].forEach(function (axis) {
    var arrow = new THREE.ArrowHelper(axis.dir, origin, axis.len, axis.cfg.hex,
      Math.max(axis.len * 0.04, 2), Math.max(axis.len * 0.024, 1.4));
    arrow.line.material.transparent = true;
    arrow.line.material.opacity = 0.85;
    arrow.line.material.depthWrite = false;
    arrow.cone.material.transparent = true;
    arrow.cone.material.opacity = 0.95;
    arrow.cone.material.depthWrite = false;
    frame.add(arrow);
  });

  // Ticks sit at the real data extremes, not at the padded box edges.
  var xLow = px({ cost: Math.pow(10, xMin) - 0.05 });
  var xHigh = px({ cost: Math.pow(10, xMax) - 0.05 });
  var yLow = py({ total: yMin });
  var yHigh = py({ total: yMax });
  var zLow = pz({ speed: 0 });
  var zHigh = pz({ speed: zMax });
  [
    { text: money(Math.pow(10, xMin) - 0.05), cfg: AXIS.x, at: new THREE.Vector3(xLow, origin.y, origin.z) },
    { text: money(Math.pow(10, xMax) - 0.05), cfg: AXIS.x, at: new THREE.Vector3(xHigh, origin.y, origin.z) },
    { text: num(yMin, 1), cfg: AXIS.y, at: new THREE.Vector3(origin.x, yLow, origin.z) },
    { text: num(yMax, 1), cfg: AXIS.y, at: new THREE.Vector3(origin.x, yHigh, origin.z) },
    { text: "0", cfg: AXIS.z, at: new THREE.Vector3(origin.x, origin.y, zLow) },
    { text: num(zMax, 0), cfg: AXIS.z, at: new THREE.Vector3(origin.x, origin.y, zHigh) },
    { text: AXIS.x.title, cfg: AXIS.x, at: new THREE.Vector3(dataBox.max.x + pad * 4, origin.y, origin.z), big: true },
    { text: AXIS.y.title, cfg: AXIS.y, at: new THREE.Vector3(origin.x, dataBox.max.y + pad * 3, origin.z), big: true },
    { text: AXIS.z.title, cfg: AXIS.z, at: new THREE.Vector3(origin.x, origin.y, dataBox.max.z + pad * 4), big: true }
  ].forEach(function (tick) {
    var sprite = makeLabel(tick.text, tick.cfg.css, tick.big ? LABEL_H * 1.35 : LABEL_H);
    sprite.position.copy(tick.at);
    frame.add(sprite);
  });

  // Mark the unpriced lane so a hollow sphere is never mistaken for a value.
  var unpricedCount = points.filter(function (point) { return point.cost === null; }).length;
  if (unpricedCount) {
    var laneTop = dataBox.max.y + biggest * 2.2;
    var laneBottom = dataBox.min.y - biggest * 1.6;
    var laneZ = dataBox.min.z - pad * 2;
    var laneGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(laneX, laneBottom, laneZ),
      new THREE.Vector3(laneX, laneTop, laneZ)
    ]);
    var laneLine = new THREE.Line(laneGeometry,
      new THREE.LineDashedMaterial({ color: 0x8c96a3, dashSize: biggest, gapSize: biggest * 0.6 }));
    laneLine.computeLineDistances();
    laneLine.material.transparent = true;
    laneLine.material.opacity = 0.6;
    laneLine.material.depthWrite = false;
    frame.add(laneLine);

    var laneLabel = makeLabel("sin precio público", "#59636e", LABEL_H * 1.05);
    laneLabel.position.set(laneX, laneBottom - LABEL_H, laneZ);
    frame.add(laneLabel);
  }

  var theta = 0.9;
  var phi = 1.15;

  function updateCamera() {
    camera.position.set(
      center.x + radius * Math.sin(phi) * Math.cos(theta),
      center.y + radius * Math.cos(phi),
      center.z + radius * Math.sin(phi) * Math.sin(theta)
    );
    camera.lookAt(center);
    renderer.render(scene, camera);
  }

  var dragging = false, lastX = 0, lastY = 0, moved = 0;
  var canvas = renderer.domElement;
  canvas.style.cursor = "grab";

  canvas.addEventListener("pointerdown", function (event) {
    dragging = true; moved = 0; lastX = event.clientX; lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", function (event) {
    if (dragging) {
      var dx = event.clientX - lastX, dy = event.clientY - lastY;
      lastX = event.clientX; lastY = event.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      theta -= dx * 0.006;
      phi = Math.max(0.18, Math.min(Math.PI - 0.18, phi - dy * 0.006));
      updateCamera();
      return;
    }
    var rect = canvas.getBoundingClientRect();
    var pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    var hit = raycaster.intersectObjects(pickable, false)[0];
    if (hit) {
      var point = hit.object.userData;
      tip.style.display = "block";
      tip.style.left = Math.min(event.clientX - rect.left + 12, rect.width - 250) + "px";
      tip.style.top = Math.max(event.clientY - rect.top - 8, 4) + "px";
      tip.textContent = point.label + " — " + point.vendor +
        " · global " + point.total.toFixed(1) +
        (point.cost === null ? "" : " · " + money(point.cost) + "/1M") +
        (point.speed === null ? "" : " · " + Math.round(point.speed) + " tok/s");
    } else {
      tip.style.display = "none";
    }
  });
  function endDrag() { dragging = false; canvas.style.cursor = "grab"; }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", function () { tip.style.display = "none"; endDrag(); });

  canvas.addEventListener("wheel", function (event) {
    event.preventDefault();
    radius = Math.max(sphereSize * 0.35, Math.min(sphereSize * 4, radius * (1 + event.deltaY * 0.0012)));
    updateCamera();
  }, { passive: false });

  sceneResize = function () {
    var w = host.clientWidth || width;
    var h = host.clientHeight || height;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    updateCamera();
  };
  window.addEventListener("resize", sceneResize);

  var home = { theta: 0.9, phi: 1.15, radius: sphereSize * 1.15 };
  sceneResetView = function () {
    theta = home.theta;
    phi = home.phi;
    radius = home.radius;
    updateCamera();
  };

  var spinning = false;
  var spinFrame = null;
  function spinTick() {
    if (!spinning) { spinFrame = null; return; }
    theta -= 0.004;
    updateCamera();
    spinFrame = window.requestAnimationFrame(spinTick);
  }
  sceneSetSpin = function (on) {
    spinning = !!on;
    if (spinning && spinFrame === null) spinFrame = window.requestAnimationFrame(spinTick);
  };

  var highlighted = points.filter(function (point) { return point.mine; }).length;
  var dimmed = points.filter(function (point) { return point.dim; }).length;
  var status = document.getElementById("sceneStatus");
  if (status) {
    status.textContent = points.length + " esferas · " + highlighted + " con halo (tus modelos)" +
      (dimmed ? " · " + dimmed + " atenuadas por el filtro" : "") +
      (unpricedCount ? " · " + unpricedCount + " sin precio público (huecas, en su carril)" : "");
  }

  updateCamera();
  return renderer;
}

function disposeScene() {
  if (sceneResetView) sceneResetView = null;
  if (sceneSetSpin) sceneSetSpin(false);
  sceneSetSpin = null;
  if (sceneResize) { window.removeEventListener("resize", sceneResize); sceneResize = null; }
  if (!three) return;
  var host = document.getElementById("scene3d");
  try {
    if (three.domElement && three.domElement.parentNode === host) host.removeChild(three.domElement);
    three.dispose();
  } catch (error) { /* a lost WebGL context can throw on teardown; nothing left to do */ }
  three = null;
  sceneSignature = null;
  var tip = document.getElementById("sceneTip");
  if (tip) tip.style.display = "none";
}

async function ensureScene() {
  wireSceneButtons();
  var signature = currentSceneSignature();
  if (three && sceneSignature === signature) return;
  if (three) disposeScene();
  if (sceneFailedFor === signature) return;

  var host = document.getElementById("scene3d");
  clearSceneMessages();
  try {
    var module = await import("/vendor/three.module.min.js");
    three = buildScene(module);
    sceneSignature = signature;
    if (!three) {
      sceneFailedFor = signature;
      sceneMessage("No hay datos de benchmark suficientes para dibujar el mapa.");
    }
  } catch (error) {
    sceneFailedFor = signature;
    sceneMessage("No se pudo cargar el visor 3D (" + (error && error.message ? error.message : "error desconocido") +
      "). La pestaña Comparativa tiene exactamente los mismos datos.");
  }
}

function sceneMessage(text) {
  var host = document.getElementById("scene3d");
  host.append(el("p", { className: "small muted scene-message", style: { padding: "16px" }, textContent: text }));
}

function clearSceneMessages() {
  document.querySelectorAll("#scene3d .scene-message").forEach(function (node) { node.remove(); });
}

function renderSceneLegend() {
  var legend = clear("sceneLegend");
  var vendors = {};
  var points = scenePoints();
  points.forEach(function (point) { vendors[point.vendor] = true; });
  Object.keys(vendors).sort().forEach(function (vendor) {
    legend.append(el("span", null, [
      el("span", { className: "dot", style: { background: vendorColor(vendor) } }),
      el("span", { textContent: " " + vendor })
    ]));
  });
  var highlighted = points.filter(function (point) { return point.mine; }).length;
  var unpriced = points.filter(function (point) { return point.cost === null; }).length;
  legend.append(el("span", {
    className: "tiny",
    textContent: highlighted + " modelos resaltados con halo" +
      (filterActive() ? " (" + activeModels().length + " pasan el filtro actual)" : "")
  }));
  if (unpriced) {
    legend.append(el("span", {
      className: "tiny",
      textContent: unpriced + " esferas huecas: sin precio público, fuera del eje X"
    }));
  }
  renderAxisKey();
}

function renderAxisKey() {
  var host = document.getElementById("sceneAxes");
  if (!host) return;
  clear("sceneAxes");
  [
    ["#c07800", "x · Precio", "izquierda barato → derecha caro, en escala logarítmica"],
    ["#157f3c", "y · Nota global", "abajo el peor modelo medido → arriba el mejor (escala 0–100)"],
    ["#2461b8", "z · Velocidad", "fondo lento → frente rápido, en tokens por segundo"]
  ].forEach(function (axis) {
    host.append(el("span", null, [
      el("span", { className: "swatch", style: { background: axis[0] } }),
      el("b", { textContent: axis[1] }),
      el("span", { textContent: " " + axis[2] })
    ]));
  });
}

function wireSceneButtons() {
  if (sceneButtonsWired) return;
  sceneButtonsWired = true;
  var reset = document.getElementById("sceneReset");
  if (reset) reset.addEventListener("click", function () { if (sceneResetView) sceneResetView(); });
  var spin = document.getElementById("sceneSpin");
  if (spin) {
    spin.addEventListener("click", function () {
      var on = spin.getAttribute("aria-pressed") !== "true";
      spin.setAttribute("aria-pressed", on ? "true" : "false");
      if (sceneSetSpin) sceneSetSpin(on);
    });
  }
}

// --- guide tab --------------------------------------------------------------

function renderGuide() {
  defs("guideDefs", [
    ["Enrutado", "Aquí eliges qué modelo atiende cada papel: los tres roles del workflow (planificar, ejecutar, verificar) y los subagentes que lanza el agente principal."],
    ["Exigencia (modelPolicy)", "Decide si el modelo fijado es obligatorio (required), una simple sugerencia (preferred) o si no opinas (inherit). Es lo que evita que una llamada suelta se vaya a un modelo caro sin que te enteres."],
    ["Esfuerzo (effort)", "Cuánto piensa el modelo antes de contestar. Más esfuerzo resuelve mejor lo difícil y cuesta más por llamada; menos esfuerzo responde antes y gasta menos."],
    ["Catálogo", "Los modelos que tienes disponibles de verdad, leídos del runtime. Incluye el fabricante, la categoría de precio, el contexto y su nota global."],
    ["Comparativa", "La parte educativa: para cada tipo de tarea te dice qué modelo sale mejor y por qué, con las notas públicas de benchmarks y el precio al lado."],
    ["Benchmark", "Una prueba estandarizada con la que se mide a los modelos. Ninguno gana en todo: hay quien escribe mejor código y quien razona mejor. Por eso la recomendación cambia según la tarea."],
    ["Fabricante frente a proveedor", "El proveedor es quien te sirve el modelo (GitHub Copilot o tu proveedor externo). El fabricante es quien lo construyó (Anthropic, OpenAI, Alibaba…). Un mismo fabricante puede llegarte por las dos vías."],
    ["Traer tu propia clave", "Los modelos del proveedor externo se pagan contra tu cuenta de ese proveedor, no contra la cuota de Copilot. Son los que hacen barato el trabajo masivo."],
    ["Auto", "Cuando el agente elige modelo por su cuenta tiende a subir a los grandes. Fijar los subagentes con un modelo barato y exigencia required es lo que corta esa escalada."],
    ["Instantánea de datos", "Un fichero JSON con fabricantes, precios, notas de benchmark y velocidades, generado desde fuentes públicas y actualizado periódicamente por el propio repositorio."],
    ["Filtro por proveedor", "Reduce todo lo que ves a los modelos de un solo proveedor. Al elegir tu proveedor externo, las seis recomendaciones y los subagentes se recalculan usando solo esos modelos: sirve para comprobar qué conviene dentro de lo que ya pagas."],
    ["Selección de modelos", "Puedes quitar modelos concretos de la comparación con un clic. El primer clic deja seleccionados todos y desmarca el que pulsaste, así que se quita de uno en uno. Mientras haya selección manual, todo se calcula con los que queden."],
    ["Solo mis modelos en la tabla", "La tabla arranca mostrando solo las filas que coinciden con tu catálogo, para no perder de vista los tuyos entre los demás. Al desactivarlo aparecen los 88 modelos del ranking público, útiles como referencia aunque no puedas escogerlos."],
    ["Notas estimadas (~)", "Si el benchmark no midió tu modelo exacto pero sí variantes de su familia, la nota es la mediana de esas variantes y va marcada con una tilde. Nunca se presenta como una medida directa."]
  ]);
}

function renderSources() {
  defs("sourceDefs", [
    ["models.dev", "Catálogo abierto de proveedores y modelos. Aporta fabricante, precios, contexto, capacidades y pesos abiertos. Licencia MIT. Mantenido por el proyecto anomalyco (antes sst).",
      "https://github.com/anomalyco/models.dev"],
    ["chinese-llm-benchmark", "Repositorio público con clasificaciones por capacidad: razonamiento, código, uso de herramientas, terminal, medicina, derecho, finanzas… De aquí salen todas las notas de benchmark. Es el trabajo de jeinlee1991 y colaboradores; el repositorio no declara una licencia explícita, así que solo se reproducen las puntuaciones numéricas ya publicadas, sin copiar su código ni su texto.",
      "https://github.com/jeinlee1991/chinese-llm-benchmark"],
    ["showdown", "Comparativa pública de velocidad y latencia, usada además para contrastar precios y completar huecos. Licencia AGPL-3.0. De aquí solo se extraen los valores numéricos de velocidad; no se reutiliza su código.",
      "https://github.com/verseles/showdown"],
    ["three.js", "Biblioteca con la que se dibuja la pestaña 3D. Se incluye empaquetada dentro de la extensión, así que el panel funciona sin conexión. Licencia MIT.",
      "https://github.com/mrdoob/three.js"],
    ["Instantánea", "Las tres fuentes de datos se cruzan en un único JSON que se descarga el propio panel. Si no hay conexión, se usa la copia incluida con la extensión."],
    ["Actualización automática", "Un flujo de trabajo del repositorio regenera la instantánea cada semana y la publica, así que el panel no tiene que mantener ninguna lista a mano."],
    ["~ (nota estimada)", "Cuando el benchmark no midió ese modelo exacto pero sí variantes de su misma familia, se muestra la mediana de esas variantes marcada con una tilde. Es una estimación, no una medida directa, y el panel lo dice explícitamente en lugar de dejarlo pasar por un dato real."],
    ["Sin precio público", "Algunos modelos medidos no publican tarifa. No se pueden colocar en un eje de precio, así que la tabla los deja sin coste y el 3D los dibuja huecos en un carril aparte."]
  ]);
  var parts = [];
  if (benchMeta && benchMeta.generatedAt) parts.push("Instantánea actual: " + benchMeta.generatedAt.slice(0, 10) + ".");
  parts.push(benchSource === "downloaded" ? "Se está usando la versión descargada del repositorio." : benchSource === "bundled" ? "Se está usando la copia incluida con la extensión." : "No se ha podido cargar ninguna instantánea.");
  if (repoUrl) parts.push("Repositorio del panel: " + repoUrl);
  document.getElementById("sourceMeta").textContent = parts.join(" ");
}

// --- actions ----------------------------------------------------------------

async function post(path, body) {
  var response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.json();
}

async function applyRouting() {
  setStatus("Guardando…");
  try {
    var result = await post("/routing", state);
    if (result && result.routing) state = result.routing;
    dirty = false;
    setStatus(result && result.applied ? "Guardado y aplicado a la sesión." : "Guardado.", "ok");
    renderAll();
  } catch (error) {
    setStatus("No se pudo guardar: " + error.message, "err");
  }
}

async function resetRouting() {
  if (!window.confirm("¿Restaurar los valores por defecto del enrutado? Se perderán los cambios guardados.")) return;
  setStatus("Restaurando…");
  try {
    var result = await post("/reset", {});
    if (result && result.routing) state = result.routing;
    dirty = false;
    setStatus("Valores por defecto restaurados.", "ok");
    renderAll();
  } catch (error) {
    setStatus("No se pudo restaurar: " + error.message, "err");
  }
}

async function refreshData() {
  setStatus("Actualizando catálogo y datos públicos…");
  try {
    var payload = await (await fetch("/catalog?refresh=1")).json();
    if (payload.catalog) catalog = catalogGroups(payload.catalog);
    var data = await (await fetch("/data?refresh=1")).json();
    if (data.rows) benchRows = data.rows;
    if (data.meta) benchMeta = data.meta;
    if (data.source) benchSource = data.source;
    sceneSignature = null;
    if (three) disposeScene();
    setStatus("Datos actualizados.", "ok");
    renderAll();
  } catch (error) {
    setStatus("No se pudo actualizar: " + error.message, "err");
  }
}

function renderAll() {
  invalidateMineKeys();
  renderRoles();
  renderSubagents();
  renderRoutingDefs();
  renderCatalog();
  renderCatalogDefs();
  renderFilterBar();
  renderFilterBanner();
  renderRecommendations();
  renderProfile();
  renderScatter();
  renderBenchTable();
  renderBenchMeta();
  renderSceneLegend();
  renderGuide();
  renderSources();
}

function activateTab(name) {
  document.querySelectorAll("#tabs button").forEach(function (button) {
    button.setAttribute("aria-selected", String(button.dataset.tab === name));
  });
  document.querySelectorAll(".panel").forEach(function (panel) {
    panel.dataset.active = String(panel.dataset.panel === name);
  });
  if (name === "scene") ensureScene();
}

document.getElementById("tabs").addEventListener("click", function (event) {
  var button = event.target.closest("button[data-tab]");
  if (button) activateTab(button.dataset.tab);
});
document.getElementById("apply").addEventListener("click", applyRouting);
document.getElementById("reset").addEventListener("click", resetRouting);
document.getElementById("refresh").addEventListener("click", refreshData);

window.addEventListener("beforeunload", function (event) {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

renderAll();

try {
  var events = new EventSource("/events");
  events.addEventListener("routing", function (event) {
    if (dirty) return;
    try {
      state = JSON.parse(event.data);
      renderAll();
    } catch (error) { /* ignore malformed push */ }
  });
} catch (error) { /* SSE unsupported: the page still works, just not live */ }
`;
