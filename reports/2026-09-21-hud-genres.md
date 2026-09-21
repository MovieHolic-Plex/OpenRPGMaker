# Genre HUD revision

Added exploration-first collector, classic JRPG, symbolic horror, no-HUD chase, and hearts presets to Database → System → Ingame HUD. The collector opens an actual keyboard-operated field-list menu, also selectable independently in the menu skin editor. HUD presets can choose an accompanying menu without rewriting the existing menuUiStyle. Existing project defaults remain unchanged.

Bundled Galmuri9 lettering uses native 9px labels and 18px clock numerals. HUD authoring exposes automatic/pixel/round/clean typography and gauge number visibility. Menu typography remains owned by each menu skin. The collector uses cream paper, charcoal borders, a muted red selection indicator, and a two-line control footer. No trademark graphics were copied.

Symbolic health is a five-petal engine-rendered flower, connected to actual HP (or another selected numeric source), with ceil(ratio*5) visible petals. It is not an arbitrary authored image-state system. Chase hides the composed HUD, legacy combat HUD and minimap. Classic has no field widgets and opens the existing classic menu. Existing battle/dialogue systems are unchanged.

## Evidence

Dedicated shipping-player harness, no editor shell. Existing fixture copied only for engine QA; no production map/event/demo content or remote DB rows authored.

- Existing seven profiles: 21 scenario beats passed, no runtime errors; serialization, real action stamina, variable changes, bounds and toolbar avoidance checked.
- Five new profiles: field/low-health/menu captures, serialization and native 320px bounds checked.
- Collector: ArrowDown/ArrowUp changes selection, Enter opens inventory and Escape returns. Font loading and finite menu transitions finish before final menu evidence.
- Horror: actual HP changes produce 5/3/1/0 petals.
- Actual database controls: add/duplicate/delete, variable binding, drag/keyboard placement, isolated preview, font/menu/number-display editing and serialized reload passed.
- Visual fixes after screenshots: clipped footer now two lines; flower reduced and desaturated; empty HUD no longer rebuilds configuration every frame.
- Full typecheck/vitest/gates not run under session rules. One initial browser title startup timed out; fresh isolated run completed. One additional probe initially assumed debug state exposed actorVitals; corrected to inspect the live accessible meter max.

Screenshots: `.superpowers/sdd/qa-shots/hud-genres/`.

References used for design principles:
- https://pokemonletsgo.pokemon.com/en-ca/how-to-play/
- https://www.nintendo.com/eu/media/downloads/games_8/emanuals/nintendo_3ds_2/pok_mon_y/ElectronicManual_Nintendo3DS_PokemonY_en.pdf
- https://zelda.nintendo.com/links-awakening/gameplay/
