// Client section "benchmarks tab" (split from renderer.mjs, issue #13).
export const CLIENT_BENCH = String.raw`// --- benchmarks tab ---------------------------------------------------------

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
    var entry = agents[playbook.type] || {};
    var pinned = entry.model || null;
    var pinnedEffort = entry.effortLevel || "";
    var pinnedModel = pinned ? findModel(pinned) : null;
    var matches = pinned === best.model.id;
    var bestEfforts = effortOptionsFor(best.model.id);
    // Effort about to be pinned with the recommended model; starts from what
    // is already fixed so the card shows the real current state.
    var chosenEffort = matches ? pinnedEffort : "";

    var card = el("div", { className: "card" + (matches ? " mine" : "") }, [
      el("h3", { className: "mono", textContent: playbook.type }),
      el("p", { className: "what", textContent: playbook.what }),
      el("div", { className: "pick" }, [
        el("span", { className: "who", textContent: best.model.label }),
        el("span", { className: "score " + (best.score >= 75 ? "tone-good" : best.score >= 50 ? "tone-mid" : "tone-bad"), textContent: num(best.score, 0) + " / 100 de encaje" })
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
    if (pinnedEffort) pinLine.append(el("span", { className: "mono", textContent: " · " + pinnedEffort }));
    if (pinnedModel && !pinnedModel.external && !best.model.external && typeof pinnedModel.blendedCost === "number" && typeof best.model.blendedCost === "number" && best.model.blendedCost > 0) {
      var factor = pinnedModel.blendedCost / best.model.blendedCost;
      if (factor >= 1.6) {
        card.append(el("p", { className: "tiny", style: { margin: "4px 0 0" },
          textContent: "Ojo: el modelo que tienes fijado cuesta unas " + factor.toFixed(1) + " veces más por token que el recomendado." }));
      }
    }
    card.append(pinLine);

    // Effort travels with the pin: the recommended model is only half the
    // decision, and the same levels as the routing tab apply here.
    var effortRow = el("div", { className: "small", style: { display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" } }, [
      el("span", { className: "muted", textContent: "Esfuerzo:" })
    ]);
    effortRow.append(selectFrom(bestEfforts, chosenEffort, function (value) {
      chosenEffort = value;
      paintActions();
    }));
    card.append(effortRow);

    var actions = el("div");
    function paintActions() {
      actions.replaceChildren();
      if (matches && chosenEffort === pinnedEffort) {
        actions.append(el("p", { className: "tiny", style: { margin: "8px 0 0" },
          textContent: pinnedEffort ? "Ya coincide: modelo y esfuerzo fijados." : "Ya coincide con la recomendación." }));
        return;
      }
      actions.append(el("button", {
        className: "mini primary", style: { marginTop: "8px" },
        textContent: "Fijar " + best.model.label + (chosenEffort ? " · " + chosenEffort : ""),
        onclick: function () {
          var next = Object.assign({}, agents[playbook.type] || {}, { model: best.model.id });
          if (chosenEffort) next.effortLevel = chosenEffort; else delete next.effortLevel;
          agents[playbook.type] = next;
          state.subagents.agents = agents;
          markDirty();
          renderRecommendations();
          renderSubagents();
        }
      }));
    }
    paintActions();
    card.append(actions);

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
    host.append(el("p", { className: "small muted", textContent:
      "Este modelo todavía no tiene notas públicas de benchmark: ninguna fuente de la instantánea lo mide a él ni a ninguna variante de su familia. " +
      "Las fuentes van por detrás de los lanzamientos; en cuanto midan el modelo o un hermano de la misma familia, aparecerá aquí (los marcados con ~ son estimaciones por familia)." }));
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
    if (model.effortOptions && model.effortOptions.length > 1) {
      host.append(el("p", { className: "tiny muted", style: { marginTop: "6px" },
        textContent: "Las notas no desglosan por nivel de esfuerzo: cambiar el esfuerzo altera la calidad, latencia y coste reales de cada uso, pero la fuente mide el modelo una sola vez." }));
    }
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
    if (onlyMine && !mine[row.id]) return false;
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
        textContent: onlyMine
          ? "Ninguno de los modelos que puedes elegir tiene notas públicas ni una estimación por familia. Desactiva el botón de arriba para ver los " + scored.length + " modelos que sí están medidos, aunque no puedas escogerlos."
          : "Ninguno de los modelos filtrados tiene notas de benchmarks públicos todavía."
      })
    ]));
  }
  table.append(body);

  var sub = rows.length + " de " + scored.length + " modelos con notas" +
    (onlyMine ? " · solo los que puedes elegir" : " · todo el campo público") +
    (limit ? " · filtrados" : "") + ".";
  if (!onlyMine) sub += " Las highlighted rows are model IDs listed by this session's live model RPC; this does not verify provider credentials or successful inference.";
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
`;
