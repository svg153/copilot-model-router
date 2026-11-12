// Client section "actions" (split from renderer.mjs, issue #13).
export const CLIENT_ACTIONS = String.raw`// --- actions ----------------------------------------------------------------

async function post(path, body) {
  var response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Router-Token": ROUTER_TOKEN },
    body: JSON.stringify(body || {})
  });
  if (!response.ok) {
    var error = new Error("HTTP " + response.status);
    error.status = response.status;
    try {
      var payload = await response.json();
      if (payload && typeof payload.error === "string") { error.serverError = payload.error; error.payload = payload; }
    } catch (_) { /* sin cuerpo JSON: el status es toda la información */ }
    throw error;
  }
  return response.json();
}

// --- revisión de cambios antes de guardar ------------------------------------

/** Nombre humano de un modelo: etiqueta del catálogo si existe, id si no. */
function modelLabel(id) {
  if (!id) return "(sin definir)";
  var model = findModel(id);
  return model ? model.label : id;
}

function fallbackLabel(list) {
  var arr = Array.isArray(list) ? list : [];
  return arr.length ? arr.map(modelLabel).join(" → ") : "(ninguno)";
}

/**
 * Diferencia dos documentos de enrutado como filas "campo: antes → después",
 * agrupadas por sección y solo con los cambios reales.
 */
function diffRoutingRows(base, next) {
  base = base || {}; next = next || {};
  var groups = [];
  function group(title) {
    var g = groups.find(function (x) { return x.title === title; });
    if (!g) { g = { title: title, rows: [] }; groups.push(g); }
    return g;
  }
  function add(title, label, before, after) {
    if (before === after) return;
    group(title).rows.push({ label: label, before: before, after: after });
  }

  ["orchestrate", "plan", "execute", "verify"].forEach(function (role) {
    var b = (base.roles && base.roles[role]) || {};
    var n = (next.roles && next.roles[role]) || {};
    add("Roles del workflow", role + " · modelo", modelLabel(b.model), modelLabel(n.model));
    add("Roles del workflow", role + " · esfuerzo", b.effort || "(sin definir)", n.effort || "(sin definir)");
    add("Roles del workflow", role + " · fallback", fallbackLabel(b.fallback), fallbackLabel(n.fallback));
  });

  var ba = (base.subagents && base.subagents.agents) || {};
  var na = (next.subagents && next.subagents.agents) || {};
  var types = subagentTypes.slice();
  Object.keys(na).forEach(function (t) { if (types.indexOf(t) < 0) types.push(t); });
  types.forEach(function (type) {
    var b = ba[type] || {};
    var n = na[type] || {};
    add("Subagentes", type + " · modelo", modelLabel(b.model), modelLabel(n.model));
    add("Subagentes", type + " · esfuerzo", b.effortLevel || "(sin definir)", n.effortLevel || "(sin definir)");
    add("Subagentes", type + " · exigencia", b.modelPolicy || "inherit", n.modelPolicy || "inherit");
    add("Subagentes", type + " · fallback", fallbackLabel(b.fallback), fallbackLabel(n.fallback));
  });

  var bc = base.subagents && base.subagents.maxConcurrency;
  var nc = next.subagents && next.subagents.maxConcurrency;
  add("Subagentes", "maxConcurrency", bc === undefined ? "(por defecto 4)" : String(bc), nc === undefined ? "(por defecto 4)" : String(nc));

  var bl = base.providerLabels || {};
  var nl = next.providerLabels || {};
  var pids = Object.keys(nl).filter(function (k) { return Object.keys(bl).indexOf(k) < 0; });
  Object.keys(bl).forEach(function (k) { if (nl[k] !== bl[k]) pids.push(k); });
  pids.forEach(function (pid) {
    var b = bl[pid] === undefined || bl[pid] === null ? "(auto)" : bl[pid];
    var n = nl[pid] === undefined || nl[pid] === null ? "(auto)" : nl[pid];
    add("Etiquetas de proveedor", providerLabel(pid), b, n);
  });

  return groups.filter(function (g) { return g.rows.length; });
}

function pinCount(rows) {
  var count = 0;
  rows.forEach(function (g) {
    if (g.title !== "Subagentes") return;
    g.rows.forEach(function (r) { if (/·\s*modelo$/.test(r.label) && r.after !== "(sin definir)") count += 1; });
  });
  return count;
}

function modalChrome(titleText, widthClass) {
  var lastFocus = null;
  try { lastFocus = document.activeElement; } catch (_) {}
  var back = el("div", { className: "fb-backdrop", onclick: function (event) { if (event.target === back) detach(); } });
  var modal = el("div", {
    className: "fb-modal" + (widthClass || ""),
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": titleText }
  });
  var detached = false;
  var onKey = function (event) {
    if (event.key === "Escape") { detach(); return; }
    if (event.key !== "Tab") return;
    var f = modal.querySelectorAll("button");
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  function detach() {
    if (detached) return;
    detached = true;
    try { document.removeEventListener("keydown", onKey); } catch (_) {}
    try { if (back.parentNode) back.parentNode.removeChild(back); } catch (_) { back.style.display = "none"; }
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (_) {}
  }
  modal.append(el("div", { className: "fb-modal-head" }, [
    el("strong", { className: "fb-modal-title", textContent: titleText }),
    el("button", { type: "button", className: "fb-modal-close", textContent: "✕", title: "Cerrar", attrs: { "aria-label": "Cerrar" }, onclick: detach })
  ]));
  back.append(modal);
  document.body.append(back);
  try { document.addEventListener("keydown", onKey); } catch (_) {}
  return { modal: modal, detach: detach };
}

/**
 * Modal de revisión estilo pre-commit: lista los cambios semánticos como
 * "antes → después" y exige un clic en «Aplicar» para escribir en disco.
 */
function openReviewModal(rows, opts) {
  var chrome = modalChrome(opts.title || "Revisar cambios", " rev-modal");
  var modal = chrome.modal;
  if (opts.warning) {
    modal.append(el("p", { className: "rev-warn", textContent: opts.warning }));
  }
  if (!rows.length) {
    modal.append(el("p", { className: "rev-warn", textContent: "No hay cambios que guardar: lo que ves en pantalla coincide con lo guardado." }));
  }
  rows.forEach(function (g) {
    modal.append(el("div", { className: "fb-group", textContent: g.title }));
    g.rows.forEach(function (r) {
      modal.append(el("div", { className: "rev-row" }, [
        el("span", { className: "rev-label", textContent: r.label }),
        el("span", { className: "rev-values" }, [
          el("span", { className: "rev-before", textContent: r.before }),
          el("span", { className: "rev-arrow", textContent: "→" }),
          el("span", { className: "rev-after", textContent: r.after })
        ])
      ]));
    });
  });
  if (rows.length) {
    var pins = pinCount(rows);
    modal.append(el("p", {
      className: "rev-summary",
      textContent: "Afectará a " + pins + (pins === 1 ? " subagente fijado." : " subagentes fijados.")
    }));
    var actions = el("div", { className: "rev-actions" });
    var cancel = el("button", { type: "button", textContent: "Cancelar", onclick: chrome.detach });
    var confirm = el("button", { type: "button", className: "primary", textContent: opts.confirmText || "Aplicar" });
    confirm.onclick = function () { confirm.disabled = true; chrome.detach(); opts.onConfirm(); };
    actions.append(cancel, confirm);
    modal.append(actions);
    try { confirm.focus(); } catch (_) {}
  } else {
    var ok = el("button", { type: "button", className: "primary", textContent: "Cerrar", onclick: chrome.detach });
    modal.append(el("div", { className: "rev-actions" }, ok));
    try { ok.focus(); } catch (_) {}
  }
}

function openConflictModal() {
  var chrome = modalChrome("Conflicto de guardado", " rev-modal");
  var modal = chrome.modal;
  modal.append(el("p", { className: "rev-warn", textContent: "Otra ventana guardó cambios antes que tú. Elige qué hacer antes de escribir nada." }));
  var actions = el("div", { className: "rev-actions" });
  actions.append(el("button", {
    type: "button",
    textContent: "Cancelar",
    onclick: chrome.detach
  }));
  actions.append(el("button", {
    type: "button",
    textContent: "Descartar mis cambios",
    title: "Sustituye lo que tienes en pantalla por lo que está guardado",
    onclick: function () {
      chrome.detach();
      discardPending();
    }
  }));
  var overwrite = el("button", {
    type: "button",
    className: "danger",
    textContent: "Sobrescribir de todas formas",
    title: "Escribe tus cambios encima de los de la otra ventana",
    onclick: function () { chrome.detach(); doSave(true); }
  });
  actions.append(overwrite);
  modal.append(actions);
  try { chrome.modal.querySelector(".fb-modal-close").focus(); } catch (_) {}
}

/** Recarga el documento guardado en el servidor como nueva base, sin tocar el disco. */
async function discardPending() {
  try {
    var payload = await (await fetch("/routing")).json();
    state = payload.routing;
    savedRouting = cloneConfig(state);
    routingRevision = payload.revision || "absent";
    dirty = false;
    setStatus("Cambios locales descartados; ahora trabajas sobre lo guardado.", "ok");
    renderAll();
  } catch (error) {
    setStatus("No se pudo recargar lo guardado: " + (error.serverError || error.message), "err");
  }
}

/**
 * Estado de la barra tras un guardado: mensaje + "Deshacer último cambio",
 * borrable con ✕.
 */
function setSavedStatus(text) {
  var node = document.getElementById("status");
  node.replaceChildren();
  if (text) node.append(document.createTextNode(text + " "));
  var undo = el("button", {
    type: "button",
    className: "toggle",
    textContent: "Deshacer último cambio",
    title: "Restaura la configuración guardada antes de este cambio",
    onclick: function () { doUndo(undo); }
  });
  node.append(undo);
  var close = el("button", {
    type: "button",
    className: "toggle",
    textContent: "✕",
    title: "Ocultar",
    attrs: { "aria-label": "Ocultar aviso de guardado" },
    onclick: function () {
      node.replaceChildren();
      dirty = false;
      setStatus("Hay cambios sin guardar.", "warn");
      if (!pendingChanges()) setStatus("", "");
    }
  });
  node.append(close);
  delete node.dataset.tone;
  node.dataset.tone = "ok";
}

function pendingChanges() {
  return diffRoutingRows(savedRouting, state).length > 0;
}

async function doUndo(button) {
  if (button) button.disabled = true;
  setStatus("Deshaciendo…");
  try {
    var result = await post("/undo", {});
    state = result.routing;
    savedRouting = cloneConfig(result.routing);
    routingRevision = result.revision || "absent";
    dirty = false;
    renderAll();
    setStatus("Último cambio deshecho.", "ok");
  } catch (error) {
    setStatus("No se pudo deshacer: " + (error.serverError || error.message), "err");
  }
}

async function doSave(force) {
  setStatus("Guardando…");
  var body = cloneConfig(state);
  if (!force) body.baseRevision = routingRevision;
  try {
    var result = await post("/routing", body);
    state = result.routing;
    savedRouting = cloneConfig(result.routing);
    routingRevision = result.revision || "absent";
    dirty = false;
    renderAll();
    setSavedStatus(result.applied ? "Guardado y aplicado a la sesión." : "Guardado.");
  } catch (error) {
    if (error.status === 412 && error.payload && error.payload.routing) {
      // El servidor rechazó escribir: adopta la revisión en disco como base
      // para que «Descartar» y el próximo guardado comparen contra lo real.
      savedRouting = cloneConfig(error.payload.routing);
      routingRevision = error.payload.revision || "absent";
      openConflictModal();
      setStatus("Conflicto: otra ventana guardó antes.", "err");
      return;
    }
    setStatus("No se pudo guardar: " + (error.serverError || error.message), "err");
  }
}

async function doReset() {
  setStatus("Calculando diferencias…");
  var defaults;
  try {
    defaults = (await (await fetch("/defaults")).json()).routing;
  } catch (error) {
    setStatus("No se pudieron leer los valores por defecto: " + (error.serverError || error.message), "err");
    return;
  }
  var rows = diffRoutingRows(state, defaults);
  openReviewModal(rows, {
    title: "Restaurar valores por defecto",
    warning: "Esto reemplaza TODA la configuración por los valores por defecto del catálogo detectado. Podrás deshacerlo una vez.",
    confirmText: "Restaurar",
    onConfirm: function () {
      var body = {};
      body.baseRevision = routingRevision;
      setStatus("Restaurando…");
      post("/reset", body).then(function (result) {
        state = result.routing;
        savedRouting = cloneConfig(result.routing);
        routingRevision = result.revision || "absent";
        dirty = false;
        renderAll();
        setSavedStatus("Valores por defecto restaurados.");
      }).catch(function (error) {
        if (error.status === 412 && error.payload && error.payload.routing) {
          savedRouting = cloneConfig(error.payload.routing);
          routingRevision = error.payload.revision || "absent";
          openConflictModal();
          setStatus("Conflicto: otra ventana guardó antes.", "err");
          return;
        }
        setStatus("No se pudo restaurar: " + (error.serverError || error.message), "err");
      });
    }
  });
}

function applyRouting() {
  var rows = diffRoutingRows(savedRouting, state);
  openReviewModal(rows, { title: "Revisar cambios", confirmText: "Aplicar", onConfirm: function () { doSave(false); } });
}

function resetRouting() {
  doReset();
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
    setStatus("No se pudo actualizar: " + (error.serverError || error.message), "err");
  }
}

async function refreshCatalog() {
  var status = document.getElementById("catalogRefreshStatus");
  status.textContent = "Actualizando la lista de modelos de la sesión…";
  status.dataset.tone = "";
  try {
    var response = await fetch("/catalog?refresh=1");
    if (!response.ok) throw new Error("HTTP " + response.status);
    var payload = await response.json();
    catalogSnapshot = payload.catalog || {};
    catalogDiagnostics = payload.diagnostics || {};
    catalog = catalogGroups(catalogSnapshot);
    status.textContent = catalogSnapshot.source === "live"
      ? "Lista de modelos actualizada."
      : "Actualización terminada, pero solo hay disponible el catálogo de respaldo.";
    status.dataset.tone = catalogSnapshot.source === "live" ? "ok" : "warn";
    renderAll();
  } catch (error) {
    status.textContent = "No se pudo actualizar la lista de modelos: " + error.message;
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
      var data = JSON.parse(event.data);
      // El servidor emite { routing, revision }; se acepta también el routing
      // crudo para no romper con versiones anteriores del evento.
      var next = data && data.routing ? data.routing : data;
      state = next;
      savedRouting = cloneConfig(next);
      if (data && typeof data.revision === "string") routingRevision = data.revision;
      renderAll();
    } catch (error) { /* ignore malformed push */ }
  });
} catch (error) { /* SSE unsupported: the page still works, just not live */ }`;