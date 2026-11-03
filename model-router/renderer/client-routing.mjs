// Client section "routing tab" (split from renderer.mjs, issue #13).
export const CLIENT_ROUTING = String.raw`// --- routing tab ------------------------------------------------------------

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
  ["orchestrate", "plan", "execute", "verify"].forEach(function (role) {
    var entry = (state.roles && state.roles[role]) || {};
    var row = el("div", { className: "meter", style: { gridTemplateColumns: "100px minmax(0, 2.2fr) minmax(0, 1fr)" } }, [
      el("strong", { textContent: role }),
      modelSelect(entry.model, function (value) {
        state.roles[role] = Object.assign({}, state.roles[role], { model: value });
        markDirty();
      }),
      selectFrom(effortLevels, entry.effort, function (value) {
        state.roles[role] = Object.assign({}, state.roles[role], { effort: value });
        markDirty();
      })
    ]);
    host.append(row);

    // Fallback chain row
    var fallbackEntry = entry.fallback || [];
    var fbRow = el("div", { className: "meter", style: { gridTemplateColumns: "100px 1fr auto", marginTop: "2px" } });
    var fbLabel = el("span", { className: "tiny muted", textContent: "  └─ fallback" });
    var fbContainer = el("div", { style: { display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" } });
    var fbSelect = modelSelect(null, function (value) {
      if (value && !fallbackEntry.includes(value)) {
        fallbackEntry.push(value);
        state.roles[role] = Object.assign({}, entry, { fallback: fallbackEntry });
        markDirty();
        renderRoles();
      }
    });
    fbSelect.querySelector("select").size = 15;
    fbContainer.append(fbSelect);
    var fbAddBtn = el("button", {
      className: "toggle",
      type: "button",
      textContent: "+",
      style: { fontSize: "12px", padding: "2px 6px" },
      onclick: function () {
        var val = fbSelect.querySelector("select").value;
        if (val && !fallbackEntry.includes(val)) {
          fallbackEntry.push(val);
          state.roles[role] = Object.assign({}, entry, { fallback: fallbackEntry });
          markDirty();
          renderRoles();
        }
      }
    });
    fbContainer.append(fbAddBtn);
    fbRow.append(fbLabel, fbContainer);
    host.append(fbRow);

    // Remove buttons for each fallback
    fallbackEntry.forEach(function (fbModel, idx) {
      var removeRow = el("div", { className: "meter", style: { gridTemplateColumns: "100px 1fr auto", marginTop: "1px" } });
      var removeLabel = el("span", { className: "tiny muted", textContent: "  " });
      var removeModel = el("span", { className: "tiny mono", textContent: fbModel });
      var removeBtn = el("button", {
        className: "toggle",
        type: "button",
        textContent: "✕",
        style: { fontSize: "10px", padding: "2px 8px", opacity: ".6" },
        onclick: function () {
          fallbackEntry.splice(idx, 1);
          state.roles[role] = Object.assign({}, entry, { fallback: fallbackEntry.length ? fallbackEntry : undefined });
          if (!fallbackEntry.length) delete state.roles[role].fallback;
          markDirty();
          renderRoles();
        }
      });
      removeRow.append(removeLabel, removeModel, removeBtn);
      host.append(removeRow);
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

      // Fallback chain row
      var fallbackEntry = entry.fallback || [];
      var fbRow = el("div", { className: "meter", style: { gridTemplateColumns: "150px 1fr auto", marginTop: "2px" } });
      var fbLabel = el("span", { className: "tiny muted", textContent: "  └─ fallback" });
      var fbContainer = el("div", { style: { display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" } });
      var fbSelect = modelSelect(null, function (value) {
        if (value && !fallbackEntry.includes(value)) {
          fallbackEntry.push(value);
          agents[type] = Object.assign({}, entry, { fallback: fallbackEntry });
          state.subagents.agents = agents;
          markDirty();
          renderSubagents();
        }
      });
      fbSelect.querySelector("select").size = 15;
      fbContainer.append(fbSelect);
      var fbAddBtn = el("button", {
        className: "toggle",
        type: "button",
        textContent: "+",
        style: { fontSize: "12px", padding: "2px 6px" },
        onclick: function () {
          var val = fbSelect.querySelector("select").value;
          if (val && !fallbackEntry.includes(val)) {
            fallbackEntry.push(val);
            agents[type] = Object.assign({}, entry, { fallback: fallbackEntry });
            state.subagents.agents = agents;
            markDirty();
            renderSubagents();
          }
        }
      });
      fbContainer.append(fbAddBtn);
      fbRow.append(fbLabel, fbContainer);
      host.append(fbRow);

      // Remove buttons for each fallback
      fallbackEntry.forEach(function (fbModel, idx) {
        var removeRow = el("div", { className: "meter", style: { gridTemplateColumns: "150px 1fr auto", marginTop: "1px" } });
        var removeLabel = el("span", { className: "tiny muted", textContent: "  " });
        var removeModel = el("span", { className: "tiny mono", textContent: fbModel });
        var removeBtn = el("button", {
          className: "toggle",
          type: "button",
          textContent: "✕",
          style: { fontSize: "10px", padding: "2px 8px", opacity: ".6" },
          onclick: function () {
            fallbackEntry.splice(idx, 1);
            agents[type] = Object.assign({}, entry, { fallback: fallbackEntry.length ? fallbackEntry : undefined });
            if (!fallbackEntry.length) delete agents[type].fallback;
            state.subagents.agents = agents;
            markDirty();
            renderSubagents();
          }
        });
        removeRow.append(removeLabel, removeModel, removeBtn);
        host.append(removeRow);
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
    ["Esfuerzo (effort)", "Cuánto tiempo de cómputo dedica el modelo a pensar antes de responder. Subirlo mejora los problemas difíciles y encarece cada llamada; bajarlo responde antes y gasta menos. " +
      effortLevels.join(" · ") + "."],
    ["Fallback", "Lista de modelos secundarios. Si el modelo principal no está disponible, el runtime intenta los de esta lista en orden. Útil para tener un plan B sin perder control."],
    ["Exigencia (modelPolicy) — required", "El modelo fijado es obligatorio. Si alguien pide otro modelo para ese subagente, se rechaza. Es lo que impide que una llamada suelta escale a un modelo premium."],
    ["Exigencia (modelPolicy) — preferred", "El modelo fijado es solo la opción por defecto: una petición explícita de otro modelo gana. Úsalo cuando quieras una sugerencia, no una regla."],
    ["Exigencia (modelPolicy) — inherit", "Sin opinión propia: se aplica lo que tenga configurado el runtime. Es el valor que se escribe cuando eliges esta opción."],
    ["maxConcurrency", "Cuántos subagentes pueden ejecutarse a la vez. Más alto termina antes y dispara el gasto; más bajo es más barato y más lento."]
  ]);
}
`;
