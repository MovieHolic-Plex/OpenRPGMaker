# Detailed authoring preset delivery evidence

The packaged editor completed its production romance interview and automatically sent a real team request using the configured Gemini provider. Responses and tool results were not mocked. The request contains 40,114 characters, including the complete common (6,491 characters) and romance (7,632 characters) manuals, original answers, edited summary, protagonist and additional notes. The user-facing chat continues to show only the short authored direction.

`provider-prompts.json` retains the unmodified first `prompt_inspection` event for the orchestrator and builder from `provider-events.json`. Both events describe the provider-normalized outbound payload. The inspection UI caps its displayed payload at 80,000 characters; omitted counts describe that display cap. Both manuals' complete text and begin/end markers are inside the captured portions. `delivery-proof.json` compares every source character, rather than accepting a hash or title alone.

Reproduce the delivery comparison with:

```sh
node scripts/qa/verify-detailed-authoring-delivery.mjs
```

Observed native writes were `set_project_settings`, `upsert_actor`, and `set_map_properties`. The saved protagonist is 지우 and the first map is named 별빛 우체국 앞. The exact interview brief and project id were read again from the same SQLite store after reload:

- Project id: `c7f38230-0a66-4ffb-8f6b-d87c7132f695`
- Store: `output/qa/detailed-authoring-live/project/.oprn-projects/591750e4-afaf-4722-9529-a9ac36fb198c/project.sqlite`
- Folder id and project id are distinct host identifiers.

Screenshots:

- `confirmed-direction.png` / `confirmed-mobile.png`: actual interview before confirmation.
- `assistant.png`: actual model execution, protagonist edit and map-name change.
- `reloaded-ready.png`: saved project after the boot loader disappeared. `reload-ui-proof.json` records the second browser load and its lack of page errors.

## Limits and failed checks

The capture stopped the model after its first map-property write. This verifies full preset delivery and initial real application; it does **not** verify a finished romance scene, NPC placement, distinct choice branches, pixel-art generation, or runtime play. The unchanged engine seed still contains two maps; preserving the new prompt does not prove that the model reconciled that seed with the requested one-map scope. Conversation persistence was not established by this run.

`report.json` has `passed: false`: the initial Chromium run recorded `Framebuffer status: Incomplete Attachment`. The separate full-text delivery check passes, and a subsequent browser reload recorded no page errors. The first two Firefox attempts timed out during browser interaction before a successful delivery capture. Do not describe this evidence as all visual/runtime QA passing.

The packaged build completed successfully. The independent contract audit in `../detailed-authoring-presets/contract-report.json` checks all four genre manuals, 60 choices, 12 ordered mixed-genre combinations, and acyclic task dependencies. `role-context-report.json` uses production prompt constructors with a fixture for builder/reviewer; it is not an additional live reviewer call. `viewer-qa.json` covers the evidence viewer at 320px and 736px. Broad repository test suites were not run.
