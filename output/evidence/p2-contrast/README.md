# Minimum-glass foreground contrast proof

Base: `f7ae885184c981c243222a93e527157143ca5fe9`.
Worktree: `/home/main/z-project/rpg-zzu-assistant-glass-p2-contrast`.
Owned server: `http://127.0.0.1:9912` (stopped after verification).

## QA follow-up: enabled turn rewind

The main QA matrix exposed an action that history-restored fixtures do not
create: `attachRewindAffordance` only attaches the button to a newly submitted
user turn. The earlier 208-label proof therefore did not cover this control.
This follow-up adds only `.ai-deck .ai-turn-rewind:not(:disabled)` in the
existing owner: opacity 1 and `color-mix(in srgb, var(--text-2) 60%, var(--text-1))`.
The 05 stylesheet, disabled behavior, background tints and action wiring are
unchanged. The stronger quiet mix is needed for the nested 12% accent user
bubble plus 4%/8%/12% control tint; the bare-glass secondary mix alone was
insufficient (`rewind-secondary-red.json`). No new token was added.

Command: `node output/evidence/p2-contrast/rewind.mjs green`.
The real composer/session submits a deterministic no-write model response,
awaits its exact terminal receipt (`stoppedReason: final`, `appliedCalls: 0`),
and exercises the actual enabled rewind. No reconstructed control is used.

| Density | Original rest opacity / exact minimum | Fixed rest | Fixed hover | Fixed keyboard focus | Fixed pointer-down |
| --- | --- | ---: | ---: | ---: | ---: |
| 78 | 0.45 / 2.4511681841193007 | 5.3321591559696015 | 4.9522778848183755 | 5.3321591559696015 | 4.590545139502109 |
| 82 | 0.45 / 2.511592018315496 | 5.860751633905676 | 5.43494220993867 | 5.860751633905676 | 5.029679355473859 |
| 100 | 0.45 / 2.743567053106191 | 8.64902147360687 | 7.977871473769046 | 8.64902147360687 | 7.340269222131937 |

`rewind-green.json`: **12 states / 60 comparisons / 0 failures**. Foreground is
`color(srgb 0.190588 0.236078 0.312941)`, effective opacity is 1 in every state,
and range remains 78..100 / step 1 / default 82. Comparisons use actual computed
foregrounds and recursively composite complete element-opacity groups against
black/white bounds and three real screenshot backdrop samples. Exact CSS alpha
is retained (not decoded through an 8-bit canvas), explaining the small numeric
difference from QA's rounded-alpha report. Screenshots corroborate the control;
glyph anti-alias pixels are never used as foreground colors.

After measurement the enabled action is actually clicked: it restores the
original instruction and removes the subsequent assistant response. This
confirms it was neither hidden nor disabled to satisfy contrast. Main QA's
separate table-renderer gap is outside this correction and was not changed.

Follow-up validation: **37/37 tests** in aiDeckCss, aiBackgroundOpacity,
aiDeckIcons and aiAssistantUxP0P2; CSS budget/graph/live-class gates and
`build:app` pass (`rewind-tests.log`, `rewind-css-gates.log`, `rewind-build.log`).
`node --check rewind.mjs` passes. Script LSP initially returned no diagnostics;
a later fresh request hit the tool's 3-second limit. CSS LSP remains unavailable
because Biome is not installed. No production TypeScript was changed.
`rewind-red.json` / `rewind-red.log` preserve the true original failure;
`rewind-secondary-red.json` preserves the insufficient first foreground mix.
The original contrast/glyph commit is `1f75385ae1ffd2fb414d21643dc6aa73b5a5800a`;
this follow-up is an incremental commit on that verified base.

## Delivered change

Only `18-assistant-deck.css` changes production styling. The local
`--ai-deck-secondary` mixes existing `--text-2` (85%) with `--text-1` (15%),
only for float outside studio/history. Glass labels and metadata, including
reasoning and tile captions, reuse it. Rail warning/success/error and pill
warning/error foregrounds mix the existing semantic token (60%) with
`--text-1` (40%). No global token, background tint, dot, geometry, or new
stylesheet was introduced or changed.

The native range remains min 78, max 100, step 1, default 82. The proof uses
its actual End/Home keyboard behavior to visit 100 and 78. Every measured
surface retains `color(srgb 1 1 1 / 0.78)`, element opacity 1, and
`blur(20px) saturate(1.08)`. Every measured text element has effective opacity 1.

`test/aiAssistantUxP0P2.test.ts` now checks the existing more button's SVG,
accessible name, menu/expanded semantics, disclosure and settings-modal
access instead of expecting a literal hamburger character. The assertions
against duplicate settings chrome remain. The test explicitly reflects the
shipped `hidden` attribute into FakeElement's property, which that mock does
not do automatically; no production behavior or shared mock was changed.

## RED: actual computed CSS, not guessed token values

`red.json` / `contrast-red.log` record the original browser-computed colors,
ancestor background layers and unrounded ratios. The first proof had 136
label measurements and 53 failures across repeated states.

| Actual selector/state | Computed foreground | Black-bound ratio at 78% |
| --- | --- | ---: |
| rail context, context meter, effort selects, model, day divider, neutral pill state | rgb(71, 85, 105) | 4.477905733201011 |
| unselected mode option, including 6% ink segment tint | rgb(71, 85, 105) | 4.004187315828023 |
| rail warning | rgb(138, 94, 0) | 2.9140113882758416 |
| rail success | rgb(24, 118, 79) | 2.8752193059915334 |
| rail error | rgb(198, 64, 61) | 2.5532809420367863 |
| pill warning | rgb(138, 94, 0) | 3.3705924037527426 |
| pill error | rgb(198, 64, 61) | 2.953341013868812 |

Expanded production-renderer coverage in `metadata-red.json` then exposed
legacy `rgb(98, 110, 137)` reasoning toggle/body text at
4.020625598837956 and tile thumbnail/grid captions at 3.018688603772784.
The final scoped metadata rule fixes both. This intermediate report also
retains the sampler defects below; it is not represented as final evidence.

`glyph-red.log` records the original test failure:
`AssertionError: expected '' to contain '☰'` (1 failed, 2 passed).

## GREEN: complete focused proof, one final run

Command: `node output/evidence/p2-contrast/prove.mjs final-green`

`final-green.json` / `final-green.log`:

- **208 label measurements / 16 states / 0 failures / 0 missing samples**.
- Both black and white composited-background bounds checked for every label.
- Lowest unrounded calculated ratio: **4.589972785807559:1**.
- Lowest screenshot-background corroboration ratio: **4.579957524457069:1**.
- 506,030 background pixels sampled; no foreground colors inferred from pixels.
- Secondary computed foreground: `color(srgb 0.24549 0.296863 0.374706)`.
- Bare-glass secondary minimum: **5.167429648545823:1**.
- Unselected mode segment minimum: **4.6207663776230765:1**.
- Reasoning toggle/body minimum: **6.882558174159187:1**.
- Tile captions minimum: **5.167429648545823:1**.

States include market idle, restored conversation with successful and failed
tool entries and expanded failure details, all four active rail states,
production-rendered reasoning/tile/recap metadata, black/white metadata
backdrops, all five collapsed states (including pending-count badge), and
black/white error-pill backdrops. The market remains the real Phaser-rendered
sample map. Black/white checks replace only the map-side float-host backdrop,
not the glass surface. No project content or model request is written remotely.

### Method and assumptions

The real editor boots through its normal shell. Conversation history is seeded
through `saveConversation` and restored via the shipped picker. Supplemental
metadata uses `createConversationLogHost`; collapsed states use
`setRestoreButtonState`. Rail state fixtures set the attributes published by
its owner. These are rendering fixtures, not claims of end-to-end model-turn
coverage (the separate main phase QA owns that).

For each actual text element, the proof reads `getComputedStyle` foreground,
foreground alpha, effective element opacity and every ancestor background up
to the glass surface. It composites in sRGB over both black and white and
calculates WCAG relative luminance. RGB bounds encompass any clamped output
of the unchanged blur/saturate filter. Opaque child backgrounds and nested
semantic/mode tints are included, not replaced with a generic white estimate.
Pass decisions use the full Number value and `>= 4.5`; no rounding to pass.

Screenshots corroborate actual map backgrounds. A temporary capture-only rule
removes glyph paint after computed colors are recorded, preserving backgrounds,
geometry and filters; native select color is transparent only for that capture.
The rule is removed immediately afterward. Finite CSS transitions are awaited
through their exact `finished` promises with a bounded timeout, not sleeps.

### Native select discrepancy resolved, not suppressed

The intermediate sampler inset every bounding rectangle by 3px. For a
52x28 rounded native select, this still included its curved border. The saved
black-background PNG has `rgb(176,177,179)` at local `(4,4)` and `(47,23)`,
whereas the center/text background is `rgb(199,199,199)`. Comparing the CSS
text color with those border pixels produced the spurious 4.074858641046004
ratio. It was never a different foreground color.

The final sampler derives a straight inner strip from the actual computed
border widths/radii, independent of pixel brightness. Both native selects
sample 528 background pixels, all with minimum ratio
**5.172786562296258:1**, corroborating the exact CSS layered-background
bound **5.167429648545823:1**. The baseline PNG is retained as
`metadata-red-black-metadata-background.png` so the corner/center values
can be independently inspected.

The single-digit caption's actual text Range was 5.734375px wide. The same
3px-per-side inset had left zero samples. Text Ranges now use a 0.5px inset;
zero samples are explicitly a failure, not Infinity silently passing.
Final caption samples are present and pass.

## Verification

- `final-tests.log`: **7 files, 53 tests passed** in one final invocation:
  aiAssistantUxP0P2, aiDeckCss, aiDeckIcons, aiBackgroundOpacity,
  aiComposerDeck, aiDeckRail, aiDockMetaReach.
- `final-css-gates.log`: CSS budget/graph/live-class gates passed; no new
  hex, !important, stylesheet, orphan, missing import or undefined variable.
- `typecheck-app.log`: `npm run typecheck:app` passed.
- `final-build.log`: `npm run build:app` passed. Vite reports oversized chunks;
  no bundle-splitting work was included in this scoped correction.
- `final-typecheck.log`: full `npm run typecheck` exits 2 with **744 errors**,
  **0 in the changed test**. The repository quickstart documents this gate's
  pre-existing failures; no production TypeScript was changed. Examples:
  `test/toolReason.test.ts(115,23)` TS2353; full-project ambient conflicts at
  `src/editor/panels/eventEditor/customSelect.ts(362,5)` TS2322 and
  `showAnimationPlayback.ts(138,5)` TS2322. App-only typecheck remains green.
- LSP: the changed test initially returned no diagnostics; later fresh-diagnostic
  attempts exceeded the tool's 3-second limit. The proof script returned no
  diagnostics and `node --check` passed. CSS LSP is unavailable (Biome not
  installed); Markdown has no configured LSP. No server installation or
  configuration change was made outside scope. CSS gates and the real browser
  provide the style validation; full tsc output includes no changed-test error.
- `git diff --check` passed.

Reproduction: start this worktree's `npm run dev:worktree -- --port 9912`,
run the proof command above, and stop that server. Never use shared port 9841.
