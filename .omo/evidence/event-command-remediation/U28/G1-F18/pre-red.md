# G1-F18 text-tool contract before RED

Base: `a9dcbf32c`. This slice covers G1-F18 only; other U28 findings remain open.

Initial fixture: `Hello world`, caret at offset 5, speaker `Narrator`, emotion
`happy`. Actor 1 is First Hero, actor 2 is Other. Variables `var_0001` and
`var_0002` are named First value and Reward, with values 11 and 29.

First RED command:

```sh
npm test -- test/eventCommandRemediation/U28.test.ts --maxWorkers=2 --reporter=verbose --reporter=json --outputFile=.omo/evidence/event-command-remediation/U28/G1-F18/red.json
```

Open the real command dialog. Click `event-command-text-tool-hero-name` or
`event-command-text-tool-variable`. Before a selection, the body must remain
unchanged. Choose `event-record-picker-row-2`, then `event-record-picker-ok`.
Expected body: `Hello\n[2] world` or `Hello\v[2] world`, retaining metadata and
placing the caret after the token. Confirm and production serialize/deserialize
must preserve it. The real interpreter and `resolveDialogueText` must produce
`HelloOther world` or `Hello29 world`, never the first record.

Before completion, extend verification for a selection range, picker Cancel,
IME-completed text, both tools in sequence, new canonical variable creation,
unsupported custom variable IDs and shadowed legacy aliases. Unsupported
variables must be visibly disabled rather than mapped to a wrong slot. Existing
numeric grammar and its alias priority must not change.

Account for native text, the M2-001 picker producing native text, and loaded
M2-209 normalization preserving speaker/emotion/autoAdvance. Do not convert
persisted M2-001 wrappers or change their U12 compatibility contract.

Real-surface acceptance uses the existing H0 map editor with visible controls:
Confirm, parent Apply, reopen, Cancel, actual file import and standalone
`player.html` rendering the editor-exported text. Capture focus and geometry at
1024x768, 1280x800 and 1440x900. Subscribe before triggers, with bounded timeouts;
no sleeps or polling. Source-only fixtures, no remote project writes.
