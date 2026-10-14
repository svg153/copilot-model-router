// Canvas renderer. Served from the extension's loopback server; talks back
// over plain HTTP (GET/POST /routing) plus an SSE stream on /events.

function escapeJsonForScript(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function renderHtml({ routing, catalog, effortLevels, subagentTypes, modelPolicies }) {
    const bootstrap = escapeJsonForScript({ routing, catalog, effortLevels, subagentTypes, modelPolicies });

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Model Router</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    padding: 16px;
    background: var(--background-color-default, #ffffff);
    color: var(--text-color-default, #1f2328);
    font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
    font-size: var(--text-body-medium, 14px);
    line-height: var(--leading-body-medium, 20px);
  }
  h1 {
    font-family: var(--font-sans-display, var(--font-sans, system-ui));
    font-size: var(--text-title-large, 26px);
    font-weight: var(--font-weight-semibold, 600);
    line-height: var(--leading-title-large, 32px);
    margin: 0 0 4px;
  }
  .sub { color: var(--text-color-muted, #59636e); margin: 0 0 20px; }
  section {
    border: 1px solid var(--border-color-default, #d1d9e0);
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 16px;
  }
  h2 { font-size: 15px; font-weight: var(--font-weight-semibold, 600); margin: 0 0 10px; }
  .row { display: grid; grid-template-columns: 120px 1fr 120px; gap: 10px; align-items: center; margin-bottom: 8px; }
  .row.subagent { grid-template-columns: 140px 1fr 100px 120px; }
  .row.head { margin-bottom: 4px; }
  .row.head span { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-color-muted, #59636e); }
  .row .name { font-weight: var(--font-weight-semibold, 600); }
  .row .hint { grid-column: 2 / -1; color: var(--text-color-muted, #59636e); font-size: 12px; margin: -4px 0 4px; }
  select, input[type=number] {
    width: 100%;
    padding: 5px 8px;
    border-radius: 6px;
    border: 1px solid var(--border-color-default, #d1d9e0);
    background: var(--background-color-default, #ffffff);
    color: var(--text-color-default, #1f2328);
    font: inherit;
  }
  select:focus-visible, input:focus-visible, button:focus-visible {
    outline: 2px solid var(--color-focus-outline, #0969da);
    outline-offset: 1px;
  }
  .actions { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
  button {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--border-color-default, #d1d9e0);
    background: var(--background-color-default, #ffffff);
    color: var(--text-color-default, #1f2328);
    font: inherit;
    cursor: pointer;
  }
  button.primary { background: var(--color-focus-outline, #0969da); border-color: transparent; color: var(--color-white, #ffffff); }
  button:disabled { opacity: .55; cursor: default; }
  .status { color: var(--text-color-muted, #59636e); font-size: 12px; margin-left: auto; }
  .status[data-tone=ok] { color: var(--true-color-blue, #0969da); }
  .status[data-tone=err] { color: var(--true-color-red, #cf222e); }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border-color-default, #d1d9e0); font-size: 13px; }
  th { color: var(--text-color-muted, #59636e); font-weight: var(--font-weight-semibold, 600); }
  td.provider { color: var(--text-color-muted, #59636e); }
  .tier {
    display: inline-block;
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 999px;
    border: 1px solid var(--border-color-default, #d1d9e0);
    color: var(--text-color-muted, #59636e);
  }
  .tier[data-tier=low], .tier[data-tier=byok] { color: var(--true-color-blue, #0969da); }
  .tier[data-tier=high], .tier[data-tier=very_high] { color: var(--true-color-red, #cf222e); }
  .section-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
  .section-head h2 { margin: 0; }
  .section-head .status { margin-left: auto; }
  .legend { color: var(--text-color-muted, #59636e); font-size: 12px; margin: 8px 0 0; }
  code { font-family: var(--font-mono, "SFMono-Regular", Consolas, monospace); font-size: var(--text-code-inline, 12px); }
  .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field label { font-size: 12px; color: var(--text-color-muted, #59636e); }
  dl.defs { margin: 0; font-size: 12px; color: var(--text-color-muted, #59636e); }
  dl.defs dt {
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-color-default, #1f2328);
    margin-top: 8px;
  }
  dl.defs dt:first-child { margin-top: 0; }
  dl.defs dd { margin: 2px 0 0; }
  dl.defs code { font-size: 11px; }
</style>
</head>
<body>
  <h1>Model Router</h1>
  <p class="sub">Un modelo premium planifica, modelos baratos ejecutan en paralelo y un tercero verifica.</p>

  <section>
    <h2>Cómo funciona</h2>
    <dl class="defs">
      <dt>Roles del workflow</dt>
      <dd>El modelo de cada fase del workflow <code>plan-then-execute</code>. Adem&aacute;s es lo que lee el agente para repartir el trabajo por su cuenta, as&iacute; que tambi&eacute;n manda fuera del workflow.</dd>
      <dt>Subagentes fijados</dt>
      <dd>El modelo de cada tipo de subagente que el agente lanza con la herramienta <code>task</code>. No cambia el modelo de esta sesi&oacute;n: solo el de los subagentes que se lancen.</dd>
      <dt>Cat&aacute;logo de modelos</dt>
      <dd>Los modelos que tienes disponibles en esta sesi&oacute;n ahora mismo. Es de solo lectura: sirve para saber qu&eacute; puedes elegir y cu&aacute;nto cuesta cada uno.</dd>
      <dt>Aplicar / Restaurar</dt>
      <dd><b>Aplicar</b> guarda estos valores en disco y los aplica a la sesi&oacute;n en curso. <b>Restaurar</b> los devuelve a los valores por defecto de la extensi&oacute;n.</dd>
    </dl>
  </section>

  <section>
    <h2>Roles del workflow</h2>
    <p class="legend">Qu&eacute; hace cada rol y con cu&aacute;nto esfuerzo.</p>
    <div id="roles"></div>
    <dl class="defs">
      <dt>Effort (esfuerzo)</dt>
      <dd>El presupuesto de razonamiento: cu&aacute;nto piensa el modelo antes de responder. <code>high</code> da mejores planes y revisiones, pero tarda m&aacute;s y cuesta m&aacute;s; <code>low</code> basta para trabajo mec&aacute;nico. Sube el esfuerzo en planificar y verificar, y b&aacute;jalo en ejecutar.</dd>
    </dl>
  </section>

  <section>
    <h2>Subagentes fijados</h2>
    <p class="legend">Un <em>pin</em> fija qu&eacute; modelo usa un tipo de subagente cuando el agente lo lanza.</p>
    <div id="subagents"></div>
    <dl class="defs">
      <dt>Effort (esfuerzo)</dt>
      <dd>Igual que en los roles. Con varios subagentes en paralelo conviene <code>low</code>: son muchas llamadas y el coste se multiplica.</dd>
      <dt>Enforcement &mdash; <code>required</code></dt>
      <dd><b>Obligatorio.</b> Si el agente intenta lanzar este subagente con otro modelo, se rechaza y se usa el fijado. Es lo que impide que se escape a un modelo premium.</dd>
      <dt>Enforcement &mdash; <code>preferred</code></dt>
      <dd><b>Sugerencia.</b> Se usa el modelo fijado salvo que el agente pida otro expl&iacute;citamente; entonces gana el suyo.</dd>
      <dt>Enforcement &mdash; <code>inherit</code></dt>
      <dd><b>Sin opini&oacute;n.</b> No se escribe nada y manda el comportamiento por defecto del runtime.</dd>
      <dt>Subagentes en paralelo / Profundidad</dt>
      <dd>Cu&aacute;ntos subagentes pueden correr a la vez y hasta qu&eacute; profundidad pueden anidarse. M&aacute;s concurrencia acaba antes y consume m&aacute;s.</dd>
    </dl>
    <div class="grid2" style="margin-top:10px">
      <div class="field">
        <label for="maxConcurrency">Subagentes en paralelo</label>
        <input id="maxConcurrency" type="number" min="1" step="1" />
      </div>
      <div class="field">
        <label for="maxDepth">Profundidad m&aacute;xima de anidado</label>
        <input id="maxDepth" type="number" min="1" step="1" />
      </div>
    </div>
  </section>

  <section>
    <div class="section-head">
      <h2>Cat&aacute;logo de modelos</h2>
      <button id="refreshCatalog">Refrescar</button>
      <span class="status" id="catalogStatus"></span>
    </div>
    <table><thead><tr><th>Modelo</th><th>Proveedor</th><th>Fabricante</th><th>Tier</th></tr></thead><tbody id="catalog"></tbody></table>
    <p class="legend">Le&iacute;do en vivo de esta sesi&oacute;n, as&iacute; que refleja tu plan y tus proveedores reales. <b>Tier</b> es el coste relativo en tokens: <code>low</code> y <code>byok</code> son baratos; <code>high</code> y <code>very_high</code>, caros. <code>byok</code> significa que no se factura al plan de Copilot, sino a tu otro proveedor.</p>
  </section>

  <div class="actions">
    <button class="primary" id="save">Aplicar routing</button>
    <button id="reset">Restaurar por defecto</button>
    <span class="status" id="status"></span>
  </div>

<script>
const BOOT = ${bootstrap};
let state = BOOT.routing;

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
    else node[key] = value;
  }
  for (const child of children) node.append(child);
  return node;
}

function modelSelect(value, onInput) {
  const select = el("select", { value: value ?? "" });
  for (const group of BOOT.catalog.providers) {
    const optgroup = el("optgroup", { label: group.label });
    for (const model of group.models) {
      optgroup.append(el("option", { value: model.id, textContent: model.label }));
    }
    select.append(optgroup);
  }
  if (value && ![...select.options].some((o) => o.value === value)) {
    select.append(el("option", { value, textContent: value + " (custom)" }));
  }
  select.value = value ?? "";
  select.addEventListener("change", () => onInput(select.value));
  return select;
}

function effortSelect(value, onInput) {
  const select = el("select", {});
  for (const level of BOOT.effortLevels) select.append(el("option", { value: level, textContent: level }));
  select.value = value ?? "low";
  select.addEventListener("change", () => onInput(select.value));
  return select;
}

function policySelect(value, onInput) {
  const select = el("select", {});
  select.append(el("option", { value: "", textContent: "inherit" }));
  for (const policy of BOOT.modelPolicies) {
    select.append(el("option", { value: policy, textContent: policy }));
  }
  select.value = value ?? "";
  select.addEventListener("change", () => onInput(select.value || null));
  return select;
}

const ROLE_LABELS = {
  plan: ["Planificar", "Arquitectura, descomposici\\u00f3n, razonamiento dif\\u00edcil."],
  execute: ["Ejecutar", "Trabajo en volumen: buscar, resumir, ediciones mec\\u00e1nicas."],
  verify: ["Verificar", "Comprobaci\\u00f3n independiente de lo que produjeron los ejecutores."],
};

function renderRoles() {
  const host = document.getElementById("roles");
  host.replaceChildren();
  for (const role of ["plan", "execute", "verify"]) {
    const [label, hint] = ROLE_LABELS[role];
    const current = state.roles[role] ?? {};
    host.append(el("div", { className: "row" }, [
      el("span", { className: "name", textContent: label }),
      modelSelect(current.model, (v) => { state.roles[role].model = v; }),
      effortSelect(current.effort, (v) => { state.roles[role].effort = v; }),
    ]));
    host.append(el("div", { className: "row" }, [el("span", {}), el("span", { className: "hint", textContent: hint })]));
  }
}

function renderSubagents() {
  const host = document.getElementById("subagents");
  host.replaceChildren();
  host.append(el("div", { className: "row subagent head" }, [
    el("span", { textContent: "Subagente" }),
    el("span", { textContent: "Modelo" }),
    el("span", { textContent: "Esfuerzo" }),
    el("span", { textContent: "Enforcement" }),
  ]));
  for (const type of BOOT.subagentTypes) {
    const entry = state.subagents.agents[type] ?? {};
    const set = (field, value) => {
      state.subagents.agents[type] = { ...state.subagents.agents[type], [field]: value };
    };
    host.append(el("div", { className: "row subagent" }, [
      el("code", { textContent: type }),
      modelSelect(entry.model, (v) => set("model", v)),
      effortSelect(entry.effortLevel, (v) => set("effortLevel", v)),
      policySelect(entry.modelPolicy, (v) => set("modelPolicy", v)),
    ]));
  }
  document.getElementById("maxConcurrency").value = state.subagents.maxConcurrency ?? "";
  document.getElementById("maxDepth").value = state.subagents.maxDepth ?? "";
}

function renderCatalog() {
  const host = document.getElementById("catalog");
  host.replaceChildren();
  for (const group of BOOT.catalog.providers) {
    for (const model of group.models) {
      host.append(el("tr", {}, [
        el("td", {}, [el("code", { textContent: model.label })]),
        el("td", { className: "provider", textContent: group.label }),
        el("td", { className: "provider", textContent: model.vendor ?? "" }),
        el("td", {}, [el("span", { className: "tier", dataset: { tier: model.tier }, textContent: model.tier })]),
      ]));
    }
  }
  const total = BOOT.catalog.providers.reduce((n, group) => n + group.models.length, 0);
  if (!total) {
    host.append(el("tr", {}, [el("td", { colSpan: 4, className: "provider", textContent: "No hay modelos disponibles." })]));
  }
  setCatalogStatus(
    total + " modelos, " + BOOT.catalog.providers.length + " proveedor(es) \\u2014 " + BOOT.catalog.source,
    BOOT.catalog.source === "live" ? "ok" : "err"
  );
}

function setCatalogStatus(text, tone) {
  const node = document.getElementById("catalogStatus");
  node.textContent = text;
  node.dataset.tone = tone ?? "";
}

function setStatus(text, tone) {
  const node = document.getElementById("status");
  node.textContent = text;
  node.dataset.tone = tone ?? "";
}

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

document.getElementById("save").addEventListener("click", async (event) => {
  event.target.disabled = true;
  setStatus("Aplicando\\u2026");
  try {
    const concurrency = Number(document.getElementById("maxConcurrency").value);
    const depth = Number(document.getElementById("maxDepth").value);
    const patch = {
      roles: state.roles,
      subagents: {
        agents: state.subagents.agents,
        maxConcurrency: Number.isInteger(concurrency) && concurrency > 0 ? concurrency : null,
        maxDepth: Number.isInteger(depth) && depth > 0 ? depth : null,
      },
    };
    state = (await post("/routing", patch)).routing;
    setStatus("Aplicado", "ok");
  } catch (error) {
    setStatus(String(error.message || error), "err");
  } finally {
    event.target.disabled = false;
  }
});

document.getElementById("reset").addEventListener("click", async (event) => {
  event.target.disabled = true;
  setStatus("Restaurando\\u2026");
  try {
    state = (await post("/reset", {})).routing;
    renderRoles();
    renderSubagents();
    setStatus("Valores por defecto restaurados", "ok");
  } catch (error) {
    setStatus(String(error.message || error), "err");
  } finally {
    event.target.disabled = false;
  }
});

document.getElementById("refreshCatalog").addEventListener("click", async (event) => {
  event.target.disabled = true;
  setCatalogStatus("Refrescando\\u2026");
  try {
    const { catalog } = await (await fetch("/catalog?refresh=1")).json();
    BOOT.catalog = catalog;
    renderCatalog();
    renderRoles();
    renderSubagents();
  } catch (error) {
    setCatalogStatus(String(error.message || error), "err");
  } finally {
    event.target.disabled = false;
  }
});

const events = new EventSource("/events");events.addEventListener("routing", (event) => {
  state = JSON.parse(event.data);
  renderRoles();
  renderSubagents();
  setStatus("Actualizado desde fuera", "ok");
});

renderRoles();
renderSubagents();
renderCatalog();
</script>
</body>
</html>`;
}
