// Client section "actions" (split from renderer.mjs, issue #13).
export const CLIENT_ACTIONS = String.raw`// --- actions ----------------------------------------------------------------

async function post(path, body) {
  var response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Router-Token": ROUTER_TOKEN },
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
    if (payload.catalog) {
      catalogSnapshot = payload.catalog;
      catalogDiagnostics = payload.diagnostics || {};
      catalog = catalogGroups(payload.catalog);
    }
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

async function refreshCatalog() {
  var status = document.getElementById("catalogRefreshStatus");
  status.textContent = "Refreshing session model list…";
  status.dataset.tone = "";
  try {
    var response = await fetch("/catalog?refresh=1");
    if (!response.ok) throw new Error("HTTP " + response.status);
    var payload = await response.json();
    catalogSnapshot = payload.catalog || {};
    catalogDiagnostics = payload.diagnostics || {};
    catalog = catalogGroups(catalogSnapshot);
    status.textContent = catalogSnapshot.source === "live"
      ? "Session model list refreshed."
      : "Refresh completed, but only the fallback catalog is available.";
    status.dataset.tone = catalogSnapshot.source === "live" ? "ok" : "warn";
    renderAll();
  } catch (error) {
    status.textContent = "Could not refresh model list: " + error.message;
    status.dataset.tone = "err";
  }
}

function renderAll() {
  invalidateMineKeys();
  renderRoles();
  renderSubagents();
  renderRoutingDefs();
  renderCatalog();
  renderCatalogDefs();
  renderProviderLabelsEditor();
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
  if (name === "catalog") renderProviderLabelsEditor();
}

document.getElementById("tabs").addEventListener("click", function (event) {
  var button = event.target.closest("button[data-tab]");
  if (button) activateTab(button.dataset.tab);
});
document.getElementById("apply").addEventListener("click", applyRouting);
document.getElementById("reset").addEventListener("click", resetRouting);
document.getElementById("refresh").addEventListener("click", refreshData);
document.getElementById("refreshCatalog").addEventListener("click", refreshCatalog);

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
} catch (error) { /* SSE unsupported: the page still works, just not live */ }`;
