## Proposed amendment: G1-F20 transfer command integrity

Status: verified GREEN (U03). Lead applies this text; no shared wiki/Design/snapshot file was edited.

- Transfer picker equality is against the latest emitted command, not the opening command. A -> B -> A restores A in the staged command.
- Apply paths patch the existing command, retaining authored optional `transition` and untouched fields. Valid transition values are `fade`, `mosaic`, and `blinds`; there is no authored transfer duration field in this schema.
- The enclosing command dialog remains the sole page-command Confirm authority. Map commands still require event Apply; Cancel discards live picker edits.
- Regression proof: original two RED cases and seven characterizations retained; three standalone transition cases added; related tests 13/13 GREEN.
- Real editor: fresh Firefox context, local fixture, Space to edit the selected command, A -> B -> A, Confirm/Apply, reopen, wire-JSON export mirror and real filechooser import, direction-only edit, Cancel.
- Real player: dedicated `player.html` in Chromium loads the editor's exported JSON. Real Z transfers to mapA/(2,3), facing left or up according to the saved command; wrong-mapB assertions reject. Observations are registered before input and released on completion/timeout.
- Evidence: `.omo/evidence/event-command-remediation/U03/manifest.json`; local screenshot hashes recorded there. Full build/gates remain lead-owned.
