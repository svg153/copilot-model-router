// Client section "catalog tab" (split from renderer.mjs, issue #13).
export const CLIENT_CATALOG = String.raw`// --- catalog tab ------------------------------------------------------------

function renderCatalog() {
  renderCatalogDiagnostics();
  var table = clear("catalogTable");
  var head = el("thead");
  head.append(el("tr", null, [
    el("th", { textContent: "Modelo" }),
    el("th", { textContent: "ID exacto de runtime" }),
    el("th", { textContent: "Proveedor / ID runtime" }),
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
      el("td", { colSpan: 8, className: "small muted", textContent: group.label + " (" + group.id + ") — " + group.models.length + " modelos" })
    ]));
    group.models.forEach(function (model) {
      var origin = model.vendorSource === "runtime" ? "runtime"
        : model.vendorSource === "snapshot" ? "snapshot"
        : model.vendorSource === "family" ? "inferido por familia"
        : model.vendorSource === "heuristic" ? "inferido por nombre"
        : "desconocido";
      body.append(el("tr", null, [
        el("td", { className: "small", textContent: model.label }),
        el("td", { className: "tiny mono", textContent: model.id }),
        el("td", { className: "small mono", textContent: group.label + " / " + group.id }),
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
  var sourceIsLive = catalogSnapshot.source === "live";
  document.getElementById("catalogSub").textContent = sourceIsLive
    ? allModels().length + " modelos en " + catalog.length + " proveedores (" + external +
      " IDs cualificados por proveedor) reportados por el runtime de esta sesión. Que aparezcan aquí no verifica credenciales ni inferencia."
    : "No hay lista de modelos en vivo; se muestra el catálogo de respaldo, que no puede confirmar disponibilidad.";

  var withVendor = allModels().filter(function (model) { return model.vendor; }).length;
  document.getElementById("catalogMeta").textContent =
    "Dato de fabricante identificado para " + withVendor + " de " + allModels().length + " modelos. " +
    "Proviene del runtime o de la instantánea pública; no implica registro en proveedor ni que la llamada vaya a funcionar.";
}

function renderCatalogDiagnostics() {
  var host = clear("catalogDiagnostics");
  var live = catalogSnapshot.source === "live";
  var knownIds = new Set(allModels().map(function (model) { return model.id; }));
  var rows = [["Etapa / subagente", "ID de modelo configurado", "Exigencia", "Estado en el runtime"]];
  var statusFor = function (model) {
    return !live ? "Desconocido — catálogo de respaldo"
      : knownIds.has(model) ? "Listado por el runtime en vivo"
      : "No lo expone esta sesión";
  };
  ["orchestrate", "plan", "execute", "verify"].forEach(function (role) {
    var model = state.roles && state.roles[role] && state.roles[role].model || "";
    rows.push([role, model || "(sin configurar)", "—", statusFor(model)]);
  });
  // A subagent pin is the one enforced with modelPolicy=required, so an id the
  // runtime cannot resolve silently routes elsewhere; the rows make that visible.
  var pinnedAgents = (state.subagents && state.subagents.agents) || {};
  Object.keys(pinnedAgents).forEach(function (type) {
    var entry = pinnedAgents[type] || {};
    if (!entry.model) return;
    rows.push(["subagent:" + type, entry.model, entry.modelPolicy || "(predeterminada)", statusFor(entry.model)]);
  });
  var sourceText = live
    ? "Fuente: session.rpc.model.list() — runtime de la sesión en vivo"
    : "Fuente: catálogo de respaldo — no se pudo confirmar disponibilidad en vivo";
  var checkedText = catalogDiagnostics.fetchedAt
    ? "Última comprobación: " + new Date(catalogDiagnostics.fetchedAt).toLocaleString()
    : "Última comprobación: desconocida";
  host.append(el("p", { className: "note", textContent: sourceText + ". " + checkedText +
    ". " + (catalogDiagnostics.modelCount ?? allModels().length) + " modelos en " +
    (catalogDiagnostics.providers || []).length + " proveedores." }));
  if (!live) {
    host.append(el("p", { className: "note", textContent:
      catalogSnapshot.diagnostic || "La petición de modelos en vivo falló o no devolvió modelos; consulta el registro de la extensión para más detalle. El catálogo de respaldo es solo informativo y no puede confirmar disponibilidad." }));
  }
  host.append(el("p", { className: "note", textContent:
    "«Listado por el runtime en vivo» significa que la sesión actual reporta ese ID exacto; no verifica credenciales del proveedor ni una petición de inferencia con éxito. «No lo expone esta sesión» no significa que el modelo falte en los ajustes de la app ni en el registro de un proveedor." }));
  var table = el("table");
  var head = el("thead");
  head.append(el("tr", null, rows[0].map(function (text) { return el("th", { textContent: text }); })));
  table.append(head);
  var body = el("tbody");
  rows.slice(1).forEach(function (row) {
    body.append(el("tr", null, row.map(function (cell, index) {
      return el("td", {
        className: index === 1 ? "tiny mono" : index === 0 ? "mono" : "small",
        textContent: cell
      });
    })));
  });
  table.append(body);
  host.append(el("div", { className: "tablewrap" }, table));
}

  /**
   * Renders a provider-label editor. The user types a provider ID and a display name,
   * clicks "Add", then clicks "Guardar y aplicar" to persist the change.
   */
  function renderProviderLabelsEditor() {
    var host = clear("providerLabelsEditor");
    if (!host) return;

    var existing = state.routing && state.routing.providerLabels ? state.routing.providerLabels : {};
    var externalProviders = [];
    catalog.forEach(function (group) {
      if (group.id !== "copilot") {
        externalProviders.push({ id: group.id, label: group.label });
      }
    });

    // If no external providers from catalog, try to list known ones from routing
    if (!externalProviders.length) {
      Object.keys(existing).forEach(function (pid) {
        if (pid !== "copilot") {
          externalProviders.push({ id: pid, label: existing[pid] });
        }
      });
    }

    // Input row
    var inputRow = el("div", { className: "filters-row", style: { marginBottom: "10px" } });
    var idInput = el("input", {
      type: "text",
      placeholder: "ID del proveedor (ej. c086cdfb-... o el hostname)",
      style: { flex: "1 1 280px", fontSize: "12px", padding: "4px 8px", border: "1px solid var(--border-color-default, #d1d9e0)", borderRadius: "6px" }
    });
    var labelInput = el("input", {
      type: "text",
      placeholder: "Nombre legible (ej. Mi proveedor externo)",
      style: { flex: "1 1 200px", fontSize: "12px", padding: "4px 8px", border: "1px solid var(--border-color-default, #d1d9e0)", borderRadius: "6px" }
    });
    var addBtn = el("button", {
      className: "toggle",
      type: "button",
      textContent: "Agregar",
      style: { fontSize: "11px", padding: "3px 12px" },
      onclick: function () {
        var pid = idInput.value.trim();
        var plabel = labelInput.value.trim();
        if (!pid || !plabel) return;
        existing[pid] = plabel;
        renderProviderLabelsEditor();
      }
    });
    inputRow.append(idInput, labelInput, addBtn);
    host.append(inputRow);

    // List of existing labels
    if (externalProviders.length || Object.keys(existing).length) {
      var listDiv = el("div", { style: { marginTop: "8px" } });
      var entries = externalProviders.length ? externalProviders : [];
      Object.keys(existing).forEach(function (pid) {
        if (!entries.find(function (e) { return e.id === pid; })) {
          entries.push({ id: pid, label: existing[pid] });
        }
      });
      entries.forEach(function (entry) {
        var row = el("div", { className: "filters-row", style: { marginBottom: "4px", alignItems: "center" } });
        var idSpan = el("span", {
          className: "tiny mono",
          textContent: entry.id,
          style: { minWidth: "120px", color: "var(--text-color-muted, #59636e)" }
        });
        var labelSpan = el("span", {
          textContent: entry.label,
          style: { flex: "1 1 auto" }
        });
        var removeBtn = el("button", {
          className: "toggle",
          type: "button",
          textContent: "✕",
          style: { fontSize: "10px", padding: "2px 8px", opacity: ".6" },
          onclick: function () {
            delete existing[entry.id];
            renderProviderLabelsEditor();
          }
        });
        row.append(idSpan, labelSpan, removeBtn);
        listDiv.append(row);
      });
      host.append(listDiv);
    }
  }

  function renderCatalogDefs() {
  defs("catalogDefs", [
    ["Estado en el runtime", "Solo se marca como listado un ID de modelo exacto presente en una lista de modelos en vivo de la sesión con éxito. No es una prueba de credenciales, endpoint ni inferencia."],
    ["Catálogo de respaldo", "Lista solo informativa que se usa cuando la lista de modelos de la sesión no está disponible. Nunca confirma que un modelo del flujo de trabajo esté disponible."],
    ["Proveedor", "Quién sirve el modelo. GitHub Copilot, o el proveedor externo cuya clave tengas configurada."],
    ["Fabricante", "Quién lo construyó. Se muestra aparte del proveedor porque un mismo fabricante puede llegar por varias vías."],
    ["Origen del dato", "De dónde ha salido el fabricante: del runtime, de la instantánea pública, de la familia del modelo o de una heurística sobre el identificador."],
    ["Precio", "Categoría de precio del plan en los modelos de Copilot; en los de clave propia, el precio de API que publica el fabricante."],
    ["Contexto", "Cuántos tokens caben en una sola conversación. Más contexto permite analizar proyectos enteros, y también encarece cada llamada."],
    ["Global", "Nota media de los benchmarks públicos. Un guion significa que ese modelo todavía no aparece en ninguno."]
  ]);
}
`;
