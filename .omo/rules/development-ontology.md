# Development Ontology Rule

Use the RPG ZZU development ontology as the first navigation step for feature work.

This is a mandatory project rule for Codex: when the user asks to add, change, debug, refactor, or explain behavior in this project, run the ontology classifier/query before choosing files to edit unless the user explicitly says not to.

## When To Use

Before implementing or changing project behavior, classify the user's requested work:

```bash
npm.cmd run ontology:classify -- "<user request>"
npm.cmd run ontology:query -- task "<user request>"
```

If the user asks about a specific source file first, also run:

```bash
npm.cmd run ontology:query -- file "<path>"
```

If the shell is not PowerShell-blocked, `npm run ...` is also fine. On this Windows workspace, `npm.cmd` avoids the `npm.ps1` execution-policy block.

## How To Use The Result

- Treat the top Capability as the starting map, not as a complete answer.
- Read the returned `type`, `ui`, `runtime`, `storage`, and `test` surfaces before editing.
- For ambiguous or multi-surface work, inspect every returned Capability with a meaningful score.
- Prefer the ontology's local file guidance over broad search when it identifies the relevant area.
- Mention the selected Capability briefly in the working update so the user can see the ontology was consulted.

## Keep It Alive

When a change introduces or materially changes any of these, update the ontology in `src/project/ontology/`:

- Capability
- Entity
- Relation
- Contract
- DevelopmentRecipe
- classification keyword or example
- generated surface, runtime surface, storage surface, or test surface

After ontology changes, regenerate and check it:

```bash
npm.cmd run ontology:docs
npm.cmd run ontology:check
npm.cmd run ontology:evaluate
```

## Done Criteria

Feature work that touches ontology-covered behavior should finish with:

- relevant implementation tests passing
- `npm.cmd run typecheck` passing when TypeScript changed
- `npm.cmd run ontology:check` passing
- ontology docs regenerated if the ontology source changed
