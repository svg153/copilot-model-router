// Static HTML skeleton of the canvas tabs (split from renderer.mjs, issue #13).
export const BODY = `
<header>
  <div class="head-row">
    <div class="logo" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="24" height="24"><circle cx="5" cy="6" r="2.2"></circle><circle cx="5" cy="18" r="2.2"></circle><circle cx="19" cy="12" r="2.2"></circle><path d="M7.2 6H12a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H7.2"></path><path d="M7.2 18H12"></path></svg>
    </div>
    <div>
      <h1>Model Router</h1>
      <p class="sub"><span class="ie">Decide qué modelo atiende cada tarea: los del plan de GitHub Copilot para lo que exige calidad, y los del proveedor externo (tu propia clave, sin coste por petición premium) para el trabajo masivo.</span><span class="ien">Decide which model handles each task: GitHub Copilot plan models for quality-critical work, and external-provider models (your own key, no per-request premium cost) for bulk work.</span></p>
    </div>
    <button id="langToggle" class="lang-toggle" type="button" title="Cambiar idioma / Change language" aria-label="Cambiar idioma / Change language"><span class="lt-opt lt-es">ES</span><span class="lt-sep">|</span><span class="lt-opt lt-en">EN</span></button>
  </div>
</header>

<div class="bar-top">
  <button id="apply" class="primary"><span class="ie">Guardar y aplicar</span><span class="ien">Save and apply</span></button>
  <button id="reset" class="danger"><span class="ie">Restaurar valores por defecto</span><span class="ien">Restore defaults</span></button>
  <button id="refresh"><span class="ie">Actualizar datos</span><span class="ien">Refresh data</span></button>
  <span id="status" class="status"></span>
</div>

<nav class="tabs" id="tabs">
  <button data-tab="routing" aria-selected="true"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg><span class="ie">Enrutado</span><span class="ien">Routing</span></button>
  <button data-tab="catalog" aria-selected="false"><svg viewBox="0 0 24 24" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg><span class="ie">Catálogo</span><span class="ien">Catalog</span></button>
  <button data-tab="bench" aria-selected="false"><svg viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg><span class="ie">Comparativa</span><span class="ien">Benchmarks</span></button>
  <button data-tab="scene" aria-selected="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>3D</button>
  <button data-tab="guide" aria-selected="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg><span class="ie">Guía</span><span class="ien">Guide</span></button>
</nav>

<section class="panel" data-panel="routing" data-active="true">
  <div class="banner" id="filterBanner" style="display:none"></div>
  <div class="section">
    <h2><span class="ie">Roles del flujo de trabajo</span><span class="ien">Workflow roles</span></h2>
    <p class="sub"><span class="ie">El flujo de trabajo <span class="mono">orchestrate → plan → execute → verify</span> tiene cuatro etapas. Orchestrate descompone la tarea y entrega los objetivos a Plan; no implementa cambios. Elige aquí el modelo y el esfuerzo de razonamiento de cada etapa.</span><span class="ien">The workflow <span class="mono">orchestrate → plan → execute → verify</span> has four stages. Orchestrate breaks down the task and hands the goals to Plan; it does not implement changes. Choose the model and reasoning effort for each stage here.</span></p>
    <div id="roles"></div>
  </div>

  <div class="section">
    <h2><span class="ie">Subagentes fijados</span><span class="ien">Pinned subagents</span></h2>
    <p class="sub"><span class="ie">Los subagentes que lanza el agente principal (búsquedas, revisiones, investigaciones). Fijar un modelo aquí evita que cada llamada elija por su cuenta uno más caro.</span><span class="ien">The subagents launched by the main agent (searches, reviews, investigations). Pinning a model here stops each call from choosing a pricier one on its own.</span></p>
    <div id="subagents"></div>
  </div>

  <div class="section">
    <h2><span class="ie">Qué significa cada ajuste</span><span class="ien">What each setting means</span></h2>
    <dl class="defs" id="routingDefs"></dl>
  </div>
</section>

<section class="panel" data-panel="catalog">
  <div class="section">
    <h2><span class="ie">Catálogo en vivo y diagnósticos de enrutado</span><span class="ien">Live catalog and routing diagnostics</span></h2>
    <p class="sub" id="catalogSub"><span class="ie">Modelos reportados por el runtime de la sesión actual. Esto no es un registro de proveedores ni una prueba de credenciales.</span><span class="ien">Models reported by the current session's runtime. This is not a provider registry nor a credential check.</span></p>
    <div class="bar-top" style="margin-bottom:10px">
      <button id="refreshCatalog"><span class="ie">Actualizar modelos de la sesión</span><span class="ien">Refresh session models</span></button>
      <span id="catalogRefreshStatus" class="status"></span>
    </div>
    <div id="catalogDiagnostics"></div>
    <div id="catalogMeta" class="note"></div>
    <div class="tablewrap"><table id="catalogTable"></table></div>
  </div>
  <div class="section">
    <h2><span class="ie">Añadir o verificar un proveedor de modelos</span><span class="ien">Add or verify a model provider</span></h2>
    <p class="sub"><span class="ie">En la app de escritorio GitHub Copilot, abre <strong>Settings → Model providers → Add provider</strong>, guarda el proveedor y después selecciona uno de sus modelos en el selector de modelos de la app. Las credenciales del proveedor las gestiona la app. Actualiza este catálogo desde la sesión actual: un proveedor que aparezca en los ajustes de la app pero no aquí no lo expone el RPC de lista de modelos de esta sesión.</span><span class="ien">In the GitHub Copilot desktop app, open <strong>Settings → Model providers → Add provider</strong>, save the provider, then pick one of its models in the app's model picker. The app manages the provider credentials. Refresh this catalog from the current session: a provider that shows up in the app settings but not here is not exposed by this session's model-list RPC.</span></p>
    <p class="sub"><span class="ie">Para la Copilot CLI independiente, configura <code>~/.copilot/providers.json</code> (o la ruta en <code>COPILOT_PROVIDERS_CONFIG</code>) y reinicia la CLI. El archivo de proveedores de la CLI guarda las credenciales en texto plano; mantenlo privado y nunca lo confirmes. Que un proveedor esté registrado y un ID de modelo aparezca en este router no prueba que la sesión actual pueda invocar ese modelo.</span><span class="ien">For the standalone Copilot CLI, configure <code>~/.copilot/providers.json</code> (or the path in <code>COPILOT_PROVIDERS_CONFIG</code>) and restart the CLI. The CLI's providers file stores credentials in plain text; keep it private and never commit it. A provider being registered and a model ID showing up in this router does not prove the current session can invoke that model.</span></p>
    <p class="sub"><span class="ie">Consulta las guías oficiales de GitHub: <a href="https://docs.github.com/en/copilot/how-tos/github-copilot-app/add-llm-models" target="_blank" rel="noreferrer noopener">proveedores en la app de Copilot</a> y <a href="https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-llm-models" target="_blank" rel="noreferrer noopener">proveedores en Copilot CLI</a>.</span><span class="ien">See GitHub's official guides: <a href="https://docs.github.com/en/copilot/how-tos/github-copilot-app/add-llm-models" target="_blank" rel="noreferrer noopener">providers in the Copilot app</a> and <a href="https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-llm-models" target="_blank" rel="noreferrer noopener">providers in Copilot CLI</a>.</span></p>
  </div>
  <div class="section">
    <h2><span class="ie">Columnas</span><span class="ien">Columns</span></h2>
    <dl class="defs" id="catalogDefs"></dl>
  </div>
    <div class="section">
      <h2><span class="ie">Etiquetas de proveedor</span><span class="ien">Provider labels</span></h2>
      <p class="sub"><span class="ie">Asigna un nombre legible a cada proveedor externo. El ID (UUID o hostname) se usa internamente; la etiqueta es lo que se muestra en la interfaz. Escribe el ID completo del proveedor y el nombre que quieras; pulsa <strong>Agregar</strong> y luego <strong>Guardar y aplicar</strong> para que surta efecto.</span><span class="ien">Give each external provider a readable name. The ID (UUID or hostname) is used internally; the label is what's shown in the UI. Enter the provider's full ID and the name you want; press <strong>Add</strong>, then <strong>Save and apply</strong> for it to take effect.</span></p>
      <div id="providerLabelsEditor"></div>
    </div>
  </section>

<section class="panel" data-panel="bench">
  <div class="section">
    <h2><span class="ie">Qué modelo conviene para cada tarea</span><span class="ien">Which model fits each task</span></h2>
    <p class="sub"><span class="ie">La recomendación combina <strong>calidad</strong> (notas de benchmarks públicos), <strong>coste</strong> y <strong>velocidad</strong>, con un peso distinto según lo que haga el subagente. No hay una sola respuesta correcta: hay una respuesta correcta para cada tipo de trabajo.</span><span class="ien">The recommendation combines <strong>quality</strong> (public benchmark scores), <strong>cost</strong>, and <strong>speed</strong>, weighted differently depending on what the subagent does. There is no single right answer: there's a right answer for each type of work.</span></p>
    <p class="sub"><span class="ie">La puntuación de <strong>encaje</strong> va de 0 a 100 y se lee así: la calidad se mide solo con los benchmarks que de verdad evaluan esa tarea (por ejemplo <code>coding</code> para revisar código), y se compara contra los 88 modelos del ranking público para que 100 sea el mejor medido y 0 el peor. El coste y la velocidad entran con el peso que indique cada tarjeta. Los modelos que <strong>no</strong> aparecen en ningún benchmark reciben la media de los medidos en lugar de una ventaja: antes un modelo sin datos ganaba por barato, lo cual no era información, era ruido. Cuando el ganador no tiene datos se avisa en la propia tarjeta.</span><span class="ien">The <strong>fit</strong> score runs from 0 to 100 and reads like this: quality is measured only against the benchmarks that actually evaluate that task (for example <code>coding</code> for code review), and compared against the 88 models in the public ranking so that 100 is the best measured and 0 the worst. Cost and speed enter with the weight each card indicates. Models that do <strong>not</strong> appear in any benchmark get the average of the measured ones instead of an advantage: before, a model without data won just for being cheap, which wasn't information, it was noise. When the winner has no data, the card itself warns about it.</span></p>
    <div class="filters">
      <div class="filters-row">
        <span class="filters-label"><span class="ie">Proveedor</span><span class="ien">Provider</span></span>
        <span id="providerFilter"></span>
      </div>
      <div class="filters-row">
        <span class="filters-label"><span class="ie">Modelos</span><span class="ien">Models</span></span>
        <span id="modelFilter"></span>
      </div>
      <div class="filters-row">
        <span class="filters-label"><span class="ie">Atajos</span><span class="ien">Shortcuts</span></span>
        <span id="filterActions"></span>
      </div>
      <div class="note" id="filterNote" style="margin:0"></div>
    </div>

    <div class="cards" id="recs"></div>
  </div>

  <div class="section">
    <h2><span class="ie">Perfil del modelo seleccionado</span><span class="ien">Selected model profile</span></h2>
    <p class="sub" id="profileSub"><span class="ie">Haz clic en cualquier fila de la tabla de abajo para ver su perfil.</span><span class="ien">Click any row in the table below to see its profile.</span></p>
    <div id="profile"></div>
  </div>

  <div class="section">
    <h2><span class="ie">Coste frente a calidad</span><span class="ien">Cost vs quality</span></h2>
    <p class="sub"><span class="ie">Cada punto es un modelo. Cuanto más a la izquierda, más barato; cuanto más arriba, mejor nota global. Lo ideal está arriba a la izquierda: bueno y barato.</span><span class="ien">Each dot is a model. The further left, the cheaper; the further up, the better the overall score. Ideal is top-left: good and cheap.</span></p>
    <div class="scrollx"><div id="scatter"></div></div>
    <div class="legend" id="scatterLegend"></div>
    <div class="note"><span class="ie">En los modelos del plan de Copilot el precio que se muestra es el <strong>precio de referencia de la API</strong>, no lo que te cobra tu suscripción. Para esos modelos lo que cuenta de verdad es su categoría de precio (<span class="mono">bajo</span>, <span class="mono">medio</span>, <span class="mono">alto</span>), que sí es la que consume tu cuota.</span><span class="ien">For Copilot plan models, the price shown is the <strong>API reference price</strong>, not what your subscription charges. For those models what really counts is their price tier (<span class="mono">low</span>, <span class="mono">medium</span>, <span class="mono">high</span>), which is what consumes your quota.</span></div>
  </div>

  <div class="section">
    <h2><span class="ie">Tabla completa de benchmarks</span><span class="ien">Full benchmarks table</span></h2>
    <p class="sub" id="benchSub"><span class="ie">Haz clic en una cabecera para ordenar.</span><span class="ien">Click a header to sort.</span></p>
    <div class="tablewrap"><table id="benchTable"></table></div>
    <div class="note" id="benchMeta"></div>
  </div>
</section>

<section class="panel" data-panel="scene">
  <div class="section">
    <h2><span class="ie">Mapa 3D del panorama</span><span class="ien">3D overview map</span></h2>
    <p class="sub"><span class="ie">Arrastra para girar, usa la rueda para acercarte y pasa el ratón por encima de una esfera para ver el modelo. Es la misma información que la pestaña Comparativa, pero vista como un terreno: se entiende de un vistazo dónde está la frontera buena y barata. Arranca mostrando solo los modelos que puedes elegir, igual que la tabla.</span><span class="ien">Drag to rotate, use the wheel to zoom, and hover over a sphere to see the model. It's the same information as the Benchmarks tab, but seen as a terrain: you can tell at a glance where the good-and-cheap frontier is. It starts showing only the models you can choose, just like the table.</span></p>
    <div class="bar-top" style="margin-bottom:10px">
      <button id="sceneReset"><span class="ie">Reencuadrar</span><span class="ien">Re-frame</span></button>
      <button id="sceneSpin" aria-pressed="false"><span class="ie">Girar solo</span><span class="ien">Spin only</span></button>
      <button id="sceneMine" class="toggle" aria-pressed="true"><span class="ie">Solo mis modelos</span><span class="ien">Only my models</span></button>
      <button id="sceneEstimated" class="toggle" aria-pressed="true"><span class="ie">Con estimadas (~)</span><span class="ien">With estimates (~)</span></button>
      <button id="sceneUnpriced" class="toggle" aria-pressed="true"><span class="ie">Con esferas sin precio</span><span class="ien">With unpriced spheres</span></button>
      <span id="sceneStatus" class="status"></span>
    </div>
    <div class="scene" id="scene3d"><div class="tip" id="sceneTip"></div></div>
    <div class="axis-key" id="sceneAxes"></div>
    <div class="legend" id="sceneLegend"></div>
    <dl class="defs">
      <dt><span class="ie">Eje horizontal (x)</span><span class="ien">Horizontal axis (x)</span></dt>
      <dd><span class="ie">Precio. A la izquierda lo barato, a la derecha lo caro. La escala es logarítmica, porque las diferencias de precio son enormes. Se marca en <b>ámbar</b>.</span><span class="ien">Price. Cheap on the left, expensive on the right. The scale is logarithmic, because price differences are huge. Marked in <b>amber</b>.</span></dd>
      <dt><span class="ie">Eje vertical (y)</span><span class="ien">Vertical axis (y)</span></dt>
      <dd><span class="ie">Nota global del benchmark. Arriba los mejores. Se marca en <b>verde</b>.</span><span class="ien">Overall benchmark score. Best at the top. Marked in <b>green</b>.</span></dd>
      <dt><span class="ie">Profundidad (z)</span><span class="ien">Depth (z)</span></dt>
      <dd><span class="ie">Velocidad de salida, en tokens por segundo. Delante lo rápido, detrás lo lento. Se marca en <b>azul</b>.</span><span class="ien">Output speed, in tokens per second. Fast at the front, slow at the back. Marked in <b>blue</b>.</span></dd>
      <dt><span class="ie">Marco de referencia</span><span class="ien">Reference frame</span></dt>
      <dd><span class="ie">La caja, la rejilla del suelo y las tres flechas giran junto con las esferas, y los rótulos de los extremos siempre miran a la cámara. Así no pierdes la orientación por mucho que gires: cada flecha lleva escrito qué mide y en qué sentido crece, con los valores en los dos extremos.</span><span class="ien">The box, the floor grid, and the three arrows rotate together with the spheres, and the end labels always face the camera. That way you don't lose orientation no matter how much you rotate: each arrow is labeled with what it measures and which direction it grows, with values at both ends.</span></dd>
      <dt><span class="ie">Tamaño de la esfera</span><span class="ien">Sphere size</span></dt>
      <dd><span class="ie">Nota global: cuanto más grande, mejor.</span><span class="ien">Overall score: the bigger, the better.</span></dd>
      <dt><span class="ie">Color</span><span class="ien">Color</span></dt>
      <dd><span class="ie">Fabricante. Un halo marca los modelos que lista el RPC en vivo de esta sesión; no confirma credenciales ni una inferencia con éxito.</span><span class="ien">Manufacturer. A halo marks the models listed by this session's live RPC; it doesn't confirm credentials or a successful inference.</span></dd>
      <dt><span class="ie">Filtros del mapa</span><span class="ien">Map filters</span></dt>
      <dd><span class="ie"><b>Solo mis modelos</b> arranca activado y deja en pantalla únicamente los modelos que puedes elegir, igual que la tabla de la pestaña Comparativa; al quitarlo aparece todo el campo público para comparar. <b>Con estimadas (~)</b> muestra u oculta las esferas cuya nota se dedujo de otras variantes de su familia en vez de medirse directamente. <b>Con esferas sin precio</b> muestra u oculta el carril de la derecha. Los botones de color de la leyenda filtran por fabricante: el primero que pulsas aísla ese fabricante y el botón <b>Todos los fabricantes</b> lo deshace. El filtro de proveedor y modelos de la pestaña Enrutado se aplica encima, pero no borra esferas: atenúa las que quedan fuera, para que el terreno siga siendo comparable.</span><span class="ien"><b>Only my models</b> starts enabled and keeps only the models you can choose on screen, just like the Benchmarks tab table; turning it off reveals the whole public field for comparison. <b>With estimates (~)</b> shows or hides the spheres whose score was inferred from other variants in their family rather than measured directly. <b>With unpriced spheres</b> shows or hides the right-hand lane. The colored legend buttons filter by manufacturer: the first one you click isolates that manufacturer, and the <b>All manufacturers</b> button undoes it. The provider and models filter from the Routing tab applies on top, but doesn't remove spheres: it dims the ones left out, so the terrain stays comparable.</span></dd>
      <dt><span class="ie">Esferas huecas</span><span class="ien">Hollow spheres</span></dt>
      <dd><span class="ie">Modelos que el benchmark público midió pero para los que no hay precio público. No pueden colocarse en un eje de precio, así que van en su propio carril, a la derecha de la caja, con una línea discontinua y el rótulo <b>sin precio público</b>. Se dibujan huecas para que nunca se lean como el modelo más caro.</span><span class="ien">Models the public benchmark measured but for which there is no public price. They can't be placed on a price axis, so they go in their own lane, to the right of the box, with a dashed line and the <b>no public price</b> label. They're drawn hollow so they're never read as the most expensive model.</span></dd>
    </dl>
  </div>
</section>

<section class="panel" data-panel="guide">
  <div class="section">
    <h2><span class="ie">Guía rápida</span><span class="ien">Quick guide</span></h2>
    <p class="sub"><span class="ie">Todo lo que hace este panel, explicado sin dar nada por sabido.</span><span class="ien">Everything this panel does, explained without assuming prior knowledge.</span></p>
    <dl class="defs" id="guideDefs"></dl>
  </div>
  <div class="section">
    <h2><span class="ie">De dónde salen los datos</span><span class="ien">Where the data comes from</span></h2>
    <dl class="defs" id="sourceDefs"></dl>
    <div class="note" id="sourceMeta"></div>
  </div>
  <div class="section">
    <h2><span class="ie">Traer tu propia clave</span><span class="ien">Bring your own key</span></h2>
    <p class="sub"><span class="ie">Los modelos que aparecen bajo un segundo proveedor no los sirve GitHub: se facturan contra la cuenta de ese proveedor, con la clave que hayas configurado en la aplicación. Por eso en este panel se marcan como <span class="mono">externo</span> y su precio se muestra en dólares de API, no en categorías del plan. Son la pieza clave del ahorro: el trabajo repetitivo se va ahí y la cuota premium se reserva para pensar.</span><span class="ien">Models that appear under a second provider are not served by GitHub: they're billed against that provider's account, with the key you configured in the app. That's why this panel marks them as <span class="mono">external</span> and shows their price in API dollars, not plan tiers. They're the key to saving: repetitive work goes there and the premium quota is reserved for thinking.</span></p>
  </div>
</section>
`;
