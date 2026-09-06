# U04 picture completion API and ownership

## Renderer owner: `src/player/runtimeDom.ts`

`PictureCompletion = "completed" | "cancelled"` is an exported runtime-only type.

`RuntimeDomOverlay.waitForPicture(pictureId): Promise<PictureCompletion>` observes the current picture generation **after** `syncPictureLayer` has consumed its authored transition intent.

- Missing/erased picture: resolves `cancelled`.
- Settled picture, duration <= 0, or the existing no-rAF fallback: resolves `completed` after the target transform has been written.
- Active tween: resolves `completed` only after the renderer writes the final transform. It does not create a duration timer and does not wait for image decoding.
- Replacing the picture state object, changing its resource, or erasing its slot cancels the old generation's observers. Multiple observers settle together; observer sets are cleared on settlement.
- A resolved target change on the same picture object/resource is a retarget, not a new generation. Existing observers remain pending through the retargeted tween and complete after its final DOM update. The existing intent rule still applies: without transition intent, an immediate target update completes after that synchronous DOM write.
- A restored state object without new transition intent applies its saved target immediately, including when its target equals an in-flight goal. Authored transition timing/interpolation and opacity conversion remain in the existing picture tween functions.

`RuntimeDomOverlay.clearPictures(): void` is idempotent picture-only teardown. It cancels the owned picture rAF, removes picture slots and settles their observers as `cancelled`. It does not remove timer/calendar HUD, event markers, lighting, audio, or other effects.

## Interpreter owner: `src/player/playSceneInterpreter.ts`

Native/M2 steps routed through the existing blocking `showPicture` consumer now observe renderer completion instead of `waitWithCutsceneSkip(durationMs)`.

- `waitForPicture === true` races the picture signal with the existing cutscene skip signal.
- Picture-operation settlement is not event-lifetime cancellation. Either `completed` or `cancelled` releases the picture wait and the same live event continues once. Same-session replacement/erase must not silently discard following commands. Only the captured-session/shutdown/destroy liveness guard stops stale event execution.
- The existing controller now tracks its captured session and the scene's shutdown/destroy state. The picture consumer checks liveness before resuming, including cancellation between final DOM write and promise continuation. Run-loop/final cleanup guards avoid touching a replaced session or dead scene.
- Skip still jumps to the existing cutscene end label. It does not cancel the visual tween or allocate a picture timer.
- Every consumed show-picture step binds shutdown/destroy cleanup to the **captured renderer instance** until that picture generation completes or is cancelled, including false/omitted waits whose command has already returned. Settlement removes those lifecycle listeners.

## Guidance for later units

- Keep interpolation, duration and opacity math in `pictures/pictureTween.ts`; U04 did not change that module.
- Call `syncPictureLayer` before asking for completion. Preserve picture object/resource identity when only a resolved target changes; that retarget keeps its current observers. Authored replacement objects/resources cancel prior observers, but this cancellation alone does not end the author event.
- Independent renderer consumers own lifecycle wiring: call `clearPictures` during their scene-picture teardown. This API does not install a generic scheduler or global lifecycle manager.
- `playSceneSchedulers.ts` and other effect owners were not edited. No project/save schema field was added for completion bookkeeping.
- `test/pictureWeatherDom.test.ts` provides deterministic real-renderer + real-interpreter coverage with independent duration-timer and rAF clocks. It verifies partial/final frames, immediate and non-waiting modes, replacement/erase, session replacement, shutdown/destroy, skipped waits, multiple observers and unrelated HUD preservation.
