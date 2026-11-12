// Client section "routing tab" (split from renderer.mjs, issue #13).
export const CLIENT_ROUTING = String.raw`// --- routing tab ------------------------------------------------------------

function modelSelect(current, onChange) {
  var select = el("select", { onchange: function (event) { onChange(event.target.value); } });
  catalog.forEach(function (group) {
    var optgroup = el("optgroup", { label: group.label + (group.id === "copilot" ? "" : " (clave propia)") });
    group.models.forEach(function (model) {
      // El tercer campo es el TIER de coste, no el esfuerzo: se etiqueta como
      // "coste:" para que no se confunda con los niveles del desplegable contiguo.
      var cost = model.tier === "byok" ? "coste externo" : "coste " + (TIER_LABEL[model.tier] || "?");
      var option = el("option", {
        value: model.id,
        textContent: model.label + "  ·  " + vendorOf(model) + "  ·  " + cost
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

// --- fallback picker ---------------------------------------------------------

/**
 * Combobox de búsqueda: un input con suggestions filtradas por nombre,
 * vendor o id, en lugar del antiguo listbox de 15 filas. ENTER añade la
 * primera coincidencia; ESC limpia y cierra.
 */
function modelCombobox(onPick) {
  var wrap = el("div", { className: "combo" });
  var input = el("input", {
    type: "text",
    className: "combo-input",
    placeholder: "Buscar modelo…",
    attrs: { autocomplete: "off" }
  });
  var pop = el("div", { className: "combo-pop" });
  var close = function () { pop.style.display = "none"; };
  var render = function () {
    pop.textContent = "";
    var q = normalizeKey(input.value);
    if (!q) { close(); return; }
    var matches = [];
    catalog.forEach(function (group) {
      group.models.forEach(function (model) {
        if (matches.length >= 12) return;
        if (normalizeKey(model.label + " " + vendorOf(model) + " " + model.id).includes(q)) matches.push(model);
      });
    });
    if (!matches.length) {
      pop.append(el("div", { className: "combo-empty", textContent: "Sin coincidencias" }));
    }
    matches.forEach(function (model) {
      pop.append(el("button", {
        type: "button",
        className: "combo-item",
        textContent: model.label + "  ·  " + vendorOf(model) + "  ·  " + model.id,
        onmousedown: function (event) {
          event.preventDefault(); // no robar el foco antes del click
          onPick(model.id);
          input.value = "";
          close();
        }
      }));
    });
    pop.style.display = "block";
  };
  input.oninput = render;
  input.onfocus = render;
  input.onblur = function () { setTimeout(close, 120); };
  input.onkeydown = function (event) {
    if (event.key === "Enter") {
      var first = pop.querySelector(".combo-item");
      if (first) { first.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); }
      event.preventDefault();
    } else if (event.key === "Escape") {
      input.value = "";
      close();
      input.blur();
    }
  };
  wrap.append(input, pop);
  return wrap;
}

/**
 * Chip de un eslabón de la cadena de fallback: posición, nombre, flecha para
 * subir en el orden de intento y ✕ para quitarlo.
 */
function fallbackChip(idx, total, id, onMove, onRemove) {
  var model = findModel(id);
  return el("span", { className: "fb-chip", title: id }, [
    el("b", { className: "fb-pos", textContent: String(idx + 1) }),
    el("span", { className: "fb-name", textContent: (model ? model.label : id) }),
    idx > 0 ? el("button", { type: "button", className: "fb-btn", textContent: "↑", title: "Subir en la cadena", onclick: function () { onMove(idx, idx - 1); } }) : null,
    idx < total - 1 ? el("button", { type: "button", className: "fb-btn", textContent: "↓", title: "Bajar en la cadena", onclick: function () { onMove(idx, idx + 1); } }) : null,
    el("button", { type: "button", className: "fb-btn fb-x", textContent: "✕", title: "Quitar", onclick: onRemove })
  ]);
}

function fallbackRow(labelWidth, host, list, render, updater) {
  var row = el("div", { className: "meter", style: { gridTemplateColumns: labelWidth + " minmax(0, 1fr)", marginTop: "2px" } });
  var wrap = el("div", { className: "fb-chain" });
  wrap.append(modelCombobox(function (value) {
    if (!list.includes(value)) updater(list.concat([value]));
    render();
  }));
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

    // Cadena de fallback: buscador + chips reordenables
    var fallbackEntry = entry.fallback || [];
    fallbackRow("100px", host, fallbackEntry, renderRoles, function (next) {
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

      // Cadena de fallback: buscador + chips reordenables
      var fallbackEntry = entry.fallback || [];
      fallbackRow("150px", host, fallbackEntry, renderSubagents, function (next) {
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
    ["Modelo", "Qué modelo atiende ese papel. Los del plan de Copilot consumen tu cuota; los de clave propia se facturan aparte."],
    ["Esfuerzo (effort)", "Cuánto tiempo de cómputo dedica el modelo a pensar antes de responder. Subirlo mejora los problemas difíciles y encarece cada llamada; bajarlo responde antes y gasta menos. El desplegable solo ofrece los niveles que admite el modelo elegido; si cambias de modelo y el nivel guardado ya no es válido, se deja sin definir. Niveles globales: " +
      effortLevels.join(" · ") + "."],
    ["Fallback", "Lista de modelos secundarios, en orden de intento. Escribe en el buscador para añadir uno (ENTER sobre la primera coincidencia); las flechas ↑↓ cambian el orden y ✕ lo quita. Si el modelo principal no está disponible, el runtime intenta los de esta lista en orden."],
    ["Exigencia (modelPolicy) — required", "El modelo fijado es obligatorio. Si alguien pide otro modelo para ese subagente, se rechaza. Es lo que impide que una llamada suelta escale a un modelo premium."],
    ["Exigencia (modelPolicy) — preferred", "El modelo fijado es solo la opción por defecto: una petición explícita de otro modelo gana. Úsalo cuando quieras una sugerencia, no una regla."],
    ["Exigencia (modelPolicy) — inherit", "Sin opinión propia: se aplica lo que tenga configurado el runtime. Es el valor que se escribe cuando eliges esta opción."],
    ["maxConcurrency", "Cuántos subagentes pueden ejecutarse a la vez. Más alto termina antes y dispara el gasto; más bajo es más barato y más lento."]
  ]);
}
`;
