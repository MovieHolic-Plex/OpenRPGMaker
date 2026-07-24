---
kind: configuration_system
name: Vite + .env-based Runtime Configuration
category: configuration_system
scope:
    - '**'
source_files:
    - .env.example
    - vite.config.ts
    - vite.player.config.ts
    - vitest.config.ts
    - evals/vitest.config.mjs
    - evals/run.mjs
    - playwright.config.ts
    - src/ai/llmClient.ts
    - src/ai/modelCatalog.ts
---

RPG ZZU uses a lightweight, Vite-centric configuration system with no dedicated config library. Environment and build-time settings are layered across several files:

Environment variables (.env)
- .env.example documents the required keys: DEV_SERVER_PORT, VITE_LLM_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_PROJECT_ID, VITE_SUPABASE_ANON_KEY.
- The evals runner (evals/run.mjs) implements its own minimal .env.local loader (no dotenv dependency) to inject VITE_LLM_API_KEY, VITE_LLM_MODEL, VITE_LLM_API_URL, EVAL_TASKS, etc. into process.env before invoking Vitest.

Vite build/dev configuration
- vite.config.ts - editor dev server: reads DEV_SERVER_PORT via loadEnv(mode, cwd, ""), sets up a /api/ai proxy to https://yunwu.ai/v1, exposes an output/ai-activity disk-mirror middleware, and pins resolve.alias["@"] to ./src.
- vite.player.config.ts - standalone player build: strips editor-only modules via path aliases to shims under src/player/export*Shim.ts, outputs to dist/export-player.
- vitest.config.ts / evals/vitest.config.mjs - separate test roots; evals suite is excluded from the default run and requires --config evals/vitest.config.mjs.
- playwright.config.ts - e2e tests read DEV_SERVER_PORT from process.env and start the dev server via npm run dev -- --host 127.0.0.1 --port ${DEV_SERVER_PORT} --strictPort.

Runtime application config (browser localStorage)
- src/ai/llmClient.ts defines the runtime AiConfig shape (authMode, baseUrl, model, liteModel, apiKey, maxToolCalls, maxTokens, reasoningEffort, autoApprove).
- Defaults come from defaultAiConfig(), which reads browser env vars via import.meta.env.VITE_LLM_API_KEY / VITE_YUNWU_API_KEY / VITE_LLM_API_URL (guarded by try/catch for non-Vite runtimes).
- User overrides persist in localStorage["rpg-zzu:ai-config"]; loadAiConfig() merges stored values over defaults with strict type guards.
- A configForLiteModel() helper produces a reduced-cost variant for tool-call loops, and configWithReasoningPolicy() caps reasoning effort for long-context models.

Node-side defaults & model catalog
- src/ai/modelCatalog.ts ships a static registry of supported model IDs grouped by auth mode (ChatGPT OAuth vs API-key gateway); it has no external config file.

Conventions developers should follow
- Never hardcode secrets in source. Secrets enter the browser only through VITE_* env vars injected by Vite; Node-side scripts load them from .env.local via the evals runner.
- New runtime toggles belong in AiConfig and must be merged through loadAiConfig() so user overrides survive reloads.
- Build-time switches go in vite.config.ts / vite.player.config.ts using loadEnv(mode, ...) rather than direct process.env reads.
- Tests that need LLM access must use evals/vitest.config.mjs and set VITE_LLM_API_KEY; the default Vitest config excludes live Supabase-dependent suites.