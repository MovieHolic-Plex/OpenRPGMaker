# Playtest Inspector

This is not a skill. It is a runtime/editor feature.

## Purpose

Help creators understand why a playtest works or fails.

## Panels

- Current map and player tile.
- Active event id.
- Last event command.
- Switches changed this session.
- Variables changed this session.
- Current quest state.
- Party HP/MP/status.
- Last battle result.
- Save-slot/local/remote persistence status.

## Debug Actions

- Jump to current event in editor.
- Toggle selected switch.
- Set variable value.
- Restart from current map.
- Export runtime trace.

## Why It Is Not A Skill

It needs runtime hooks and live project state. A skill can tell an agent what to inspect, but creators need this in the app.
