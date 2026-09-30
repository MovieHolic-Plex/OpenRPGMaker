# Battle audit — data, authoring, assets

Commit: `0e0db9b5818814e9f27400c8fb2b54b619d59e8d` (v0.41.0)
Workspace: `/home/main/.codex/worktrees/3852/rpg-zzu`
Read only audit. No Node/browser/server or tests/gates started; repository and DB unchanged. Only this report was written. Root handled conversation lookup and shipping-player QA.

## 1. [P2] Export does not include human battlers' magic casting sheets

**confirmed-by-source + root direct collection reproduction; browser ZIP/subdirectory reproduction still recommended.**

- Owning lines: `/home/main/.codex/worktrees/3852/rpg-zzu/src/project/webExportAssets.ts:56` (id asset collection) and `/home/main/.codex/worktrees/3852/rpg-zzu/src/player/battleFieldDom.ts:1801` (cast resolver and absolute fallback).
- Dependency: `/home/main/.codex/worktrees/3852/rpg-zzu/src/assets/generatedAssetResourceResolver.ts:28` registers CHARSET_BATTLERS `entry.path` only. It never registers `${entry.resourceId}-cast` or `entry.castPath`. `castSheetUrl` attempts that unregistered id, then falls back to `/assets/generated/charset-battlers/cast/<chip>.png`.
- `collectWebExportAssets` includes base sheets via the actor resource id but never cast companions. `src/player/runtimeAssets.json` contains no `charset-battlers/` paths. No player-side static/dynamic `new URL` covers the cast directory. `vite.player.config.ts:14` sets `publicDir:false`, so the folder is not automatically copied. `webExportZip.ts:20` only includes verified bundle files, runtime inventory, and collected project assets.
- Input: default retro2003 project, actor_mage (charset-battler-actor1-5), any fire/ice/etc cast skill. Export ZIP, host it at `/games/foo/`, use spell.
- Expected: the element-specific cast_charge/raise/release sheet works like editor Test Play, URLs relative to exported game's folder.
- Actual: cast companion omitted; request falls back to origin-root `/assets/...`, fails and caches `missing` for that URL (`battleFieldDom.ts:1807-1808`). Runtime continues using generic base-sheet casting poses (`battleFieldDom.ts:701-705`), silently losing type-specific animation.
- Proposed fix: register -cast URLs through withInlineAsset and collect each used charset's cast companion in export. Test ZIP entry presence and subdirectory request path, not just base actor appearance.
- Cover gap: current webExport battle tests do not cover charset cast companions or magic pose-specific paths.

## 2. [P2] Editor offers borrowed monster choreography for actor skills but player ignores it

**confirmed-by-source + root shipping-player observation (actor borrowing monster contract).**

- Owning lines: `/home/main/.codex/worktrees/3852/rpg-zzu/src/player/retroSkillChoreography.ts:306` and `:318` / `:326`.
- Authoring accepts all kinds: `/home/main/.codex/worktrees/3852/rpg-zzu/src/editor/panels/databaseSkillRetroPicker.ts:73` filters class + monster together; selecting saves any id (`:96`). AI `validateSkillRetroPatch` (`src/editor/tools/dbTools.ts:1155`) checks id existence, not caster compatibility; list_retro_choreographies explicitly offers monster contracts.
- Input: custom skill `skill_test_acid`, name `산성 시험`, scope enemy, damage attack, retroChoreographyId=`skill_mon_acid_spit`; teach it to an actor. Opposite direction also fails: custom enemy skill borrowing `skill_hero_cross_slash`.
- Expected: selected borrowed choreography, as shown in editor stage. Editor `/src/editor/panels/databaseSkillRetroStage.ts:413` recognizes monster and renders its stage.
- Actual actor path: skillByName(..., false) excludes EVERY skill whose resolveRetroMonsterChoreography is truthy; classEntry cannot resolve; retroSkillForEntry uses same rejected filter. No selected contract playback. Enemy path insists on true monster contract and also cannot run a borrowed class choreography. Supporting APIs can report contract exists while shipping player silently falls back.
- Proposed fix: resolve skill identity first, then adapt choreography to caster side; alternatively explicitly constrain authoring choices with clear incompatibility validation. Fully sharing the catalog without runtime support is currently misleading.
- Cover gap: no test found covering cross-kind borrowing from picker/AI through actor/enemy playback.

## 3. [P2] Same-name equipped skill replays a different class's choreography

**confirmed-by-source + root shipping-player reproduction.**

- Owning lines: `/home/main/.codex/worktrees/3852/rpg-zzu/src/player/retroSkillChoreography.ts:286` (`ownedSkillIds`) and `:310` (`mine` selection).
- Runtime legality correctly includes equipment grants (`src/battle/battleSkillUse.ts:41`). Timeline loses the real skill id and retains only name. Playback `ownedSkillIds` reads authored actor.skillIds/learnedSkills and original actor.classId class, excluding equipment grants, live session learned skills and class overrides.
- Input: default level>=12 actor_ranger, equip an item with grantsSkillIds=["skill_gunner_snipe"]. Ranger already knows its own `skill_ranger_snipe`; both name=`저격`. Select gunner version from menu.
- Expected: `skill_gunner_snipe`/gunner_scope 10-frame choreography. Actual: matches includes ranger+gunner; authored ranger class makes ranger skill the unique `mine`, so ranger_scope+ranger_arrow+ranger_power_hit is played instead. Rules and damage may use selected gunner skill correctly while visual animation and downstream battleEntrySkillRecord describe another skill.
- QA signal: during approach inspect `.battle-field.dataset.retroClassSkill` or user.dataset.retroClassSkill (assigned `retroSkillChoreography.ts:849,853`); it should be gunner but becomes ranger. Correct key is `retroClassSkill`, not retroClassSkillId.
- Related: legal same-name cloning and session learning can make selection ambiguous, returning undefined and dropping choreography entirely. `battleEntrySkillRecord` eventually chooses first name match (`:118`), risking wrong support-state explanation too.
- Proposed fix: carry skillId in BattleTimelineEntrySnapshot at execution and use exact id throughout choreography/outcome queries. Identity cannot be recovered reliably from display name + original authored ownership.
- Cover gap: existing same-name handling covers original class ownership, not grants/live class/learned skills.

## 4. [P2] New roster's explicitly three-hit skills still resolve one hit

**confirmed-by-source + root direct engine reproduction.**

- Owning line: `/home/main/.codex/worktrees/3852/rpg-zzu/src/project/defaults/retroRosterRecords.ts:475` applies explicit mechanic only where present; deriveRosterSkillSeed never produces hitSequence and Seed/record likewise have no hitSequence.
- Data: `/home/main/.codex/worktrees/3852/rpg-zzu/src/assets/retroRosterSkills/p2.ts:63` skill_noble_triple_thrust `삼단 찌르기`, description `세 번 찌른다`, no mechanic. `/home/main/.codex/worktrees/3852/rpg-zzu/src/assets/retroRosterSkills/a3.ts:49` skill_squire_triple_cut `삼연격`, description `세 번 빠르게 벤다`, also no mechanic.
- Input: new default project, actor_noble level1 uses 삼단 찌르기 on high-HP target (ensure it survives). Or actor_squire level>=5 uses 삼연격.
- Expected: three damage/accuracy/state application attempts, balanced hit multipliers. Actual: generated SkillRecord lacks hitSequence; `/src/battle/runtime.ts:2654` loops over `skill?.hitSequence ?? [1]` so only ONE applySkillHit occurs. The art can show repeated swings but gameplay is single hit.
- a1 batch alone was hand populated with mechanic and works; that fix does not cover p2/a3 and most other roster batches. This is the same user-reported 'all skills just do damage' issue left in the expanded roster.
- Proposed fix: add explicit mechanic {hits:[...]} for all descriptions promising numbered/multiple strikes and enforce the authored mechanic contract for the full roster rather than guessing from text. Test actual timeline damage-entry count; screenshots of FX alone cannot prove the mechanic.
- Cover gap: previous recording/QA count layer presence and sprite movement; the mechanic verification described in wiki is only a1 56 skills.

## 5. [P1] Unconditional roster backfill introduces missing dependencies into valid custom projects

**confirmed-by-source + root direct serialize/deserialize roundtrip reproduction.**

- Owning line: `/home/main/.codex/worktrees/3852/rpg-zzu/src/project/defaults/defaultDatabase.ts:91` appends default actors; `:99-103` appends only learned skills; `:109-113` appends only eight gimmick states. No equipment or baseline states dependency collection.
- Invocation: `src/project/store.ts:1643` every writable load, and `src/headless/index.ts:82` initialization. Function's parameter type has only actors/classes/skills/states and cannot supplement equipment/elements.
- Reproduction input: valid user-authored project with only custom actor/class/equipment (all actual references coherent), without default equipment such as equip_focus_charm or default states such as state_attack_up/state_regen. Before operation collectProjectReferenceIssues returns none. Call ensureRetroRosterRecords on this project.
- Expected: an optional/additive roster catalog either remains coherent or is not forced into that custom DB.
- Actual: new humanoid roster actors' initialEquipment reference DEFAULT_EQUIPMENT_ID/staff/leather/etc and EVERY nonhumanoid actor references EQUIPMENT_FOCUS_CHARM_ID (`retroRosterRecords.ts:178-185`); default classes reference full ROLE_EQUIPMENT (`:124`); skills reference many baseline statuses, but only eight gimmick states are seeded. Missing equipment and state references become hard validation failures (`src/project/io/references.ts:565,591,607`). `repairProjectReferences` only removes unknown animation/element references, not these (`:411-420`).
- `prepareWebExport` explicitly serialize+deserialize checks (`src/project/webExport.ts:71-72`); deserializer validates all these hard refs (`src/project/io/shape.ts:98`), so export fails and an autosaved normalized custom project risks next-load failure. This is not a request to overwrite author-custom assets; it is missing dependency closure for newly appended bundled records.
- Proposed fix: supplement full dependency closure by missing ids preserving existing records, or limit roster convergence to opt-in/catalog layer; validate result before persistence. Cover a custom valid DB without starter equipment/baseline states, not only older untouched default DB.
- Cover gap: no ensureRetroRosterRecords tests found.

## Investigated and excluded

- pixel-fx export omission: excluded. `retroSkillChoreography.ts:239` uses dynamic `new URL('../../public/assets/generated/pixel-fx/${key}.png',import.meta.url)`, placing directory PNGs in Vite's bundle graph. Assets missing from runtimeAssets.json alone do not prove missing ZIP files.
- party-pixel base-sheet export omission: excluded. Authored resource id is scanned and generatedAssetResourceResolver registers PARTY_PIXEL_SHEETS; collectWebExportAssets resolves it.
- Source reference scan: all contract FX PNGs exist and dimensions match cell*frames by cell; all party-pixel 64 and charset base/cast files examined through file inventory. No absent FX or dimension mismatch claim made.
- Old project's absent default battleUiStyle/rm2000 compatibility and preserving an explicitly authored custom battler are intentional and not findings.

## Root reproduction evidence added after first report

Evidence: `/home/main/.codex/worktrees/3852/rpg-zzu/verify-shots/battle-audit-2026-09-30/rules-probe.json` (produced by supervisor; this reviewer only read it).

- Finding 1: actor_mage baseIncluded=true, castIncluded=false, collectedCastPaths=[]; direct asset collection confirms omission. This does not by itself claim a browser network trace or unpacked ZIP was inspected. The source's Vite/export closure analysis establishes why the cast is not added elsewhere.
- Finding 4: skill_squire_triple_cut normalized hitSequence=[1], actualHitCount=1, amount94; skill_noble_triple_thrust normalized hitSequence=[1], actualHitCount=1, amount84. Correction to original wording: normalizer materializes `[1]` rather than leaving the optional field absent, with exactly the same single-hit effect.
- Finding 5: coherent custom fixture beforeIssueCount=0 and deserialize(serialize(project))='ok'. After ensureRetroRosterRecords: 1106 reference issues, and roundtrip throws ProjectFormatError on appended actors' missing equip_iron_sword/equip_leather_armor/equip_traveler_hat/equip_focus_charm. This proves invalid output/reload rejection; no actual user's canonical SQLite was modified or shown corrupted, so phrase user-store impact as risk, not observed data loss.

## Independent critique of the combined 14 findings

Read `/tmp/battle-audit-3852-rules.md` (5), `/tmp/battle-audit-3852-flow.md` (4), and this report (5), and followed the decisive source lines where needed. No confirmed item needs rejection. Scope/phrasing limits:

- Rules R1 strict queued action bypass, R2 gauge all-freeze deadlock, R3 random-AoE multiplication, R4 source HP/drain prediction, R5 state element prediction now have direct root engine evidence. The actual recorded numbers support those named cases. R5 physical/magic defense and emotion subcases remain source-confirmed unless separately probed; do not imply the element case runtime-reproduced every branch. R1 both actor/enemy directions are source-confirmed; direct fixture demonstrates actor direction. R2 has 2,100,000ms simulation with unchanged turn1/stateTurns1 and finite recovery contract; actual fixture is deliberately constructed all-survivor freeze, not proof this happens every battle.
- Flow1 capture transaction: source shows direct live-session mutation before cancellation and deferred item writeback. Needs actual capture+teardown observation before labeling user-visible reproduction. Do not imply ordinary accepted victory duplicates captures.
- Flow2 input prompt: missing AUTO ownership guard is definite, while wrong-next-actor technique execution depends on callback timing and next actor learning same skill. Keep these confidence levels separate. Active ATB timeout interruption is a related conditional path, not a second independent confirmed exploit.
- Flow3 result occlusion: settled normal/reduced screenshots plus computed intersection and rm2000 control are strongest visual evidence. Do not cite result-revealed.png, which is field after dismissal.
- Flow4 eligibility signature omits allies' readiness and resources. Strong source proof; root still needs menu-held Active ATB readiness reproduction to establish live visual impact. As soon as another keyed value (actor MP/phase/submenu) changes the panel rebuilds, so specify those remain unchanged.
- Data1 cast omission: current evidence proves collection and resolver defect. Render fallback preserves a generic caster; report loss of magic-specific casting poses, not entirely invisible actors or broken battle.
- Data2 cross-kind borrowing: selected monster/class contract is accepted but cannot enter caster-opposite runtime choreography path. Do not call this missing effect/damage: rules can remain correct and only presentation is lost.
- Data3 same-name: deterministic equipment-granted gunner/ranger example is stronger than broad 'all duplicate names fail'; original owned class disambiguation often works. Correct current signal is data-retro-class-skill (no trailing Id).
- Data4 three-hit: root engine confirmed. Only named/all explicitly multi-hit contracts without mechanics can be claimed; don't imply every roster skill or every finisher is wrong.
- Data5 backfill: direct roundtrip proved. Custom DB dependency closure, not old default-skin compatibility or overriding author's custom asset choice.

## Motion harness failures are stale expectations, not additional product bugs

- `scripts/qa/runtime/retro2003-frames.probe.mjs:178` demands actor center left of every enemy center. Current `src/battle/battlerPlacements.ts:122-127` explicitly has enemy left, party diagonal right and actors facing left. Captured party-right is correct.
- `:175` demands the union walk_a/walk_b/walk_c for every tested battle. Current styled approach uses reduced subsets. Flash `battleRetroMotion.ts:550` is attack_windup→walk_c→attack_strike; dash `:560` uses walk_a/walk_c, not walk_b; leap and blink do not need walk cycles.
- Actual pose-events union: attack, attack_follow, attack_strike, attack_windup, defend, evade, guard_hit, idle, victory, victory_b, walk_c. Only the old expected walk_a/walk_b are absent. First scout approach recorded attack_windup→walk_c→attack_strike, then attack_follow→evade→idle recover. The full union assertion is invalid independently of whether a short dash walk_a frame was missed by sampling. No missing attack windup/strike/follow or missing victory alternation found.
- Motion fixture still carries old authored mage charset-battler-actor3-0. Preserving that explicit old authored sheet is intentional; do not report current default mage rebinding as broken from this fixture.

## Shipping-player interaction evidence (root follow-up)

Read evidence `/home/main/.codex/worktrees/3852/rpg-zzu/verify-shots/battle-audit-2026-09-30/interactions/interactions.json` and producer `.omo/battle-audit-3852/interaction-probe.mjs`. This reviewer did not execute the producer or edit its outputs.

### Data2 cross-kind — actor borrowing monster contract corroborated in shipping player

- Fixture exposes actor_hero's `actor-skill-skill_audit_mon_borrow` menu row (`감사 산성 연출`, MP0).
- MutationObserver is attached to document.body before menu activation, watches child/attribute changes throughout 6.5 seconds after target confirmation, and samples `.battle-field.dataset.retroClassSkill` plus `.retro-class-fx[data-retro-skill-fx]`. Both observedSkillIds and observedFx are empty; errors=[].
- Expected borrowed contract is skill_mon_acid_spit and layer keys mon_acid_blob/mon_acid_splash. None appear. This is stronger than one late screenshot which could miss an already finished animation.
- Limit: producer's negative assertion alone cannot prove all animation or damage disappeared; it specifically corroborates the source-predicted absence of selected contract playback. There is no action-specific engine damage trace here. Enemy borrowing class contract remains source-confirmed, not separately shipping-reproduced.

### Data3 same-name — exact wrong choreography positively observed

- Fixture's actor_ranger menu contains both ranger 저격 MP12 and gunner 저격 MP6. Producer explicitly activates `actor-skill-skill_gunner_snipe`, then confirms target. Actor MP999→993 matches selected gunner skill's cost, not ranger skill's MP12.
- observedSkillIds=[skill_ranger_snipe], observedFx=[ranger_scope,ranger_arrow,ranger_power_hit], errors=[]. Expected gunner contract and gunner_scope never appear. Thus selected rule identity and played visual identity demonstrably differ in shipping player.
- This supports the equipment-granted same-name case. Broad statements that every duplicate name or normal class-owned skill fails remain unwarranted.

### Flow1 capture-cancel — numeric impact is supported, with scope limits

- Before capture: one monster instance/party member, item_capture_orb8. Immediately after successful capture: two distinct instances/party members, orbs8. New monster_2 is species_scarloxy_larvea; this is one newly owned monster, not a duplicate of the existing mossling.
- Producer calls real existing scene.battleAbortController.abort() (:29), confirms battle scene detached before reading final session (:30). abort=true; after cancellation: still two owned monsters and orbs8, errors=[].
- Accurate conclusion: a successful capture persists in the live session after real battle cancellation while its capture-item consumption is discarded. One additional owned monster is free in this reproducible cancellation route.
- Avoid claiming ordinary completed capture/victory duplicates monsters, canonical SQLite was written, a normal Escape key directly invokes this controller, or the fixture proves endless production farming without another user-reachable cancellation path. The demonstrated same-session abort lifetime is real; its exact UI reachability is a separate question.

### Flow2 input-auto — prompt ownership failure corroborated; wrong-actor outcome still conditional

- Before: strict actorCommand, busy=false, input prompt visible. After F: busy=true/director acting, AUTO=true/speed1.8, prompt still visible; hero MP999→987 and guardian999→969 indicate automatic actions consumed resources beneath the unresolved prompt. errors=[].
- This establishes AUTO proceeding underneath prompt. It does not yet demonstrate completion executing the old technique as a different actor; keep that branch needs-runtime-repro.

### Flow4 combo first attempt is inconclusive, not evidence the source defect was rejected

- Current interaction row has a 45s wait timeout. It initially records guardian ATB57% with combo inert=true; lastDom shows guardian ATB100% and same disabled reason. This is suggestive, but lastDom is sequenceBusy=true/enemy-acting and reopened comparison did not run.
- Do not mark this failed probe as successful reproduction. Wait for root's rerun with ready/settled and reopen comparison before promoting source finding.


## 감독자 최종 재현 판정

최종 기준은 `docs/2026-09-30-battle-adversarial-review.md`와 `rules-probe.json`, `interactions/interactions.json`이다. 2026-09-30 추가 상호작용 5개 모두 reproduced=true/errors0. combo 재실행도 ATB57→100 비활성 유지, 재개방 활성으로 확인됐다. 리뷰 원문의 source-only/needs-runtime-repro 표현은 해당 검토자가 작성한 시점의 범위이며, 후속 감독자 재현은 종합 보고서에 반영했다.
