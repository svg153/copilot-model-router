# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primario** _(inferido del historial de sesiones y del repo)_ : svg153, usuario intensivo de la app de escritorio GitHub Copilot con proveedores BYOK (NaN Builders y afines). Situación: lanza tareas masivas con subagentes y workflows multi-etapa; el enrutado `Auto` desvía trabajo barato a modelos premium. Trabajo: decidir a propósito qué modelo (y qué esfuerzo de razonamiento) ejecuta cada tipo de tarea, y que la decisión sobreviva reinicios.
- **Secundario** _(inferido: licencia MIT, `install.ps1` reutilizable)_ : otros usuarios de la app de Copilot que instalen la extensión. La interfaz debe ser comprensible sin contexto interno del repo, pero el producto no se ha declarado como público.

## Product Purpose

Model Router es una extensión canvas para la app de GitHub Copilot que da control explícito del modelo por tipo de tarea: orquestación, plan, ejecución, verificación y cada subagente fijable (con esfuerzo de razonamiento y política de enforcement por fila). Éxito = que el gasto real de la sesión siga la intención del usuario (los registros `session_usage` mostraron ~$885 en una sesión mal enrutada: eso es el dolor fundacional) y que cada decisión de enrutado sea auditable y persistente.

## Positioning

Mecanismo que un producto vecino no puede copiar honestamente: lee el **catálogo en vivo de la sesión** (refleja el plan y los proveedores reales del usuario, con clave compuesta proveedor-prefijo + modelo), lo combina con **benchmarks públicos trazables** (medido vs. estimado se distingue siempre, con fuente y nota), y **aplica el resultado a la sesión viva** vía `session.rpc` + inyección de `<model-routing-policy>`, persistido en `routing.json`. No es un catálogo de modelos ni un dashboard de costes: es el punto de decisión entre ambos, conectado a la sesión real.

## Operating Context

- App de escritorio GitHub Copilot (Windows como entorno de desarrollo; la extensión corre en Node ≥ 20 como proceso del canvas).
- Configuración duradera en `~/.copilot/extensions/model-router/routing.json` (se conserva al reinstalar).
- Instantánea `model-router/data/models-enriched.json` regenerada semanalmente por un GitHub Action a partir de fuentes pinnadas por SHA (models.dev, showdown, jeinlee1991).
- Instalación desde worktree/checkout con `install.ps1 -Force`, recarga de extensiones en la app.
- Pestañas: Routing (roles + subagentes + enforcement), Comparativa (ranking, calidad/precio, recomendaciones con fijado modelo+esfuerzo), 3D (mapa calidad/precio/velocidad, carga diferida).
- Workflow `plan-then-execute` con defaults por etapa documentados en README.

## Capabilities and Constraints

- **Cero dependencias** (ESM puro; único script `node --test model-router/test/`). Golden test del HTML del renderer; tests se saltan en árbol instalado (centinela `SCRIPT`).
- **Idioma prioritario: español** _(inferido de toda la UI y docs; hay cadena histórica mixta ES/EN fuera de scope)_.
- Los ids de modelo **deben llevar prefijo de proveedor** para resolver de forma determinista; la UI nunca guarda un id que no pueda re-cargarse.
- Enforcement por fila: `required` (exige el fijado) / `preferred` / *inherit* (borra la clave, sin escribir valores vacíos). Nunca se sustituye en silencio el modelo elegido.
- Los benchmarks **no desglosan por esfuerzo**: el esfuerzo se fija y aplica, pero la nota pública es por modelo. Las estimaciones (prefijo o cross-generación) se marcan con `~` y nota de origen; claves genéricas cortas ("gpt", "qwen") no se emparejan.
- Un guardado del canvas pisa el `routing.json` completo: la UI debe leer el estado actual antes de guardar (lección de #47).
- Datos ausentes que no deben inventarse: MAI-Code 1.1 Flash no está en ninguna fuente pública; hay gaps reales de cobertura por generación.

## Brand Commitments

- Nombre: **Model Router** (repo `svg153/copilot-model-router`); MIT © 2026 svg153.
- Voz: directa, técnica, en español; explica el "por qué" cuando el dato no existe en vez de mostrar huecos vacíos.
- Sin testimonios, clientes ni afirmaciones de precios o despliegue que no existan _(absencia intencionada)_.

## Evidence on Hand

- `model-router/data/models-enriched.json` + `manifest.json`: 343 modelos, 70 con notas medidas, `generatedAt` 2026-11-12; fuentes con SHA pinnado reproducibles.
- README.md: defaults del workflow, columna Enforcement, formato del snapshot; suite de tests real (`node --test`) en verde; CI (test 20/22).
- Historial de PRs/issues del repo (#15–#53) como registro de decisiones de producto.
- **No existe**: página de marketing, capturas oficiales, benchmarks propios, métricas de usuarios externos.

## Product Principles

1. **Honestidad de procedencia**: todo número muestra si es medido, estimado (y de qué) o ausente (y por qué).
2. **La intención del usuario manda**: lo fijado se aplica; si no puede aplicarse, se dice, nunca se sustituye en silencio.
3. **Estado real, no copia antigua**: el catálogo y la configuración se leen de la sesión y de `routing.json` antes de mostrar o guardar.
4. **Auditable y mínimo**: cero dependencias, configuración en un JSON legible, diffs pequeños.
5. **El coste es la métrica**: cada pantalla debe ayudar a mover trabajo masivo a modelos flash sin perder calidad donde importa.

## Accessibility & Inclusion

- El modal de fallback cumple patrones nativos: `role="dialog"`, foco gestionado, toggle accesible y respeto de `prefers-reduced-motion` (#52).
- UI pensada para lectura densa de tablas: contraste y etiquetas de eje en la vista 3D como requisito ya visible en el incumbent.
- Sin estándar formal declarado; el listón práctico es no degradar lo anterior en cada iteración de UI.
