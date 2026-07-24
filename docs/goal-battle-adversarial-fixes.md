# Ultrawork Goal — Battle-area adversarial review fixes

Fix all 14 findings (C1, H1-H5, M1-M6, L1-L5) from the prior battle-area adversarial
review of `src/battle/`, proving each fix with failing-first evidence (RED→GREEN), a
real-surface or unit proof per criterion, and mid-stream adversarial reviewer approval.
No production behavior change without a captured failing-first proof preceding it.

## TIER: HEAVY
C1 changes battle state-machine control flow (recursion→iteration with round cap =
control-flow boundary); H4/H5 touch save/load determinism (session RNG stream) =
"carefully"-class correctness; multi-file cross-cutting; user demanded adversarial reviewer.

## SUCCESS CRITERIA (literal scenario + binary observable + failing-first proof + evidence)

- **SC1 (C1)**: `createBattleRuntime` strict + both actors asleep (no-recover) + neuter enemy
  → no RangeError, snapshot.phase ∈ {charging,actorCommand,roundResolve,resolved}. RED: repro
  asserts `expect(threw).toBeInstanceOf(RangeError)` on current. GREEN: `toBeUndefined()` + phase ok.
- **SC2 (H1)**: `applySkillLike` twice with fixed rng → identical deterministic amount (no ±15%). RED: differs. GREEN: equal.
- **SC3 (H2)**: strict troop page `wait(ms)` honored OR logged unsupported. RED: neither. GREEN: chosen path.
- **SC4 (H3)**: strict m2-108 actionTimes grants extra action OR logged unsupported. RED: neither. GREEN: chosen path.
- **SC5 (H4)**: `createBattleRuntime` without rng THROWS. RED: silent. GREEN: throws; 2 callers updated.
- **SC6 (H5)**: `applySkillLike`/`applyStateEffects`/`collectBattleRewards` without rng → no Math.random, deterministic or throws. RED: Math.random. GREEN: chosen path.
- **SC7 (M2)**: `predictAttackDamage` uses snapshot level not DB initialLevel. RED: level-1 for level-10. GREEN: level-10.
- **SC8 (M2)**: `predictSkillDamage` includes equipment elemental defense (0.5). RED: ignores. GREEN: half.
- **SC9 (M3)**: `simulateBattle` does not mutate project.system flags. RED: mutates. GREEN: unchanged.
- **SC10 (M5)**: heal target not "hit" pose, caster not "attack" pose. RED: attack/hit. GREEN: idle/defend.
- **SC11 (M6)**: successful capture appends to actionLog. RED: absent. GREEN: present.
- **SC12 (M4)**: enemy recenter code exists OR wiki claim removed. RED: neither. GREEN: one true.
- **SC13 (L5)**: `vitest run test/battle*.test.ts test/action*.test.ts test/monsterBattlerField.test.ts` → 0 failures. RED: 3 fail. GREEN: 0.
- **SC14 (M1)**: runtime.ts decomposed; strict-flow extraction folded into C1; new modules ≤250 LOC. RED: 1277>250. GREEN: split.
- **SC15 (reviewer)**: adversarial reviewer child approves (only notes remain), max 2 re-reviews. GREEN: approval recorded.

## CLEANUP
Every temp file (throwaway repros) removed; no servers/tmux/ports. Receipts in notepad.

## WHEN TO STOP
Stop right away when all 15 criteria PASS with evidence captured in the notepad, all cleanup
receipts recorded, the full battle test suite is green (0 failures), and the adversarial
reviewer has approved.
