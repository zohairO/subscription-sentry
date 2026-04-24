# Subscription Sentry — CLAUDE.md

Chrome MV3 extension that tracks recurring subscriptions and shows a reminder overlay on checkout pages. Local-first, zero network egress. Personal project with a path open to Chrome Web Store publication.

## Before writing any code

1. Read `.claude/rules/architecture.md` once per session — it owns the big-picture decisions (data model, permissions, library extraction rules, v1 done criteria, known tensions). Don't duplicate it here; lean on it.
2. Check `src/types.ts` to see whether the Design A `sources[]` migration has landed yet. Storage and UI work depends on it.

## Run it

```bash
npm install       # first time
npm run dev       # dev bundle + HMR, writes to dist/
```

Then in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## Verify

```bash
npm run typecheck   # before every commit
npm run build       # production bundle
```

No test runner is wired up yet. When tests get added, matchers and the mbox parser are the obvious first targets.

## Non-negotiable rules

- **No network calls against user data.** No telemetry, analytics, error reporting, remote logging. Ever.
- **No `host_permissions` in `manifest.json`.** If a feature seems to need one, stop and reread architecture.md.
- **No `chrome.*` or DOM imports in `src/lib/`** — `storage.ts` is the one allowed exception.
- **Amount is cents (integer).** Never float. If a float touches storage, it's a bug.
- **Types use `service` and `cadence`** — not `serviceName` or `billingCycle`. `types.ts` is source of truth for naming.
- **No runtime dependencies** without asking. Stdlib only.
- **No framework** in v1. Vanilla TS + DOM.

## Commit style

- Commit frequently — every logical chunk, not batched at the end.
- Prefix in the style of the existing log (`chore:`, `feat:`, `fix:`, `docs:`).
- Use a HEREDOC for multi-line messages; include a `Co-Authored-By:` footer.
- Match the tone in `git log` rather than inventing a new style.

## Scope discipline

v1 is exactly the five criteria listed in architecture.md § "v1 done criteria". Do not build beyond them without an explicit go-ahead. Deferred items (renewal alarms, edit flow, categories, CSV, history heuristic, annual↔monthly UI polish) are v2.

## Rules directory

```
.claude/rules/
  architecture.md    big picture: what, why, not-what, known tensions
```

`conventions.md`, `workflow.md`, and `testing.md` may be added as the project grows.

## When in doubt

- Overlay quality wins over internal elegance.
- Ask before adding a dependency, a permission, or a file that isn't purely in one of `src/{popup,content,options,background,lib}`.
- If a session is mid-flight and context seems thin, re-read architecture.md rather than inferring.

### Auto-Update Memory (MANDATORY)

**Update memory files AS YOU GO, not at the end.** When you learn something new, update immediately.

| Trigger | Action |
|---------|--------|
| User shares a fact about themselves | → Update (or create if it doesnt yet exist) `memory-profile.md` |
| User states a preference | → Update (or create if it doesnt yet exist) `memory-preferences.md` |
| A decision is made | → Update (or create if it doesnt yet exist) `memory-decisions.md` with date |
| Completing substantive work | → Add to (or create if it doesnt yet exist) `memory-sessions.md` |

**Skip:** Quick factual questions, trivial tasks with no new info.

**DO NOT ASK. Just update the files when you learn something.**