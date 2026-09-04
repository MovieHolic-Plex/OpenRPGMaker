# Autonomy dial — browser evidence

Worktree: `worktree-lucky-stone-e5b4-autonomy-dial-p3` · dev server `http://127.0.0.1:9845`
(port 9841 was already serving the base tree, so a dedicated server on 9845 was used;
capture script takes `BASE=`).
Script: `verify-shots/autonomy-dial/capture-autonomy-dial.mjs`
(`BASE=http://127.0.0.1:9845 node verify-shots/autonomy-dial/capture-autonomy-dial.mjs`)

What was proven (DOM-read values, script asserts each transition before screenshotting):

- Initial: `autonomy=balanced, reasoning=low, agentMode=auto`
- After `selectOption("max")`: `reasoning=high, agentMode=auto` (waitForFunction on the
  reasoning select, then strict equality assert)
- After `selectOption("confirm")`: `reasoning=low, agentMode=chat` (waitForFunction on the
  agentMode select, then strict equality assert)
- Persisted: `oprn:ai-config` in localStorage holds
  `reasoningEffort=low, agentMode=chat, autonomyLevel=confirm` (see `evidence.json`)

## Shots

- `01-dial-render.png` (behavior-section crop, 578x418) — the settings modal renders the
  `ai-config-autonomy` dial inside the behavior section alongside reasoning/agentMode selects.
- `02-dial-max-sync.png` (same crop) — dial set to max; visible labels synced to
  reasoning=high + agentMode=auto.
- `03-dial-confirm-sync.png` (same crop) — dial set to confirm; visible labels synced to
  reasoning=low + agentMode=chat.
- `04-settings-modal-full.png` (full page 1440x900) — full settings modal context with the
  dial at confirm.
- `evidence.json` — machine-readable values (`afterMax`, `afterConfirm`, stored config,
  shot manifest with bounding boxes).
