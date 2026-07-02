---
name: quest-loop-template
description: Use this RPG Maker authoring skill when creating or improving short playable quests with a clear objective, trigger NPC, completion condition, state switch/variable, reward, and closure dialogue.
---

# Quest Loop Template

Use this skill to turn a flat demo into a playable RPG loop.

## Required Shape

Every quest must have:

1. Hook: why the player should care.
2. Objective: one concrete action.
3. Gate: an obstacle, locked path, enemy, missing item, or condition.
4. Completion condition: switch, variable, item count, enemy defeated, or map reached.
5. Reward: item, gold, skill, stat, unlock, or story change.
6. Closure: the world acknowledges completion.

## Editor Authoring Pattern

Use visible editor controls only:

- Create a quest giver NPC event.
- Add text explaining the problem.
- Set a quest-start switch.
- Add a target event or battle event with condition checks.
- Set a quest-complete switch or variable.
- Add reward commands.
- Add post-completion dialogue page conditioned on completion.

## Minimum Quest Pages

Quest giver:

- Page 1: no quest switch. Offers quest and turns on `quest_started`.
- Page 2: `quest_started` on, `quest_complete` off. Reminds objective.
- Page 3: `quest_complete` on. Gives closure.

Target object/enemy:

- Page 1: `quest_started` on, `quest_complete` off. Performs task and sets complete.
- Page 2: `quest_complete` on. Shows depleted/finished state.

## Quality Bar

Pass only if the player can explain:

- what to do,
- where to go,
- why it changed,
- what reward they received,
- and what is now different in the world.
