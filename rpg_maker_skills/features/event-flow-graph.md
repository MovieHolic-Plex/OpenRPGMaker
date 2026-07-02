# Event Flow Graph

This is not a skill. It is an editor feature because it visualizes and edits project event commands.

## Purpose

Show game logic as connected nodes instead of a long command list.

## Nodes

- Dialogue
- Choice
- Switch
- Variable
- Condition branch
- Transfer
- Battle
- Reward
- Shop
- Game over
- Common event

## Required Behaviors

- Select a node and highlight the original event command.
- Drag to reorder where safe.
- Show branches as separate lanes.
- Warn on unreachable commands.
- Show switch/variable dependencies.

## Why It Is Not A Skill

The feature needs live AST/project command editing, graph layout, selection sync, and validation. A skill can recommend event shapes, but it cannot replace the UI.
