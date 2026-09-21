# Reviewed default places

The prior registration only saved library records in LegacyDb project
`rpg-zzu-ashen-vault-20260913`; it did not add project-independent default cards.
The shipped catalog now contains 25 approved roots and 27 total place definitions,
including both inn floors. Data was extracted from the saved/reloaded project;
original maps and remote projects remain unchanged.

Validation:
- All 25 roots copied into an empty canonical document and compiled; inn generated
  two maps and both stair transfers. 27 catalog contract tests passed.
- Existing catalog and reference coverage: 27 tests in three files passed before
  broadening the compile matrix to all roots.
- Browser verified default cards and loaded two-floor preview on the actual 9888
  preview server in two unrelated saved projects, with remote writes blocked.
- `scripts/qa/reviewed-default-places.mjs` reproduces the browser check.

Default browsing is read-only. Copying requires the existing spatial-authoring
activation and shared draft preview/apply workflow. No authored project library
or chipset ID is overwritten; copies use fresh namespaces.
