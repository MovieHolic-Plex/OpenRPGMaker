# Reviewed house catalog — 2026-09-12

The editor now distinguishes reusable **objects** (including building exteriors),
usable **spaces** (rooms, floors, yards), and connected **places** (facilities or
settlements). A graphic does not imply rooms or navigation.

## Published content

- Supabase project: `rpg-zzu-house-template-gallery`.
- 15 reviewed exterior objects, 15 yard spaces, 4 reusable room spaces, 15 facility places.
- Two instantiated examples: `house-example:inn-3f` and `house-example:workshop-4f`.
  These contain two yards and seven indoor maps, with explicit bidirectional doors/stairs.
- `supabase-proof.json`: real save followed by a full-project deep-equal reload;
  library SHA256 independently recomputed by the review agent.
- `discovery-proof.json`: registered list tools discover 15 objects, 19 spaces and 15 places.
  All 15 places also passed registered get/preview/apply tools on detached project copies.
  This is tool-runner verification, not a live LLM-provider conversation.
- Existing maps, start position, atlas fields and existing kits were preserved against
  the latest loaded baseline. Missing reviewed house kits were restored from their recipes.
  Earlier gallery-map evidence is historical; the live examples are the map IDs in the receipt.
- Excluded house chips: 196, 197, 226, 227, 256, 257. Balcony study 08 remains excluded.

`connected-houses.png` uses the actual editor tile renderer on the Supabase-reloaded
project. It shows the exterior and every usable floor of both examples. Interiors
are basic reusable rooms; they are not bespoke furnished plans for every facade.
`editor-place.png` and `editor-proof.json` cover the editor's category guidance and
atomic exterior picker, using a minimum contract fixture with remote writes blocked.
The picker changes the draft, and does not silently save it.

## Persistence prerequisite

The configured database was missing the already-tracked spatial activation/save RPCs.
Applied the unchanged `supabase/migrations/20260907000000_spatial_authoring_cas.sql`
after checking zero canonical project markers, pgcrypto in `extensions`, and no
additional RLS/FK/user-trigger constraints on the affected tables. Reloaded PostgREST's
schema cache. The migration adds canonical write fences without rewriting legacy
project payloads. Publication used raw activation and the returned CAS authority.

Do not blindly reapply that non-idempotent migration. Other environments need its
prerequisites checked before enabling canonical content.

## Reproduce

Configure `.env.local` for the project above. With the repository dependencies installed:

```sh
# Read-only preview: loads Supabase, registers on copies, checks every place.
npx tsx scripts/register-house-spatial-catalog.mts
# Authorized publication: save and reload, producing reloaded-project.json.
npx tsx scripts/register-house-spatial-catalog.mts --apply
npm run qa:runtime -- --scenario house-spatial-catalog --project output/evidence/house-spatial-catalog/reloaded-project.json
npm run qa:runtime -- --scenario house-spatial-catalog-4f --project output/evidence/house-spatial-catalog/reloaded-project.json
```

Each runtime scenario starts a fresh `player.html` session, teleports only to set up
its yard, then walks through doors and every floor in both directions. The two
examples do not have an authored inter-house link. Short entry/top-floor moves use
ordinary input: forced routes can bypass the preceding transfer event's fade-in lock.
Read each runtime `SUMMARY.md` before its failure screenshots.

## Validation and review

- Three Astra high agents: AI/tool contract, isolated editor UI implementation, read-only
  adversarial review. The supervising agent integrated the commits and ran checks.
- Dedicated runtime: 3-floor scenario **9/9**, 4-floor scenario **11/11**; no runtime errors.
  See `runtime-3f.md` / `runtime-4f.md` and their manifests.
- Final app typecheck gate: pass, no regression against the repository baseline.
- Focused catalog/AI/UI/facility/village suites: 77 tests passed; after updating the
  obsolete fourth-floor rejection, schema/facility/village suites: 70 tests passed.
- OpenWiki verification and `git diff --check`: pass.
- Full `npm run gates`: **not green**. Typecheck and CSS checks passed; the full test
  run had 503 failures and surface checks retained snapshot mismatches. The immediately
  preceding same-task run was already red (501 failures). Both runs reported the same
  45 failing-file additions against the older tracked baseline. The changed fourth-floor
  contract was then corrected and all 59 spatial schema tests passed. These numbers do
  not establish that every unrelated failure is pre-existing; full-suite CI remains a limit.
- Review fixes include receipt-based object identity reuse, ground supplied by yard
  spaces, one shared facility floor policy, atomic exterior selection, and excluding
  future lake/yard areas from the auxiliary riverbank tree placement.
