# Monster campaign menu and permanent journal (2026-10-03)

`system.monsterCampaign` opts an authored game into three ESC → 기록 commands:
몬스터 도감, 지역 지도, 배지·목표. Games without this definition retain their existing
commands and collection behavior. The definition contract is
`docs/content/monster-expedition-contract.md`; the UI helper temporarily mirrors it
as `MonsterCampaignDefinition` in `src/project/monsterJournal.ts` so isolated agents
can build before the shared `SystemRecords` field is integrated.

## Ownership and receipts

- `playerMonsterCampaignMenu.ts` owns species ecology/skills/evolution detail, the
  region graph and acquired badge/next objective views. Native status-menu buttons
  retain controller keyboard focus and touch activation; the dex detail has a
  touch-accessible 목록 action as well as the controller's nested Esc back action.
- `monsterJournal.ts` owns `session.switches['mx_seen_'+speciesId]` and
  `session.switches['mx_caught_'+speciesId]`. Species must belong to the campaign.
  Caught implies seen. Existing ownership supplies the old-save fallback; the
  collection menu promotes existing instances to permanent receipts.
- Successful `giveMonster` and evolution register receipts. Successful release,
  trade and fusion register the departing species before deleting its instance,
  preserving old saves even if the player never opened the dex. Boxing never
  clears receipts. Failed actions do not register new caught species.
- `battleDom` supplies its already-created visible-enemy snapshot through an
  optional `onSnapshot` callback; `playSceneBattle` attaches it only for campaigns.
  Hidden troop members never enter that snapshot. Late revealed enemies are
  discovered when the existing view updates. This adds no new per-frame snapshot.
- Capture receipts come from `giveMonster` in the canonical battle-exit commit,
  after cancellable presentation. Campaign defeat (including canLose) issues no
  captured instances. Cancelled exits never reach the commit. The existing
  noncampaign capture policy is preserved. The commit preserves true journal
  receipts across the battle's older seeded switch copy.
- Save slots already preserve arbitrary switches; there is no save-schema change.

## UI data and map

Unknown species show only their dex number and `???`, with no art, species name,
notes, types or evolution target identity. A discovered species exposes its actual
front resource, authored notes, base stats, evolution requirements and learned
skills/PP from database records. The configured roster order is the dex order.

The region map uses authored location coordinates. Lines derive from actual
nested `transfer` commands rather than inventing connections. A building's
current marker resolves to its nearest named exterior through these transfers.
The current exact map name is also shown. The location list scrolls by keyboard
and touch. Badges read their switches; the next objective is the first incomplete
objective whose prerequisite switch is true (or absent).

`styles/runtime/monsterCampaignMenu.css` is loaded by the runtime index after
pixel windows; all selectors are scoped to campaign pages. Logical player size
remains 320×240. The default pixel menu owns window chrome and fonts.

## Browser evidence and limitations

`verify-shots/monster-campaign-menu/SUMMARY.md` records an engine-only 60-species
fixture with placeholder artwork. It exercises the native menu controller, ESC
and Enter navigation, touch actions, unknown information hiding, live badges,
prerequisite objectives, give/evolve/box/release receipts, defeat/victory capture
and save-snapshot roundtrip. This is not final authored-game or SQLite evidence.

Reproduce with a running `npm run dev:worktree`, then
`OPRN_QA_URL=http://127.0.0.1:<port> node scripts/qa/runtime/monster-campaign-menu.probe.mjs`.
The probe runs no suites or typecheck. The campaign supervisor owns final
shipping-player QA and SQLite save/reload evidence.

## Authored field menu and assistant tools (2026-10-04)

`meta.oprnFieldMenu` is the version1 authored command/label/order contract in
`src/project/fieldMenu.ts`. Keeping it in metadata lets older SQLite hosts preserve
it. Runtime reads this contract directly; intrinsic availability/access gates
still apply. Collector preset: dex, monsters, items, trainer-card, region-map,
campaign-progress, save, options. It uses `field-list`; configuring the menu also
updates an existing `fieldHud.menuStyle`, which otherwise overrides system style.

`trainer-card` shows the actual trainer identity, current place, party size,
seen/caught counts, badges and money. It does not fabricate actor combat stats.
The menu controller clamps the selection to available authored entries on render;
a hidden default Items command cannot remain selected on first boot. All command
icon, dispatch and controller switches must include a newly added command.

Assistant tools: `read_game_systems`, `configure_field_menu`,
`configure_monster_campaign`, `review_game_systems`; `configure_monster_system`
can explicitly select `rules:gen1`. Reads expose effective commands and report
incompatible collection/party/rules/campaign combinations. Campaign definitions
validate actual species, map and switch references before mutation. They do not
award species, badges or overwrite the play session. Native input/save proof is
separate from configuration review.

PiGameSystemProduction records actual read/review receipts and fingerprints final
system/menu/audio/map-BGM settings. Successful system/music writes require an actual
read and review after the last change; stale or inconsistent reviews enter the
existing bounded repair loop. Done receipts expose remaining issues and explicitly
keep playbackVerified:false. This does not establish native gameplay or hearing.
