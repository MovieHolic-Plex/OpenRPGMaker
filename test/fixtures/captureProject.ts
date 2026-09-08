// test/fixtures/captureProject.ts
//
// 표면 스냅샷 게이트 전 축이 공유하는 **고정 캡처 프로젝트**.
//
// 왜 createBlankProject() 를 그대로 쓰지 않는가 — 실측:
//   기준선 testid 항목 2,836 중 768(27%)와 select 옵션 값 5,694 중 1,732(30%)가
//   createBlankProject() 의 DB 레코드 id 였다. shop 폼의 testid 610개 중 566개가
//   shop-item-check-<itemId> / shop-item-row-<itemId>(아이템 208종), changeFace 의 129개 중
//   113개가 페이스셋 옵션이다.
//   이 저장소는 아이템·적·리소스 카탈로그를 활발히 늘린다(최근만 해도 아이템 48종 추가).
//   즉 폼과 아무 상관 없는 DB 편집이 게이트를 빨갛게 만들고, 그걸 *_SURFACE_UPDATE=1 로
//   통째 갱신하는 습관이 생기면 같은 diff 안에 있던 진짜 컨트롤 소실이 그대로 승인된다.
//   (과제 A 진행 중 실제로 한 번 일어난 경로다.)
//
// 그래서 열거 대상 컬렉션을 앞 N개로 절단한다. 렌더 경로는 그대로 탄다 — 목록 루프는
// 3개로도 돌고, 없는 id 를 참조하는 픽스처가 내는 검증 경고도 그대로 남는다(경고 노드는
// 텍스트 축이 보는 대상이라 유지돼야 한다).
//
// 절단하지 않는 것: maps / tilesets / system / session / meta / mapTree.
// 폼이 존재를 가정하고 읽는 구조라 줄이면 렌더 자체가 달라진다.
// (아래 seedProbedRecords 는 maps / mapTree / system 에 **더한다** — 절단이 아니라 하한이다.)
//
// ── 절단할 수 없는 것: 정적 자산 매니페스트 (실측, 의도된 한계) ─────────────────────
// changeFace 폼의 testid 129개 중 112개가 페이스셋 낱장 셀(7시트 × 16셀)이고, 이건
// 프로젝트 데이터가 아니라 **모듈 상수**에서 온다:
//   src/assets/facesetFaceAssets.ts  FACESET_FACE_ASSETS (113개)
//   src/assets/easyrpgRtp.ts         LEGACY_FACESET_SHEET_ASSETS
// facesetPreview.ts 가 이 상수를 직접 import 하므로 store 를 갈아도 줄지 않는다.
//
// 그래서 절단하지 않고 **그대로 둔다**. `vi.mock` 으로 막을 수는 있지만 그러면 이 게이트의
// 설계 전제("렌더 경로를 그대로 탄다")가 깨져, 폼이 실제로 무엇을 그리는지 보증하지 못한다.
// 내장 페이스셋 시트를 추가하면 changeFace 축이 시트당 testid 16개만큼 빨개진다 —
// 이건 거짓 빨강이 아니라 **진짜 표면 변화**이고(갤러리에 선택지가 실제로 늘었다),
// diff 가 `testid 신규 16종 [easyrpg-faceset-xxx-00 …]` 로 정확히 지목하므로 한 줄로
// 리뷰된다. DB 레코드 절단이 필요했던 이유(shop 한 폼에서 566개가 흔들림)와 규모가 다르다.
//
// ── 절단은 천장만 덮었다: 바닥이 빠져 축이 빨간 채로 굳었다 (2026-09-09 실측) ─────────
// 위 절단은 "카탈로그가 늘어도 게이트가 흔들리지 않게" 하는 **상한**이다. 그런데 이 파일은
// 하한을 두지 않았다 — 열거 대상 컬렉션이 `createBlankProject()` 에서 **0개로 줄어들면**
// 그대로 0개를 물려받는다. 그 사이 빈 프로젝트가 가벼워지면서 커밋 프로브 축이 결정적으로
// 빨개져 방치됐다. origin/main 에서 이 파일을 실측한 값:
//
//   commonEvents: 0                     · maps: 1개(map_blank_start), 그 맵의 events: 0
//   system.craftRecipes / system.itemUpgrades / endings: 아예 없음(undefined)
//   assets.uploaded: 0  (resourceProfiles 36개 중 kind "movie" 는 0)
//   database.actors  [actor_hero, actor_guardian, actor_mage]
//   database.classes [class_hero, class_guardian, class_mage]
//   database.troops  [troop_slime, troop_slime_pair, troop_bat_swarm]
//   database.monsterSpecies [species_leafling, species_sparkit, species_aqualing]
//
// 이 상태가 프로브에 두 가지로 나타났다(원인은 하나다 — 고를 것이 없다):
//
//  1) **열거가 0이면 select 에 placeholder 한 줄만 남는다.** 프로브는 "현재와 다른 값"을
//     넣어야 조작이 성립하므로 후보가 0이면 `single-option` 으로 건너뛰고 commitCount 가 0이
//     된다. callCommonEvent / callMapEvent / craftRecipe / applyItemUpgrade / triggerEnding 과
//     playMovie 의 리소스 select 가 전부 이 경로였다(하한선 6건 미달).
//
//  2) **`<select>` 는 옵션에 없는 값을 담지 못한다.** 실제 브라우저와 같이 test/fakeDom.ts 의
//     SELECT 는 `value` 대입을 `selectedIndex = findIndex(...)` 로 처리하므로(fakeDom.ts:340-347)
//     없는 id 를 넣으면 selectedIndex 가 -1 이 되고 `value` 는 `""` 를 돌려준다. 그래서
//     minimalCommands.ts 가 쓰는 합성 id(`actor1`/`map1`/`troop1`/`class1`/`species1`/`res1`)를
//     폼이 DOM 에서 되읽는 순간 `""` 로 내려앉아, 저장된 커맨드가 `"actorId":""` 가 됐다.
//     addFollower 는 빈 값을 아예 필드 생략으로 취급해 `actorId` 키가 사라졌다.
//     **프로덕션 결함이 아니다** — 같은 보고서에서 실재 id(`"actorId":"actor_mage"`)는 그대로
//     보존됐다. 픽스처가 존재하지 않는 것을 가리킨 것이 원인이다.
//
// 그리고 `""` 로 내려앉은 축은 감지력을 잃는다: 폼이 actorId 를 **떨어뜨리는** 회귀가 나도
// 기준선은 이미 `""` 라서 아무 차이가 없다. 그래서 프로브가 조작하는 폼들이 열거하는
// 레코드를 **직접 심는다**(seedProbedRecords). 규칙 세 개:
//
//   * 상한(절단)은 그대로 두고 **절단 뒤에** 심는다 — 심은 것이 KEEP 에 잘려나가지 않게.
//   * 픽스처가 참조하는 **합성 id 그대로** 심는다. 그러면 프로브가 재는 것이 기본 카탈로그의
//     내용이 아니라 "폼이 명령의 값을 DOM 에 실어 되돌려 놓는가" 라는 배선 그 자체가 된다.
//   * 슬롯마다 **2개**를 심는다. 1개면 현재값이 그 1개라서 프로브가 고를 수 있는 후보가
//     placeholder(`""`) 뿐이고, 커밋값이 다시 `""` 가 되어 (2)의 감지력 손실이 그대로 남는다.
//     2개면 프로브가 **실재 id** 로 바꿔 커밋하므로 값이 왕복하는지 실제로 보인다.
//
// 심은 레코드는 기본 카탈로그 레코드를 structuredClone 해 id·이름만 갈아 만든다 — 스키마가
// 자라도(필수 필드 추가) 픽스처가 조용히 무효 레코드를 넣지 않는다. 템플릿이 없으면 던진다:
// 조용히 건너뛰면 다시 오늘의 상태(축이 빨간 채로 굳음)로 돌아간다.
//
// ── 왜 시드가 createCaptureProject() 안이 아니라 별도 팩토리인가 (실측 후 결정) ────────
// 처음에는 공유 팩토리(createCaptureProject)에 그대로 심었다. 한 세계를 전 축이 공유하는
// 것이 이 파일의 설계이므로 그게 맞아 보였다. **그런데 재 보니 다른 축이 깨졌다** —
// npm run gates:surface 로 측정한 차이(시드 전 8건 실패 → 시드 후 9건, 새로 깨진 것 3건):
//
//   * 포털 축 `preserves pre-feature picker control identities and signatures`
//     — PRE_FEATURE_PICKER_CONTROL_SHA256 이 픽커 컨트롤 집합의 **하드코딩 sha256** 이다.
//       배우 하나를 더하면 companion-card-actor1 이 생겨 해시가 달라진다. 그 축의 하드 계약
//       상수를 고치지 않고는 되돌릴 수 없다.
//   * 상호작용 축 `반응하던 컨트롤이 no-change 로 퇴화하지 않는다`
//     — callCommonEvent / triggerEnding / moveEvent 의 select 가 «선택지가 생겨서» 조작
//       가능해졌는데 그 폼들은 재렌더 반응이 없어 «반응 퇴화» 래칫에 걸린다.
//       (그 래칫은 INTERACTION_ALLOWLIST_UPDATE=1 로만 갱신되는데, 기준선보다 위험한
//        갱신이라 이 작업 범위 밖이다.)
//   * 조건/열거값 축 `기준선과 일치한다` — 시드 전 **초록**이던 축이 배우/적그룹 옵션
//     4→5종 때문에 6줄 빨개진다.
//
// 그리고 축마다 **원하는 풍부함이 실제로 반대**라는 증거가 있다: playMovie 표시면은 고른
// 리소스가 해석되지 않을 때만 번들 샘플 안내를 그리므로, 동영상을 심으면 폼 축의 표면이
// **줄어든다**(CAPTURE_SEED_IDS.movies 주석의 실측). 표면 존재를 재는 축과 커밋 배선을 재는
// 축은 같은 세계를 원하지 않는다.
//
// 그래서 공유 팩토리는 손대지 않고, 시드를 얹은 **커밋 프로브 전용 층**을 따로 낸다
// (createCommitProbeProject). 두 함수가 같은 파일에 있어야 다음 사람이 절단(상한)과
// 시드(하한)를 한 화면에서 본다 — 파일을 나누면 그게 흩어진다.
// 다른 축도 같은 하한이 필요해지면 그 축의 하드 계약·래칫과 함께 별도 커밋으로 옮길 일이다.
import { createBlankProject } from "@/project/defaults";
import type {
  CommonEvent,
  EndingDef,
  GameEvent,
  GameMap,
  Project,
  ResourceProfile,
  UploadedAsset,
} from "@/project/types";

/** 열거 UI 를 채우기에 충분하고, 카탈로그 증감에 흔들리지 않는 최소 개수. */
const KEEP = 3;

/** database 하위에서 절단할 배열 키. 값이 배열이 아니거나 없으면 건너뛴다. */
const DATABASE_COLLECTIONS = [
  "actors",
  "classes",
  "skills",
  "items",
  "equipment",
  "enemies",
  "troops",
  "states",
  "elements",
  "terrains",
  "battleCommands",
  "battleAnimations",
  "monsterSpecies",
  "crops",
  "lifeSkills",
  "farmAnimalSpecies",
  "fishSpecies",
  "farmBuildingTypes",
  "homeDecorationTypes",
] as const;

/** 최상위에서 절단할 배열 키. */
const ROOT_COLLECTIONS = ["switches", "variables"] as const;

function truncate<T>(list: T[] | undefined, keep = KEEP): T[] | undefined {
  return Array.isArray(list) ? list.slice(0, keep) : list;
}

/**
 * resourceProfiles(실측 618개)는 kind 별로 갈라 쓰인다 — charset/faceset/bgm/se/picture 픽커가
 * 각자 자기 kind 만 필터한다. 통째로 앞 3개만 남기면 어떤 픽커는 선택지가 0이 되어
 * "옵션 목록"이라는 렌더 경로 자체가 사라진다. 그래서 kind 별로 KEEP 개씩 남긴다.
 */
function truncateResourceProfiles(list: ResourceProfile[]): ResourceProfile[] {
  const perKind = new Map<string, number>();
  const out: ResourceProfile[] = [];
  for (const profile of list) {
    const n = perKind.get(profile.kind) ?? 0;
    if (n >= KEEP) continue;
    perKind.set(profile.kind, n + 1);
    out.push(profile);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 하한: 프로브가 조작하는 폼이 열거하는 레코드를 직접 심는다
// ---------------------------------------------------------------------------

/**
 * 픽스처가 참조하는 합성 id. **test/fixtures/minimalCommands.ts 와
 * test/fixtures/branchFixtures.ts 의 값과 글자 그대로 같아야 한다** — 다르면 select 가
 * 그 값을 담을 수 없어 폼이 `""` 를 되읽고, 축은 "커밋은 되지만 값은 빈 문자열"이라는
 * 감지력 없는 기준선으로 굳는다(머리 주석 (2)).
 */
export const CAPTURE_SEED_IDS = {
  /** callMapEvent 가 열거하는 맵. 그 폼은 project.maps 가 아니라 **에디터의 현재 맵**을 읽는다. */
  map: "map1",
  /** 이 맵에 심는 이벤트. moveEvent / callMapEvent 가 열거한다. */
  events: ["ev1", "ev2"],
  commonEvents: ["ce1", "ce2"],
  recipes: ["recipe1", "recipe2"],
  upgrades: ["upgrade1", "upgrade2"],
  endings: ["ending_true", "ending_bad"],
  /**
   * playMovie 의 리소스 픽커용 업로드 자산(kind "movie"). resourceProfiles 가 아니다.
   *
   * **일부러 `res1` 을 쓰지 않는다.** minimalCommands.ts 는 `res1` 하나를 네 kind 가
   * 돌려쓴다 — changeFace(faceset) / showPicture(picture) / playAudio(음악) / playMovie(동영상).
   * 한 업로드 자산은 kind 가 하나뿐이라 넷 다 만족시킬 수 없고, `res1` 을 동영상으로
   * 등재하면 다른 축의 **하한선이 깨진다**(실측):
   *   폼(kind)   playMovie.testidCount 16 → 15, playMovie.textCount 5 → 4
   *   상호작용   playMovie.initialTestidCount 16 → 15, showPicture.reactingCount 4 → 3
   * 원인: playMovie 표시면은 고른 리소스가 **해석되지 않을 때만** 번들 샘플 안내
   * `play-movie-sample-note` 를 그린다(playMoviePreview.ts:96-104). `res1` 이 실재하는
   * 동영상이 되면 그 안내가 사라져 testid 가 하나 줄고, showPicture 쪽은 `res1` 이
   * 업로드 자산으로 해석되면서 반응하는 컨트롤이 하나 줄었다.
   * 커밋 프로브의 빨강을 다른 축 하한선 위반 2건과 맞바꾸는 셈이므로 하지 않는다.
   *
   * 대신 별도 id 2개만 심는다. 그러면 픽커에 실재 선택지가 생겨 프로브가 리소스 select 를
   * 조작할 수 있고(playMovie.commitCount 2 → 3), `res1` 은 어느 축에서도 해석되지 않던
   * 기존 상태 그대로 남는다. 대가는 playMovie 의 wait/skippable 커밋이 `resourceId: ""` 로
   * 기록되는 것이다 — 이건 픽스처가 등재되지 않은 id 를 가리킨다는 **사실의 정직한 기록**이다.
   */
  movies: ["movie1", "movie2"],
  actor: "actor1",
  class: "class1",
  troop: "troop1",
  species: "species1",
} as const;

/**
 * 기본 카탈로그의 첫 레코드를 복제해 id·이름만 갈아 심는다.
 *
 * 왜 리터럴로 만들지 않는가: 레코드 스키마에 필수 필드가 추가되면 손으로 쓴 리터럴은 조용히
 * 무효가 되고(렌더가 폴백을 타거나 예외가 난다) 그 원인이 픽스처에 있다는 게 안 보인다.
 * 복제는 스키마를 자동으로 따라간다. 대신 **템플릿이 없으면 던진다** — 조용히 건너뛰면
 * 열거가 0개인 채로 축이 다시 빨개지고, 그 빨강이 오늘처럼 방치된다.
 */
function seedClonedRecord(list: unknown[] | undefined, key: string, id: string, name: string): void {
  if (!Array.isArray(list)) throw new Error(`캡처 프로젝트 시드: ${key} 가 배열이 아니다 (id=${id})`);
  if (list.some((row) => (row as { id?: unknown }).id === id)) return;
  const template = list[0];
  if (!template) {
    throw new Error(
      `캡처 프로젝트 시드: ${key} 가 비어 있어 ${id} 를 복제할 템플릿이 없다 — ` +
        `기본 DB 에서 ${key} 가 사라졌는지 확인하라(절단 KEEP=${KEEP} 보다 먼저 비었다는 뜻이다).`
    );
  }
  list.push({ ...(structuredClone(template) as Record<string, unknown>), id, name });
}

/** 프로브가 조작하는 폼이 실제로 고를 수 있는 것을 갖도록 최소 레코드를 심는다. */
function seedProbedRecords(project: Project): void {
  const db = project.database as unknown as Record<string, unknown>;

  // ── 열거형 DB 레코드: 픽스처의 합성 id 를 실재 옵션으로 만든다 ─────────────────────
  // 필요한 폼(실측): actor1 → learnSkill / changeExp / changeLevel / changeActorHp /
  //   changeActorMp / enterHeroName / changeParty / changeEquipment / promoteActor / addFollower
  //   (10개 kind 가 전부 `"actorId":""` 로 내려앉아 있었다. addFollower 는 키가 사라졌다.)
  // class1 → promoteActor(toClassId 가 `<undefined>` 였다), troop1 → battleProcessing,
  // species1 → giveMonster / evolveMonster.
  // 맨 뒤에 붙인다 — 앞에 끼우면 기존 옵션의 문서순 서수가 밀려 무관한 축까지 빨개진다.
  seedClonedRecord(db.actors as unknown[], "database.actors", CAPTURE_SEED_IDS.actor, "프로브 배우");
  seedClonedRecord(db.classes as unknown[], "database.classes", CAPTURE_SEED_IDS.class, "프로브 직업");
  seedClonedRecord(db.troops as unknown[], "database.troops", CAPTURE_SEED_IDS.troop, "프로브 적그룹");
  seedClonedRecord(
    db.monsterSpecies as unknown[],
    "database.monsterSpecies",
    CAPTURE_SEED_IDS.species,
    "프로브 몬스터"
  );

  // ── commonEvents: callCommonEvent 의 select 를 채운다(빈 프로젝트는 0개) ───────────
  const commonEvents: CommonEvent[] = CAPTURE_SEED_IDS.commonEvents.map((id, index) => ({
    id,
    name: `프로브 공통 이벤트 ${index + 1}`,
    trigger: "none",
    commands: [],
  }));
  project.commonEvents = [...project.commonEvents, ...commonEvents];

  // ── 두 번째 맵 + 그 맵의 이벤트: callMapEvent / moveEvent 가 열거한다 ──────────────
  // 빈 프로젝트의 맵을 복제한다 — 타일셋 id·타일 배열 길이가 스키마와 항상 맞는다.
  // 기존 맵(map_blank_start)은 지우지 않는다: startMapId·startPos·mapTree 가 그것을 가리키고,
  // 맵 select 의 첫 실재 옵션이라 지우면 transfer/changeTile 의 기본 해석이 바뀐다.
  const templateMap = Object.values(project.maps)[0];
  if (!templateMap) throw new Error("캡처 프로젝트 시드: 복제할 맵이 없다 — 빈 프로젝트에 맵이 0개다.");
  const seededMap = structuredClone(templateMap) as GameMap;
  seededMap.id = CAPTURE_SEED_IDS.map;
  seededMap.name = "프로브 맵";
  seededMap.events = CAPTURE_SEED_IDS.events.map((id, index): GameEvent => ({
    id,
    name: `프로브 이벤트 ${index + 1}`,
    x: 1 + index,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
  }));
  project.maps[seededMap.id] = seededMap;
  // maps 에만 넣고 mapTree 에 안 넣으면 맵 목록 UI 가 "행 없는 맵"을 갖게 된다 —
  // 두 구조가 어긋난 프로젝트는 이 저장소에 존재하지 않으므로 트리에도 노드를 단다.
  project.mapTree.children = [...project.mapTree.children, { mapId: seededMap.id, children: [] }];

  // ── system.craftRecipes / system.itemUpgrades: 두 폼이 여기만 읽는다 ───────────────
  // (craftRecipesOf → project.system.craftRecipes, upgradeRulesOf → project.system.itemUpgrades.
  //  둘 다 optional 이라 빈 프로젝트에는 키 자체가 없다 → 픽커 옵션 0개 → single-option.)
  const itemIds = project.database.items.map((item) => item.id);
  const [firstItem, secondItem] = [itemIds[0] ?? "item1", itemIds[1] ?? itemIds[0] ?? "item1"];
  project.system = {
    ...project.system,
    craftRecipes: [
      ...(project.system.craftRecipes ?? []),
      ...CAPTURE_SEED_IDS.recipes.map((id, index) => ({
        id,
        name: `프로브 레시피 ${index + 1}`,
        ingredients: [{ itemId: firstItem, count: 1 }],
        outputItemId: secondItem,
        goldCost: 10 * (index + 1),
      })),
    ],
    itemUpgrades: [
      ...(project.system.itemUpgrades ?? []),
      ...CAPTURE_SEED_IDS.upgrades.map((id, index) => ({
        id,
        fromItemId: firstItem,
        toItemId: secondItem,
        goldCost: 20 * (index + 1),
      })),
    ],
  };

  // ── endings: triggerEnding 의 select. 조건을 빈 배열로 두지 않는다 ─────────────────
  // 조건 0개인 엔딩은 검증 경고를 만들고(collectEndingWarnings) 그 경고 노드는 텍스트 축이
  // 보는 대상이다 — 픽스처가 무관한 경고를 새로 만들면 안 된다. 실재 스위치를 조건으로 쓴다.
  const switchId = project.switches[0]?.id;
  if (!switchId) throw new Error("캡처 프로젝트 시드: 엔딩 조건에 쓸 스위치가 없다.");
  const endings: EndingDef[] = CAPTURE_SEED_IDS.endings.map((id, index) => ({
    id,
    name: `프로브 엔딩 ${index + 1}`,
    conditions: [{ kind: "switch", switchId, value: true }],
    priority: index + 1,
  }));
  project.endings = [...(project.endings ?? []), ...endings];

  // ── 동영상 업로드 자산: playMovie 의 리소스 픽커 ──────────────────────────────────
  // listMovieResources 는 resourceProfiles 가 아니라 **assets.uploaded** 를 훑고
  // `kind === "movie"` 를 근거로 삼는다(playMoviePreview.ts:38-43). 빈 프로젝트의
  // uploaded 는 0개라 픽커에 placeholder 한 줄만 있었다.
  // dataUrl 을 진짜 video 데이터 URL 로 둔다 — 표시면(resolveMovieResourceUrl)이 재생 경로를
  // 그대로 타야 "고르는 곳과 재생되는 곳이 한 표면"이라는 그 폼의 설계를 실제로 검증한다.
  // 이름은 픽커가 이름 오름차순으로 정렬하므로(같은 파일 42행) 순서를 못박아 준다.
  for (const [index, id] of CAPTURE_SEED_IDS.movies.entries()) {
    const asset: UploadedAsset = {
      id,
      name: `프로브 동영상 ${index + 1}`,
      kind: "movie",
      dataUrl: "data:video/webm;base64,GkXfo0AgQoaBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwA=",
      meta: {},
    };
    project.assets.uploaded[id] = asset;
  }
}

/**
 * 캡처 전용 프로젝트. 호출마다 새 객체를 만든다(테스트 간 오염 방지).
 * store.replace(createCaptureProject()) 형태로 쓴다.
 *
 * 표면 존재를 재는 축(폼 / M2 / 셸 / 조건 / 포털 / 상호작용)이 이것을 쓴다. 절단(상한)만
 * 적용하고 시드(하한)는 얹지 않는다 — 이유는 머리 주석의 "왜 별도 팩토리인가" 절.
 */
export function createCaptureProject(): Project {
  const project = createBlankProject();

  const db = project.database as unknown as Record<string, unknown>;
  for (const key of DATABASE_COLLECTIONS) {
    const cut = truncate(db[key] as unknown[] | undefined);
    if (cut) db[key] = cut;
  }

  const root = project as unknown as Record<string, unknown>;
  for (const key of ROOT_COLLECTIONS) {
    const cut = truncate(root[key] as unknown[] | undefined);
    if (cut) root[key] = cut;
  }

  if (Array.isArray(project.resourceProfiles)) {
    project.resourceProfiles = truncateResourceProfiles(project.resourceProfiles);
  }

  return project;
}

/**
 * **커밋 프로브 축 전용 캡처 프로젝트.** 공유 프로젝트 + 프로브가 조작하는 폼이 열거하는
 * 레코드의 하한(seedProbedRecords).
 *
 * 순서가 계약이다: **절단(상한) → 시드(하한)**. 뒤집으면 심은 레코드가 KEEP 에 잘려나가
 * 이 파일이 고치려는 상태(열거 0개)로 그대로 되돌아간다.
 *
 * 이 프로젝트만으로는 부족한 폼이 하나 있다 — callMapEvent 는 `project.maps` 가 아니라
 * `editorState.currentMapId` 를 읽는다. 호출부(test/eventEditorCommitProbe.ts)가
 * CAPTURE_SEED_IDS.map 으로 현재 맵을 세우는 것까지가 한 세트다.
 */
export function createCommitProbeProject(): Project {
  const project = createCaptureProject();
  seedProbedRecords(project);
  return project;
}

/** 절단 결과 요약 — 진단·보고용(어떤 컬렉션이 몇 개로 줄었는지). */
export function captureProjectShape(project: Project = createCaptureProject()): Record<string, number> {
  const db = project.database as unknown as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const key of DATABASE_COLLECTIONS) {
    const list = db[key];
    if (Array.isArray(list)) out[`database.${key}`] = list.length;
  }
  for (const key of ROOT_COLLECTIONS) {
    const list = (project as unknown as Record<string, unknown>)[key];
    if (Array.isArray(list)) out[key] = list.length;
  }
  out.resourceProfiles = project.resourceProfiles?.length ?? 0;
  // 시드(하한) 슬롯도 같이 낸다 — 절단만 보고하면 "왜 축이 빨간가"의 절반만 보인다.
  // 공유 프로젝트를 넘기면 이 값들은 시드 전 상태(0/1)를 보여 주고,
  // createCommitProbeProject() 를 넘기면 심은 뒤 값을 보여 준다.
  out.commonEvents = project.commonEvents.length;
  out.maps = Object.keys(project.maps).length;
  out["maps.seededEvents"] = project.maps[CAPTURE_SEED_IDS.map]?.events.length ?? 0;
  out["system.craftRecipes"] = project.system.craftRecipes?.length ?? 0;
  out["system.itemUpgrades"] = project.system.itemUpgrades?.length ?? 0;
  out.endings = project.endings?.length ?? 0;
  out["assets.uploaded"] = Object.keys(project.assets.uploaded).length;
  return out;
}
