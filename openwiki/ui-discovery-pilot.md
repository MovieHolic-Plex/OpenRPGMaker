# Screenshot-only editor discovery pilot

This is an exploratory agent usability pilot, not a human-speed benchmark or
statistically significant comparison. Run identical instructions on independent
before/after subjects before using a result to justify a UI change.

## Contract

- Four tasks: pan without changing map content, enter event-editing mode, open
  current-map properties, open the game database.
- Standard editor, 1440x900, `?freshProject=1`, separate browser context per task.
  The harness asserts remote persistence is disabled. Do not substitute a user's
  remotely saved project.
- Subjects see screenshots only. No source, DOM, accessibility names, repository
  instructions, parent conversations, other task results or application-state hooks.
- Each task uses a fresh isolated Senpi session with `opencodex/gpt-6-astra:high`.
  Tools, extension discovery, skills and context files are disabled. The browser
  driver executes one returned action and sends the resulting screenshot.
- The supervisor privately captures camera state, editor tool/layer, current map,
  visible dialogs and an authored-map hash. A subject's claim is not a success
  detector. Selecting Pan alone does not qualify: the viewport must move without
  changing the map hash.
- Maximum 240 seconds, 15 input actions, 30 controller calls. Model reasoning,
  CLI startup and tool latency are included in wall time; report action counts
  separately. Task duration is not human task-completion time.

## Run

Start an isolated worktree dev server, then use the actual installed Senpi CLI
path. Do not use the OmO wrapper: it explicitly injects its plugin even when
extension discovery is disabled.

```sh
UI_DISCOVERY_CLI=/absolute/path/to/senpi/dist/cli.js \
UI_DISCOVERY_URL=http://127.0.0.1:9867 \
node scripts/qa/run-ui-discovery-pilot.mjs before

# After one evidence-justified change, or unchanged repeat when none is justified:
UI_DISCOVERY_CLI=/absolute/path/to/senpi/dist/cli.js \
UI_DISCOVERY_URL=http://127.0.0.1:9867 \
node scripts/qa/run-ui-discovery-pilot.mjs after
```

Requires installed Bun, Senpi and Chrome. `CHROME_PATH` selects Chrome;
`UI_DISCOVERY_OUTPUT` selects a new evidence root. Preserve earlier runs rather
than silently overwriting them. The driver closes browser contexts and removes
its temporary subject sessions in `finally`; stop the separately owned server.

The current screenshot controller uses the same-origin GET relay from
`scripts/qa/sidebar-focus.mjs` to isolate host Chromium network churn. The real
browser executes the unchanged application. This does not validate remote DB or
provider behavior in the editor.

## Score and decide

For each trial, inspect `trace.json`, numbered PNGs, raw `subject-*.json` responses,
`browser-trace.zip` and cleanup receipts. Report the exact first action, inputs to
the first independently verified target state, wrong actions, neutral exploration,
no-ops and time. A wrong action invokes an unrelated/incompatible function or
changes content; opening a container on a valid route is neutral exploration.
Recovery from a wrong action is not a second wrong action.

Choose at most one pinpoint change by task failure, then wrong-action count, then
neutral/no-op count. Require a visible affordance problem in the trace, not merely
a long model pause. Freeze task wording and the change before new after subjects.
If no problem is supported, make no product change and run an unchanged repeat.
Do not claim a fix from an inconclusive or invalid transport trial.

## Image capability trap

A non-vision warning from Senpi's `read` tool comes from the selected model's
`input` metadata, not an upstream rejection. Custom model definitions without
`input` default to `["text"]`. Set `["text", "image"]` on the actual selected
provider/model, refresh it, then verify an actual image response. A different
provider's same-named model does not repair the selected definition.

Noninteractive CLI probes need closed stdin. An inherited open stdin can wait
silently before inference. The runner uses `stdio: ['ignore', 'pipe', 'pipe']`.
Do not classify such infrastructure failures as UI discovery failures.

## 2026-09-08 pilot result

Source: `d79e602ea`. Eight independent task sessions, four before and four new
subjects on an unchanged repeat. All eight reached the actual target state in
one input, with zero wrong actions and unchanged authored-map hashes.

| Task | First action in both cohorts | First-effect wall seconds, first / repeat |
| --- | --- | --- |
| Pan | Middle-button drag | 25.278 / 17.962 |
| Event editing | Event layer tab | 22.259 / 14.122 |
| Current-map properties | Map settings button | 11.862 / 11.694 |
| Database | Topbar data-library button | 10.212 / 18.887 |

No product UI change was supported by this small sample. These times include
model/tool overhead, and the repeat ran beside gates/build; they do not establish
a speed improvement. Both pan subjects bypassed the icon using a familiar mouse
gesture, so neither pan-icon recognition nor long-press UX was evaluated.

Independent supervisor browser QA confirmed pan without mutation in paint/event
modes, properties/database open and Escape-close, and visible hit-testable targets
at 1024x768 and 1440x900. Canvas widths were 718px and 1134px respectively.

Local evidence: `output/evidence/ui-discovery-v2/report.html`, both cohort
`results.json` files, per-trial screenshots/traces and cleanup receipts, plus
`direct/RESULTS.json`. Earlier `output/evidence/ui-discovery` is unscored transport
preflight, not a failed UI trial. Runtime evidence is retained locally, not bundled
into Git. The report rendered in Chrome with all 11 images and no page overflow.
