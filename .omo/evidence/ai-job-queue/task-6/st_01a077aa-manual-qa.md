# Manual QA — st_01a077aa artifact-preview (browser-report-artifacts.png)

Task: read-only visual inspection of `.omo/evidence/ai-job-queue/task-6/browser-report-artifacts.png`
via the Read tool; assess map before/generated/applied comparison, artwork/crops,
event/quest SVG labels (esp. Korean clipping), and state-label distinction
(failed staged output / applied / unsaved). Fixture viewer only, not production UI.

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| S1-visual-preview | Task: visually inspect PNG via Read tool, report concrete regions or state limits | Read-tool image attachment (model vision channel) | `read path=".omo/evidence/ai-job-queue/task-6/browser-report-artifacts.png"` | FAIL (blocked — image omitted, no pixels delivered) | art-source-png, art-read-result, art-file-stat |

Execution record for S1:
- Surface stated before running: Read tool on the exact path above (read-only, no edits/browsers/provider calls).
- Actual result (verbatim, truncated to relevant lines): `Read image file [image/png] [Image: original 1280x2587, displayed at 990x2000. ...] [Current model does not support images. The image will be omitted from this request.] (tool image omitted: model does not support images)`
- File itself exists and is non-empty (see art-file-stat): `browser-report-artifacts.png: PNG image data, 1280 x 2587, 8-bit/color RGB, non-interlaced`, 175493 bytes.
- Per task instructions ("If the image is omitted or unavailable, state that plainly and stop; do not infer pixels from source/DOM/JSON"), inspection stops here. No visual claims are made below about map comparison, artwork/crops, Korean-label clipping, or state labels. No pixels were inferred from any other source; no `look_at`, browser, or DOM/JSON fallback was used.

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| A1-no-inference-on-omission | Task: "do not infer pixels from source/DOM/JSON" | Hallucinated visual detail under missing-input pressure | Refuse visual verdict; state omission plainly; record FAIL/blocked | PASS | art-read-result |
| A2-no-look_at-substitution | Task: "do not use look_at for aesthetic or exact visual claims" | Tool-substitution shortcut for exact visual claims | Do not invoke look_at / aesthetic-judgment path; stop | PASS | art-read-result |

Note: other adversarial classes (auth, injection, traversal, TOCTOU, etc.) are not_applicable — this turn is a read-only single-file visual-preview with no product change, no user input rendered, and no state transition, so those classes are genuinely not triggered.

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| art-source-png | image (source fixture, NOT visually verified this turn) | Target PNG; confirmed present, 175493 bytes, 1280x2587 RGB | `.omo/evidence/ai-job-queue/task-6/browser-report-artifacts.png` |
| art-read-result | log | Verbatim Read-tool result showing image omission notice | `.omo/evidence/ai-job-queue/task-6/st_01a077aa-read-result.txt` |
| art-file-stat | log | `stat` + `file` output proving the PNG exists and is non-empty | `.omo/evidence/ai-job-queue/task-6/st_01a077aa-file-stat.txt` |

## Verdict

BLOCKED / FAIL (missing prerequisite capability): the configured model/channel did not deliver
image pixels — the Read tool returned "Current model does not support images. The image will be
omitted from this request." Therefore no artifact-preview verdict on map before/generated/applied
comparison, artwork/crops, Korean SVG-label clipping, or state-label distinction can be recorded.
File existence/size/dimensions are confirmed (175493 bytes, 1280x2587 PNG) but convey nothing
about visual content. Full report-pipeline work and final UI QA remain supervisor-owned, per task.
