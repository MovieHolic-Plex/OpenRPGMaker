---
name: interaction-object-kit
description: Use this authoring skill when adding interactable map objects such as treasure chests, locked doors, switches, signs, healing points, traps, levers, key items, or one-time pickups.
---

# Interaction Object Kit

Use object interactions to make the map feel playable.

## Object Patterns

Treasure chest:

- Page 1: closed graphic, action trigger, gives reward, turns on chest switch.
- Page 2: open graphic, conditioned on chest switch, says it is empty.

Locked door:

- Page 1: no key condition, explains lock.
- Page 2: key condition met, consumes/keeps key, opens or transfers.

Switch/lever:

- Page 1: flips switch and changes map state.
- Page 2: shows activated state.

Sign:

- Gives map goal, warning, or world flavor.
- Keep to one or two lines.

Healing point:

- Restores HP/MP and gives short feedback.
- Should communicate safety visually.

Trap:

- Warn, trigger damage/state/battle, then set a one-time switch if needed.

## Quality Bar

An interaction object should answer one question:

- What did I get?
- What opened?
- What did I learn?
- What danger did I trigger?
