// Static HTML skeleton of the canvas tabs (split from renderer.mjs, issue #13).
export const BODY = `
<header>
  <div class="head-row">
    <div class="logo" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="24" height="24"><circle cx="5" cy="6" r="2.2"></circle><circle cx="5" cy="18" r="2.2"></circle><circle cx="19" cy="12" r="2.2"></circle><path d="M7.2 6H12a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H7.2"></path><path d="M7.2 18H12"></path></svg>
    </div>
    <div>
      <h1>Model Router</h1>
      <p class="sub">
        Decide qué modelo atiende cada tarea: los del plan de GitHub Copilot para lo que exige calidad,
        y los del proveedor externo (tu propia clave, sin coste por petición premium) para el trabajo masivo.
      </p>
    </div>
  </div>
</header>

<div class="bar-top">
  <button id="apply" class="primary">Guardar y aplicar</button>
  <button id="reset" class="danger">Restaurar valores por defecto</button>
  <button id="refresh">Actualizar datos</button>
  <span id="status" class="status"></span>
</div>

<nav class="tabs" id="tabs">
  <button data-tab="routing" aria-selected="true"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>Enrutado</button>
  <button data-tab="catalog" aria-selected="false"><svg viewBox="0 0 24 24" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>Catálogo</button>
  <button data-tab="bench" aria-selected="false"><svg viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>Comparativa</button>
  <button data-tab="scene" aria-selected="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>3D</button>
  <button data-tab="guide" aria-selected="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>Guía</button>
</nav>

<section class="panel" data-panel="routing" data-active="true">
  <div class="banner" id="filterBanner" style="display:none"></div>
  <div class="section">
    <h2>Roles del flujo de trabajo</h2>
    <p class="sub">
      El flujo de trabajo <span class="mono">orchestrate → plan → execute → verify</span> tiene cuatro etapas.
      Orchestrate descompone la tarea y entrega los objetivos a Plan; no implementa cambios.
      Elige aquí el modelo y el esfuerzo de razonamiento de cada etapa.
    </p>
    <div id="roles"></div>
  </div>

  <div class="section">
    <h2>Subagentes fijados</h2>
    <p class="sub">
      Los subagentes que lanza el agente principal (búsquedas, revisiones, investigaciones).
      Fijar un modelo aquí evita que cada llamada elija por su cuenta uno más caro.
    </p>
    <div id="subagents"></div>
  </div>

  <div class="section">
    <h2>Qué significa cada ajuste</h2>
    <dl class="defs" id="routingDefs"></dl>
  </div>
</section>

<section class="panel" data-panel="catalog">
  <div class="section">
    <h2>Catálogo en vivo y diagnósticos de enrutado</h2>
    <p class="sub" id="catalogSub">Modelos reportados por el runtime de la sesión actual. Esto no es un registro de proveedores ni una prueba de credenciales.</p>
    <div class="bar-top" style="margin-bottom:10px">
      <button id="refreshCatalog">Actualizar modelos de la sesión</button>
      <span id="catalogRefreshStatus" class="status"></span>
    </div>
    <div id="catalogDiagnostics"></div>
    <div id="catalogMeta" class="note"></div>
    <div class="tablewrap"><table id="catalogTable"></table></div>
  </div>
  <div class="section">
    <h2>Añadir o verificar un proveedor de modelos</h2>
    <p class="sub">
      En la app de escritorio GitHub Copilot, abre <strong>Settings → Model providers → Add provider</strong>,
      guarda el proveedor y después selecciona uno de sus modelos en el selector de modelos de la app. Las
      credenciales del proveedor las gestiona la app. Actualiza este catálogo desde la sesión actual: un
      proveedor que aparezca en los ajustes de la app pero no aquí no lo expone el RPC de lista de modelos
      de esta sesión.
    </p>
    <p class="sub">
      Para la Copilot CLI independiente, configura <code>~/.copilot/providers.json</code> (o la ruta en
      <code>COPILOT_PROVIDERS_CONFIG</code>) y reinicia la CLI. El archivo de proveedores de la CLI guarda
      las credenciales en texto plano; mantenlo privado y nunca lo confirmes. Que un proveedor esté
      registrado y un ID de modelo aparezca en este router no prueba que la sesión actual pueda invocar
      ese modelo.
    </p>
    <p class="sub">
      Consulta las guías oficiales de GitHub:
      <a href="https://docs.github.com/en/copilot/how-tos/github-copilot-app/add-llm-models" target="_blank" rel="noreferrer noopener">proveedores en la app de Copilot</a>
      y
      <a href="https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-llm-models" target="_blank" rel="noreferrer noopener">proveedores en Copilot CLI</a>.
    </p>
  </div>
  <div class="section">
    <h2>Columnas</h2>
    <dl class="defs" id="catalogDefs"></dl>
  </div>
    <div class="section">
      <h2>Etiquetas de proveedor</h2>
      <p class="sub">
        Asigna un nombre legible a cada proveedor externo. El ID (UUID o hostname) se usa internamente;
        la etiqueta es lo que se muestra en la interfaz. Escribe el ID completo del proveedor y el nombre
        que quieras; pulsa <strong>Agregar</strong> y luego <strong>Guardar y aplicar</strong> para que surta efecto.
      </p>
      <div id="providerLabelsEditor"></div>
    </div>
  </section>

<section class="panel" data-panel="bench">
  <div class="section">
    <h2>Qué modelo conviene para cada tarea</h2>
    <p class="sub">
      La recomendación combina <strong>calidad</strong> (notas de benchmarks públicos), <strong>coste</strong>
      y <strong>velocidad</strong>, con un peso distinto según lo que haga el subagente. No hay una sola
      respuesta correcta: hay una respuesta correcta para cada tipo de trabajo.
    </p>
    <p class="sub">
      La puntuación de <strong>encaje</strong> va de 0 a 100 y se lee así: la calidad se mide solo con los
      benchmarks que de verdad evaluan esa tarea (por ejemplo <code>coding</code> para revisar código), y se
      compara contra los 88 modelos del ranking público para que 100 sea el mejor medido y 0 el peor. El coste
      y la velocidad entran con el peso que indique cada tarjeta. Los modelos que <strong>no</strong> aparecen en
      ningún benchmark reciben la media de los medidos en lugar de una ventaja: antes un modelo sin datos
      ganaba por barato, lo cual no era información, era ruido. Cuando el ganador no tiene datos se avisa en
      la propia tarjeta.
    </p>
    <div class="filters">
      <div class="filters-row">
        <span class="filters-label">Proveedor</span>
        <span id="providerFilter"></span>
      </div>
      <div class="filters-row">
        <span class="filters-label">Modelos</span>
        <span id="modelFilter"></span>
      </div>
      <div class="filters-row">
        <span class="filters-label">Atajos</span>
        <span id="filterActions"></span>
      </div>
      <div class="note" id="filterNote" style="margin:0"></div>
    </div>

    <div class="cards" id="recs"></div>
  </div>

  <div class="section">
    <h2>Perfil del modelo seleccionado</h2>
    <p class="sub" id="profileSub">Haz clic en cualquier fila de la tabla de abajo para ver su perfil.</p>
    <div id="profile"></div>
  </div>

  <div class="section">
    <h2>Coste frente a calidad</h2>
    <p class="sub">
      Cada punto es un modelo. Cuanto más a la izquierda, más barato; cuanto más arriba, mejor nota global.
      Lo ideal está arriba a la izquierda: bueno y barato.
    </p>
    <div class="scrollx"><div id="scatter"></div></div>
    <div class="legend" id="scatterLegend"></div>
    <div class="note">
      En los modelos del plan de Copilot el precio que se muestra es el <strong>precio de referencia de la API</strong>,
      no lo que te cobra tu suscripción. Para esos modelos lo que cuenta de verdad es su categoría de precio
      (<span class="mono">bajo</span>, <span class="mono">medio</span>, <span class="mono">alto</span>), que sí es
      la que consume tu cuota.
    </div>
  </div>

  <div class="section">
    <h2>Tabla completa de benchmarks</h2>
    <p class="sub" id="benchSub">Haz clic en una cabecera para ordenar.</p>
    <div class="tablewrap"><table id="benchTable"></table></div>
    <div class="note" id="benchMeta"></div>
  </div>
</section>

<section class="panel" data-panel="scene">
  <div class="section">
    <h2>Mapa 3D del panorama</h2>
    <p class="sub">
      Arrastra para girar, usa la rueda para acercarte y pasa el ratón por encima de una esfera para ver el modelo.
      Es la misma información que la pestaña Comparativa, pero vista como un terreno: se entiende de un vistazo
      dónde está la frontera buena y barata. Arranca mostrando solo los modelos que puedes elegir, igual que la tabla.
    </p>
    <div class="bar-top" style="margin-bottom:10px">
      <button id="sceneReset">Reencuadrar</button>
      <button id="sceneSpin" aria-pressed="false">Girar solo</button>
      <button id="sceneMine" class="toggle" aria-pressed="true">Solo mis modelos</button>
      <button id="sceneEstimated" class="toggle" aria-pressed="true">Con estimadas (~)</button>
      <button id="sceneUnpriced" class="toggle" aria-pressed="true">Con esferas sin precio</button>
      <span id="sceneStatus" class="status"></span>
    </div>
    <div class="scene" id="scene3d"><div class="tip" id="sceneTip"></div></div>
    <div class="axis-key" id="sceneAxes"></div>
    <div class="legend" id="sceneLegend"></div>
    <dl class="defs">
      <dt>Eje horizontal (x)</dt>
      <dd>Precio. A la izquierda lo barato, a la derecha lo caro. La escala es logarítmica, porque las diferencias de precio son enormes. Se marca en <b>ámbar</b>.</dd>
      <dt>Eje vertical (y)</dt>
      <dd>Nota global del benchmark. Arriba los mejores. Se marca en <b>verde</b>.</dd>
      <dt>Profundidad (z)</dt>
      <dd>Velocidad de salida, en tokens por segundo. Delante lo rápido, detrás lo lento. Se marca en <b>azul</b>.</dd>
      <dt>Marco de referencia</dt>
      <dd>
        La caja, la rejilla del suelo y las tres flechas giran junto con las esferas, y los rótulos de los
        extremos siempre miran a la cámara. Así no pierdes la orientación por mucho que gires: cada flecha
        lleva escrito qué mide y en qué sentido crece, con los valores en los dos extremos.
      </dd>
      <dt>Tamaño de la esfera</dt>
      <dd>Nota global: cuanto más grande, mejor.</dd>
      <dt>Color</dt>
      <dd>Fabricante. Un halo marca los modelos que lista el RPC en vivo de esta sesión; no confirma credenciales ni una inferencia con éxito.</dd>
      <dt>Filtros del mapa</dt>
      <dd>
        <b>Solo mis modelos</b> arranca activado y deja en pantalla únicamente los modelos que puedes elegir, igual que
        la tabla de la pestaña Comparativa; al quitarlo aparece todo el campo público para comparar. <b>Con estimadas (~)</b>
        muestra u oculta las esferas cuya nota se dedujo de otras variantes de su familia en vez de medirse directamente.
        <b>Con esferas sin precio</b> muestra u oculta el carril de la derecha. Los botones de color de la leyenda
        filtran por fabricante: el primero que pulsas aísla ese fabricante y el botón <b>Todos los fabricantes</b> lo deshace.
        El filtro de proveedor y modelos de la pestaña Enrutado se aplica encima, pero no borra esferas: atenúa las que
        quedan fuera, para que el terreno siga siendo comparable.
      </dd>
      <dt>Esferas huecas</dt>
      <dd>
        Modelos que el benchmark público midió pero para los que no hay precio público. No pueden colocarse
        en un eje de precio, así que van en su propio carril, a la derecha de la caja, con una línea
        discontinua y el rótulo <b>sin precio público</b>. Se dibujan huecas para que nunca se lean como el
        modelo más caro.
      </dd>
    </dl>
  </div>
</section>

<section class="panel" data-panel="guide">
  <div class="section">
    <h2>Guía rápida</h2>
    <p class="sub">Todo lo que hace este panel, explicado sin dar nada por sabido.</p>
    <dl class="defs" id="guideDefs"></dl>
  </div>
  <div class="section">
    <h2>De dónde salen los datos</h2>
    <dl class="defs" id="sourceDefs"></dl>
    <div class="note" id="sourceMeta"></div>
  </div>
  <div class="section">
    <h2>Traer tu propia clave</h2>
    <p class="sub">
      Los modelos que aparecen bajo un segundo proveedor no los sirve GitHub: se facturan contra la cuenta
      de ese proveedor, con la clave que hayas configurado en la aplicación. Por eso en este panel se marcan
      como <span class="mono">externo</span> y su precio se muestra en dólares de API, no en categorías del plan.
      Son la pieza clave del ahorro: el trabajo repetitivo se va ahí y la cuota premium se reserva para pensar.
    </p>
  </div>
</section>
`;
