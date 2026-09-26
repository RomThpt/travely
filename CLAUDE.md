# Travely

Travely tracks transport legs with live flight and train data, maps, weather, local alerts, and a local visual travel passport. Ferries and buses use labelled demo data.

## Build, run, test

- Install dependencies with `bun install` at the root.
- Run the proxy with `bun run dev:proxy` and the Expo app with `bun run dev:mobile`.
- Run `bun run check` before merging. It covers typecheck, lint, and existing tests.
- `apps/proxy/.env` holds provider keys and a `PROXY_KEY` of at least 16 characters. `apps/mobile/.env` holds the public proxy URL and matching key.

## Conventions and pitfalls

- Code, comments, commit messages, and docs use English. UI strings go through FR/EN i18n.
- `serviceDate` is the local departure date as `YYYYMMDD`. Navitia returns Paris local time without an offset; compute deltas local to local.
- Every `Leg` carries `source` and `isDemo`. Demo data is always labelled in the UI.
- Mobile `EXPO_PUBLIC_*` values are bundled and public. Keep provider secrets on the proxy.
- AeroDataBox quota is limited; rely on the proxy cache and demo catalogue for repeated testing.
- The Expo dev client is required for native modules. `react-native-mmkv` v4 needs `react-native-nitro-modules`, Reanimated 4 needs `react-native-worklets`, and the iOS deployment target is at least 16.4.
- iOS maps use Apple `hybridFlyover`; Android uses MapLibre. The pure map model is in `features/trips/map/model.ts`.
- The local passport reflects trip data; it does not independently verify travel.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **travely** (9592 symbols, 22373 relationships, 354 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact before editing.** Use `impact({target: "symbolName", direction: "upstream"})` or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .`; report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- MUST warn on HIGH/CRITICAL `risk` pre-edit; never use `riskSharedAxes` to waive a HIGH/CRITICAL `risk` warning. Compare File/symbol: MCP File omits axes; Graph-RAG expands File.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- **MUST use `query({search_query: "concept"})` for concepts/flows, `context({name: "symbolName"})` for a named symbol, or `impact` for blast radius, on read-only callers, dependencies, imports, or execution flow.** Graph first; text search only for empty/`UNKNOWN`/literals.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/travely/context` | Codebase overview, check index freshness |
| `gitnexus://repo/travely/clusters` | All functional areas |
| `gitnexus://repo/travely/processes` | All execution flows |
| `gitnexus://repo/travely/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
