---
name: model-router-persistence-debug
description: Debug and extend svg153/copilot-model-router model-id persistence, validation, and diagnostics. Use when routing.json stores bad model ids, pins don't survive save/load, validation rules need adding, or when investigating issues like bare-id fallback (issue #3) and dead fallback chains (issue #4).
---

# Model Router Persistence Debugging

Repo-side map of `svg153/copilot-model-router`: where model ids enter, persist, and leave — and how to add validation safely.
Baseline: main after the PR #16–#22 fix series. Cite function names first; line numbers drift.

## Architecture (what touches routing.json)

````
defaults (DEFAULT_ROUTING / defaultRoutingFor)   env: MODEL_ROUTER_PROVIDER_ID → ROUTED_MODEL_PREFIX
        │  heals bare→prefixed ONLY on first run, ONLY with a live catalog
        ▼
loadRouting()  ── merges persisted file OVER defaults, then normalizes ids IN MEMORY (disk untouched)
        ▼
mergeRouting(current, patch)  ── replaces roles/subagents entries, keeps unknown fields
        ▼
saveRouting(patch)  ── merge → resolveModelId normalization (PR #20) → JSON.stringify → .bak backup → atomic tmp+rename
        ▼
consumers: toSubagentSettings() (wire to runtime, verbatim), policyProse() (UI prose),
           catalogDiagnostics() (availability table: roles + subagents), renderer.mjs (panel UI)
````

Key files (repo root):
- `model-router/routing.mjs` — persistence + diagnostics + `resolveModelId` normalization (~600 lines).
- `model-router/renderer.mjs` — panel UI (~2900 lines): `modelSelect` (unknown ids saveable with a "(no está en el catálogo)" marker), `renderCatalogDiagnostics` (availability table incl. subagent pins), `renderRoles`/`renderSubagents` (fallback chain +/✕ UI from PR #2 — do not break).
- `model-router/extension.mjs` — catalog loader registration (`setDefaultCatalogLoader`), HTTP/canvas save entry points that call `saveRouting(ctx.input)`.
- `model-router/server.mjs` — HTTP layer extracted from `extension.mjs` (PR #19), with instance token + Host guards (PR #21).
- `model-router/test/routing.test.mjs`, `workflow.test.mjs`, `extension.test.mjs`, `build-data.test.mjs` — conventions to copy.

## Known defect classes (forensic history — both resolved)

### #3 — Persisted ids never validated (bare ids silently fell back) — FIXED by PR #20
Original chain: unset `MODEL_ROUTER_PROVIDER_ID` → `ROUTED_MODEL_PREFIX=""` → defaults carry bare ids → `saveRouting` wrote any string verbatim → `loadRouting` replayed it → `toSubagentSettings` forwarded it → runtime could not resolve → **silent fallback** despite `modelPolicy: "required"`. Diagnostics only checked the 4 roles; `modelSelect` marked unknown ids but still saved them.

**Shipped fix shape** (`resolveModelId(id, models)` in `routing.mjs`):
1. exact match → id;
2. id containing `/` (qualified but unknown) → NEVER suffix-remap across providers (different provider = different billing) → kept as-is;
3. bare id → unique `endsWith("/" + id)` match → canonical id; 0 or >1 matches → kept as-is (never guess);
4. empty catalog → strict no-op.

Applied in `saveRouting` (normalize before write), `loadRouting` (in-memory only — disk untouched), `resetRouting`; covers `roles.*.model`, `subagents.agents.*.model`, and all `fallback[]` arrays. `catalogDiagnostics` + renderer table now include subagent rows.

### #4 — Fallback chains are dead config — CLOSED via PR #18
PR #2 persists/renders `fallback: [modelId]` arrays but no runtime consumer reads them (`toSubagentSettings`, `workflow` ignore `entry.fallback`). PR #18 made them effective as **policy prose** (the renderer consumes them as display/permission text) and README documents that no runtime retry loop exists. Reopen only if a runtime retry fallback is wanted as a feature.

## Reproducing the bare-id bug (pre-fix shape)

```powershell
# 1. Ensure prefix env is unset in the launching process
$env:MODEL_ROUTER_PROVIDER_ID = $null
# 2. Write a bare id through the real save path (or edit artifacts/routing.json directly)
# 3. loadRouting + inspect (expect the NORMALIZED id since PR #20):
node --input-type=module -e "const r = await import('./model-router/routing.mjs'); console.log(JSON.stringify((await r.loadRouting()).subagents.agents['general-purpose'], null, 2));"
```
Artifact path: `<COPILOT_HOME>/extensions/model-router/artifacts/routing.json` (+ `.bak`).

## Test conventions (MUST follow)

- Command (matches CI): `node --test model-router/test/*.test.mjs` from repo root; CI runs it on Node 20 and 22 (`.github/workflows/test.yml`).
- New test files: `model-router/test/<topic>.test.mjs`. In a NEW file: `mkdtemp` → `process.env.COPILOT_HOME = tmp` → `mkdir(tmp/extensions/model-router/artifacts)` → **dynamic `await import("../routing.mjs")` AFTER env is set** (module reads env at import time; each test file is a separate process).
- Do NOT set `MODEL_ROUTER_PROVIDER_ID` in tests unless testing prefix behavior.
- Inject catalogs with exported `setDefaultCatalogLoader(fn)`; reset with `setDefaultCatalogLoader(null)`.
- Baseline must stay green: existing tests assert normalization behavior (healed/unchanged/ambiguous/no-op), defaults keeping requested ids when unavailable, `catalogDiagnostics` shape (`available` true/false/null by source), `policyProse` wording, and HTTP token guards.

## Adding a new validation rule (checklist)

1. Decide the **write point**: normalization belongs in `saveRouting` (persisted) and `loadRouting` (in-memory heal of old files) — never rewrite disk during load.
2. Implement pure function + export (e.g. `resolveModelId` / `normalizeRoutingModels`) so it is unit-testable.
3. Cover every id location: roles model, role fallback[], subagent model, subagent fallback[].
4. Extend `catalogDiagnostics` for any field users can get wrong; mirror its `available` true/false/null semantics.
5. Surface in `renderer.mjs` `renderCatalogDiagnostics` table (surgical edit; leave the fallback-UI regions alone).
6. Add tests in a new file (conventions above): healed, unchanged, ambiguous, empty-catalog no-op, disk-untouched-on-load.
7. Docs: README behavior section only if user-visible; keep it out of code-comment duplication.

## Operational notes

- Line numbers quoted in old issues refer to `588c730`; re-verify after any merge.
- Repo protection: PRs into `main`, mandatory Copilot review, owner merge for `review-recovery: owner-merge-required` PRs.
- Never commit `.software-factory/` (session runner state, untracked by design).
- Data/vendor integrity: `scripts/build-data.mjs --verify` checks `model-router/data/manifest.json` hashes (CRLF trap: hashes are of committed LF bytes — regenerate from the repo, never a stale Windows checkout).
- Related runtime half: `routing-model-forensics` skill (events.jsonl evidence, race-free probes).
