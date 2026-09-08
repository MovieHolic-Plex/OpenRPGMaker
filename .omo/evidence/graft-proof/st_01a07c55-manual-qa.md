# manualQa — st_01a07c55 GRAFT-1 strict graft-image evidence

Attempt evidence root: `.omo/evidence/graft-proof`  
Worktree: `/home/main/z-project/rpg-zzu-ai-full-context-graft-proof`  
Branch: `agent/ai-full-context-graft-proof`

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
| --- | --- | --- | --- | --- | --- |
| S1-held-renderer | GRAFT-1: no usable image while graft source pending | Vitest + `renderToolImages` / real raster DOM | `npm test -- test/toolImageGraftReadiness.test.ts -t "does not resolve a held graft source"` | **PASS** — race stays `pending` while interior source held; after release PNG hash ≠ base `b08965b8…` | A-held-renderer, A-png-export, A-vitest-graft |
| S2-missing-source-renderer | GRAFT-1: missing source cannot be partial-bake success | Vitest + `renderToolImages` | `npm test -- test/toolImageGraftReadiness.test.ts -t "fails closed for a missing graft source"` | **PASS** — rejects `tileset-graft-rendering-unavailable` | A-missing-renderer, A-vitest-graft |
| S3-session-held-release | GRAFT-1 + C001/C002: held → no authority; release exact bake → reviewer image + authority | Public `AssistantSession` + real `set_tile_grafts` / `show_map_region` + `renderToolImages` | same file `-t "withholds session approval while the graft source is held"` | **PASS** — while held: `reviews.length===0`, `isDraftReviewApproved()===false`; after release: `afterHash=27d5a9e7…`, review approved, authority true | A-session-held, A-png-meta, A-vitest-graft |
| S4-session-failed-source | failure stays unapproved | Public `AssistantSession` + forced interior load `onerror` | same file `-t "keeps failed graft source loads unapproved"` | **PASS** — graft written, `imageCount:0`, `changes_requested`, authority false | A-session-fail, A-vitest-graft |
| S5-columns-contract | preserve tileset columns visual gate | `assistantTilesetVisualReview` | `npm test -- test/assistantTilesetVisualReview.test.ts` | **PASS** — 2/2 | A-related-final |
| S6-event-visual | preserve event depiction / fail-closed multi-page | `toolImageEventRender` + acceptance session | `npm test -- test/toolImageEventRender.test.ts test/toolImageEventAcceptanceSession.test.ts` | **PASS** — 7/7 | A-related-final |
| S7-nongraft-group-sample | ordinary nongrafted group sample | `toolImageEventRender` group sample case | included in S6 run | **PASS** | A-related-final |
| S8-png-byte-inspect | real changed PNG bytes | exported PNGs + Pillow tile-0 diff | export via focused render + `png-pixel-inspect.json` | **PASS** — 128×128 PNG pair; tile0 1024/1024 pixels differ; full images not equal | A-before-png, A-after-png, A-pixel-inspect, A-png-export |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
| --- | --- | --- | --- | --- | --- |
| ADV-held-base-spoof | GRAFT-1 | stale/cached base presented as current graft evidence | must not resolve held bake to base atlas or grant authority | **PASS** — pending while held; base hash only before graft | A-held-renderer, A-session-held |
| ADV-missing-chipset | GRAFT-1 | unknown sourceChipset texture | fail closed, no image receipt | **PASS** | A-missing-renderer |
| ADV-load-error | GRAFT-1 | source path exists but Image errors | fail closed at session review | **PASS** | A-session-fail |
| ADV-partial-bake | GRAFT-1 | incomplete source set cached as success | bake returns null unless every source loads; nothing cached | **PASS** (same fail-closed path; no partial cache entry) | A-session-fail, A-source-tileGraftImageCache |
| ADV-geometry-cache-bind | GRAFT-1 | cache key omits geometry | key includes count/tileSize/tilesPerRow/grafts/base URL | **PASS** — code+hash evidence | A-source-tileGraftImageCache, A-source-hashes |
| ADV-cancel-abort | don’t hang cancellation | AbortSignal during await bake | resolves null → unavailable throw; no success cache | **PASS** at helper unit contract (signal branch in `awaitGraftedTilesetImageUrl`); session does not yet pass turn signal into renderImages | A-source-tileGraftImageCache, A-handoff |
| ADV-editor-fallback | preserve ordinary editor transient fallback | `tilesetImageUrl` while pending | still returns base URL + schedules bake | **PASS** — `tilesetImageUrl` unchanged fallback semantics | A-source-tilesetImage |
| ADV-background-event | preserve adjacent visual contracts | background refusal + event multi-page | unchanged fail-closed | **PASS** | A-related-final |

## artifactRefs

| id | kind | description | path |
| --- | --- | --- | --- |
| A-held-renderer | json | held→release renderer observation | `.omo/evidence/graft-proof/held-release-renderer.json` |
| A-missing-renderer | json | missing source renderer observation | `.omo/evidence/graft-proof/missing-source-renderer.json` |
| A-session-held | json | session held/release reviews+authority | `.omo/evidence/graft-proof/session-held-release.json` |
| A-png-meta | json | before/after SHA-256 for session path | `.omo/evidence/graft-proof/session-held-release-png-meta.json` |
| A-session-fail | json | failed source session observation | `.omo/evidence/graft-proof/session-failed-source.json` |
| A-before-png | png | ungrafted region PNG | `.omo/evidence/graft-proof/before-base.png` |
| A-after-png | png | grafted region PNG | `.omo/evidence/graft-proof/after-graft.png` |
| A-png-export | json | export hashes/sizes | `.omo/evidence/graft-proof/png-export.json` |
| A-pixel-inspect | json | tile-0 pixel diff counts | `.omo/evidence/graft-proof/png-pixel-inspect.json` |
| A-vitest-graft | log | graft readiness vitest | `.omo/evidence/graft-proof/graft-readiness-vitest.log` |
| A-related-final | log | 26-pass related visual suite | `.omo/evidence/graft-proof/focused-related-final.log` |
| A-typecheck | log | `npm run typecheck:app` exit 0 | `.omo/evidence/graft-proof/typecheck-app.log` |
| A-source-hashes | text | SHA-256 of owned sources | `.omo/evidence/graft-proof/source-hashes.txt` |
| A-source-tileGraftImageCache | source | strict bake/await implementation | `src/assets/tileGraftImageCache.ts` |
| A-source-tilesetImage | source | base URL + editor fallback | `src/editor/tilesetImage.ts` |
| A-handoff | markdown | parent integration handoff | `.omo/evidence/graft-proof/HANDOFF.md` |
| A-manual-qa | markdown | this matrix | `.omo/evidence/graft-proof/st_01a07c55-manual-qa.md` |

## Residual risk

Session turn abort is not plumbed into `renderImages` (out of authorized session edit scope). Bake abort API is ready; production cancel still depends on Image settlement or outer timeout policy unchanged from other atlas loads.

## Follow-up surfaceEvidence (nonblocking + abort)

| scenario id | criterion | surface | invocation | verdict | artifactRefs |
| --- | --- | --- | --- | --- | --- |
| S9-session-abort | held turn abort; bake cannot revive | public AssistantSession + AbortSignal | `toolImageGraftReadiness` abort case | **PASS** stoppedReason aborted, authority false after bake | session-held-abort.json, followup-vitest.log |
| S10-geometry-cache | cache binds geometry | renderToolImages + peek | geometry-change case | **PASS** ready URL changes after tilesPerRow++ | geometry-cache-bind.json |
| S11-nonblocking-pending | no Session hang on held I/O | renderToolImages fail-closed | held-fail-closed-then-release | **PASS** immediate unavailable then ready PNG | held-release-renderer.json |

