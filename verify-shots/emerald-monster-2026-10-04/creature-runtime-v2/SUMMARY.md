# Shipping creature runtime V2 — SUMMARY

Artifact `ced3aba1d8d081fe`, stable root `262fe80536`, `/tmp/oprn-emerald-20261004/player-v2/player.html`, own static port18573. Frozen V2 source was not modified. Browser served original shipping project/player/assets; player.html route only enables QA instrumentation and changes save namespace to `starlight-creature-runtime-v2-qa`. Existing save namespace/data untouched.

## 즉시 확인
- `11-native-pp-after.png`: actual native move PP29/30 after one attack.
- `13-native-capture-result.png`, `14-natural-capture-party.png`: actual successful second orb and settled two-member party.
- `17-controlled-pending-skill.png`, `18-controlled-native-skill-learned.png`: actual pending/replaced skill after controlled EXP preparation.
- `19-controlled-stag-combat.png`: actual original legendary troop; independently authored front/rear quadruped.
- `26-native-gym-victory.png`: actual first-gym victory EXP108, gold288, Lv5→6.
- `27-native-badge-dialogue.png`, `28-native-gym-badge-settled.png`: reward-event sequence; final authoritative state is `runtime-record.json.gymFinal`.

## Natural starter / encounter / capture
Fresh opening, ordinary keyboard lab route, professor Coalbit choice, ordinary route to meadow and 17 habitat steps. No teleport/RNG/levels/outcome injection in this phase. Actual wild Spriglet Lv4. One normal attack PP30→29; first orb fails, second succeeds. Settled party1→2, orbs10→8, CoalbitHP20→16, caughtAt meadow12,28. SprigletLv4/HP15; source and native instance HP recomputed from capture IVs. `naturalFinal` records settled result; asynchronous intermediate queries were not accepted as final receipts.

## Controlled growth and combat presentation
Chromium target crashed before first controlled attack. New private browser replayed recorded natural state as QA preparation; no application pageerror/stack or cause observed. Coalbit explicitly prepared Lv15 EXP1870 with four legitimate scheduled moves. Original wild troop/native fight produced actual victory, EXP1890, Lv16 Kilnclaw, firePP30→29, pending fighting_1. Native detail replacement control replaced normal_1 with fighting_1 PP30 and cleared pending. The DOM control click activates original callback; no skill/outcome mutation. This is mechanism proof, not natural 15-level grinding.
Astralhart Lv65 party preparation plus original legendary troop rendered front/rear and escaped through native command. Both are clearly quadruped, green/ivory with matching title mane/antlers/tail. This is presentation proof, not naturally earned legendary encounter.

## First gym — actual native event / reward
Restored exactly natural-capture Lv5Coalbit/Lv4Spriglet. QA teleports to grove center, puzzle devices and leader, explicitly labeled; no level, skill, badge, result or EXP injection in this phase. Actual center nurse healed HP20/17 and PP30. Native pivot/cut confirmations set puzzle flags; original leader event launched two uncapturable Lv9Spriglet. Eight fire attacks, three native potions5→2 won; native EXP108 gives CoalbitLv6EXP298; firePP30→22. Original victory branch set badge_1 true, awarded600gold plus battle288 (1600→2488), hi_potion0→2. Spriglet remainsLv4. Did not walk full gym puzzle corridor; content activation/reward proof does not claim route reachability. Extra confirmation after reward began rematch greeting; final badge state already settled, no extra victory reported.

## Assets, bounds, regressions
`asset-audit.json`: all120 current front/back exported resources byte-identical to authored source,64×64, integer native bounds, binary alpha, feet bbox bottom exclusive62;60species IDs present. V2 export has142uploadedassets and omitted all60icons; party uses front fallback. Root confirmed/fixed export closure in2885753297; V3 icon verification belongs root and is not claimed here. Exact project/player SHA in audit.
Actual enemy64 image computed110×110 with fractional breathe (observed≈221×218 screen); authored back64 computed128×128 stable (screen256×256 at stage2). Root fixed final Emerald128variables/static-image breathe in9a377ad7c6; frozen V2 still fails enemy exact2× logical sizing. This report does not claim final bundle validation. Visual review also found V2 result panel clipped at upper left in26-native-gym-victory.png (title/EXP/left reward rows outside viewport); native reward outcome still verified from state. Root notified. Skill detail title in18 also begins partly outside left edge; layout regression requires final-bundle check.
`map-structure-audit.json`:72maps/60species,0 layer-length, missing-tileset, event-bounds or transfer-target issues; this is schema shape, not collision/visual/reachability audit.
Pageerrors0, HTTP errors0, failedrequests0, scene.failedAssets0 in recorded native phases. No suites/gates/Vitest/typecheck, canonical save or remote writes. All browser storage belongs isolated QA namespace. Root independently owns final shipping/canonical verification.
