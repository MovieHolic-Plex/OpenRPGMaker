# Late local save must not relabel a replacement project

Supervisor-owned isolated fix based on c31d62000. No authored user content,
paid provider calls or remote project writes.

## RED: actual browser

Monitor mon_1H120HASQ0PPJJD2 / bash_51 ran actual Chromium against the source
ProjectStore via an isolated Vite harness on port 19842. Its browser context,
server and temporary Vite cache closed in finally.

The test acquires the real cache Web Lock, starts a local save, changes to
freshProject and replaces the project, then releases the old save. It observes
exact events rather than using sleeps.

```json
{
  "oldIdentity": {"backend":"local","projectId":"0d6e17b4-aa18-44a0-b029-aa27b331d919"},
  "newIdentity": {"backend":"local","projectId":"38a93390-1b59-4348-b516-afa9529758ba"},
  "beforeRelease": false,
  "afterRelease": true,
  "oldSlotIdentity": "0d6e17b4-aa18-44a0-b029-aa27b331d919",
  "newTitle": "New ephemeral project"
}
```

Exit 1: `Old save must not mark replacement durable`, actual true, expected false.
The old cache write stayed in the correct slot; the defect was the late
assignment to the new project's in-memory durability flag.

## RED: persistent regression

`test/aiJobIdentity.test.ts` adds
`does not mark a replacement durable when a late local save completes`.

```sh
npm test -- --maxWorkers=1 --no-file-parallelism test/aiJobIdentity.test.ts -t 'late local save'
```

Monitor mon_D3NJKFH9Y2FHZH79 / bash_53 exited 1:
`expected true to be false`, 1 failed / 6 excluded by the explicit filter.
The regression uses real Web Locks and the actual store/cache implementation.

## Fix and verification

The local save branch captures projectEpoch before waiting and updates
dirty/durable state only if that epoch still owns the editor afterward.
It does not discard the old project's successful write or modify the replacement.

Post-fix verification completed with exit 0 under mon_AEPV1MB2X8Q1PTV5 / bash_54:
6 local identity cases, all 25 application tests, the same real Chromium
probe, typecheck:app and build:app (56.64 seconds). The unrelated fixed-port proxy identity case is
excluded in this isolated concurrent run to avoid the report worker's port 19841;
the final integrated identity suite remains a required gate.

Fresh diagnostics on the modified test are clean. Isolated store.ts diagnostics
timed out at the tool's 3000ms deadline; this is not reported as a clean LSP result.
The application compiler passed. Final integrated diagnostics remain a follow-up.

Actual browser GREEN observed beforeRelease:false and afterRelease:false. The
oldSlotIdentity still matched oldIdentity, the new identity differed, and the new
title remained intact. The probe printed CACHE_RACE_CLEANED after closing its
browser/server and removing temporary storage. No fixed sleep was used.
