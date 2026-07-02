# Quest Editor

This is not a skill. It is an app feature because it needs project schema, editor UI, event generation, and runtime state inspection.

## Purpose

Let creators build a quest without manually wiring every switch, page, reward, and reminder dialogue.

## Core UI

- Quest list.
- Quest detail panel.
- Objective editor.
- Start/completion switch binding.
- Required condition selector.
- Reward selector.
- Linked NPC/event picker.
- Generated event page preview.

## Data Model

Quest:

- id
- title
- description
- startedSwitchId
- completedSwitchId
- objective
- giverEventId
- targetEventIds
- rewards
- nextQuestIds

## Generated Editor Output

The editor should be able to generate:

- quest giver pages,
- reminder page,
- target completion event,
- reward command block,
- post-completion dialogue page.

## Why It Is Not A Skill

A skill can describe a quest pattern, but it cannot provide persistent quest state, UI validation, event-page generation, or runtime debugging.
