# Skill Or Feature Decision Map

This file maps the game-quality improvements into either reusable authoring skills or app/editor features.

## Decision Rule

Make it a skill when:

- the work is a repeatable authoring recipe,
- it can be applied through existing editor controls,
- it teaches another agent how to create better content,
- and it does not need new persistent app UI.

Make it an app feature when:

- creators need to see or edit state directly,
- the feature needs project schema or runtime hooks,
- the feature changes persistence or validation,
- or manual authoring would be too fragile.

## The 10 Improvements

| Improvement | Classification | Location | Why |
|---|---|---|---|
| Quest/objective editor | App feature | `features/quest-editor.md` | Needs quest schema, UI, event generation, and validation. |
| Event chain/flow graph | App feature | `features/event-flow-graph.md` | Needs live command graph editing and dependency visualization. |
| NPC role presets | Skill-owned | `skills/npc-role-kit/SKILL.md` | AI-driven NPC creation belongs in the skill. App code may expose editor affordances, but it must not become the source of NPC preset logic. |
| Reward/growth editor | Skill first, app feature later | `skills/reward-and-growth-loop/SKILL.md` | Reward patterns are authorable now; a future UI can automate them. |
| Battle tuning panel | Skill first, app feature later | `skills/encounter-balance-kit/SKILL.md` | Balance rules can guide DB edits today; advanced tuning needs UI later. |
| Map purpose tools | Skill first, app stamp feature later | `skills/map-purpose-stamps/SKILL.md` | Layout grammar works as a skill; stamp palettes can automate it later. |
| Interaction object editor | Skill first | `skills/interaction-object-kit/SKILL.md` | Event page recipes should stay skill-owned; UI may assist applying them without owning the recipe. |
| Playtest inspector | App feature | `features/playtest-inspector.md` | Needs runtime/editor bridge, switches, variables, command trace. |
| Dialogue direction tools | Skill first, app helper later | `skills/dialogue-scene-direction/SKILL.md` | Writing and pacing can be guided now; live preview can follow. |
| Demo template generator | Skill-owned | `skills/playable-demo-template/SKILL.md` | The full loop should remain an AI authoring skill; app code should only provide surfaces for applying or inspecting the authored result. |

## Missing From The Previous Demo

The previous demo failed as a game because it had:

- no explicit quest state,
- no reward that changed future play,
- no object interaction,
- no exploration structure,
- no post-battle aftermath,
- and no inspector surface to understand event state.

The first upgrade path is:

1. Use `skills/playable-demo-template`.
2. Apply `skills/quest-loop-template`.
3. Add `skills/interaction-object-kit`.
4. Add `skills/reward-and-growth-loop`.
5. Verify with future `features/playtest-inspector.md`.
