# Runtime Capture Hooks

This is not a content skill. It is runtime/test infrastructure.

## Purpose

Make visual QA stable when the runtime uses typewriter text, transitions, battle start animations, or delayed canvas rendering.

## Hooks

- dialogue visible
- dialogue text completed
- battle scene ready
- actor command ready
- map canvas first nonblack frame
- event command trace changed
- quest state changed

## Test IDs

Expose stable, hidden debug surfaces for:

- current dialogue text,
- current battle phase,
- current event id,
- last completed command,
- current quest states.

## Why It Is Not A Skill

This requires runtime instrumentation and Playwright-visible state. A skill can ask for better screenshots, but hooks make them reliable.
