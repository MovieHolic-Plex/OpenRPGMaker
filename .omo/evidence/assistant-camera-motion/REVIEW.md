# Assistant camera adversarial review

Review scope: editor camera requests from accepted AI changes, `focus_editor_view`, region highlights, and reference navigation. Engine/editor changes only; browser maps are ephemeral test fixtures, not authored content.

| Attack / failure | Finding and repair | Evidence |
| --- | --- | --- |
| Fit a large offscreen region | Zoom changed immediately before the pan. Restore live camera before the first painted frame and interpolate zoom and look-at together. | Scene regression + browser frame samples |
| Switch maps while a pan is active | Clearing the deferred request did not stop Phaser Pan, which writes scroll before invoking its callback. Reset the actual effect on map/view changes and invalidate callbacks. | Scene regression + browser A→B switch |
| Start painting or manually pan during automatic motion | Existing guard only handled gestures that started before the request. Cancel active motion on pointerdown, pan start, wheel and keyboard pan. | Scene cancellation + browser wheel interruption |
| Click during an interpolated zoom | Settling zoom before tile lookup can shift the clicked tile. Preserve the world point under the pointer while settling. | Scene anchor regression |
| Repeated tool results for the same destination | Forced pan restarted the motion each time. Ignore duplicate active requests. | Scene regression |
| A newer request arrives during a pan | Resume from the current camera position and invalidate the previous callback. | Scene regression |
| `NaN` / infinite coordinates or dimensions | Invalid bounds bypassed finite point checks. Reject before planning and before changing the selected map. | Planner + navigation regressions |
| Region extends past the addressed map | Center-only validation either discarded a partly valid region or fitted an area outside the map. Intersect it with the map first. | Planner regression |
| Read viewport during motion | Phaser's effect callback precedes worldView refresh. Refresh camera geometry before publishing. | Scene regression + browser target projection |
| Reduced-motion preference | Existing animation ignored it. Apply the destination immediately. | Scene regression + browser media emulation |

The editor intentionally allows padding around maps and respects floating assistant occlusion. Map bounds here constrain the requested region; they do not remove the editor's normal camera padding.

Validation results and measurements are recorded separately after execution. The browser specification drives the actual tool resolver and navigation code without a network LLM call.
