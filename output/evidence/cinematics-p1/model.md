# Cinematics P1: persisted model evidence

Date: 2026-09-06. Task: `st_01a07536`.

## Delivered commit

- Worktree: `/home/main/z-project/rpg-zzu-wish-cinematics-p1`
- Branch: `agent/wish-cinematics-p1`
- Base: `4c7cf588`
- Verified implementation commit: `4729ac5b5855b8a0056ab930a88ab1df795bdfb7`
- Subject: `feat(project): persist opening and game-over cinematic settings`
- Nine model/type/validation/export/test/wiki files, 344 added lines. No runtime or editor UI changes.
- The commit includes the required omo attribution and co-author trailer. No push, PR, merge, main checkout, or external database writes were performed.

The exact implementation contract was read from `.omo/ulw-loop/wish-cinematics-0906/implementation.md` in the parent worktree before repository work. AGENTS, quickstart, focused INDEX coordinates, PROJECT_WIKI, runtime schema/routing, programming TypeScript/data-modeling references, git-master and frontend routing were consulted. Existing npm/Vitest and boundary guards were retained; no dependencies or framework were introduced.

## Exact exported API

Types are defined in `src/project/cinematicSettings.ts` and exposed via `import type { ... } from "@/project/types"`:

```ts
type CinematicMotion = "none" | "fade" | "pan" | "zoom";
type CinematicScene =
  | { id: string; kind: "text"; narration: string; narrationAudioResourceId?: string; durationMs: number }
  | { id: string; kind: "image"; resourceId: string; narration: string; narrationAudioResourceId?: string; durationMs: number; motion: CinematicMotion }
  | { id: string; kind: "video"; resourceId: string; narration: string; narrationAudioResourceId?: string; durationMs: number };
type CinematicSequence = { enabled: boolean; skippable: boolean; scenes: CinematicScene[] };
type GameOverSettings = {
  sequence?: CinematicSequence;
  title?: string;
  message?: string;
  retryLabel?: string;
  titleLabel?: string;
  backgroundResourceId?: string;
};
```

Runtime values are named exports from `@/project/cinematicSettings` (not value exports from the type barrel):

```ts
const CINEMATIC_SCENE_LIMIT = 100;
const CINEMATIC_DURATION_MAX_MS = 120_000;
function normalizeCinematicSequence(sequence: CinematicSequence): CinematicSequence;
function normalizeGameOverSettings(settings: GameOverSettings): GameOverSettings;
```

`SystemRecords` adds `opening?: CinematicSequence` and `gameOver?: GameOverSettings`. Normalizers take present, typed authored records; optional absence is handled by the existing `normalizeSystemRecords` whitelist. No additional public validation API was introduced: use existing `validateSystem`, `validateSystemResources`, or the integrated `deserialize` boundary.

## Semantics and decisions

- Missing settings remain absent; `{}`, empty scenes, false flags, and disabled authored content survive load/save/export.
- Normalization preserves scene order and exact text (including blank strings and whitespace), trims IDs, omits optional blank IDs, and does not mutate the input. Repeated normalized serialization is byte-stable.
- Wire validation runs before typed cloning/normalization and rejects unknown/variant-inappropriate fields, malformed kinds/fields, blank IDs, duplicate IDs after trim, over 100 scenes, and non-finite or non-integer durations outside `0..120000`. Duplicate IDs are scoped to each sequence, so opening and game-over may reuse an ID.
- Typed normalizers do not clamp invalid numbers or repair duplicate IDs; wire data must pass strict validation first. They are not unknown-input parsers.
- Resource validation follows the existing known-ID existence convention, including disabled sequences. It validates image, video, narration, and game-over background references, not decoded media or MIME compatibility.
- Existing recursive export string traversal already finds cinematic references. No additional collector was added. The only export correction adds `.mp4`, `.webm`, and `.ogv` filenames for the three video MIME types accepted by the existing movie importer.
- No schema bump or server migration. No demo/content records were authored. Rendering and duration playback semantics remain later producer work.

## RED before production edits

Command: `npm test -- test/cinematicSettings.test.ts`

Exit **1**, **100 failed / 9 passed (109)**, duration 14.82 seconds. Captured before any production edit; raw session log: `/tmp/cinematics-model-red.log`.

Representative assertion failures:

```text
retains disabled authored scenes ... expected undefined to deeply equal ...
rejects malformed scene: null ... expected function to throw an error, but it didn't
exports video/mp4 ... expected assets/uploaded/video.mp4, received assets/uploaded/video.png
```

The test module collected and ran; failures were assertions, not missing-module/import errors. Initial tests exercised existing normalization, validation, and export APIs. The same 109 tests passed after the implementation.

## GREEN and validation receipts

| Check | Exit / result |
| --- | --- |
| `npm test -- test/cinematicSettings.test.ts` | **0**, 109/109 passed in one GREEN invocation, 20.13s |
| `npm test -- test/titleScreenSettingsNormalize.test.ts test/webExport.test.ts test/webExportZipPruning.test.ts test/webExportUsagePruning.test.ts` | **0**, 29/29 passed across four files, 17.32s |
| `npm run typecheck:app` | **0**, no compiler errors |
| LSP diagnostics, severity all | No diagnostics in all eight changed TypeScript files |
| `npm run build` | **0**, app, exported player SDK, and standalone bundle built |
| Real SDK-backed export smoke, described below | **0**, ZIP bytes and deserialized settings verified |
| `git diff --check` | **0** before staging/commit |

Session logs: `/tmp/cinematics-model-green.log`, `/tmp/cinematics-model-regressions.log`, `/tmp/cinematics-model-typecheck.log`, `/tmp/cinematics-model-build.log`, `/tmp/cinematics-model-smoke.log`. This file contains the durable receipt; `/tmp` logs are session-local.

LSP paths: `src/project/cinematicSettings.ts`, `src/project/types.ts`, `src/project/types/database.ts`, `src/project/databaseRecordModel.ts`, `src/project/io/shapeDatabaseFields.ts`, `src/project/io/resourceReferenceValidation.ts`, `src/project/webExportAssets.ts`, `test/cinematicSettings.test.ts`. Markdown LSP was attempted for the wiki and is not configured; this is not reported as a pass.

Build warnings remain visible: unresolved-at-build-time public font/image URLs and large-chunk advisories. No warnings, failures, or baselines were suppressed or modified. No scoped regression failures occurred. Full application `npm run gates` remains lead-owned and was not run by this producer.

## Real export entry-point exercise

After the build, a temporary local `.mts` script invoked `createWebPlayerExportPackage` against the freshly built SDK. Its `fetchBytes` adapter read real `/export-player/...` files from `dist` and public assets from `public`; it did not fabricate the deployment manifest or bundle. The script ran via:

```text
./node_modules/.bin/vite-node --script output/evidence/cinematics-p1/model-export-smoke.mts
```

It created disabled opening and game-over sequences with image/video/narration plus a game-over background, generated the actual ZIP Blob, read the central-directory names and stored entry bytes, deserialized `project.json`, and asserted exact settings equality and a second byte-stable roundtrip. Results:

```json
{
  "uploaded": [
    "assets/uploaded/background.webp",
    "assets/uploaded/image.gif",
    "assets/uploaded/video.mp4",
    "assets/uploaded/voice.ogg"
  ],
  "zipEntries": 726,
  "zipBytes": 49443268,
  "playerBundleFileCount": 7,
  "roundtrip": "pass"
}
```

Each uploaded entry exactly retained test bytes `[1, 2, 3]`. These are byte-retention fixtures, not a claim of decodable media/playback QA. Unit export tests separately cover MP4, WebM, and Ogg video extensions, disabled opening-only/game-over-only references, and pruning unused uploads.

Cleanup: the one-shot process exited 0, no listening server or background process was started, the ZIP remained in memory, and the temporary smoke source was removed before committing. No browser playback or authoring UI was exercised because those implementations are later tasks.
