// Client section "3D tab" (split from renderer.mjs, issue #13).
export const CLIENT_SCENE = String.raw`// --- 3D tab -----------------------------------------------------------------

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
  var vendors = "all";
  if (sceneVendors) vendors = Object.keys(sceneVendors).sort().join(",");
  return filters.provider + "|" + picked + "|" + vendors + "|" +
    (onlyMine ? "mine" : "all") + "|" +
    (sceneShowUnpriced ? "px" : "nopx") + "|" +
    (sceneShowEstimated ? "est" : "noest") + "|" +
    benchRows.length + "|" + allModels().length;
}

/**
 * Plots the scored rows that survive the scope and the 3D filters. The
 * provider/model filter does not remove anything here: it only decides which
 * spheres get a ring and which ones fade, so the landscape stays comparable.
 */
function scenePoints() {
  var limit = activeKeySet();
  return scoredRows().filter(function (row) {
    if (!row.bench || typeof row.bench.total !== "number") return false;
    if (onlyMine && !isMine(row.id)) return false;
    if (!sceneShowEstimated && row.estimated) return false;
    if (!sceneShowUnpriced && typeof row.blendedCost !== "number") return false;
    if (sceneVendors && !sceneVendors[row.vendor || VENDOR_FALLBACK]) return false;
    return true;
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
    host.append(el("p", {
      className: "small muted",
      style: { padding: "16px" },
      textContent: onlyMine
        ? "Ninguno de los modelos que puedes elegir tiene nota global ni una estimación por familia. Quita el botón Solo mis modelos para ver todo el campo público."
        : "Ninguna esfera pasa los filtros del mapa 3D. Prueba a activar las esferas sin precio, las estimadas o a soltar el filtro de fabricante."
    }));
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
    status.textContent = points.length + " esferas" +
      (onlyMine ? " (solo las que puedes elegir)" : " (todo el campo público)") +
      " · " + highlighted + " con halo" +
      (dimmed ? " · " + dimmed + " atenuadas por el filtro de arriba" : "") +
      (sceneVendors ? " · " + Object.keys(sceneVendors).length + " fabricante(s)" : "") +
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

function toggleSceneVendor(vendor) {
  var next = {};
  if (sceneVendors) {
    Object.keys(sceneVendors).forEach(function (key) { if (sceneVendors[key]) next[key] = true; });
  } else {
    // Seed with what is on screen, so the first click isolates one vendor
    // instead of narrowing the map down to that vendor alone.
    scenePoints().forEach(function (point) { next[point.vendor] = true; });
  }
  if (next[vendor]) delete next[vendor]; else next[vendor] = true;
  sceneVendors = Object.keys(next).length ? next : null;
  renderFiltered();
}

function syncSceneButtons() {
  [
    ["sceneMine", onlyMine],
    ["sceneUnpriced", sceneShowUnpriced],
    ["sceneEstimated", sceneShowEstimated]
  ].forEach(function (pair) {
    var node = document.getElementById(pair[0]);
    if (node) node.setAttribute("aria-pressed", pair[1] ? "true" : "false");
  });
}

function renderSceneLegend() {
  var legend = clear("sceneLegend");
  var vendors = {};
  var points = scenePoints();
  points.forEach(function (point) { vendors[point.vendor] = true; });
  var names = Object.keys(vendors).sort();
  if (sceneVendors) {
    legend.append(el("button", {
      className: "toggle", type: "button", textContent: "Todos los fabricantes",
      onclick: function () { sceneVendors = null; renderFiltered(); }
    }));
  }
  names.forEach(function (vendor) {
    var on = !sceneVendors || sceneVendors[vendor] === true;
    legend.append(el("button", {
      className: "toggle",
      type: "button",
      attrs: { "aria-pressed": on ? "true" : "false" },
      title: "Mostrar u ocultar " + vendor,
      onclick: function () { toggleSceneVendor(vendor); }
    }, [
      el("span", { className: "swatch", style: { background: vendorColor(vendor) } }),
      el("span", { textContent: " " + vendor })
    ]));
  });
  var highlighted = points.filter(function (point) { return point.mine; }).length;
  var unpriced = points.filter(function (point) { return point.cost === null; }).length;
  legend.append(el("span", {
    className: "tiny",
    textContent: points.length + " esferas en pantalla · " + highlighted + " resaltadas con halo" +
      (filterActive() ? " (" + activeModels().length + " pasan el filtro de arriba)" : "")
  }));
  if (unpriced) {
    legend.append(el("span", {
      className: "tiny",
      textContent: unpriced + " esferas huecas: sin precio público, fuera del eje X"
    }));
  }
  syncSceneButtons();
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
  [
    ["sceneMine", function (on) { onlyMine = on; }],
    ["sceneEstimated", function (on) { sceneShowEstimated = on; }],
    ["sceneUnpriced", function (on) { sceneShowUnpriced = on; }]
  ].forEach(function (pair) {
    var node = document.getElementById(pair[0]);
    if (!node) return;
    node.addEventListener("click", function () {
      var on = node.getAttribute("aria-pressed") !== "true";
      pair[1](on);
      node.setAttribute("aria-pressed", on ? "true" : "false");
      renderFiltered();
    });
  });
}
`;
