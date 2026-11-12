// Client section "routing tab" (split from renderer.mjs, issue #13).
export const CLIENT_ROUTING = String.raw`// --- routing tab ------------------------------------------------------------

/** Model IDs currently pinned to a role or subagent; they head the picker. */
function modelPickedIds() {
  var ids = [];
  var roles = state.roles || {};
  ["orchestrate", "plan", "execute", "verify"].forEach(function (role) {
    var m = roles[role] && roles[role].model;
    if (m && !ids.includes(m)) ids.push(m);
  });
  var agents = (state.subagents && state.subagents.agents) || {};
  Object.keys(agents).forEach(function (type) {
    var m = agents[type] && agents[type].model;
    if (m && !ids.includes(m)) ids.push(m);
  });
  return ids;
}

/**
 * Disparador compacto del selector de modelo: en vez de un <select> con
 * cientos de opciones, un botón con el modelo actual que abre un modal
 * buscador (openModelPicker, modo único). El título muestra el ID completo.
 */
function modelSelect(current, onChange) {
  var model = current ? findModel(current) : null;
  var text = !current ? "(sin fijar)"
    : model ? model.label + "  ·  " + vendorOf(model)
    : current + "  ·  (no está en el catálogo)";
  return el("button", {
    type: "button",
    className: "mpk" + (current ? "" : " mpk-empty"),
    title: current ? current : "Elegir un modelo",
    attrs: { "aria-haspopup": "dialog" },
    onclick: function () {
      openModelPicker({
        title: "Elegir modelo",
        single: true,
        current: current,
        getList: function () { return [current]; },
        onPick: function (id) { onChange(id); }
      });
    }
  }, [
    el("span", { className: "mpk-label", textContent: text }),
    el("span", { className: "mpk-caret", textContent: "▾", attrs: { "aria-hidden": "true" } })
  ]);
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

// --- model picker ------------------------------------------------------------

/**
 * Modal de elección de modelos con buscador, agrupado por proveedor y con el
 * grupo «Mis fijados» delante (los modelos ya fijados en la config). Dos modos:
 *  - múltiple (fallbacks): getList/onAdd/onRemove; un clic añade, otro quita.
 *  - único (fijar modelo): single + onPick; un clic elige, marca ✓ y cierra.
 * El buscador filtra por nombre, ID exacto, fabricante y proveedor. Se cierra
 * con ✕, fondo o ESC, y devuelve el foco al disparador. Trampa de foco con Tab.
 */
function openModelPicker(opts) {
  var single = !!opts.single;
  var getList = opts.getList || function () { return []; };
  var rows = [];
  var groups = [];
  var lastFocus = null;
  try { lastFocus = document.activeElement; } catch (_) {}

  var onKey = function (event) {
    if (event.key === "Escape") { detach(); return; }
    if (event.key !== "Tab") return;
    var f = modal.querySelectorAll("button, input");
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  var detach = function () {
    try { document.removeEventListener("keydown", onKey); } catch (_) {}
    try { if (back.parentNode) back.parentNode.removeChild(back); } catch (_) { back.style.display = "none"; }
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (_) {}
  };

  var back = el("div", { className: "fb-backdrop", onclick: function (event) { if (event.target === back) detach(); } });
  var modal = el("div", {
    className: "fb-modal",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": opts.title }
  });
  modal.append(el("div", { className: "fb-modal-head" }, [
    el("strong", { className: "fb-modal-title", textContent: opts.title }),
    el("button", { type: "button", className: "fb-modal-close", textContent: "✕", title: "Cerrar", attrs: { "aria-label": "Cerrar catálogo" }, onclick: detach })
  ]));
  var count = el("span", { className: "fb-count" });
  var search = el("input", {
    type: "text",
    placeholder: "Buscar por nombre, ID o fabricante…",
    attrs: { "aria-label": "Buscar modelos" }
  });
  modal.append(el("div", { className: "fb-search" }, [search, count]));

  var refreshMarks = function () {
    var cur = getList();
    rows.forEach(function (r) {
      var on = cur.includes(r.id);
      r.mark.textContent = on ? "✓" : "";
      if (on) r.row.classList.add("fb-on"); else r.row.classList.remove("fb-on");
      if (!single) {
        r.row.setAttribute("aria-pressed", on ? "true" : "false");
        r.row.title = on ? "Quitar " + r.id + " del fallback" : "Añadir " + r.id + " al fallback";
      }
    });
  };

  var addGroup = function (titleText) {
    var g = el("div", { className: "fb-group", textContent: titleText });
    g._rows = [];
    g._hay = titleText.toLowerCase();
    modal.append(g);
    groups.push(g);
    return g;
  };
  var addRow = function (model, g) {
    // El meta muestra fabricante y TIER de coste (no esfuerzo), nunca el
    // ID abreviado: va en su propia línea mono para poder verificarlo.
    var cost = model.tier === "byok" ? "coste externo" : "coste " + (TIER_LABEL[model.tier] || "?");
    var mark = el("span", { className: "fb-mark", textContent: "" });
    var row = el("button", {
      type: "button",
      className: "fb-opt",
      title: model.id,
      attrs: single ? {} : { "aria-pressed": "false" },
      onclick: function () {
        if (single) { opts.onPick(model.id); detach(); return; }
        if (getList().includes(model.id)) { if (opts.onRemove) opts.onRemove(model.id); }
        else { opts.onAdd(model.id); }
        refreshMarks();
      }
    }, [
      el("span", { className: "fb-opt-main" }, [
        el("span", { className: "fb-opt-name", textContent: model.label }),
        el("span", { className: "fb-opt-id mono", textContent: model.id })
      ]),
      el("span", { className: "fb-opt-meta", textContent: vendorOf(model) + "  ·  " + cost }),
      mark
    ]);
    var entry = {
      id: model.id, row: row, mark: mark, group: g,
      hay: (model.label + " " + model.id + " " + vendorOf(model) + " " + g._hay).toLowerCase()
    };
    rows.push(entry);
    g._rows.push(entry);
    modal.append(row);
  };

  var pinnedIds = modelPickedIds();
  var byId = {};
  allModels().forEach(function (m) { byId[m.id] = m; });
  var inPinned = {};
  if (pinnedIds.length) {
    var pg = addGroup("Mis fijados");
    pinnedIds.forEach(function (id) {
      var m = byId[id];
      if (!m) return;
      inPinned[id] = true;
      addRow(m, pg);
    });
    if (!pg._rows.length) modal.removeChild(pg);
  }
  catalog.forEach(function (group) {
    var g = addGroup(group.label + (group.id === "copilot" ? "" : " (clave propia)"));
    group.models.forEach(function (model) {
      if (inPinned[model.id]) return;
      addRow(model, g);
    });
    if (!g._rows.length) modal.removeChild(g);
  });
  groups = groups.filter(function (g) { return g.parentNode; });
  if (!rows.length) modal.append(el("div", { className: "fb-empty", textContent: "No hay modelos en el catálogo. Recarga con el botón «Actualizar modelos»." }));

  var applyFilter = function () {
    var q = search.value.trim().toLowerCase();
    var shown = 0;
    rows.forEach(function (r) {
      var hit = !q || r.hay.includes(q);
      if (hit) r.row.classList.remove("fb-hide"); else r.row.classList.add("fb-hide");
      if (hit) shown++;
    });
    groups.forEach(function (g) {
      var any = g._rows.some(function (r) { return r.hay.includes(q); });
      if (any) g.classList.remove("fb-hide"); else g.classList.add("fb-hide");
    });
    count.textContent = rows.length
      ? (shown === rows.length ? rows.length + (rows.length === 1 ? " modelo" : " modelos") : shown + " de " + rows.length)
      : "";
  };
  search.oninput = applyFilter;

  if (single && opts.current) {
    modal.append(el("div", { className: "fb-foot" }, [
      el("button", {
        type: "button", className: "toggle",
        textContent: "Quitar el fijado (dejar sin modelo)",
        onclick: function () { opts.onPick(""); detach(); }
      })
    ]));
  }

  back.append(modal);
  document.body.append(back);
  try { document.addEventListener("keydown", onKey); } catch (_) {}
  refreshMarks();
  applyFilter();
  try {
    if (rows.length) { search.focus(); }
    else { var t = modal.querySelector(".fb-modal-close"); if (t) t.focus(); }
  } catch (_) {}
  return detach;
}

/** Compat: apertura del picker en modo múltiple para cadenas de fallback. */
function openFallbackPicker(titleText, getList, onAdd, onRemove) {
  return openModelPicker({ title: titleText, getList: getList, onAdd: onAdd, onRemove: onRemove });
}

/**
 * Chip de un eslabón de la cadena de fallback: posición, nombre, flecha para
 * subir en el orden de intento y ✕ para quitarlo.
 */
function fallbackChip(idx, total, id, onMove, onRemove) {
  var model = findModel(id);
  var name = model ? model.label : id;
  return el("span", { className: "fb-chip", title: id }, [
    el("b", { className: "fb-pos", textContent: String(idx + 1) }),
    el("span", { className: "fb-name", textContent: name }),
    idx > 0 ? el("button", { type: "button", className: "fb-btn", textContent: "↑", title: "Subir en la cadena", attrs: { "aria-label": "Subir " + name + " en la cadena de fallback" }, onclick: function () { onMove(idx, idx - 1); } }) : null,
    idx < total - 1 ? el("button", { type: "button", className: "fb-btn", textContent: "↓", title: "Bajar en la cadena", attrs: { "aria-label": "Bajar " + name + " en la cadena de fallback" }, onclick: function () { onMove(idx, idx + 1); } }) : null,
    el("button", { type: "button", className: "fb-btn fb-x", textContent: "✕", title: "Quitar", attrs: { "aria-label": "Quitar " + name + " del fallback" }, onclick: onRemove })
  ]);
}

function fallbackRow(labelWidth, host, getList, render, updater) {
  var list = getList();
  var row = el("div", { className: "meter", style: { gridTemplateColumns: labelWidth + " minmax(0, 1fr)", marginTop: "2px" } });
  var wrap = el("div", { className: "fb-chain" });
  list.forEach(function (fbModel, idx) {
    wrap.append(fallbackChip(idx, list.length, fbModel, function (from, to) {
      var next = list.slice();
      var tmp = next[from];
      next[from] = next[to];
      next[to] = tmp;
      updater(next);
      render();
    }, function () {
      updater(list.filter(function (_, i) { return i !== idx; }));
      render();
    }));
  });
  wrap.append(el("button", {
    type: "button",
    className: "fb-add",
    textContent: list.length ? "+ añadir" : "+ elegir modelos",
    title: "Abrir el catálogo para elegir modelos de fallback",
    onclick: function () {
      openFallbackPicker("Modelos de fallback", getList, function (id) {
        updater(getList().concat([id]));
        render();
      }, function (id) {
        updater(getList().filter(function (x) { return x !== id; }));
        render();
      });
    }
  }));
  row.append(el("span", { className: "tiny muted", textContent: "  └─ fallback" }), wrap);
  host.append(row);
}

function renderRoles() {
  var host = clear("roles");
  ["orchestrate", "plan", "execute", "verify"].forEach(function (role) {
    var entry = (state.roles && state.roles[role]) || {};
    // Si el esfuerzo guardado no lo admite el modelo (config previa), se limpia al renderizar.
    if (entry.effort && !effortOptionsFor(entry.model).includes(entry.effort)) {
      entry = Object.assign({}, entry);
      delete entry.effort;
      state.roles[role] = entry;
    }
    var row = el("div", { className: "meter", style: { gridTemplateColumns: "100px minmax(0, 2.2fr) minmax(0, 1fr)" } }, [
      el("strong", { textContent: role }),
      modelSelect(entry.model, function (value) {
        var next = Object.assign({}, state.roles[role], { model: value });
        var options = effortOptionsFor(value);
        if (next.effort && !options.includes(next.effort)) delete next.effort;
        state.roles[role] = next;
        markDirty();
        renderRoles();
      }),
      selectFrom(effortOptionsFor(entry.model), entry.effort, function (value) {
        state.roles[role] = Object.assign({}, state.roles[role], { effort: value });
        markDirty();
      })
    ]);
    host.append(row);

    // Cadena de fallback: botón "+" con modal de catálogo + chips reordenables
    fallbackRow("100px", host, function () {
      return (state.roles[role] && state.roles[role].fallback) || [];
    }, renderRoles, function (next) {
      var updated = Object.assign({}, state.roles[role]);
      if (next.length) updated.fallback = next; else delete updated.fallback;
      state.roles[role] = updated;
      markDirty();
    });
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
    if (entry.effortLevel && !effortOptionsFor(entry.model).includes(entry.effortLevel)) {
      entry = Object.assign({}, entry);
      delete entry.effortLevel;
      agents[type] = entry;
      state.subagents.agents = agents;
    }
    var row = el("div", { className: "meter", style: { gridTemplateColumns: "150px minmax(0, 2.2fr) 92px 118px" } }, [
      el("span", { className: "mono", textContent: type }),
      modelSelect(entry.model, function (value) {
        var next = Object.assign({}, entry, { model: value });
        var options = effortOptionsFor(value);
        if (next.effortLevel && !options.includes(next.effortLevel)) delete next.effortLevel;
        agents[type] = next;
        state.subagents.agents = agents;
        markDirty();
        renderSubagents();
        renderRecommendations();
      }),
      selectFrom(effortOptionsFor(entry.model), entry.effortLevel, function (value) {
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

      // Cadena de fallback: botón "+" con modal de catálogo + chips reordenables
      fallbackRow("150px", host, function () {
        return (agents[type] && agents[type].fallback) || [];
      }, renderSubagents, function (next) {
        var updated = Object.assign({}, agents[type] || {});
        if (next.length) updated.fallback = next; else delete updated.fallback;
        agents[type] = updated;
        state.subagents.agents = agents;
        markDirty();
      });
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
    ["Modelo", "Qué modelo atiende ese papel. El botón abre un buscador sobre el catálogo: escribe nombre, ID o fabricante, y el grupo «Mis fijados» coloca delante los modelos que ya usas en otra fila. Los del plan de Copilot consumen tu cuota; los de clave propia se facturan aparte."],
    ["Esfuerzo (effort)", "Cuánto tiempo de cómputo dedica el modelo a pensar antes de responder. Subirlo mejora los problemas difíciles y encarece cada llamada; bajarlo responde antes y gasta menos. El desplegable solo ofrece los niveles que admite el modelo elegido; si cambias de modelo y el nivel guardado ya no es válido, se deja sin definir. Niveles globales: " +
      effortLevels.join(" · ") + "."],
    ["Fallback", "Lista de modelos secundarios, en orden de intento. Pulsa «+ añadir» para abrir el catálogo con buscador (agrupado por proveedor, con «Mis fijados» delante): un clic añade el modelo al final de la cadena y una ✓ marca los que ya están; ✕, ESC o pulsar el fondo cierran el modal. En los chips, las flechas ↑↓ cambian el orden y ✕ lo quita. Si el modelo principal no está disponible, el runtime intenta los de esta lista en orden."],
    ["Exigencia (modelPolicy) — required", "El modelo fijado es obligatorio. Si alguien pide otro modelo para ese subagente, se rechaza. Es lo que impide que una llamada suelta escale a un modelo premium."],
    ["Exigencia (modelPolicy) — preferred", "El modelo fijado es solo la opción por defecto: una petición explícita de otro modelo gana. Úsalo cuando quieras una sugerencia, no una regla."],
    ["Exigencia (modelPolicy) — inherit", "Sin opinión propia: se aplica lo que tenga configurado el runtime. Es el valor que se escribe cuando eliges esta opción."],
    ["maxConcurrency", "Cuántos subagentes pueden ejecutarse a la vez. Más alto termina antes y dispara el gasto; más bajo es más barato y más lento."]
  ]);
}
`;
