# C2/C3 answer-omission correction: frozen

## Outcome

The lead's premise was confirmed. A Do request containing explicit dimensions or
prohibition could become answer-only when the declarer returned question mode and
omitted requirements. The previous H5 authored-predicate tests did not cover this
omission. The corrected existing session/ledger boundary retains these unresolved
source constraints and enters the existing recovery path instead of demoting them.

Current supported affected checks are **313 passed / 0 failed / 0 pending**, in
12 complete files, one invocation. App typecheck/build and all six changed-file
LSP checks passed. Source, tests and wiki are frozen again. No UI patches, commits,
reference-tree changes, browser/image work, live provider or remote DB writes.
Model was rechecked: `opencodex/gpt-6-astra`, high. Worktree/branch/HEAD remain those
in `FROZEN-CORE-HANDOFF.md` (HEAD `5891c52bf`, uncommitted integration).

## Real-session RED, before production edits

```sh
npm test -- test/assistantQuestionAuthority.test.ts --maxWorkers=1 \
  -t H5-omitted-source-constraints
```

`answer-omission-red.log`, exit 1: **6 failed**; the 20 other existing cases were
name-filtered in this RED command only, never disabled or deleted.

The regression family uses the real `AssistantSession`, existing source ledger,
real intent adapter/parser and a hermetic declaration provider. It supplies
`{ mode: "question", needsPlan: false }` with either omitted requestRequirements
or `{ entries: [] }`, for each input:

1. `Resize current map to 22x17; do not change the title.`
2. `Resize current map to 22x17`
3. `Do not change the title`

Every case executed and failed **expected `aborted`, received `answer`**. The
controller was subscribed before send and aborts on the exact first `run_state`
whose state is `recovering`. Thus the fixed behavior cannot pass by waiting for a
cap or timing luck. The old behavior never reached that signal: `isAnswerOnlyTurn`
saw no valid extracted predicates, and `markAnswer` could delete all uncovered
canonical source rows. This was behavioral RED, not a collection/import failure.

## Small production correction

- `assistantRequestContract.ts`: reuse the existing source-constraint helper with
  optional `includeNumeric = false`. Answer demotion opts in to numeric coverage
  as well as the existing preservation/prohibition scan. The normal write gate
  still calls the unchanged preservation-only default. Source unit boundaries,
  quoted preservation-word exclusion, and list-format handling are reused.
- `assistantSession.ts`: question-authoring consistency checks the current
  request's unresolved lexical constraints as well as its validated predicates.
  The existing recovery driver retains the same request/baseline/scope and cannot
  publish answer-only merely because the model omitted extraction.
- `assistantAcceptanceLedger.ts`: `markAnswer` independently rejects the same
  unresolved numeric/preservation source, so a direct call cannot bypass the
  session check. No fake withdrawal, new ledger, or changed evaluate signature.
- `intentDeclaration.ts` and the recovery call: the internal typed reason gains
  `unresolved-source-constraints`, distinguished from existing
  `authored-request-criteria`. The extraction guidance describes retained raw
  constraints without pretending absent predicates were already validated.

Only those four production modules, two test files and `editor-ai-panel.md` changed
relative to the previous frozen integration. The complete integration now changes
eight production modules / 32 files. Public UI event/result shapes are unchanged;
no new UI glue is required by this correction.

## Bounded guarantees and controls

The six omission cases now assert:

- exactly one recovery event followed by the subscribed abort, never answer state;
- zero writer requests, pending apply candidates or applied calls;
- original raw text and every uncovered unit retained as authoring source;
- no withdrawal/supersession metadata manufactured;
- canonical blocked/incomplete state and unchanged live project.

Additional controls preserve explicit Ask (answer, no authoring) and explicit Plan
(preview, no authoring), while legitimate existing H5 questions still answer.
`What does "No Signal" mean?` and a numbered informational question also remain
answer-only: quoted preservation words and list numbering are not new constraints.
Two direct-ledger tests ensure markAnswer cannot demote omitted dimensions or
prohibition even without the session wrapper.

A positive recovery case supplies real anchored mapDimensions width/height and
entityPreserve title coverage on the next declaration, then executes real
`resize_map`. It finishes verified-local with exactly one applied resize, map
22x17, unchanged original title, two declared source units and the new machine
repair reason. Unexpected further recovery aborts the fixture rather than looping.

This is **not arbitrary NLP certainty**. It does not classify genres, infer task
size, or identify every possible imperative. It conservatively blocks answer
demotion for the lexical numeric/preservation constraints already tracked by source
coverage. Numeric informational text submitted in Do can remain unresolved; an
explicit Ask request remains read-only. No unsupported requirement is converted
into a pass, optionality, withdrawal, or model-owned completion authority.

## Complete affected GREEN on this revision

```sh
npm test -- \
  test/assistantQuestionAuthority.test.ts \
  test/assistantRequestContract.test.ts \
  test/assistantAcceptanceSourceIntegration.test.ts \
  test/assistantCoreIntegration.test.ts \
  test/aiUnboundedExecution.test.ts \
  test/aiRunEndProof.test.ts \
  test/intentDeclarationClient.test.ts \
  test/intentDeclaration.test.ts \
  test/aiAskPendingPlan.test.ts \
  test/aiComposerModeSession.test.ts \
  test/assistantAcceptance.test.ts \
  test/aiRequiredOutcomes.test.ts \
  --maxWorkers=1 --reporter=json \
  --outputFile=.omo/evidence/core-integration/answer-omission-green.json
npm run typecheck:app
GOMAXPROCS=2 VITE_CACHE_DIR="$PWD/.omo/evidence/core-integration/answer-omission-build-cache" npm run build:app
```

`answer-omission-green.json` / `.log`: exit 0, **313/313**, 12 files, no pending or
filtered cases, approximately **355.67 seconds** from the JSON run interval.
Counts: H5=31, source=62, canonical source integration=29, core seams=18,
Unbounded/U1c=18, RunEndProof=48, declaration adapter=13, declaration parser=25,
Ask=1, composer=6, acceptance=23, required outcomes=39.

All six changed TS files received fresh **No diagnostics found** before build.
App typecheck exit 0 (`answer-omission-typecheck.log`); app build exit 0,
**27.50s** (`answer-omission-build.log`), with mixed-import/chunk-size warnings
retained. No individual test deadlines were raised and no sleeps/polling added.
The earlier 2537 full integration pass and lead critical82 pass are preserved
pre-correction evidence, not rerun or claimed as current full-tree verification.
The previously disclosed three legacy assertions were not rerun or hidden by this
focused correction. No affected-test failure remains.

## Updated frozen artifacts and hashes

Complete patch: `frozen-core.patch`, SHA-256
`d83e3c405b6b3c82d65942eaab7071dde2fb14fdc07077b1246a8b4c6bad9747`.
Current manifests: `frozen-core-source.sha256` (8 production modules) and
`frozen-files.sha256` (32 source/test/wiki files). Original patch, manifests and
handoff reports are preserved as `*.pre-answer-omission.*`; RED/GREEN logs from
earlier stages are unchanged.

Changed production hashes for this narrow correction:

```
f7053015170e8f4ee42a5b32586c3a0035373ccdb65461f0fa9b9c1579535cbc  src/ai/assistantSession.ts
d6ccc03e284bcfbbbcf592e757547f167bf9b0aca72e52b29195a1b001ae901a  src/ai/assistantAcceptanceLedger.ts
8a7e2994e9b54319093f15dc88b38129b92679a221587d89c0f35998fae7792a  src/ai/assistantRequestContract.ts
0f1aafe2cbbce02d4ba070e9dbc177a03d830fadccf03cf3b25237720cccfc4f  src/ai/intentDeclaration.ts
```

The other four integration production modules retain their previous hashes. Lead
owns commit, UI release and final repository/browser verification. No further core
edit or child validation command is queued.
