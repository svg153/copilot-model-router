# copilot-model-router

Extensión de canvas para la app de escritorio **GitHub Copilot**: decide qué modelo
de IA se usa para cada tipo de tarea, para que el trabajo masivo no acabe en modelos
premium por culpa de `Auto`.

## Qué incluye

| Pieza | Qué hace |
| --- | --- |
| Panel **Model Router** | Eliges el modelo y el esfuerzo para planificar / ejecutar / verificar, y fijas el modelo **y la obligatoriedad** de cada subagente. Se explica a sí mismo dentro del panel. |
| Catálogo de modelos | Se lee en vivo de la sesión, así que refleja tu plan y tus proveedores reales. |
| Pestaña **Comparativa** | Ranking de benchmarks públicos, gráfico calidad/precio, una recomendación por tipo de subagente y **filtros por proveedor y por modelo**. |
| Pestaña **3D** | Mapa tridimensional de los 88 modelos medidos (calidad, precio y velocidad) con marco de referencia, rejilla y etiquetas de eje. Solo se carga al abrir la pestaña. |
| Workflow `plan-then-execute` | Un modelo caro planifica, modelos baratos ejecutan en paralelo, un tercer modelo verifica. |
| Ajustes de subagentes | Se aplican a la sesión viva vía `session.rpc.tools.updateSubagentSettings`. |
| Bloque de política | Al iniciar sesión se inyecta `<model-routing-policy>` para que el agente enrute a propósito. |
| Instantánea de datos | `model-router/data/models-enriched.json`: fabricante, precio, notas de benchmark y velocidad de 371 modelos, regenerada cada semana por un GitHub Action. |

## Reparto por defecto

En una instalación nueva, los valores iniciales **no están escritos a mano**: se derivan
del catálogo que detecte tu sesión.

| Rol | Regla | Ejemplo |
| --- | --- | --- |
| Planificar | el modelo de Copilot con mejor nota pública (si no hay notas, el primero de gama alta) | `claude-opus-5.5` |
| Ejecutar | el modelo más barato disponible, con esfuerzo `low` | `<proveedor>/mimo-v2.6-flash` |
| Verificar | el segundo más barato, con esfuerzo `medium` | `<proveedor>/glm5.3-flash` |

Los seis subagentes integrados (`explore`, `task`, `general-purpose`, `code-review`,
`research`, `security-review`) se fijan al modelo de ejecución con `contextTier: inherit`
y `modelPolicy: "required"`.

Así el repositorio público no lleva ningún id de proveedor ni ningún nombre de empresa:
cada máquina se configura con lo que tenga delante. Si el catálogo no se puede leer, se
usa una lista mínima de reserva (`claude-opus-5.5` / `claude-haiku-5.5` / `gpt-5.4-mini`).

> **Restaurar por defecto** sobrescribe la configuración guardada con esos valores
> derivados del catálogo, así que **pierdes las fijaciones que hayas afinado a mano**.

### Columna *Enforcement*

Cada fila de subagente tiene un desplegable **Enforcement** con tres opciones:

| Valor | Efecto |
| --- | --- |
| `required` | La fijación es **obligatoria**: si el agente pide otro modelo en la llamada al tool `task`, se rechaza y se usa el fijado. |
| `preferred` | La fijación es la **opción por defecto**, pero un `model` explícito en la llamada gana. |
| *inherit* (vacío) | No se escribe `modelPolicy`; aplica el comportamiento por defecto del runtime. |

`inherit` borra la clave del fichero de configuración en lugar de escribir un valor, así
que la entrada del subagente vuelve a comportarse como si esta extensión no la tocara.

## Cómo llega el modelo a un subagente

Orden de resolución, de mayor a menor prioridad:

1. `model` explícito en la llamada al tool `task`
2. Override de sesión viva (`updateSubagentSettings`) ← lo que aplica esta extensión
3. `settings.json` → `subagents.agents.<nombre>` (lo que escribe `/subagents`)
4. Frontmatter del agente
5. Hereda del padre

`modelPolicy` decide qué ocurre cuando el paso 1 choca con el 2 o el 3:

- `"preferred"` (valor por defecto del runtime) → gana el override del paso 1; la
  fijación es solo una sugerencia y el agente puede escalar a un modelo premium.
- `"required"` → el override del paso 1 se rechaza; siempre se usa el modelo fijado.

## Catálogo de modelos

El panel no lleva una lista de modelos escrita a mano: se la pide a la sesión con
`session.rpc.model.list()`, así que aparecen los modelos de tu plan y los del
proveedor externo con el nombre y el coste que ve la propia app.

- `tier` es el coste relativo en tokens: `low`, `medium`, `high` o `very_high`.
- Los modelos del proveedor externo se reconocen por la forma de su id
  (`<proveedor>/<modelo>`) y salen con `tier: byok`: no se facturan contra el plan de
  Copilot. No hay ningún id de proveedor que mantener.
- El botón **Refresh** fuerza una relectura sin caché.
- Si la llamada falla (sesión sin autenticar, runtime antiguo) el panel muestra una
  lista mínima de reserva y lo indica.

El bloque de política que se inyecta en la sesión se construye con ese mismo catálogo,
así que nombra explícitamente los modelos caros que conviene evitar y los gratuitos que
conviene usar para trabajo masivo.

### Fabricante, precio y notas de benchmark

El runtime no siempre dice quién fabrica un modelo, y no publica notas de calidad. Esos
datos se resuelven en cascada, de más fiable a menos:

1. **Runtime** — si el modelo trae fabricante propio, se usa ese.
2. **Instantánea pública** (`model-router/data/models-enriched.json`) — cruce por id
   normalizado (`glm5.3-flash` → `glm53flash`), con `aliases` para los nombres alternativos.
3. **Familia** — si el id exacto no está, se busca por prefijo (`qwen3.6` → `qwen3.8-flash`)
   y solo se aceptan los campos en los que **todos** los candidatos coinciden.
4. **Heurística sobre el id** — último recurso: `glm` → Z.ai, `mimo` → Xiaomi,
   `deepseek` → DeepSeek, `kimi`/`moonshot` → Moonshot AI, `hydrafusion` → GitHub Copilot, etc.

Los modelos de Copilot que no son públicos (`hydrafusion-max`, `mai-code-1.1-flash`) se
quedan en el paso 1 o 4, porque no aparecen en ninguna fuente abierta.

### De dónde salen los benchmarks

`scripts/build-data.mjs` cruza tres fuentes públicas y sin clave, y escribe la instantánea:

| Fuente | Aporta |
| --- | --- |
| [`models.dev/api.json`](https://models.dev/api.json) | Fabricante, familia, contexto, capacidades y precio de API. Se filtra a los proveedores creadores: de ~8.800 entradas quedan 371 modelos. |
| [`jeinlee1991/chinese-llm-benchmark`](https://github.com/jeinlee1991/chinese-llm-benchmark) | Notas reales de razonamiento, código, agentes, `TAU` y `Terminal-Bench`. Es la fuente de calidad. |
| [`verseles/showdown`](https://github.com/verseles/showdown) | Velocidad de salida y latencia del primer token. Se usa como contraste y para completar familias. |

Resultado: **371 modelos, 371 con fabricante, 331 con precio, 88 con benchmarks y 57 con
velocidad**. La instantánea pesa ~213 KB y va dentro de la extensión, así que el panel
funciona sin red; si el fichero tiene más de una semana, se intenta descargar el más
reciente y se cachea en `artifacts/`.

> No hay ninguna API pública y sin clave que devuelva notas de calidad: LMArena responde
> 403, Artificial Analysis 401 y el dataset de HuggingFace está restringido. Por eso el
> ranking se construye con un repositorio mantenido en GitHub en lugar de consultarse en vivo.

### Cómo se calcula la recomendación

Cada rol (`explore`, `task`, `code-review`, `research`, `security-review`) tiene sus
propios benchmarks y sus propios pesos. La calidad se normaliza **por benchmark** contra
los 88 modelos del ranking público, así que 100 es el mejor medido y 0 el peor, y un
modelo solo se compara con otros que reportan la misma métrica. El coste entra como
categoría de precio del plan (o como precio de API en los modelos de clave propia) y la
velocidad como tokens por segundo.

Un modelo sin benchmarks **no** recibe una ventaja: se le asigna la media de los medidos,
y la tarjeta lo avisa. Sin eso, cualquier modelo barato sin datos ganaba todas las
recomendaciones por el simple hecho de no tener nada que lo penalizara.

### Actualización automática

`.github/workflows/refresh-data.yml` regenera la instantánea los lunes a las 05:17 UTC,
cuando cambia `scripts/build-data.mjs`, y a mano con *Run workflow*. Si el resultado es
idéntico al anterior no hace commit. Como el script conserva el `generatedAt` cuando nada
más cambia, dos ejecuciones seguidas producen un fichero byte a byte igual.

```bash
node scripts/build-data.mjs   # regenerar en local
```

### Filtro por proveedor y selección de modelos

La pestaña **Comparativa** tiene una barra de filtros que afecta a las seis tarjetas de
recomendación, al gráfico, a la tabla y a la leyenda del 3D:

| Control | Efecto |
| --- | --- |
| **Proveedor** | Deja solo los modelos de ese proveedor. Sirve para responder a la pregunta *"con lo que ya pago, ¿qué me conviene para cada tarea?"*. |
| **Modelos** | Al pulsar un modelo se quita de la lista; el primer clic siembra la selección con todo lo visible, así que **desmarcas lo que no quieres** en lugar de quedarte con uno solo. |
| **Ninguno** | Vacía la selección y las tarjetas quedan sin recomendación. |
| **Solo mis modelos en la tabla** | Deja en la tabla únicamente las filas de los modelos que tienes disponibles. |
| **Quitar filtros** | Vuelve a los 37 modelos del catálogo. |

Cuando hay un filtro activo aparece un aviso sobre el panel de enrutado, para que no se
confunda una recomendación filtrada con la recomendación global. Las notas de calidad se
siguen normalizando contra los 88 modelos del ranking público: el filtro cambia **qué**
modelos compiten, no la escala.

### Pestaña 3D

Cada modelo medido es una esfera: **X** es el precio en escala logarítmica, **Y** la nota
global y **Z** la velocidad en tokens por segundo. El color es el fabricante, el tamaño
la nota global, y las esferas con **halo** son los modelos que tienes disponibles ahora
mismo. Los que quedan fuera del filtro se atenúan.

Para que girar la escena no te deje sin referencias, el mapa lleva un **marco de
referencia** fijo: una caja que envuelve los datos, una rejilla en el suelo, tres flechas
de eje y nueve etiquetas que siempre miran a la cámara con el valor de cada extremo.
**Reencuadrar** vuelve a la vista inicial y **Girar solo** rota automáticamente.

## Instalación

### Opción A — desde la app (recomendada)

Pídele al agente de Copilot que instale la extensión desde esta carpeta del repo:

```
Instala esta extensión: https://github.com/svg153/copilot-model-router/tree/main/model-router
```

### Opción B — script

```powershell
git clone https://github.com/svg153/copilot-model-router.git
cd copilot-model-router
./install.ps1
```

### Opción C — manual

Copia la carpeta `model-router/` dentro de `%USERPROFILE%\.copilot\extensions\`
(o `$COPILOT_HOME\extensions\` si defines esa variable) y recarga las extensiones.

## Uso

Abre el panel **Model Router** desde el canvas, cambia lo que quieras y pulsa
**Aplicar routing**. Se guarda en `artifacts/routing.json` dentro de la carpeta de la
extensión y se aplica inmediatamente a la sesión. **Restaurar por defecto** vuelve a los
valores de fábrica.

El panel se explica solo: la sección **Cómo funciona** resume qué es cada apartado y qué
afecta, y debajo de **Roles del workflow** y **Subagentes fijados** hay una lista con el
significado de *Effort* (presupuesto de razonamiento del modelo) y de cada valor de
*Enforcement* (`required` / `preferred` / `inherit`).

Para el flujo caro/barato, invoca el workflow:

```
plan-then-execute
args: {
  "task": "lo que hay que hacer",
  "targets": ["unidad 1", "unidad 2"],
  "planModel": "...",     // opcional, por defecto el del panel
  "workerModel": "...",   // opcional
  "verifyModel": "...",   // opcional
  "verify": true          // opcional
}
```

Sin `targets` el workflow usa `[task]` como única unidad de trabajo.

## Configuración

`model-router/artifacts/routing.json` es el estado guardado. Si el archivo falta o
está corrupto, se usan los valores por defecto de `routing.mjs`, así que un JSON roto
nunca rompe una ejecución.

### Fijación permanente sin la extensión

El comando `copilot config` **no** puede escribir estos ajustes (responde *"Edit
settings.json directly"*). La forma persistida, verificada contra el CLI, es:

```json
"subagents": {
  "agents": {
    "explore": { "model": "<id>", "effortLevel": "low", "modelPolicy": "required" }
  },
  "maxConcurrency": 4
}
```

Dentro de una sesión, `/subagents` es la vía interactiva.

### Auto

`Auto` no tiene umbral configurable, pero sí perfil de enrutado:

```powershell
copilot config autoTier efficiency
```

`efficiency` hace que `Auto` prefiera modelos baratos en lugar de escalar.

### Otro proveedor

Los modelos del proveedor externo se detectan por la forma de su id, así que no hay
que configurar ningún id. Lo único configurable es el **nombre visible** del grupo, en
`providerLabels` dentro de `artifacts/routing.json`:

```json
"providerLabels": {
  "copilot": "GitHub Copilot",
  "<id-del-proveedor>": "Mi proveedor"
}
```

En una máquina nueva se puede sembrar sin editar el JSON:

```powershell
setx MODEL_ROUTER_PROVIDER_ID "<id-del-proveedor>"
setx MODEL_ROUTER_PROVIDER_LABEL "Nombre visible"
```

## Notas

- El catálogo es dinámico: si añades o quitas modelos en la app, el panel lo refleja
  al recargar. También puedes escribir a mano un id que no aparezca y se guardará igual.
- Fijar el modelo de los subagentes es lo que evita que `Auto` escale a premium: el
  umbral de `Auto` no es configurable, pero el trabajo delegado ya no pasa por él.
- Con `modelPolicy: "required"`, si el proveedor externo no está disponible el
  subagente falla en lugar de caer a un modelo premium. Cambia a `"preferred"` si
  prefieres degradar en vez de fallar.
- Las notas de benchmark son de terceros y **no** están alineadas con los precios del
  plan: sirven para ordenar modelos entre sí, no para predecir tu factura. En los
  modelos de Copilot, el precio que se muestra es el de API de referencia, no lo que
  te cobra la suscripción.
- `model-router/vendor/` lleva three.js 0.180.0 empaquetado para que la pestaña 3D
  funcione sin red. El build de módulos reexporta desde `three.core.min.js`, así que
  hacen falta los dos ficheros y se sirven desde el propio servidor local del panel.
- `model-router/data/models-enriched.json` es la instantánea que se commitea. No la
  añadas a `.gitignore`: es el respaldo que hace que el panel funcione recién instalado.
- El repositorio **no** contiene ningún id de proveedor, ningún nombre comercial ni tu
  login. El nombre visible de un proveedor externo se guarda solo en tu máquina
  (`artifacts/routing.json`); si no le pones uno, el panel lo llama
  *"Proveedor externo &lt;prefijo&gt;"* en lugar de mostrar el identificador crudo.

## Dónde aplica

| Capa | App de escritorio | Copilot CLI (terminal) |
| --- | --- | --- |
| Panel (canvas) | ✅ | ❌ no hay panel en una TUI |
| Workflow `plan-then-execute` | ✅ | ✅ |
| Hook `onSessionStart` (política) | ✅ | ✅ |
| `updateSubagentSettings` (fijación real) | ✅ | ✅ |

La app de escritorio **embebe** el mismo Copilot CLI, así que ambos leen `~/.copilot`.
`gh` (GitHub CLI) no interviene en la elección de modelos; `gh copilot` es solo un
wrapper que lanza el binario `copilot`.

El workflow `plan-then-execute` no necesita `modelPolicy`: fija `model` explícitamente
en cada llamada a `ctx.agent`, y `WorkflowAgentOptions` no admite `modelPolicy`.
