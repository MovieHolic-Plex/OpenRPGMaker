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
import { createBlankProject } from "@/project/defaults";
import type { Project, ResourceProfile } from "@/project/types";

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

/**
 * 캡처 전용 프로젝트. 호출마다 새 객체를 만든다(테스트 간 오염 방지).
 * store.replace(createCaptureProject()) 형태로 쓴다.
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
  return out;
}
