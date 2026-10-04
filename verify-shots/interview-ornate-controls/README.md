# Cinematic interview controls — 2026-10-04

Production CSS uses a stepped gold frame, inset writing surfaces, metallic primary actions and clear focus/selected states. Decorations ignore pointer events. The native text fields, fixed footer and motion button retain their behavior and layout.

Browser verification: eight production-component checks passed, including 1024×768 button visibility, keyboard focus, reduced motion, cancellation, failed creation/storage/account handling, and complete confirmed-brief serialization. Auth, unavailable image service and final destination are synthetic; no canonical writes or actual AI execution were performed. See component-proof.json.

Preview verification separately covered both layouts at 1024/736/390/320, all four genre flows, custom/blended answers, light appearance and reduced motion, with no overflow or script errors. The preview remains a mockup.

Reproduction, using the assigned worktree dev server:

```sh
LAUNCHER_INTERVIEW_CAPTURE_DIR=verify-shots/interview-ornate-controls node scripts/qa/launcher-interview-flow.mjs
```

No local gates, Vitest or full typecheck were run under the session restriction.
