# Pokémon native motion QA

Completed: false. Checks: 2. Pages: 0/8. Errors: 0.

Failure: TimeoutError: locator.waitFor: Timeout 90000ms exceeded.
Call log:
[2m  - waiting for getByTestId('title-screen') to be visible[22m


Inspect first: opening-page-3.png, opening-native-poses.webm, walking-down-idle.png, opening-reduced-motion.png.

Actual compiled standalone player and original project/assets. Isolated browser storage. HTML injects only the existing qaInstrumentation boot capability; no JS/CSS/project replacement. Opening uses native keys and real media playback. Walking preparation is separately recorded.

Walking not reached.

No narration voice is authored. Real BGM continuity is checked; continuous voice across pages is not claimed.

- PASS authored confirm opening and actual pose strip exist
- PASS supplied canonical snapshot preserves exact motion metadata
