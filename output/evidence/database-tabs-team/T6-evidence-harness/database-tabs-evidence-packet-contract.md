# Database Tabs Evidence Packet Contract

Owner: T6 evidence-harness

## Packet Directory
Each domain team writes one packet per assigned tab group under:

`output/evidence/database-tabs-team/<member-or-tab>/`

The team handoff copy or summary belongs under:

`.omo/teams/019f0b07-a984-7122-a801-bc946b72da32/artifacts/`

## Required Files
- `scenario.json`: route, viewport list, user path, tab IDs, edited canonical JSON paths, and acceptance checks.
- `tabs/<tab-slug>.png`: at least one real `database-modal` screenshot for every covered top tab.
- `project-export.json`: parsed project export after edits.
- `tab-metrics.json`: shell metrics for every switched tab, including modal size, tab row top, manual source top, status top, body top, and modal body scroll.
- `state-capture.json`: domain-specific state, when the tab affects runtime/session/battle/map state.
- `agy-vision.txt`: mandatory Antigravity visual review for a representative final screenshot.
- `visual-qa.md`: final GOOD/NEEDS WORK verdict with links to screenshots, JSON artifacts, agy output, and blocking findings.
- `trace.zip`: only when Playwright fails.

## Shared Helper API
Use `test/e2e/rm2k3-database-helpers.ts` for Database modal operations and `test/e2e/rm2k3-database-evidence-helpers.ts` for packet file writing.

Required helper calls:
- `openDatabase(page)`
- `switchDatabaseTab(page, tab)`
- `captureDatabaseShellMetrics(page)`
- `exportedProject(page)`
- `applyDatabaseChanges(page)`
- `closeAndReopenDatabase(page)`

Required packet helper calls:
- `captureDatabaseEvidencePacket(page, evidenceDir, DATABASE_TAB_SPECS or owned subset)`
- `writeDatabaseScenario(evidenceDir, scenario)`
- `writeVisualQaVerdict(evidenceDir, verdict)`

Domain teams may add narrow field-edit helpers in their own specs, but shared helpers must stay free of tab-specific business expectations.

## agy-vision Requirement
Every domain packet must run:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
agy --version
agy --print-timeout 90s --print "Analyze this UI screenshot: <absolute screenshot path>. Report overlaps, clipped text, blank regions, layout problems, visual hierarchy issues, and likely interaction affordances. Keep it concise."
```

Save cleaned output to `agy-vision.txt`. If `agy` cannot run, write `BLOCKED` in `agy-vision.txt` with the exact command and error, and keep the screenshots/state files.

## Visual QA Retry Loop
The leader consumes every packet and writes or updates final `visual-qa.md`.

Verdict rules:
- `GOOD`: browser path passed, screenshots are nonblank, export/state JSON proves persistence, agy has no blocking finding, and modal metrics stay stable.
- `NEEDS WORK`: any missing packet file, clipped/overlapping CJK text, blank or misframed screenshot, unstable modal chrome, missing export/reopen proof, or agy finding that needs a product decision.

Retry contract:
- The leader sends the owning member a short retry request naming the packet path, failing screenshot or JSON path, and required new evidence.
- The member fixes only their owned tab logic and reruns the same scenario.
- Fresh retry evidence is written under the same packet directory with updated screenshots, JSON, `agy-vision.txt`, and `visual-qa.md`.

## Wave 0 Proof
Proof packet:

`output/evidence/database-tabs-team/T6-evidence-harness/proof/`

Proof command:

```bash
npx playwright test test/e2e/rm2k3-database-harness-proof.spec.ts --project=chromium
```

Current proof includes all 20 tab screenshots, `project-export.json`, `tab-metrics.json`, `agy-vision.txt`, and `visual-qa.md`.
