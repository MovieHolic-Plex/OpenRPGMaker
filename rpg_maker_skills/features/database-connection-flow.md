# Database Connection Flow

This is not a content skill. It is an app/product feature.

## Purpose

Make project persistence understandable and screenshot-proof.

## Required States

- Remote DB ready.
- Remote DB saving.
- Remote DB saved.
- Remote DB failed.
- Local fallback active.
- Dev showcase remote disabled.
- Unsaved local changes.

## UI Requirements

- Status badge with plain language.
- Details popover explaining where data is saved.
- "Test connection" action.
- "Reload from remote" action.
- "Export local fallback" action.

## Why It Is Not A Skill

Persistence state comes from environment, store behavior, network results, and save/reload paths. A skill can document expected behavior, but the editor must expose it.
