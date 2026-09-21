# Slates structure study — coverage and limits

Source project: Supabase `rpg-zzu-slates32-38e6`.
40 observation kits: 28 reference contexts, 4 controlled variants, 8 mechanism poses.
46 reviewed regions cover all 1232 v2 source slots. Coverage is NOT proof of every possible assembly.
New atlas: 1232 original slots + 536 source-rectangle observation tiles = 1768.
Source artwork: Ivan Voirol / CC BY 4.0, v1 and v2 atlases. No screenshot pixels in generated atlas.
Reference screenshots are used only for comparison boards and numerical source matching.

Four editable observation maps:
- `slates_mastery_architecture`, 36×29
- `slates_mastery_fortification`, 36×28
- `slates_mastery_terrain`, 36×18
- `slates_mastery_detail`, 36×21

All are 32px. Their specimen footprints are conservatively blocked and flatten contextual art.
These are study scenes, not gameplay-ready building objects or a completed walled village.
Gate interior remains explicitly held for review. Some borders/shadows still differ from references.
The window-height experiment initially repeated a flag tip; it was corrected to repeat the row below.
All 40 output specimens were inspected on the four contact sheets.

Persistence: `persistence.json` proves root and maps/tilesets mirror reload equality.
`local-persistence.json`: SQLite revision 7, maps/tilesets/assets equality, existing six maps,
their tilesets and start position preserved. Editor screenshots use the authored JSON;
it is identical to the remotely reloaded root. Actual engine deserialization and texture load succeeded.

Browser observations: four editor maps render, valid arrays/ranges and 40 kits, no page errors.
HTML: desktop 1440px and mobile 390px, no document overflow or broken images; 40 cards,
9 fortress-category cards, tabs/filter/source-details work; no page errors.
No gates, vitest or full typecheck were run. No runtime behavior was added or claimed.

즉시 확인:
- `contact-architecture.png` — building depth, projecting floor, connected shops, corrected tall window.
- `contact-fortification.png` — gate, wall, tower, terraces, water arches and extension experiment.
- `contact-terrain.png`, `contact-detail.png` — remaining context assemblies and all 8 mechanism poses.
- `slates_mastery_fortification.png` — actual editor map PNG export (2304×1792).
- `report-desktop.png`, `report-mobile.png`, `report-fortification.png` — report surfaces.

Durable AI entry: `openwiki/slates-structure-learning.md`, linked from AGENTS / PROJECT_WIKI / quickstart.
Human report: `reports/slates-mastery/index.html`.
