# 별빛섬 몬스터 원정

An original complete monster campaign authored as an ordinary `Project`, using
the shipping Gen1 battle, collection, interpreter, save and menu systems.

## Source and regeneration

- `src/project/examples/monsterExpedition/index.ts`: composes a fresh project and
  round-trips it through the canonical loader; retains the seven current monster
  chipsets and their shared reference documents for the editor.
- `world.ts` / `worldPlan.ts`: 72 maps, 142 directed door/route connections, 8 gyms,
  company rescue/beacon events, 5 league rooms, ending and 6 repeatable postgame rares.
  The current project has 360 events and 44 authored trainer/story battles.
- `mapTemplates.json`: reviewed I6 native sample arrays. Its generator is
  `scripts/content/monster-expedition-templates.py`; inspect the current canonical
  tileset references and images before changing tile placement.
- `roster.ts`, original creature art and audio registrars own the data/assets.
  `markers.json` contains three original event sprites, not chipset tiles.
- `opening.ts` authors three distinct prologue images (4/5/9 seconds), a single
  purpose-composed 18.3-second score and the existing title picture. The camera
  uses still-image pan/zoom; this is not animated character acting. Provenance is under
  `public/assets/monster-expedition/opening/`. SQLite owns the uploaded bytes.
- Visible character pages use same priority and overlapForbidden:true; invisible
  logic and floor portals remain passable. `npcLayout.ts` repairs 13 original seed
  positions that blocked portal bypasses, narrow corridors or ice approaches.
  Already moved author positions are preserved. Four empty-looking neighboring
  tiles alone do not prove that a solid NPC leaves a route open.
- `patch-monster-expedition-opening.mjs` applies only the opening/title/media and
  NPC page/position corrections to a freshly loaded canonical document. It preserves
  the database, session, tiles and editing references; it is not a world regeneration.
- `node scripts/content/build-monster-expedition.mjs` writes the portable project,
  public asset inventory and world manifest under `public/monster-expedition/`.
  The document with editor references goes to the private evidence directory.
- Build the player with `npm run build:player`, then
  `node scripts/content/export-monster-expedition.mjs <output-folder>` copies the
  compiled player and the standard `prepareWebExport` asset closure.
  If building the editor too, run `build:app` before `build:player`, sequentially:
  the app build cleans `dist/` including the player output. Freeze an export before
  any later build, and do not mutate a server's frozen QA directory.

## Campaign metadata contract

`SystemRecords.monsterCampaign` is optional authored metadata: roster IDs, ecology
notes, badge switch/city IDs, region coordinates and objective prerequisite IDs.
`shapeMonsterCampaign.ts` checks shape, `references.ts` checks database/map/switch
references, and `normalizeSystemRecords` preserves it during load. Runtime journal
and menu behavior is documented in `monster-campaign-menu.md`.

Game state belongs in the existing session. Badge/story/puzzle switches, tile
mutations, party instances, seen/caught receipts and learned move PP use native
save snapshots. Gym devices use `changeTile`; psychic pads set their switch before
transfer (ordinary interpreters terminate at transfer). Ice uses native slide rules.
The fire gym's lower vent mouths reset the player to its entrance; the upper steam
plume is artwork. Field HUD uses the collector configuration; dialogue uses the
handheld style. Ether restores each learned move's PP through the shared monster
medicine contract rather than actor MP.

## Storage and evidence

Canonical project `fca4b134-ed34-4365-9021-450c7ee24894` is managed by the team host,
selector `649482df-81ca-4af9-806b-2613f7d7bebb`. Use
`scripts/content/monster-expedition-store.mjs` for the host's `assets.put`, CAS save,
fresh connection load and binary media reread. Never patch the running SQLite DB.
Do not create a second canonical project when that identity file exists.

2026-10-03 follow-up: revision8 is the saved/reloaded opening/collision correction.
Fresh-connection receipt includes the original PNG byte reload. The exported player
uses that exact document except media transport and editing reference removal.
Evidence: `verify-shots/monster-opening-collision-2026-10-03/`. Spatial audit accepts
an optional project JSON and output path, so frozen artifacts can be inspected
without replacing older evidence. Static all-map reachability is distinct from
native story progression; the whole campaign has not been played through.

Opening direction follow-up: canonical revision9 contains the new dimming lighthouse,
the three unclaimed starters waiting in the lab, and mx_audio_prologue. Normal playback
is18seconds with two short captions; actual starter selection remains in the lab event.
`patch-monster-expedition-storyboard.mjs` checks that only opening and its three new
media differ; all old media refs, title settings, maps/events, database and session are
exact. Save with `monster-expedition-store.mjs save <host> <private-dir> <prepared>
<expected-source-sha>` to reject a stale prepared snapshot before media promotion.
Fresh reopen proves all three new media bytes. Do not rerun the older NPC patch to
change just this storyboard. Evidence: `verify-shots/monster-opening-direction-2026-10-03/`.

Focused content inspection commands (not suites):

```bash
node scripts/qa/runtime/monster-expedition-spatial.mjs
node scripts/qa/runtime/monster-expedition-logic.mjs
```

Spatial inspection uses actual collision and slide helpers, every authored arrival
and successive device states. Logic inspection uses the real interpreter with
prescribed battle outcomes; it proves branches and locks, not battle balance or
human play duration. Browser evidence must use compiled `player.html` with the
export store shim. QA-only input/teleport hooks stay out of the ordinary player boot.
The full native browser probe is `scripts/qa/runtime/monster-expedition-play.probe.mjs`: starter and
capture, every gym, both story chapters, league, ending, Continue and return home.
It uses QA travel and a level99 party, so it verifies integration rather than normal
difficulty. `verify-shots/monster-expedition/SUMMARY.md` records the evidence and
canonical save receipt. The export script includes static battle-skin media in
addition to the standard asset closure.

Existing repository restrictions on suites/full typecheck still apply. Do not run
gates because these inspection scripts exist. Combat pacing needs human playtesting.

## Normal-play dogfood and authoring policy (2026-10-03)

The first ordinary Lv5 run reached both grass-gym devices, then lost after 13 fire
uses and all four remaining potions: the generic `demoEnemy` even-turn policy had
given both Lv9 opponents a Lv7 full recovery. Gen1 non-link enemies do not spend PP;
`maxPp: 10` does not bound their recovery. Do not use the old level99 integration
run as normal-play balance evidence.

`enemyActions.ts` now authors damage as always eligible, support at lower priority,
and HP healing only at HP ≤35%. The roster learns early normal/grass/dragon recovery
at Lv13, after the second attack at Lv11. The first gym retains its Lv9 stats,
two members and rewards. This removes its recovery loop; HP conditions alone do not
bound recovery in later battles. Later gym balance remains unverified.

`scripts/content/patch-monster-expedition-balance.mjs` prepares this learning/action
patch on an existing host document; save it with the host CAS API and freshly load
it through `monster-expedition-store.mjs`. Do not regenerate/reset the canonical
world to patch combat. The export script's optional canonical JSON argument uses
that reloaded document and verifies all portable asset bytes against host SHA.

The complete improvement/evidence scope is
`verify-shots/monster-authoring-dogfood-2026-10-03/REPORT.md`.


## 실제 Pi 조수 제작 오프닝 · revision11 (2026-10-03)

기존 `opening.ts`의 수동 3장 seed는 이전 기준선이다. 현재 정본은 실제 Pi/이미지 제공자가
생성·등록·시각 검토한 별도 5장으로, `apply-monster-assistant-opening.mjs`가 오프닝과 새 그림만
저장 제안에 옮겼다. 첫 수정은 revision10(9생성 그림 중5장 연결), 실제 브라우저 조수의 후속
검토/수정은 revision11(그림 동일·문구/시간 개선)이다. 맵72개·DB·타이틀·시작 세션·기존141개
에셋은 이전 정본과 동일하다. 전체 자동 도입은4.5/4.5/4/4.5/7초,24.5초다.

정본 projectId `fca4b134-ed34-4365-9021-450c7ee24894`, hostProject
`649482df-81ca-4af9-806b-2613f7d7bebb`, SQLite 호스트9888, revision11 재로드SHA
`f09f724a365ab43eb4050f591216a08aa5a89b102ca9d34753be742b498c161a`.
9개 새 그림의 저장 후 바이트 재로드 증거는 revision10 receipt에, 최종 전체 문서 재로드는
revision11 receipt에 보존한다. 호스트 재시작 뒤 같은 revision11을 다시 load했다.

휴대 에셋 캐시는 `/home/main/.local/share/oprn/monster-expedition-evidence/assistant-portable-revision11.json`
(비공개 정본 SHA 일치 캐시)에 있다. `export-monster-expedition.mjs <out> <canonical> [portable-cache]`
네 번째 인자로 지정한다. 기존 저장소 seed JSON은 수동 기준선으로 유지하며 최신 정본을 대신하지 않는다.
QA/실제 모델 제작 방법과 한계: `verify-shots/monster-assistant-opening-2026-10-03/REPORT.md`.

후속 편집기 부팅 정규화가 revision14를 저장했다. 오프닝/시작 세션은 같지만 번들·DB 등은 변했다.
18301 게임은 검수한 revision11 스냅샷, 개선 조수는18364에서 같은9888 정본을 사용한다.
운영 autosweep가 임시 조수 패치를 치환하므로 영구9888 배포로 보고하지 않는다.

추가 확인: 운영 기준선에 system.monsterCampaign 계약이 없어서 revision14/15 부팅 저장에서
캠페인이 누락됐다. 고정 개선 UI에 원래 타입·normalizer·shape/reference 계약을 통합하고,
다른 최신 필드를 유지한 채 캠페인만 원본에서 복구한 revision16을 CAS 저장·fresh load했다.
9888의 이전 소스로 다시 저장하면 이 계약을 보장할 수 없으므로 개선 UI18364를 사용한다.


## Native creature refinement · 2026-10-04

`scripts/content/monster-expedition-art.py` owns all24 original anatomy painters,
three stage proportions and distinct rear detail, and independently draws32px icons.
The ordinary `configureExpeditionRoster` import of `uploaded-art.json` registers
120battle resources plus60icons into every freshly generated campaign. Existing
species IDs, front/back IDs, stats, learning and evolution data remain unchanged.
The generator has no canonical/remote store access; existing saved projects need
an explicit asset-only promotion through their standard host service.

Battle PNGs are native64×64, icons32×32, alpha0/255, integer drawing, no resource
image resize. The legacy80unit design grid is projected before rasterization.
Each sprite contains body/highlight/shadow colors, family-colored1px ink and at
most8opaque colors. Last opaque battle row61, party row29. `catalog.json` records
all180resource byte sizes/SHA/bbox/dimensions/palettes; `provenance.json` records
source/catalog/upload-seed SHA and the complete native contract.

`mx_art_<slug>_icon` is a separate single static frame. Consumers may prefer this
registered resource for a party/dex cell, with the existing front as fallback;
`MonsterSpeciesGraphic` has no icon field, so do not append an unsupported field.
The normal roster upload clone preserves isolation across project externalization.

Visual review assets: `contact-sheet.png` shows all60front/back pairs at1x;
`starter-review.png` shows all9starter-family species at3x; `rare-review.png` shows
all6rares at4x; `icon-contact-sheet.png` shows all60icons at1x. Review enlargement
never touches exported sprite bytes. The generator itself checks dimensions,
alpha, baseline, palette bound,180embedded-byte matches and120+60unique hashes.
Direct before/after inspection and all-resource byte audit are recorded privately
under `/tmp/oprn-emerald-20261004/creature-qa/`. This is asset QA; runtime/canonical
promotion and native battle/party screenshots belong to the integration owner.
