---
name: routing-model-forensics
description: Determine which model actually executed a Copilot subagent/agent and diagnose silent fallback when a configured model pin is ignored. Use when a user reports "I pinned model X but it ran on Y", "why is this using sonnet/gpt when I configured another model", or when verifying BYOK/Nan Builders routing took effect.
---

# Routing Model Forensics

Evidence-first procedure for answering: **which model actually ran, and why not the configured one.**
Repo side (where pins are persisted) lives in `svg153/copilot-model-router`; this skill covers the runtime evidence.

## Symptom taxonomy

| Signature in evidence | Meaning |
|---|---|
| `subagent.started` model id differs from configured pin, `src=configured_required` | **Unresolvable id → silent fallback** (the issue #3 class: bare id without provider prefix; since PR #20 bare ids are healed by `resolveModelId` on save/load — remaining causes are qualified-but-unknown ids kept as-is by design, stale pre-fix artifacts, or provider failure). |
| `src=task_argument` | Config never consulted — the caller passed `model` explicitly. Pin does not apply by design. |
| `src=explicit_override` | Explicit model argument won. Check who passed it (prompt/task call), not the config. |
| No `subagent.started` at all | Agent never ran (idle/failed launch) — routing is irrelevant. |
| started model == configured, but `session.usage_record` MODEL differs | Correlation error (see Race warning) or a different concurrent call consumed the record you grabbed. |

## Evidence locations

1. **`~/.copilot/session-state/<sessionId>/events.jsonl`** — the source of truth. Relevant events:
   - `subagent.started`: `agentId`, `src` (one of `configured_required` / `explicit_override` / `task_argument`), `model` (the id the runtime resolved FROM CONFIG — this is what your pin produced).
   - `subagent.completed`: window end for that agent.
   - `session.usage_record`: `MODEL` (what was billed/executed), `byok` (true = custom provider key used), `initiator` (`subagent` / `main`), `dur`, `ts`.
2. **`<COPILOT_HOME>/extensions/model-router/artifacts/routing.json`** (+ `.bak` backup) — persisted role/subagent pins: `roles.*.model`, `subagents.agents.*.model`, `subagents.agents.*.modelPolicy`, `fallback[]` arrays.
3. **`MODEL_ROUTER_PROVIDER_ID` env var** — provider prefix source (`routing.mjs` `EXTERNAL_PROVIDER_ID` / `ROUTED_MODEL_PREFIX`). Unset → defaults generate as **bare ids** (the issue #3 root cause; PR #20's normalizer now repairs them on write). On Windows it is set via `setx`; a GUI-launched process may not see a value set after launch — restart the app.
4. **Model-router panel diagnostics** — availability status table. Since PR #20 it covers roles AND subagent pins.

## Race warning (cost me a wrong diagnosis once)

`session.usage_record` rows from concurrent probes **interleave**, and `agentId` is often empty in usage records.
**Never** take the last usage record after firing parallel probes. Instead:

1. Fire **one** probe at a time (serial), capture a timestamp.
2. Find the probe's own `subagent.started` (unique string in its prompt/task identifies it).
3. Take usage records whose `ts` falls **between that agent's started and completed events**.
4. Cross-check the `started.src` — `task_argument` vs `configured_required` changes the verdict entirely.

Probe recipes:
- **Pin-path probe**: `task` call WITHOUT a `model` argument → exercises `configured_required`. Expect `started.model` == configured pin and usage `MODEL` == same id, `byok=true` for custom providers.
- **Explicit probe**: `task` call WITH `model:` → exercises `explicit_override`. Use to confirm the provider itself works (isolates config vs provider issues).

## Verdict matrix

| Configured id | started.model | usage MODEL / byok | Verdict |
|---|---|---|---|
| prefixed, catalog-known | same | same / byok=true | ✅ Working |
| **bare (no `/`)** | different model | different / byok=false | ❌ **Issue #3 class** (fixed by PR #20): `resolveModelId` should have healed it on save/load — if not, inspect the save path or a pre-20 artifact. |
| prefixed, unknown to catalog | fallback model | fallback | ❌ Kept as-is by design (never suffix-remap across providers) → add it to the catalog or fix the id. |
| prefixed | same | different | ❌ Correlation race — redo serially (or another agent consumed the record). |
| prefixed, provider down | fallback model | fallback | ⚠️ Provider/auth failure → check extension logs, not routing. |
| anything | `src=task_argument` | whatever caller passed | ℹ️ Config ignored by design — fix the caller. |

## Common root causes (ranked)

1. **Bare id missing provider prefix** (`qwen3.8-flash` instead of `<providerId>/qwen3.8-flash`). Classic: persisted verbatim, unresolvable at runtime, silent fallback. **Fixed by PR #20** (`copilot-model-router#3`) — still relevant when inspecting pre-fix artifacts or code paths that bypass `saveRouting`.
2. **Qualified-but-unknown id** — normalizer keeps it verbatim on purpose (different provider = different billing); it will not resolve and falls back. Fix the id or the catalog.
3. **Catalog loader failure** — `detectedCatalog()` returns `[]`, so first-run healing (`defaultRoutingFor`) and diagnostics are no-ops.
4. **`modelPolicy: "required"` is prose, not enforcement** — it changes wording/claims in `policyProse()` but an unresolvable id still falls back. Do not trust it as a guard.
5. **Key/alias mismatch** — `task()` `agent_type` (e.g. `general-purpose`) must match the routing key in `subagents.agents`; unmatched keys never apply.
6. **Stale env** — `MODEL_ROUTER_PROVIDER_ID` changed after process start; restart required.

## Golden rules

- Prove with `events.jsonl`, never with the model's self-report or UI claims.
- Serial probes only; correlate by time window.
- A pinned id is honored **only** if it is provider-qualified AND resolvable by the catalog (or healable by `resolveModelId`); qualified-unknown ids and `task_argument` callers bypass the pin by design.

Related repo-side skill: `model-router-persistence-debug`.
