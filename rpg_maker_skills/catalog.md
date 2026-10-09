# Authoring Skills Catalog

This directory separates RPG-making knowledge into two buckets:

- `skills/`: reusable authoring packages that another agent can apply today to create better RPG content through the editor.
- `features/`: product/editor capabilities that must be implemented in the app because they require UI, runtime state, persistence, or inspection tools.

Existing packages under `building/` and `tilesets/` remain asset/reference skills. New packages under `skills/` focus on game structure and play loops.

## Classification

| Need | Put it in | Reason |
|---|---|---|
| Quest structure, NPC roles, rewards, encounters, map purpose, dialogue scenes, demo templates | `skills/` | These are reusable authoring recipes. They can guide content generation without changing app code. |
| Quest editor, event graph, playtest inspector, DB connection flow, responsive DB modal, runtime capture hooks | `features/` | These need editor UI, project schema, runtime hooks, persistence, or viewport behavior. |

## Priority

1. Build the `features/quest-editor.md` product surface first.
2. Pair it with `skills/quest-loop-template` and `skills/reward-and-growth-loop`.
3. Add `features/playtest-inspector.md` so authored loops are debuggable.
4. Use `skills/playable-demo-template` to generate a real first 10-minute RPG loop.

## Definition Of A Better Demo

A demo should not stop at "NPC says text, battle starts." It should contain:

- a visible goal,
- a reason to move through the map,
- at least one gate or obstacle,
- a state change,
- a reward,
- a return or consequence,
- and a way for the creator to inspect why it works.
