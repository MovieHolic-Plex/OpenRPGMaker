# SUPERVISOR-E2E - final candidate 238d6f4f

This is a separate supervisor-run receipt, not a relabeling of the historical
worker run. Receipt verification: omo child `st_01a0733a`; supervisor/root session
`01a072aa-d666-7ef3-a123-c923fcda0392`.

## Run identity and result

- Tested source commit: `238d6f4f0e8ea4ea00c0aea480bf50bdbe86284d`.
- Run cwd: `/home/main/z-project/rpg-zzu-house-protection-p1-final`.
- Supervisor monitor: `bash_86`; **4 passed, exit 0, zero retries, 5.8m**
  (reported duration, not an invented exact number of seconds).
- Supervisor reports no source/test edits during the run. The receipt child
  independently confirmed that worktree HEAD is the exact commit above and that
  its tracked changes are only scenario JSON/PNG evidence, not source or tests.

```sh
DEV_SERVER_PORT=34535 E2E_RETRIES=0 npx playwright test test/e2e/ai-house-protection.spec.ts --project=chromium --workers=1 --reporter=line
```

Run result source: supervisor ledger record 22 (1-based), at
`2026-09-05T20:16:37.065Z`, in:

`/home/main/.herdr/worktrees/rpg-zzu/wish-ai/.omo/ulw-loop/house-protection-20260905/ledger.jsonl`

SHA-256 of that exact raw UTF-8 record **including its trailing newline**:
`feeb476f95c7250d3a8c3b3fc4d264337833b7ec344697a46d55171b22067023`.
The hash deliberately binds the record, not the appendable whole ledger. Its
JSON-encoded `evidence` field records the command, commit, exit, duration, four
scenario results and cleanup. Monitor identity and the detailed cleanup method
below are supplied by the supervisor's task handoff. The child did not rerun
Playwright or independently observe those earlier processes. No fresh raw
Playwright log was supplied or fabricated.

## Independent artifact validation

The child parsed all four actual JSON files listed below, not `e2e-receipt.json`.
All four assertions passed in each scenario:

| Scenario | protectedEqual | fullMapRollback | rejected | outside |
| --- | --- | --- | --- | --- |
| selection | true | true | true | true |
| confirmDestroy | true | true | true | true |
| overExisting-clear | true | true | true | true |
| overExisting-keep | true | true | true | true |

- `protectedEqual`: the 42 `protectedBefore` records equal `protectedAfter`
  exactly, including lower/upper bases and stack entries. Each recorded base
  value was also checked against its coordinate in the built/final map arrays.
- `fullMapRollback`: each outcome map for `erase-house`, `fill-empty-upper` and
  `erase-ridge` equals the entire `built` map, not just its protected cells.
- `rejected`: those three outcomes have `result.ok == false` and an issue with
  code `protected-house-write`.
- `outside`: `edit-selected-outside` succeeds at its requested single upper-layer
  cell outside the protected coordinates; the cell was nonempty. Its outcome map
  and the final `after` map equal `built` with only that upper cell set to -1.
- Plan/build succeed in all cases; the explicit permit succeeds in the three
  non-selection cases. Every fixture reports remote persistence disabled.

All twelve PNGs were read as bytes and checked for PNG signatures and 1440x900
IHDR dimensions. Hashes below were computed directly from existing files.
**Subjective visual grading is not claimed**: the supervisor reported that image
reading was unsupported for its model; this child performed byte/header checks,
not visual interpretation. Artifact presence or identical hashes do not alone
prove regeneration; attribution of the run comes from the supervisor record and
handoff. Identical screenshots across scenarios are retained as actually found.

## Fresh artifact manifest

These are absolute paths in **p1-final**, not the older same-named artifacts in
this receipt worktree. JSON and screenshots are linked in place, not copied or
committed here. Preserve these external files for later verification; a checkout
of this receipt alone does not contain the fresh artifacts. A later rerun that
overwrites them must not reuse this receipt unless all hashes still match.

```sha256sum
d411477194e33ddcdb0ed8b6875be6cc8dbead091f113cdb88d0bb3331dc5ed7  /home/main/z-project/rpg-zzu-house-protection-p1-final/.omo/evidence/house-protection/p1/selection.json
2dae2b66fc10017ef7a083ce5290302406586a317954a296b2c1447000365f83  /home/main/z-project/rpg-zzu-house-protection-p1-final/.omo/evidence/house-protection/p1/selection-before.png
959bdbcb64237a52931414a49677ec604989680ab4dd9de7587859f436e03c6c  /home/main/z-project/rpg-zzu-house-protection-p1-final/.omo/evidence/house-protection/p1/selection-built-before-attempts.png
110fc8a8a9f01aac1ea8a0409e556b4d18f5dcef141887e50ec02d6d7a0e05d5  /home/main/z-project/rpg-zzu-house-protection-p1-final/.omo/evidence/house-protection/p1/selection-after.png
06fd7f6be593241ad5fa1828ad3825d309b43e757ed115a814f271079a128ef1  /home/main/z-project/rpg-zzu-house-protection-p1-final/.omo/evidence/house-protection/p1/confirmDestroy.json
ed0df7869de4b53792e61347ad499abb00d19d3071f89c0adb35b250ec9a781e  /home/main/z-project/rpg-zzu-house-protection-p1-final/.omo/evidence/house-protection/p1/confirmDestroy-before.png
c21222f6219e9e3e81cec37ec3d6481e485852f2106949d0c98fb4af92d49cdc  /home/main/z-project/rpg-zzu-house-protection-p1-final/.omo/evidence/house-protection/p1/confirmDestroy-built-before-attempts.png
5f95bc40b64dbab9e58a5f123d01c98376c4225fdd9eee975003ab2291450bb0  /home/main/z-project/rpg-zzu-house-protection-p1-final/.omo/evidence/house-protection/p1/confirmDestroy-after.png
86d3372ec23afb9d6390042872e358cdeb2a3bf9340bac826ac0516cf94be347  /home/main/z-project/rpg-zzu-house-protection-p1-final/.omo/evidence/house-protection/p1/overExisting-clear.json
56091bc0d78422302f03c1eba2537f51176336c07922176ea7445fad0e021b31  /home/main/z-project/rpg-zzu-house-protection-p1-final/.omo/evidence/house-protection/p1/overExisting-clear-before.png
cd9cce7cbc3cc2e970c30d484357871630cc456a6c67d0a5cc5e7542eda931f3  /home/main/z-project/rpg-zzu-house-protection-p1-final/.omo/evidence/house-protection/p1/overExisting-clear-built-before-attempts.png
5f95bc40b64dbab9e58a5f123d01c98376c4225fdd9eee975003ab2291450bb0  /home/main/z-project/rpg-zzu-house-protection-p1-final/.omo/evidence/house-protection/p1/overExisting-clear-after.png
8934ab1571b84bf577abbd73d710a82f2a4d0bf7734d04d3678a2d091b190a29  /home/main/z-project/rpg-zzu-house-protection-p1-final/.omo/evidence/house-protection/p1/overExisting-keep.json
56091bc0d78422302f03c1eba2537f51176336c07922176ea7445fad0e021b31  /home/main/z-project/rpg-zzu-house-protection-p1-final/.omo/evidence/house-protection/p1/overExisting-keep-before.png
635a8125da933fe1c2cf6979fbc756274ed7f5887752c401de621c3865b47464  /home/main/z-project/rpg-zzu-house-protection-p1-final/.omo/evidence/house-protection/p1/overExisting-keep-built-before-attempts.png
272879650d2e290d625b26bd93d2a965f7e51f351c294b01c7d8f301e50b040c  /home/main/z-project/rpg-zzu-house-protection-p1-final/.omo/evidence/house-protection/p1/overExisting-keep-after.png
```

## Cleanup provenance

The supervisor started server monitor `bash_85` in p1-final on port **34535**,
then stopped it with `kill_bash`. Its handoff reports that `Bun.listen` successfully
bound port 34535 afterward and the probe was closed. Ledger record 22 corroborates
Playwright exit, `bash_85 killed`, and `portReleased: 34535`. These are attributed
supervisor observations, not a cleanup procedure executed again by this child.

## Historical evidence is not this run

`E2E-RECEIPT.md`, `e2e-receipt.json`, `playwright.log`, `playwright.exit`,
`server-receipt.json` and `cleanup.json` describe the **historical worker run**:
commit `02b496aec6c331d0cc33b19217765e2b0b2e967b`, **4.9m**, port **52385**,
server cwd `/home/main/z-project/rpg-zzu-house-protection-p1`.
The implementation `README.md` likewise remains historical, not a final-candidate
gate report. None of those records supplies this supervisor run's outcome,
artifact hashes or cleanup. In p1-final specifically, the old receipt/log/cleanup
files coexist with regenerated JSON/PNGs, so their old relative hash references
must not be treated as certificates for the fresh bytes. This receipt leaves the
historical records intact apart from an explicit historical banner on the worker
Markdown receipt. No source, tests, old raw logs or old artifact hashes changed.
