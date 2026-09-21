# Growth tree studio verification

- Source baseline: `7167ae65` (main when the feature branch was created).
- `npm run typecheck:app`: exit 0.
- Focused tests: 5 files / 69 tests passed, including 23 growth graph/runtime/persistence contracts.
- `npm run build`: exit 0 (editor, player, standalone). Editor build repeated after the final catalog layout adjustment: exit 0.
- CSS gate: exit 0.
- Firefox shipped-player QA: prerequisite lock, investment, skill learning, promotion, class deactivation, inactive-tree refund; no runtime errors. Uses the dedicated player harness.
- Firefox DB probe: 32 tabs measured, no tab errors. Both new tabs have zero clipped text, tiny text, broken images, unskinned controls, or bad image URLs. Unrelated existing tabs have findings; see `db-probe.json` totals.
- Surface gate: exit 1, reproduced at the unmodified source baseline in `/tmp/rpg-zzu-growth-base`: the same six event-editor snapshot assertions and the same `.selected` CSS `bottom` ratchet. Both reports are included with whitespace normalized; the integrated failed-assertion comparison is in `surface-comparison.json`. Baselines were not modified.

The browser projects are minimal contract fixtures. They do not author or modify a user's LegacyDb project. Authored settings use the existing project store and persistence pipeline; runtime investments round-trip through save slots.

- Final editor interactions passed: CRUD, links, cycle rejection, arrange, drag/keyboard movement, preview spending/refund, dirty-close guard, tab return; no page errors or outer overflow at 1600/1280/1024.
- Additional layout assertions prove the search input does not overlap the create button and the bonus selector remains usable at all three widths.
- Merged main through `2ef2b071` in `32a66afb`; final focused tests pass 69/69 and the full editor/player/standalone build exits 0 (including the app typecheck).
- Full `npm run gates` at integrated source `905c4e60` was stopped after a 10-minute timebox without a Vitest result report on the heavily loaded shared host. It is **incomplete**, not a pass. The earlier pre-integration full run was superseded after more than 20 minutes. No full-suite claim is made for the final merge; see `full-gate.json`.

Screenshots show the actual editor and shipped-player surfaces. The skill layout shots use the deterministic fixture in `scripts/qa/growth-tree-layout.mjs`; editor interactions use `scripts/qa/growth-tree-studio.mjs`.
