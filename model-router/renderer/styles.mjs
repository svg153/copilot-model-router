// Static CSS for the canvas (split from renderer.mjs, issue #13).
export const STYLES = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body {
    margin: 0;
    padding: 0 20px 48px;
    background:
        radial-gradient(900px 420px at 85% -10%,
            color-mix(in srgb, var(--color-focus-outline, #0969da) 9%, transparent), transparent 70%),
        var(--background-color-default, #ffffff);
    color: var(--text-color-default, #1f2328);
    font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
    font-size: var(--text-body-medium, 14px);
    line-height: var(--leading-body-medium, 20px);
}
header { padding: 22px 0 14px; }
.head-row { display: flex; align-items: flex-start; gap: 14px; }
.logo {
    flex: none; width: 44px; height: 44px; border-radius: 12px;
    display: grid; place-items: center; color: #ffffff;
    background: linear-gradient(135deg, var(--color-focus-outline, #0969da), color-mix(in srgb, var(--color-focus-outline, #0969da) 55%, #8839ef));
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-focus-outline, #0969da) 35%, transparent);
}
.logo svg { display: block; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
h1 {
    margin: 0 0 4px;
    font-size: var(--text-title-large, 26px);
    font-weight: var(--font-weight-semibold, 600);
    line-height: var(--leading-title-large, 32px);
    letter-spacing: -0.015em;
}
h2 { margin: 0 0 4px; font-size: 16px; font-weight: var(--font-weight-semibold, 600); }
h3 { margin: 0 0 2px; font-size: 13px; font-weight: var(--font-weight-semibold, 600); }
p { margin: 0 0 10px; }
a { color: var(--color-focus-outline, #0969da); }
code, .mono {
    font-family: var(--font-mono, "SFMono-Regular", Consolas, "Liberation Mono", monospace);
    font-size: 12px;
}
.sub { color: var(--text-color-muted, #59636e); margin: 0; }
.muted { color: var(--text-color-muted, #59636e); }
.small { font-size: 12px; }
.tiny { font-size: 11px; }
.warn-line { color: var(--true-color-yellow, #9a6700); }
.section { margin: 0 0 26px; }
.section > .sub { margin-bottom: 12px; }

.bar-top {
    position: sticky; top: 0; z-index: 5;
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
    padding: 10px 0; margin-bottom: 4px;
    background: color-mix(in srgb, var(--background-color-default, #ffffff) 82%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border-color-default, #d1d9e0);
}
.status {
    display: inline-flex; align-items: center; gap: 6px;
    color: var(--text-color-muted, #59636e); font-size: 12px;
    padding: 3px 10px; border-radius: 999px;
    background: var(--background-color-muted, #f6f8fa);
    border: 1px solid var(--border-color-default, #d1d9e0);
}
.status:empty { display: none; }
.status[data-tone="ok"] {
    color: var(--true-color-green, #1a7f37);
    background: color-mix(in srgb, var(--true-color-green, #1a7f37) 10%, transparent);
    border-color: color-mix(in srgb, var(--true-color-green, #1a7f37) 35%, transparent);
}
.status[data-tone="warn"] {
    color: var(--true-color-yellow, #9a6700);
    background: color-mix(in srgb, var(--true-color-yellow, #9a6700) 10%, transparent);
    border-color: color-mix(in srgb, var(--true-color-yellow, #9a6700) 35%, transparent);
}
.status[data-tone="err"] {
    color: var(--true-color-red, #cf222e);
    background: color-mix(in srgb, var(--true-color-red, #cf222e) 10%, transparent);
    border-color: color-mix(in srgb, var(--true-color-red, #cf222e) 35%, transparent);
}

button, select, input {
    font: inherit;
    color: inherit;
    background: var(--background-color-default, #ffffff);
    border: 1px solid var(--border-color-default, #d1d9e0);
    border-radius: 8px;
    padding: 5px 11px;
    transition: background-color .15s ease, border-color .15s ease, box-shadow .15s ease, transform .06s ease;
}
button { cursor: pointer; }
button:hover { background: var(--background-color-muted, #f6f8fa); border-color: color-mix(in srgb, var(--text-color-muted, #59636e) 40%, transparent); }
button:active { transform: translateY(1px); }
button.primary {
    background: linear-gradient(180deg, color-mix(in srgb, var(--color-focus-outline, #0969da) 88%, #ffffff), var(--color-focus-outline, #0969da));
    border-color: var(--color-focus-outline, #0969da);
    color: var(--color-white, #ffffff);
    box-shadow: 0 1px 3px color-mix(in srgb, var(--color-focus-outline, #0969da) 40%, transparent);
}
button.primary:hover { filter: brightness(1.08); }
button.danger { color: var(--true-color-red, #cf222e); border-color: color-mix(in srgb, var(--true-color-red, #cf222e) 45%, transparent); }
button.danger:hover { background: color-mix(in srgb, var(--true-color-red, #cf222e) 8%, transparent); }
button.mini { padding: 2px 8px; font-size: 11px; border-radius: 7px; }
select { max-width: 100%; }
select:hover, input:hover { border-color: color-mix(in srgb, var(--text-color-muted, #59636e) 40%, transparent); }

.tabs {
    display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 20px;
    padding: 4px; border-radius: 12px;
    background: color-mix(in srgb, var(--text-color-muted, #59636e) 8%, transparent);
    border: 1px solid var(--border-color-default, #d1d9e0);
}
.tabs button {
    border: 0; border-radius: 9px;
    background: transparent; padding: 7px 13px;
    color: var(--text-color-muted, #59636e);
}
.tabs button:hover {
    background: color-mix(in srgb, var(--text-color-muted, #59636e) 10%, transparent);
    color: var(--text-color-default, #1f2328);
}
.tabs button[aria-selected="true"] {
    color: var(--color-focus-outline, #0969da);
    background: var(--background-color-default, #ffffff);
    box-shadow: 0 1px 4px rgba(0, 0, 0, .12);
    font-weight: var(--font-weight-semibold, 600);
}
.panel { display: none; }
.panel[data-active="true"] { display: block; animation: panelIn .22s ease; }
@keyframes panelIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: none; }
}

table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--border-color-default, #d1d9e0); }
th {
    position: sticky; top: 0; z-index: 1;
    background: var(--background-color-muted, #f6f8fa);
    font-size: 11px; text-transform: uppercase; letter-spacing: .04em;
    color: var(--text-color-muted, #59636e); font-weight: var(--font-weight-semibold, 600);
}
th.sortable { cursor: pointer; user-select: none; }
th.sortable:hover { color: var(--text-color-default, #1f2328); }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
.tablewrap {
    max-height: 440px; overflow: auto;
    border: 1px solid var(--border-color-default, #d1d9e0); border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, .05);
}
tbody tr { transition: background-color .12s ease; }
tbody tr:nth-child(even) td { background: color-mix(in srgb, var(--text-color-muted, #59636e) 4%, transparent); }
tbody tr:hover td { background: color-mix(in srgb, var(--color-focus-outline, #0969da) 7%, transparent); }
tr.mine td { background: color-mix(in srgb, var(--color-focus-outline, #0969da) 9%, transparent) !important; }

.chip {
    display: inline-block; padding: 1px 8px; border-radius: 999px;
    font-size: 10px; line-height: 16px; text-transform: uppercase; letter-spacing: .05em;
    font-weight: var(--font-weight-semibold, 600);
    border: 1px solid var(--border-color-default, #d1d9e0);
    background: var(--background-color-muted, #f6f8fa);
    color: var(--text-color-muted, #59636e);
}
.chip[data-tier="low"] {
    border-color: color-mix(in srgb, var(--true-color-green, #1a7f37) 40%, transparent);
    color: var(--true-color-green, #1a7f37);
    background: color-mix(in srgb, var(--true-color-green, #1a7f37) 10%, transparent);
}
.chip[data-tier="medium"] {
    border-color: color-mix(in srgb, var(--true-color-yellow, #9a6700) 40%, transparent);
    color: var(--true-color-yellow, #9a6700);
    background: color-mix(in srgb, var(--true-color-yellow, #9a6700) 10%, transparent);
}
.chip[data-tier="high"], .chip[data-tier="very_high"] {
    border-color: color-mix(in srgb, var(--true-color-red, #cf222e) 40%, transparent);
    color: var(--true-color-red, #cf222e);
    background: color-mix(in srgb, var(--true-color-red, #cf222e) 10%, transparent);
}
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; vertical-align: middle; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .15); }

/* Selector de fallback: botón "+" y modal de catálogo */
.fb-add {
    font-size: 12px; padding: 4px 12px; border-radius: 6px; cursor: pointer;
    border: 1px dashed var(--border-color-default, #d1d9e0); background: none;
    color: var(--text-color-muted, #59636e);
}
.fb-add:hover { border-style: solid; color: var(--text-color-default, #1f2328); }
.fb-backdrop {
    position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
    background: rgba(0, 0, 0, .35);
}
.fb-modal {
    width: min(480px, 92vw); max-height: 70vh; overflow-y: auto;
    border: 1px solid var(--border-color-default, #d1d9e0); border-radius: 10px;
    background: var(--background-color-raised, #ffffff);
    box-shadow: 0 12px 40px rgba(0, 0, 0, .25); padding: 0 0 8px;
}
.fb-modal-head {
    position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; align-items: center;
    padding: 10px 14px; background: var(--background-color-raised, #ffffff);
    border-bottom: 1px solid var(--border-color-muted, #e7ebf0);
}
.fb-modal-title { font-size: 13px; }
.fb-modal-close {
    border: 0; background: none; font-size: 13px; cursor: pointer;
    min-width: 26px; min-height: 26px; border-radius: 6px;
    color: var(--text-color-muted, #59636e);
}
.fb-modal-close:hover { background: color-mix(in srgb, var(--true-color-red, #cf222e) 12%, transparent); color: var(--true-color-red, #cf222e); }
.fb-group {
    position: sticky; top: 81px; z-index: 1;
    padding: 8px 14px 5px; font-size: 11px; text-transform: uppercase; letter-spacing: .4px;
    color: var(--text-color-muted, #59636e); background: var(--background-color-raised, #ffffff);
}
.fb-opt {
    display: grid; grid-template-columns: minmax(0, 1fr) auto 22px; gap: 8px; align-items: center;
    width: 100%; text-align: left; border: 0; background: none; cursor: pointer;
    padding: 7px 14px; min-height: 34px; font-size: 13px; color: var(--text-color-default, #1f2328);
}
.fb-opt:hover { background: color-mix(in srgb, var(--color-focus-outline, #0969da) 10%, transparent); }
.fb-opt.fb-on { background: color-mix(in srgb, var(--true-color-green, #1a7f37) 9%, transparent); }
.fb-opt.fb-on:hover { background: color-mix(in srgb, var(--true-color-green, #1a7f37) 16%, transparent); }
.fb-opt-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fb-opt-meta { color: var(--text-color-muted, #59636e); font-size: 11px; white-space: nowrap; }
.fb-mark { color: var(--true-color-green, #1a7f37); font-weight: 700; text-align: center; min-height: 1em; }
.fb-empty { padding: 16px 14px; font-size: 12px; color: var(--text-color-muted, #59636e); }

/* Buscador del selector de modelos: barra fija bajo la cabecera del modal */
.fb-search {
    position: sticky; top: 37px; z-index: 2; display: flex; gap: 8px; align-items: center;
    padding: 8px 14px; background: var(--background-color-raised, #ffffff);
    border-bottom: 1px solid var(--border-color-muted, #e7ebf0);
}
.fb-search input {
    flex: 1; min-width: 0; font-size: 13px; padding: 6px 10px; border-radius: 6px;
    border: 1px solid var(--border-color-default, #d1d9e0);
    background: var(--background-color-default, #ffffff); color: var(--text-color-default, #1f2328);
}
.fb-count { font-size: 11px; color: var(--text-color-muted, #59636e); white-space: nowrap; }
.fb-hide { display: none; }
.fb-opt-main { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.fb-opt-id {
    font-size: 10px; color: var(--text-color-muted, #59636e);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
/* Pie del modal en modo único: acción discretas (quitar fijado) */
.fb-foot {
    position: sticky; bottom: 0; display: flex; justify-content: flex-start; gap: 8px;
    padding: 10px 14px; background: var(--background-color-raised, #ffffff);
    border-top: 1px solid var(--border-color-muted, #e7ebf0);
}

/* Disparador compacto del selector de modelo (sustituye al <select> gigante) */
.mpk {
    display: flex; align-items: center; gap: 6px; max-width: 320px; min-width: 0;
    padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 13px;
    border: 1px solid var(--border-color-default, #d1d9e0);
    background: var(--background-color-default, #ffffff); color: var(--text-color-default, #1f2328);
}
.mpk:hover { border-color: var(--color-focus-outline, #0969da); }
.mpk-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mpk-caret { font-size: 10px; color: var(--text-color-muted, #59636e); flex: none; }
.mpk-empty .mpk-label { font-style: italic; color: var(--text-color-muted, #59636e); }
.mf-more { font-style: italic; }

/* Cadena de fallback */
.fb-chain { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.fb-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 6px 2px 4px; border-radius: 999px; font-size: 11px;
    border: 1px solid var(--border-color-default, #d1d9e0);
    background: var(--background-color-muted, #f6f8fa);
}
.fb-chip .fb-pos {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 50%; font-size: 10px;
    background: var(--color-focus-outline, #0969da); color: #fff;
}
.fb-chip .fb-name { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fb-btn {
    border: 0; background: none; cursor: pointer; font-size: 11px; line-height: 1;
    min-width: 18px; min-height: 18px; border-radius: 4px; opacity: .75; color: inherit;
}
.fb-btn:hover { opacity: 1; background: color-mix(in srgb, var(--color-focus-outline, #0969da) 12%, transparent); }
.fb-x:hover { background: color-mix(in srgb, var(--true-color-red, #cf222e) 12%, transparent); color: var(--true-color-red, #cf222e); }

/* Momento de entrada único: el modal se posa; el fondo solo aparece */
@media (prefers-reduced-motion: no-preference) {
    .fb-backdrop { animation: fb-fade 120ms ease-out; }
    .fb-modal { animation: fb-in 160ms cubic-bezier(.16, 1, .3, 1); }
    @keyframes fb-fade { from { opacity: 0; } }
    @keyframes fb-in { from { opacity: 0; transform: translateY(8px) scale(.98); } }
}

/* Modal de revisión de cambios (guardar protegido, P1-1) */
.fb-modal.rev-modal { width: min(640px, 94vw); }
.rev-warn {
    margin: 10px 14px 4px; padding: 8px 10px; font-size: 12px; border-radius: 8px;
    background: color-mix(in srgb, var(--true-color-amber, #9a6700) 10%, transparent);
    color: var(--text-color-default, #1f2328);
}
.rev-row {
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 10px;
    align-items: baseline; padding: 5px 14px; font-size: 12px; min-height: 26px;
}
.rev-row:nth-child(odd) { background: var(--background-color-muted, #f6f8fa); }
.rev-label { color: var(--text-color-muted, #59636e); overflow-wrap: anywhere; }
.rev-values { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; min-width: 0; }
.rev-before { color: var(--text-color-muted, #59636e); text-decoration: line-through; overflow-wrap: anywhere; }
.rev-arrow { color: var(--text-color-muted, #59636e); }
.rev-after { font-weight: 600; color: var(--true-color-green, #1a7f37); overflow-wrap: anywhere; }
.rev-summary { margin: 10px 14px 0; font-size: 12px; color: var(--text-color-muted, #59636e); }
.rev-actions {
    position: sticky; bottom: 0; display: flex; justify-content: flex-end; gap: 8px;
    margin-top: 12px; padding: 10px 14px 4px;
    background: var(--background-color-raised, #ffffff);
    border-top: 1px solid var(--border-color-muted, #e7ebf0);
}

.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 12px; }
.card {
    border: 1px solid var(--border-color-default, #d1d9e0); border-radius: 12px; padding: 14px;
    background: var(--background-color-default, #ffffff);
    box-shadow: 0 1px 3px rgba(0, 0, 0, .06);
    transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
}
.card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, .1);
    border-color: color-mix(in srgb, var(--color-focus-outline, #0969da) 45%, var(--border-color-default, #d1d9e0));
}
.card.mine {
    border-color: var(--color-focus-outline, #0969da);
    background: color-mix(in srgb, var(--color-focus-outline, #0969da) 4%, var(--background-color-default, #ffffff));
}
.card .what { color: var(--text-color-muted, #59636e); font-size: 12px; margin: 0 0 10px; }
.pick { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.pick .who { font-weight: var(--font-weight-semibold, 600); }
.pick .score {
    font-variant-numeric: tabular-nums; font-size: 11px; font-weight: var(--font-weight-semibold, 600);
    padding: 2px 9px; border-radius: 999px; white-space: nowrap;
    background: var(--background-color-muted, #f6f8fa);
    border: 1px solid var(--border-color-default, #d1d9e0);
    color: var(--text-color-muted, #59636e);
}
.pick .score.tone-good {
    color: var(--true-color-green, #1a7f37);
    background: color-mix(in srgb, var(--true-color-green, #1a7f37) 10%, transparent);
    border-color: color-mix(in srgb, var(--true-color-green, #1a7f37) 35%, transparent);
}
.pick .score.tone-mid {
    color: var(--true-color-yellow, #9a6700);
    background: color-mix(in srgb, var(--true-color-yellow, #9a6700) 10%, transparent);
    border-color: color-mix(in srgb, var(--true-color-yellow, #9a6700) 35%, transparent);
}
.pick .score.tone-bad {
    color: var(--true-color-red, #cf222e);
    background: color-mix(in srgb, var(--true-color-red, #cf222e) 10%, transparent);
    border-color: color-mix(in srgb, var(--true-color-red, #cf222e) 35%, transparent);
}

.bar { display: block; height: 8px; border-radius: 999px; background: color-mix(in srgb, var(--text-color-muted, #59636e) 15%, transparent); overflow: hidden; }
.bar > i {
    display: block; height: 100%; border-radius: inherit;
    background: linear-gradient(90deg, color-mix(in srgb, var(--color-focus-outline, #0969da) 65%, transparent), var(--color-focus-outline, #0969da));
    transition: width .45s cubic-bezier(.22, 1, .36, 1);
}
.meter { display: grid; grid-template-columns: 132px 1fr 54px; gap: 8px; align-items: center; font-size: 12px; margin-bottom: 6px; }
.meter .val { text-align: right; font-variant-numeric: tabular-nums; color: var(--text-color-muted, #59636e); font-weight: var(--font-weight-semibold, 600); }

dl.defs { margin: 0; }
dl.defs dt { font-weight: var(--font-weight-semibold, 600); margin-top: 12px; }
dl.defs dt::before { content: "▸"; color: var(--color-focus-outline, #0969da); margin-right: 6px; font-size: 11px; }
dl.defs dd { margin: 2px 0 0 14px; color: var(--text-color-muted, #59636e); }

.scene {
    position: relative; width: 100%; height: 440px;
    border: 1px solid var(--border-color-default, #d1d9e0); border-radius: 12px; overflow: hidden;
    background: radial-gradient(600px 300px at 50% 0%, color-mix(in srgb, var(--color-focus-outline, #0969da) 5%, transparent), transparent 70%);
    box-shadow: inset 0 1px 4px rgba(0, 0, 0, .06);
}
.scene canvas { display: block; }
.tip {
    position: absolute; display: none; pointer-events: none; z-index: 3;
    max-width: 260px; padding: 7px 10px; border-radius: 8px; font-size: 11px;
    background: var(--background-color-default, #ffffff);
    border: 1px solid var(--border-color-default, #d1d9e0);
    box-shadow: 0 6px 18px rgba(0, 0, 0, .18);
}
.legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 11px; color: var(--text-color-muted, #59636e); margin-top: 8px; }
.note {
    border-left: 3px solid color-mix(in srgb, var(--color-focus-outline, #0969da) 45%, transparent);
    border-top: 1px solid var(--border-color-default, #d1d9e0);
    border-right: 1px solid var(--border-color-default, #d1d9e0);
    border-bottom: 1px solid var(--border-color-default, #d1d9e0);
    padding: 6px 0 6px 12px; margin: 10px 0;
    color: var(--text-color-muted, #59636e); font-size: 12px;
    background: color-mix(in srgb, var(--color-focus-outline, #0969da) 4%, transparent);
    border-radius: 0 8px 8px 0;
}
.scrollx { overflow-x: auto; }
.empty-row td {
    padding: 22px 10px; color: var(--text-color-muted, #59636e);
    font-style: italic; text-align: center;
}
.est {
    color: var(--true-color-yellow, #9a6700);
    font-weight: var(--font-weight-semibold, 600); cursor: help;
}

.filters {
    display: grid; gap: 10px; margin-bottom: 18px; padding: 14px;
    border: 1px solid var(--border-color-default, #d1d9e0); border-radius: 12px;
    background: color-mix(in srgb, var(--text-color-muted, #59636e) 5%, transparent);
}
.filters-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.filters-label {
    min-width: 78px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em;
    color: var(--text-color-muted, #59636e); font-weight: var(--font-weight-semibold, 600);
}
.toggle {
    padding: 3px 11px; border-radius: 999px; font-size: 11px; line-height: 18px; cursor: pointer;
    border: 1px solid var(--border-color-default, #d1d9e0);
    background: var(--background-color-default, #ffffff); color: var(--text-color-default, #1f2328);
    transition: background-color .15s ease, border-color .15s ease, color .15s ease;
}
.toggle:hover { border-color: var(--color-focus-outline, #0969da); }
.toggle[aria-pressed="true"] {
    background: var(--color-focus-outline, #0969da);
    border-color: var(--color-focus-outline, #0969da); color: #ffffff;
    box-shadow: 0 1px 4px color-mix(in srgb, var(--color-focus-outline, #0969da) 40%, transparent);
}
.toggle[aria-pressed="false"] { opacity: .5; }
.toggle .swatch {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    margin-right: 5px; vertical-align: middle; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .18);
}
.banner {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 12px;
    padding: 8px 12px; border-left: 3px solid var(--color-focus-outline, #0969da);
    border-top: 1px solid var(--border-color-default, #d1d9e0);
    border-right: 1px solid var(--border-color-default, #d1d9e0);
    border-bottom: 1px solid var(--border-color-default, #d1d9e0);
    border-radius: 0 10px 10px 0; font-size: 12px;
    background: color-mix(in srgb, var(--color-focus-outline, #0969da) 7%, transparent);
}
.axis-key { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 8px; font-size: 11px; color: var(--text-color-muted, #59636e); }
.axis-key b { font-weight: var(--font-weight-semibold, 600); color: var(--text-color-default, #1f2328); }
.axis-key .swatch {
    display: inline-block; width: 9px; height: 9px; border-radius: 2px;
    margin-right: 5px; vertical-align: middle;
}
h2 { display: flex; align-items: center; gap: 8px; }
h2::before {
    content: ""; flex: none; width: 3px; height: 14px; border-radius: 2px;
    background: linear-gradient(180deg, var(--color-focus-outline, #0969da), color-mix(in srgb, var(--color-focus-outline, #0969da) 40%, transparent));
}
.tabs button svg {
    width: 14px; height: 14px; margin-right: 6px; vertical-align: -2px;
    fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; opacity: .8;
}
:focus-visible { outline: 2px solid var(--color-focus-outline, #0969da); outline-offset: 2px; }
::selection { background: color-mix(in srgb, var(--color-focus-outline, #0969da) 25%, transparent); }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--text-color-muted, #59636e) 35%, transparent);
    border-radius: 999px; border: 2px solid transparent; background-clip: content-box;
}
::-webkit-scrollbar-thumb:hover { background-color: color-mix(in srgb, var(--text-color-muted, #59636e) 55%, transparent); }
@media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
}
`;
