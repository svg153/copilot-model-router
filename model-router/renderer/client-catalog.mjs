// Client section "catalog tab" (split from renderer.mjs, issue #13).
export const CLIENT_CATALOG = String.raw`// --- catalog tab ------------------------------------------------------------

function renderCatalog() {
  renderCatalogDiagnostics();
  var table = clear("catalogTable");
  var head = el("thead");
  head.append(el("tr", null, [
    el("th", { textContent: L("Modelo", "Model") }),
    el("th", { textContent: L("ID exacto de runtime", "Exact runtime ID") }),
    el("th", { textContent: L("Proveedor / ID runtime", "Provider / runtime ID") }),
    el("th", { textContent: L("Fabricante", "Vendor") }),
    el("th", { textContent: L("Origen del dato", "Data origin"), className: "tiny" }),
    el("th", { textContent: L("Precio", "Price") }),
    el("th", { textContent: L("Contexto", "Context") }),
    el("th", { textContent: L("Global", "Global"), className: "num" })
  ]));
  table.append(head);

  var body = el("tbody");
  catalog.forEach(function (group) {
    body.append(el("tr", null, [
      el("td", { colSpan: 8, className: "small muted", textContent: group.label + " (" + group.id + ") — " + group.models.length + L(" modelos", " models") })
    ]));
    group.models.forEach(function (model) {
      var origin = model.vendorSource === "runtime" ? "runtime"
        : model.vendorSource === "snapshot" ? "snapshot"
        : model.vendorSource === "family" ? L("inferido por familia", "inferred from family")
        : model.vendorSource === "heuristic" ? L("inferido por nombre", "inferred from name")
        : L("desconocido", "unknown");
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
    ? allModels().length + L(" modelos en ", " models across ") + catalog.length + L(" proveedores (", " providers (") + external +
      L(" IDs cualificados por proveedor) reportados por el runtime de esta sesión. Que aparezcan aquí no verifica credenciales ni inferencia.", " provider-qualified IDs) reported by this session's runtime. Their presence here does not verify credentials or inference.")
    : L("No hay lista de modelos en vivo; se muestra el catálogo de respaldo, que no puede confirmar disponibilidad.", "There is no live model list; the backup catalog is shown, which cannot confirm availability.");

  var withVendor = allModels().filter(function (model) { return model.vendor; }).length;
  document.getElementById("catalogMeta").textContent =
    L("Dato de fabricante identificado para ", "Vendor identified for ") + withVendor + L(" de ", " of ") + allModels().length + L(" modelos. ", " models. ") +
    L("Proviene del runtime o de la instantánea pública; no implica registro en proveedor ni que la llamada vaya a funcionar.", "It comes from the runtime or the public snapshot; it does not imply provider registration or that the call will work.");
}

function renderCatalogDiagnostics() {
  var host = clear("catalogDiagnostics");
  var live = catalogSnapshot.source === "live";
  var knownIds = new Set(allModels().map(function (model) { return model.id; }));
  var rows = [[L("Etapa / subagente", "Stage / subagent"), L("ID de modelo configurado", "Configured model ID"), L("Exigencia", "Requirement"), L("Estado en el runtime", "Runtime status")]];
  var statusFor = function (model) {
    return !live ? L("Desconocido — catálogo de respaldo", "Unknown — backup catalog")
      : knownIds.has(model) ? L("Listado por el runtime en vivo", "Listed by the live runtime")
      : L("No lo expone esta sesión", "Not exposed by this session");
  };
  ["orchestrate", "plan", "execute", "verify"].forEach(function (role) {
    var model = state.roles && state.roles[role] && state.roles[role].model || "";
    rows.push([role, model || L("(sin configurar)", "(not configured)"), "—", statusFor(model)]);
  });
  // A subagent pin is the one enforced with modelPolicy=required, so an id the
  // runtime cannot resolve silently routes elsewhere; the rows make that visible.
  var pinnedAgents = (state.subagents && state.subagents.agents) || {};
  Object.keys(pinnedAgents).forEach(function (type) {
    var entry = pinnedAgents[type] || {};
    if (!entry.model) return;
    rows.push(["subagent:" + type, entry.model, entry.modelPolicy || L("(predeterminada)", "(default)"), statusFor(entry.model)]);
  });
  var sourceText = live
    ? L("Fuente: session.rpc.model.list() — runtime de la sesión en vivo", "Source: session.rpc.model.list() — this session's live runtime")
    : L("Fuente: catálogo de respaldo — no se pudo confirmar disponibilidad en vivo", "Source: backup catalog — live availability could not be confirmed");
  var checkedText = catalogDiagnostics.fetchedAt
    ? L("Última comprobación: ", "Last checked: ") + new Date(catalogDiagnostics.fetchedAt).toLocaleString()
    : L("Última comprobación: desconocida", "Last checked: unknown");
  host.append(el("p", { className: "note", textContent: sourceText + ". " + checkedText +
    ". " + (catalogDiagnostics.modelCount ?? allModels().length) + L(" modelos en ", " models across ") +
    (catalogDiagnostics.providers || []).length + L(" proveedores.", " providers.") }));
  if (!live) {
    host.append(el("p", { className: "note", textContent:
      catalogSnapshot.diagnostic || L("La petición de modelos en vivo falló o no devolvió modelos; consulta el registro de la extensión para más detalle. El catálogo de respaldo es solo informativo y no puede confirmar disponibilidad.", "The live model request failed or returned no models; check the extension log for more detail. The backup catalog is informational only and cannot confirm availability.") }));
  }
  host.append(el("p", { className: "note", textContent:
    L("«Listado por el runtime en vivo» significa que la sesión actual reporta ese ID exacto; no verifica credenciales del proveedor ni una petición de inferencia con éxito. «No lo expone esta sesión» no significa que el modelo falte en los ajustes de la app ni en el registro de un proveedor.", "«Listed by the live runtime» means the current session reports that exact ID; it does not verify provider credentials or a successful inference request. «Not exposed by this session» does not mean the model is missing from the app's settings or from a provider's registry.") }));
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
      placeholder: L("ID del proveedor (ej. c086cdfb-... o el hostname)", "Provider ID (e.g. c086cdfb-... or the hostname)"),
      style: { flex: "1 1 280px", fontSize: "12px", padding: "4px 8px", border: "1px solid var(--border-color-default, #d1d9e0)", borderRadius: "6px" }
    });
    var labelInput = el("input", {
      type: "text",
      placeholder: L("Nombre legible (ej. Mi proveedor externo)", "Readable name (e.g. My external provider)"),
      style: { flex: "1 1 200px", fontSize: "12px", padding: "4px 8px", border: "1px solid var(--border-color-default, #d1d9e0)", borderRadius: "6px" }
    });
    var addBtn = el("button", {
      className: "toggle",
      type: "button",
      textContent: L("Agregar", "Add"),
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
    [L("Estado en el runtime", "Runtime status"), L("Solo se marca como listado un ID de modelo exacto presente en una lista de modelos en vivo de la sesión con éxito. No es una prueba de credenciales, endpoint ni inferencia.", "Only an exact model ID present in a successful live model list for the session is marked as listed. It is not proof of credentials, endpoint, or inference.")],
    [L("Catálogo de respaldo", "Backup catalog"), L("Lista solo informativa que se usa cuando la lista de modelos de la sesión no está disponible. Nunca confirma que un modelo del flujo de trabajo esté disponible.", "An informational-only list used when the session's model list is unavailable. It never confirms that a workflow model is available.")],
    [L("Proveedor", "Provider"), L("Quién sirve el modelo. GitHub Copilot, o el proveedor externo cuya clave tengas configurada.", "Who serves the model. GitHub Copilot, or the external provider whose key you have configured.")],
    [L("Fabricante", "Vendor"), L("Quién lo construyó. Se muestra aparte del proveedor porque un mismo fabricante puede llegar por varias vías.", "Who built it. It is shown separately from the provider because the same vendor can arrive through several channels.")],
    [L("Origen del dato", "Data origin"), L("De dónde ha salido el fabricante: del runtime, de la instantánea pública, de la familia del modelo o de una heurística sobre el identificador.", "Where the vendor came from: the runtime, the public snapshot, the model family, or a heuristic over the identifier.")],
    [L("Precio", "Price"), L("Categoría de precio del plan en los modelos de Copilot; en los de clave propia, el precio de API que publica el fabricante.", "Plan price category for Copilot models; for own-key models, the API price the vendor publishes.")],
    [L("Contexto", "Context"), L("Cuántos tokens caben en una sola conversación. Más contexto permite analizar proyectos enteros, y también encarece cada llamada.", "How many tokens fit in a single conversation. More context lets you analyze whole projects, and also raises the cost of each call.")],
    [L("Global", "Global"), L("Nota media de los benchmarks públicos. Un guion significa que ese modelo todavía no aparece en ninguno.", "Average score across public benchmarks. A dash means that model does not yet appear in any.")]
  ]);
}
`;
