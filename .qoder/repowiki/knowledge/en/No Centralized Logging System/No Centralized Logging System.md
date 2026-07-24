---
kind: logging_system
name: No Centralized Logging System
category: logging_system
scope:
    - '**'
---

This repository does not implement a centralized logging system. Across the codebase, logging is ad hoc: most modules use bare `console.log`, `console.warn`, and `console.error` calls directly (e.g., in `src/app/mode.ts`, `src/assets/bundled.ts`, `src/assets/tileGraftImageCache.ts`, `src/editor/mapEditLocks.ts`, and all eval scripts under `evals/`). There is no dedicated logger module, no structured log framework (winston/pino/bunyan/debug), no log-level configuration, and no central sink or rotation strategy. The only structured output related to logging is the AI activity log (`src/ai/activityLog.ts`), which persists AI-assistant interactions to the database rather than serving as a general-purpose application logger. As a result, this category does not apply — there is no logging system to document.