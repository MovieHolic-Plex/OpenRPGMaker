# CPEN OpenWiki

Use `npm run openwiki:cpen` to generate or refresh OpenWiki content through the CPEN router.

The output should maintain the AI-facing project wiki structure, especially `openwiki/PROJECT_WIKI.md` and `openwiki/ai-workflow.md`. These files are the bridge between project-specific OpenWiki content and agents that need to edit the repo safely.

## Required config

- Set `CPEN_API_KEY` in your shell or local env file; do not commit or store the secret in the repo.
- Set `OPENAI_BASE_URL=https://cpenrouter.space/v1`.

## Compatibility notes

- Requests should run in non-stream mode.
- The wrapper strips `stream` and `stream_options` before sending requests because CPEN v1 currently rejects `stream` even when it is `false`.
- The wrapper strips `messages.name` because CPEN v1 currently treats that optional OpenAI compatibility field as unsupported.

## Output limits

- Keep the total message content under the `128,000` character budget for the full run.
- Prefer page-by-page generation instead of trying to emit the whole wiki in one pass.
- Generate one page, verify it, then continue with the next page to reduce truncation risk.

## Practical tips

- Treat `CPEN_API_KEY` as a runtime-only credential.
- Reuse `OPENAI_BASE_URL` consistently across runs and let the wrapper handle non-stream compatibility.
- If a page gets large, split it before continuing.
- After refreshing pages, run `npm run openwiki:verify` and update `AGENTS.md` if the required pre-edit read order changes.
