# copilot-model-router

Extensión de canvas para la app de escritorio **GitHub Copilot**: decide qué modelo
de IA se usa para cada tipo de tarea, para que el trabajo masivo no acabe en modelos
premium por culpa de `Auto`.

## Qué incluye

| Pieza | Qué hace |
| --- | --- |
| Panel **Model Router** | Eliges el modelo y el esfuerzo para planificar / ejecutar / verificar, y fijas el modelo **y la obligatoriedad** de cada subagente. Se explica a sí mismo dentro del panel. |
| Catálogo de modelos | Se lee en vivo de la sesión, así que refleja tu plan y tus proveedores reales. |
| Workflow `plan-then-execute` | Un modelo caro planifica, modelos baratos ejecutan en paralelo, un tercer modelo verifica. |
| Ajustes de subagentes | Se aplican a la sesión viva vía `session.rpc.tools.updateSubagentSettings`. |
| Bloque de política | Al iniciar sesión se inyecta `<model-routing-policy>` para que el agente enrute a propósito. |

## Reparto por defecto

| Rol | Modelo | Esfuerzo |
| --- | --- | --- |
| Planificar | `claude-opus-5.5` | high |
| Ejecutar | `<proveedor>/deepseek-v4-flash` | low |
| Verificar | `<proveedor>/qwen3.6` | medium |

Los seis subagentes integrados (`explore`, `task`, `general-purpose`, `code-review`,
`research`, `security-review`) se fijan al modelo barato con `contextTier: inherit` y
`modelPolicy: "required"`.

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
