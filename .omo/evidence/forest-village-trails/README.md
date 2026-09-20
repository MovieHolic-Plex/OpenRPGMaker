# Forest village trails, 2026-09-21

Whole map: `public/assets/region-references/forest-cliff-village.png`.
This is the actual editor tile renderer output at 1280×1152, after local save/reload.

- `editor-proof.json`: two trails, 49 grass cells, 33 small decorations and six
  complete props; 1,950/1,950 passable cells connected, five house fronts reachable,
  zero canopy/road/grass/trunk mismatches. Local save receipt and reload match.
- `remote-proof.json`: source project CAS save and exact reload. Other maps and
  assets preserved relative to their own remote baseline.
- `region-proof.json`: frozen shared project saved and reloaded; exact atlas hash.
- `document-proof.json`: all three portable region documents survive the app's
  deserialize/serialize/deserialize with map, tile metadata and atlas unchanged.
- `new-region.png`: fresh blank-project gallery; source map is absent from that
  project. Preview, exact download and AI row lookup were checked successfully.
- `existing-region.png` / `existing-gallery-proof.json`: existing local project
  gallery, exact download, AI row lookup and unchanged map confirmed.

The gallery capture only permits read bridge channels (including project.open,
which opens the existing folder); project writes are blocked. A first capture
blocked project.load because it uses POST. Later attempts coincided with the
local server shutting down. The final existing-project capture uses the restarted
server and the corrected channel allowlist. Failure images are not shipped.

The source project has earlier local-only differences in other experimental maps.
Those were preserved, not bulk-synchronized; only map_forest_cliff_village is
asserted identical between the local project and Supabase.

No Vitest suite, full typecheck, gates, build or GitHub CI was run. This change
used browser inspection, native document round trips, content connectivity audits
and git diff --check. Prior GPT-6 Astra sprite processing review and pixel metrics
are beside the eleven PNGs in generated/forest-harmony/village-unfake-v1.
