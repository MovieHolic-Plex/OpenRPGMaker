# Implementation Roadmap

This roadmap orders the work so the editor becomes better at making games, not just better at exposing controls.

## Phase 1: Better Demos Without App Changes

Use the new skills with existing editor controls.

Deliverables:

- One quest giver NPC.
- One interactable object.
- One gated encounter.
- One reward.
- One post-completion state.

Use:

- `skills/playable-demo-template`
- `skills/quest-loop-template`
- `skills/npc-role-kit`
- `skills/interaction-object-kit`
- `skills/reward-and-growth-loop`
- `skills/encounter-balance-kit`
- `skills/map-purpose-stamps`
- `skills/dialogue-scene-direction`

Success:

- The player can state their goal.
- The player can complete the goal.
- The world visibly changes afterward.

## Phase 2: Editor Presets

Add UI shortcuts that generate common event structures.

Build:

- NPC role presets.
- Chest/locked door/switch/heal point templates.
- Quest giver page generator.
- Reward command block generator.
- First battle template.

Success:

- A creator can add a basic quest loop in minutes without manually remembering switch/page structure.

## Phase 3: Core Product Features

Build the app features that cannot be solved by skills.

Build:

- `features/quest-editor.md`
- `features/playtest-inspector.md`
- `features/database-connection-flow.md`

Success:

- Creators can see quest state, persistence state, and event execution state while testing.

## Phase 4: Visual And Logic Tooling

Build the advanced editor surfaces.

Build:

- `features/event-flow-graph.md`
- `features/responsive-database-workbench.md`
- `features/runtime-capture-hooks.md`

Success:

- Event logic is visible.
- DB editing works at screenshot and narrow widths.
- Automated visual QA captures stable runtime states.

## Phase 5: Demo Generator

Turn `skills/playable-demo-template` into a wizard.

Inputs:

- theme,
- quest type,
- map size,
- enemy role,
- reward type.

Output:

- map structure,
- NPCs,
- object interactions,
- event pages,
- DB records,
- playtest checklist.

Success:

- A new project can become a playable 5-10 minute RPG slice from the editor, then be customized.
