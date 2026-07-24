---
kind: error_handling
name: No Centralized Error Handling System Found
category: error_handling
scope:
    - '**'
---

After investigating the RPG ZZU monorepo, no centralized error handling system was found. The codebase does not define custom error classes (no `class X extends Error` patterns), has no dedicated errors package or directory, and shows no consistent pattern for structured error propagation. Error usage appears scattered — test files in `evals/` reference an `error` field on result objects, and a few scripts throw generic `new Error(...)` instances, but there is no repository-wide convention for sentinel errors, typed error types, middleware-based error wrapping, or panic/recover strategies. This category does not apply to this repo.