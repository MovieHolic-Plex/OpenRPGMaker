# Original Brendan walking fidelity

User objective: ≥95% identity with the actual original walking GIF. Target: the current male field hero, Emerald Brendan. This explicitly adopts original Nintendo/Game Freak/Creatures pixels; it is not original Codex hand drawing. Existing original-costume aesthetic rubric and gate implementation remain unchanged.

## Measurements

- All12 native16×32 poses: exact foreground100%, silhouette IoU100%.
- Every pose must independently exceed95%. Union of original/candidate foreground is the denominator; jointly transparent background is excluded. No alignment/resampling.
- Four decoded GIF frames[stepA,idle,stepB,idle] match mapped source cells and transparent separators.130ms per frame approximates original8ticks. Native68×32 GIF and integer display copy preserve exact visible RGB.
- Negative controls reject blank image,1px shift,recolor,wrong direction,single missing pose,extra ink.
- Real HTMLImageElement playback at1×/4× shows allthree distinct poses and matches decoded pixels.
- Canonical/shared/export and all12 actual standalone-player texture-frame samples independently match the pinned original100%.
- Runtime39/39checks: native movement,three distinct poses per direction,idle,gutters,scale,camera,Enter opening,BGM continuity and reduced motion.0browser/resource errors.

## Canonical persistence

Project id: fca4b134-ed34-4365-9021-450c7ee24894

Canonical directory: /home/main/.local/share/oprn/web-workspace/.oprn-projects/649482df-81ca-4af9-806b-2613f7d7bebb

Revision34. Same official host API performs asset put,CAS save and fresh-connection reload. Changed onlyoprn_emerald_field_cast_1. Its72×128hero slot is replaced;64,512outside-slot pixels and every other project field/asset are identical. Canonical hero provenance is explicit metadata. No direct SQLite/LegacyDb writes. The dedicated18584host created for this operation was stopped afterward; shared hosts were untouched.

Canonical documentSHA: a8c2b6b63aca60c3d4135c732a8a4af61bfdc880c6648c0c93e1c345519602d0

Reloaded castSHA: 2cc5a2321a4215388c95c7887db6bef0f7253fe7cfc1ef6d6817e87c72dc7224

Shared PNG uses a different encoder from canonical PNG; decoded full cast pixels are exact. Its byte hash is separately recorded. Exported bytes match the canonical asset; public export copy matches all3,292verified files.

## Delivery and limits

Report: http://mdc-server:18301/emerald-hero-reference-report.html

Play: http://mdc-server:18301/monster-expedition/player.html?build=brendan-reference-100

Original Brendan/May GIFs: http://mdc-server:18301/pokemon-original-walking.html

Raw public project/player/GIF bytes match verified output. Unmodified public player boots without errors. Report fits960px/320px, shows1×/4× and pauses/resumes GIFs. Previousv18report/media/game preserved under distinct backups.

Identity claim covers field walking only. Battle fronts/back and other NPCs remain independent original art. Runtime movement timing remains the existing game clock; only GIF preview approximates source timing. QA uses original event-free map corridors and actual input/frame instrumentation; this is not a full campaign playthrough.

Private full reproducible selection/source/export/runtime evidence: /home/main/z-project/pokemon-hero-reference-fidelity/. No large canonical JSON or access credentials are committed.

Inspect comparison.png and runtime-walking.png first. Pipeline/source/browser/delivery receipts preserve measurements. An independent native agent inspected source mapping and runtime evidence; no cross-model reviewer is claimed.
