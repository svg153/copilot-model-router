// Client section "guide tab" (split from renderer.mjs, issue #13).
export const CLIENT_GUIDE = String.raw`// --- guide tab --------------------------------------------------------------

function renderGuide() {
  defs("guideDefs", [
    ["Routing", "Choose models for the four workflow stages (orchestrate, plan, execute, verify) and for the subagents launched by the main agent. Orchestrate prepares decomposition and targets; Plan details implementation; only Execute implements changes."],
    ["Exigencia (modelPolicy)", "Decide si el modelo fijado es obligatorio (required), una simple sugerencia (preferred) o si no opinas (inherit). Es lo que evita que una llamada suelta se vaya a un modelo caro sin que te enteres."],
    ["Esfuerzo (effort)", "Cuánto piensa el modelo antes de contestar. Más esfuerzo resuelve mejor lo difícil y cuesta más por llamada; menos esfuerzo responde antes y gasta menos."],
    ["Catalog", "The model IDs reported by this session's model-list RPC. This list does not inspect provider settings or credentials and does not guarantee inference will succeed. It includes vendor, price category, context, and public benchmark score when available."],
    ["Comparativa", "La parte educativa: para cada tipo de tarea te dice qué modelo sale mejor y por qué, con las notas públicas de benchmarks y el precio al lado."],
    ["Benchmark", "Una prueba estandarizada con la que se mide a los modelos. Ninguno gana en todo: hay quien escribe mejor código y quien razona mejor. Por eso la recomendación cambia según la tarea."],
    ["Fabricante frente a proveedor", "El proveedor es quien te sirve el modelo (GitHub Copilot o tu proveedor externo). El fabricante es quien lo construyó (Anthropic, OpenAI, Alibaba…). Un mismo fabricante puede llegarte por las dos vías."],
    ["Traer tu propia clave", "Los modelos del proveedor externo se pagan contra tu cuenta de ese proveedor, no contra la cuota de Copilot. Son los que hacen barato el trabajo masivo."],
    ["Auto", "Cuando el agente elige modelo por su cuenta tiende a subir a los grandes. Fijar los subagentes con un modelo barato y exigencia required es lo que corta esa escalada."],
    ["Instantánea de datos", "Un fichero JSON con fabricantes, precios, notas de benchmark y velocidades, generado desde fuentes públicas y actualizado periódicamente por el propio repositorio."],
    ["Filtro por proveedor", "Reduce todo lo que ves a los modelos de un solo proveedor. Al elegir tu proveedor externo, las seis recomendaciones y los subagentes se recalculan usando solo esos modelos: sirve para comprobar qué conviene dentro de lo que ya pagas."],
    ["Selección de modelos", "Puedes quitar modelos concretos de la comparación con un clic. El primer clic deja seleccionados todos y desmarca el que pulsaste, así que se quita de uno en uno. Mientras haya selección manual, todo se calcula con los que queden."],
    ["Solo mis modelos", "La tabla de la pestaña Comparativa y el mapa 3D arrancan mostrando solo lo que coincide con tu catálogo, para no perder de vista los tuyos entre los demás. Al desactivarlo aparecen los 88 modelos del ranking público, útiles como referencia aunque no puedas escogerlos."],
    ["Filtros del mapa 3D", "Además de la selección de arriba, el mapa tiene sus propios interruptores: quitar Solo mis modelos, ocultar las notas estimadas, ocultar el carril de las esferas sin precio, y aislar un fabricante pulsando su color en la leyenda."],
    ["Notas estimadas (~)", "Si el benchmark no midió tu modelo exacto pero sí variantes de su familia, la nota es la mediana de esas variantes y va marcada con una tilde. Nunca se presenta como una medida directa."]
  ]);
}

function renderSources() {
  defs("sourceDefs", [
    ["models.dev", "Catálogo abierto de proveedores y modelos. Aporta fabricante, precios, contexto, capacidades y pesos abiertos. Licencia MIT. Mantenido por el proyecto anomalyco (antes sst).",
      "https://github.com/anomalyco/models.dev"],
    ["chinese-llm-benchmark", "Repositorio público con clasificaciones por capacidad: razonamiento, código, uso de herramientas, terminal, medicina, derecho, finanzas… De aquí salen todas las notas de benchmark. Es el trabajo de jeinlee1991 y colaboradores; el repositorio no declara una licencia explícita, así que solo se reproducen las puntuaciones numéricas ya publicadas, sin copiar su código ni su texto.",
      "https://github.com/jeinlee1991/chinese-llm-benchmark"],
    ["showdown", "Comparativa pública de velocidad y latencia, usada además para contrastar precios y completar huecos. Licencia AGPL-3.0. De aquí solo se extraen los valores numéricos de velocidad; no se reutiliza su código.",
      "https://github.com/verseles/showdown"],
    ["three.js", "Biblioteca con la que se dibuja la pestaña 3D. Se incluye empaquetada dentro de la extensión, así que el panel funciona sin conexión. Licencia MIT.",
      "https://github.com/mrdoob/three.js"],
    ["Instantánea", "Las tres fuentes de datos se cruzan en un único JSON que se descarga el propio panel. Si no hay conexión, se usa la copia incluida con la extensión."],
    ["Actualización automática", "Un flujo de trabajo del repositorio regenera la instantánea cada semana y la publica, así que el panel no tiene que mantener ninguna lista a mano."],
    ["~ (nota estimada)", "Cuando el benchmark no midió ese modelo exacto pero sí variantes de su misma familia, se muestra la mediana de esas variantes marcada con una tilde. Es una estimación, no una medida directa, y el panel lo dice explícitamente en lugar de dejarlo pasar por un dato real."],
    ["Sin precio público", "Algunos modelos medidos no publican tarifa. No se pueden colocar en un eje de precio, así que la tabla los deja sin coste y el 3D los dibuja huecos en un carril aparte."]
  ]);
  var parts = [];
  if (benchMeta && benchMeta.generatedAt) parts.push("Instantánea actual: " + benchMeta.generatedAt.slice(0, 10) + ".");
  parts.push(benchSource === "downloaded" ? "Se está usando la versión descargada del repositorio." : benchSource === "bundled" ? "Se está usando la copia incluida con la extensión." : "No se ha podido cargar ninguna instantánea.");
  if (repoUrl) parts.push("Repositorio del panel: " + repoUrl);
  document.getElementById("sourceMeta").textContent = parts.join(" ");
}
`;
