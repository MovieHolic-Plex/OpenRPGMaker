---
name: npc-role-kit
description: Use this RPG Maker authoring skill when creating NPCs with functional game roles such as quest giver, guide, merchant, gatekeeper, trainer, healer, rumor source, or encounter trigger.
---

# NPC Role Kit

Create NPCs as game systems, not decoration.

## Source Of Truth

Keep NPC role presets in this skill. Do not invent a parallel TypeScript preset catalog or hardcoded NPC generator as the authority for AI-authored content.

App code may store the final authored event data, render it, validate it, or expose controls that help apply this skill. The role recipe, required state, dialogue shape, and completion behavior belong here.

## Roles

Quest giver:

- Gives a clear task.
- Tracks started/completed states.
- Changes dialogue after completion.

Guide:

- Points to landmarks and controls player uncertainty.
- Uses short text and directional words.

Gatekeeper:

- Blocks progress until a condition is met.
- Explains the required condition.
- Changes passability or transfers after unlock.

Merchant:

- Opens shop or item reward loop.
- Has one sentence of context so the shop belongs to the world.

Trainer:

- Teaches skill or explains combat mechanic.
- Pairs instruction with immediate use.

Healer:

- Restores party and marks safe zone.
- Should be visually near a landmark.

Encounter trigger:

- Starts battle intentionally.
- Has pre-battle warning and post-battle consequence.

## Authoring Rule

Every NPC needs:

- a role,
- a first line of intent,
- a state change or useful information,
- and a changed line after the player advances the quest.

## Event Output Contract

When authoring an NPC through the editor, produce an event with:

- one clear role from this kit,
- an action trigger unless the role requires touch or autorun,
- visible character graphic and optional face graphic,
- first-contact dialogue that names intent,
- switch or variable state when the NPC changes the world,
- a later page or conditional branch that proves the state changed,
- and a short post-change line.

Decorative townspeople may skip state change only when their useful information directly guides movement, a landmark, a mechanic, or the current objective.
