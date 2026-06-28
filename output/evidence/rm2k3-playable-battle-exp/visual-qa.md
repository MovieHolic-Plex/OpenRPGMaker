# RPG Maker 2003 Style Battle Evidence QA

Verdict: PASS

Date: 2026-06-28

Route: `http://127.0.0.1:5173/?freshProject=1&classicCapture=2&npcGateEvidence=1`

Scenario: Playwright seeded `test/fixtures/projects/battle-v3.json`, entered play mode, started a new game, clicked `event-battle-start`, captured battle entry, clicked the skill command, captured an active animation frame, waited for victory, and repeated battle entry on a 390x844 mobile viewport.

## Evidence Files

- Desktop battle entry: `desktop-battle-entry.png`
- Desktop skill animation: `desktop-skill-animation.png`
- Desktop post-victory map/EXP state: `desktop-victory-exp.png`
- Mobile battle entry: `mobile-battle-entry.png`
- Desktop geometry: `desktop-battle-geometry.json`
- Mobile geometry: `mobile-battle-geometry.json`
- Runtime before victory: `runtime-before.json`
- Runtime after victory: `runtime-after.json`
- Animation state: `animation-state.json`
- Actor render state: `actor-render-state.json`
- Imagegen reference asset: `imagegen-hero-battler-reference.png`

## Browser Findings

- Desktop composition now follows the RPG Maker 2003 side-view pattern: enemy on the left field, actor sprite on the right field, bottom-left vertical command window, and bottom-right party status window.
- The battle UI was enlarged after visual review: desktop HUD height is now 118px, command text is larger, enemy art is larger, and the actor battle sprite renders as a 96x96 display of one 48x48 source frame.
- Actor chipset rendering is explicitly frame-cropped. `actor-render-state.json` shows `hasSprite: true`, `backgroundPosition: "0px 0px"`, `backgroundSize: "288px 768px"`, and a 96x96 desktop sprite rect from the 144x384 source sheet.
- Status readability was improved by labeling values as `HP 514`, `MP 43`, and `100%` instead of detached bare numbers.
- Mobile keeps the same split-window composition. Commands remain visible and the actor/enemy sprites stay inside the battle frame.
- `desktop-battle-geometry.json` and `mobile-battle-geometry.json` prove the key layout relationships: enemy center is left of actor center, command window center is left of status window center, both HUD windows share the bottom band, and no measured panel clips outside the scene.
- Skill use is playable. `desktop-skill-animation.png` captures an active battle animation after clicking the Korean skill command.
- Rewards are applied to the actual play session. `runtime-before.json` has `actorExperience.actor_hero: 0`; `runtime-after.json` has `actorExperience.actor_hero: 7`, `gold: 3`, and `battleResult: "victory"`.

## Regression Gates

- `npx vitest run test/battleRewardsToSession.test.ts test/battleRuntime.test.ts test/io.test.ts --configLoader runner`: PASS, 25 tests.
- `npm run typecheck -- --pretty false`: PASS.
- `npx playwright test test/e2e/rm2k3-battle.spec.ts --project=chromium`: PASS, 4 tests.
