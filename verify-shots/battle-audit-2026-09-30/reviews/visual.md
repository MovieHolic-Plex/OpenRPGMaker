# Independent shipping battle visual review

Repository commit: 0e0db9b5818814e9f27400c8fb2b54b619d59e8d, v0.41.0.

Method: read each completed case SUMMARY.md before images; inspect extra.json geometry; open selected PNGs through view_image. Did not execute browser/server/Node/tests or alter source/project/QA outputs. Only this /tmp report was written. Screenshots were produced by root's shipping player harness. Review is of captured static surfaces; animation pacing, every key transition, full roster and every skill are not established by screenshots.

## Matrix verdicts

| Completed case | Opened evidence | Visual verdict |
|---|---|---|
| retro-1024-settled, 1024×768, wait | result-settled.png; result-revealed.png | **Result fails**: persistent old director victory strip occludes new summary. Party/loot/counts/confirm readable. result-revealed is actually the field after dismissal, not a revealed result screenshot. |
| retro-1280-menus, 1280×800, wait — final rerun | command-settled.png; skills.png; target.png; target-next.png; target-cancel.png | Command/status/skill submenu **pass**. Initial target and changed target **pass**: field arrow/name, top instruction and hand/menu row move together from slime1 to bat. Cancel restores root Attack cursor without obscuring status. Latest extra.json has errors0 and all5 extra captures. |
| retro-1440, 1440×900, wait | command-settled.png | Command/status **pass**. Stage is centered 960×720 with black margins, all controls and battlers remain inside. |
| retro-active, 1024×768 | command-settled.png | Static command/status **pass**. This screenshot does not establish active timer correctness or cached combo eligibility. |
| retro-strict, 1024×768 — final rerun | command-settled.png; skills.png; target.png; target-next.png; target-cancel.png | Skill/status/initial target/changed target/cancel **pass**. “명령1/4” badge is legible; cancel returns to the same first actor and command1/4 with Attack cursor. Latest extra.json has errors0 and all5 extra captures. |
| retro-reduced, 1024×768 | 05-battle-command.png; result-settled.png | Command/status **pass**. Result **fails** with identical summary occlusion. Static screenshot cannot verify reduced animation semantics. |
| rm2000-control, 1024×768 | 05-battle-command.png; result-settled.png | Front-view command/status and result **pass**. Old-save rm2000 compatibility is intentional; its different art is not a bug. Correct result has one summary with fully readable 승리!, EXP+17, +14G and no director overlay. |

## Confirmed visual defect — previously reported result overlay

Primary code: `/home/main/.codex/worktrees/3852/rpg-zzu/src/styles/runtime/battle-skins/_retro2003.css:177`.

Evidence: `/home/main/.codex/worktrees/3852/rpg-zzu/verify-shots/battle-audit-2026-09-30/retro-1024-settled/result-settled.png` and `retro-reduced/result-settled.png`.

Both captured phase resolved, step result, busy false. extra.json shows message display grid / visibility visible, message rect (44,36,936,60), summary rect (56,48,912,96): **48 screen pixels of the summary's top overlap the old message**. It hides the summary title and EXP/gold in both normal and reduced motion. Loot count has already revealed; this is not an early result-animation frame.

rm2000-control confirms expected behavior at same viewport: message display none, zero rect, summary rect unchanged and fully legible. This isolates skin specificity, not result DOM geometry or rendering delay. Fix and call chain are recorded in `/tmp/battle-audit-3852-flow.md`, finding3.

## No additional confirmed product visual defects in inspected surfaces

Command/menu observations:
- Retro sideview gives enemies clear left group and four actors clear diagonal right group. Individual silhouettes are distinguishable; no sprite touches/clips the top banner or bottom cards in these cases.
- HP 514/514 and MP43 are readable on every actor; active actor has arrow/yellow name, distinct from command cursor's hand/yellow text.
- All five root choices are visible in two columns; empty inventory reads disabled gray Item, not a missing button. Escape remains visible.
- At 1280 and1440, centered stage uses the same logical composition rather than stretching columns into margins.
- Skill rows show names/cost pills, selected row hand/yellow name and lower scroll cue. “뒤로” is below the initial skill scroll viewport; cue makes continuation discoverable. This is not proven keyboard Back usability, only visible menu organization.
- Latest target and target-next screens in both final reruns show selected “슬라임1” then “동굴박쥐”: the field arrow, selected nameplate, top instruction and menu hand/yellow row agree. Nonselected slimes darken; duplicate slimes have1/2 suffixes. Back is visible. Target-cancel removes target markers, restores all enemy colors, actorCommand and root Attack cursor. No overlapping target labels were found.
- rm2000-control root is a smaller scroll list with its lower cue; front-view enemies are separated and all actor gauges/names are readable.

## Final harness/data state — keep out of product findings

- Root corrected target capture waiting from visible duplicate prompt to attached prompt, and awaited scenery data-layers=ready. Both retro-1280-menus and retro-strict were rerun. Latest matrix.json and both extra.json have **errors0**; each has command-settled, skills, target, target-next and target-cancel captures. These replace the earlier timeout/failure.png evidence. The initial target timeout is resolved and is not an outstanding product or harness finding.
- Eight latest skills/target/target-next/target-cancel PNGs were independently reopened. All use the loaded layered pixel forest consistently. Background layers are ready before menu review; the earlier comparison of night-forest early captures with later pixel forest is superseded. Final target changes/cancels do not change backdrop artwork. Scenery initialization remains the documented four-layer load contract, not a reported product defect.
- `result-revealed.png` in settled/reduced/control has scene:null in extra.json and is field exploration after result closes. The harness waited long enough for all rewards to reveal automatically, so next Z dismissed. Do not present that file as a fully revealed result proof. `result-settled.png` is the actual final visible result proof; the result overlay finding remains unchanged.

## Coverage limits

No full battle result at1280/1440 or Active/strict was supplied in these completed cases; no level-up modal, long skill/item names, status-heavy fights, inputSequence overlay, party switch, capture cinematic, battle-event choices or monster-party Pokemon surface was visually established. These remain unreviewed, not failed. Static reads cannot prove flash/skip smoothness, reduced-motion conformance, skin loading continuity or actual keyboard sequence acceptance.


## 감독자 최종 재현 판정

최종 기준은 `docs/2026-09-30-battle-adversarial-review.md`와 `rules-probe.json`, `interactions/interactions.json`이다. 2026-09-30 추가 상호작용 5개 모두 reproduced=true/errors0. combo 재실행도 ATB57→100 비활성 유지, 재개방 활성으로 확인됐다. 리뷰 원문의 source-only/needs-runtime-repro 표현은 해당 검토자가 작성한 시점의 범위이며, 후속 감독자 재현은 종합 보고서에 반영했다.
