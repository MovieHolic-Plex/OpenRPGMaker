// 맵 묶음 분할·병합. 다중 에이전트가 각자 맵 하나씩 맡아 병렬로 일한 뒤 결과를 한 프로젝트로 합친다.
//
// 「맵 묶음」= 맵 + mapTree 에서 그 맵 아래 달린 부분 트리(실내 맵 등 파생 맵 포함).
// 집 시공이 실내 맵을 새로 만들면 부모 맵의 자식으로 단다(houseKitDomain). 그래서 `maps.<id>`
// 한 키만 복사하면 실내 맵과 mapTree 항목이 떨어진다 — 2026-09-09 스파이크에서 실측한 구멍.
//
// 병합은 base 를 기준으로 각 결과의 묶음만 옮긴다. 묶음 밖 변경은 버리고 `spills` 로 보고한다.
// 최종 무결성은 호출자가 commitChangeset 게이트로 확인한다(이 모듈은 게이트를 대신하지 않는다).
//
// 다만 **묶음이 새로 만든 정의는 함께 옮긴다**(2026-09-14). 맵 이벤트는 다른 컬렉션을 가리키기
// 때문이다 — `place_battle_blocker` 가 만드는 「클리어 스위치」가 그 예다. 정의를 버리면 병합본은
// 자기 이벤트가 가리키는 스위치가 없는 프로젝트가 되고, 커밋 게이트가 serialize 왕복에서 그걸
// 잡아 **에이전트가 한 일 전부를 거부**한다(실측: `/pi` → "적용 실패(commit-rejected):
// 직렬화 왕복 실패: setSwitch: switchId가 존재하지 않습니다: sw_ev_battle_<uuid>_clear").
// 옮기는 것은 «만든 것»뿐이다 — 기존 항목의 수정·삭제는 여전히 범위 밖 편집이라 버리고 보고한다.

import type { MapTreeNode, Project } from "@/project/types";

export interface MapBundleResult {
  readonly mapIds: readonly string[];
  readonly project: Project;
  /**
   * 이 결과를 만든 에이전트가 출발한 사본. 범위 밖 변경 감사에만 쓴다(병합은 언제나 `base` 위에
   * 얹는다). 비동기 배정에서는 에이전트가 도는 동안 다른 에이전트의 결과가 먼저 병합돼 병합
   * base 가 앞서 나간다 — 그때 병합 base 로 감사하면 남이 바꾼 맵이 이 에이전트의 spill 로
   * 잘못 잡힌다. 비우면 병합 base 를 쓴다.
   */
  readonly base?: Project;
}

export interface MapBundleSpill {
  readonly mapIds: readonly string[];
  /** 묶음 밖에서 바뀐 키. `maps.<id>` 또는 최상위 키. */
  readonly keys: readonly string[];
}

export interface MergeMapBundlesResult {
  readonly project: Project;
  readonly spills: readonly MapBundleSpill[];
  /** 둘 이상의 결과가 같은 맵을 묶음에 넣었다. 뒤의 결과가 이겼으니 호출자가 알려야 한다. */
  readonly conflicts: readonly string[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function findMapTreeNode(root: MapTreeNode | undefined, mapId: string): MapTreeNode | null {
  if (!root) return null;
  if (root.mapId === mapId) return root;
  for (const child of root.children ?? []) {
    const found = findMapTreeNode(child, mapId);
    if (found) return found;
  }
  return null;
}

function findMapTreeParent(root: MapTreeNode | undefined, mapId: string): MapTreeNode | null {
  if (!root) return null;
  for (const child of root.children ?? []) {
    if (child.mapId === mapId) return root;
    const found = findMapTreeParent(child, mapId);
    if (found) return found;
  }
  return null;
}

function collectTreeIds(node: MapTreeNode, out: string[]): void {
  out.push(node.mapId);
  for (const child of node.children ?? []) collectTreeIds(child, out);
}

/** 맵 + mapTree 부분 트리의 맵 id 들. 트리에 없는 맵은 자기 자신만. */
export function mapBundleIds(project: Project, mapId: string): string[] {
  const node = findMapTreeNode(project.mapTree, mapId);
  if (!node) return [mapId];
  const ids: string[] = [];
  collectTreeIds(node, ids);
  return ids;
}

function pruneSubtrees(node: MapTreeNode, roots: ReadonlySet<string>): MapTreeNode {
  // 묶음 루트의 부분 트리는 통째로 비운다. 자식으로 만나는 묶음 루트는 아래 filter 가 걷어내지만,
  // **트리 루트 자신이 묶음 루트일 때**(빈 프로젝트의 시작 맵이 그렇다 — blankProject 의
  // `mapTree.mapId = startMapId`) filter 는 자기 자신을 걷어내지 못한다. 그래서 루트 밑에 새로
  // 달린 실내 맵 노드가 감사에 남아 base 와 달라 보였고, 실제로는 병합된 변경을 팀 보드가
  // 「범위 밖 변경 버림 (시공): mapTree」 로 보고했다(실측: 2026-09-17 조수 로그 [33][37][59][61]).
  if (roots.has(node.mapId)) return { ...node, children: [] };
  return {
    ...node,
    children: (node.children ?? []).filter((child) => !roots.has(child.mapId)).map((child) => pruneSubtrees(child, roots)),
  };
}

/** 묶음 밖에서 달라진 키. 범위를 벗어난 에이전트를 잡아내는 감사용. */
export function mapBundleSpill(base: Project, result: Project, mapIds: readonly string[]): string[] {
  const roots = new Set(mapIds);
  const bundle = new Set<string>();
  for (const id of mapIds) {
    for (const bid of mapBundleIds(result, id)) bundle.add(bid);
    for (const bid of mapBundleIds(base, id)) bundle.add(bid);
  }
  const spill: string[] = [];
  const keys = new Set([...Object.keys(base), ...Object.keys(result)]);
  for (const key of keys) {
    if (key === "maps") {
      const ids = new Set([...Object.keys(base.maps ?? {}), ...Object.keys(result.maps ?? {})]);
      for (const id of ids) {
        if (bundle.has(id)) continue;
        if (JSON.stringify(base.maps?.[id]) !== JSON.stringify(result.maps?.[id])) spill.push(`maps.${id}`);
      }
      continue;
    }
    if (key === "mapTree") {
      const a = base.mapTree ? pruneSubtrees(base.mapTree, roots) : undefined;
      const b = result.mapTree ? pruneSubtrees(result.mapTree, roots) : undefined;
      if (JSON.stringify(a) !== JSON.stringify(b)) spill.push("mapTree");
      continue;
    }
    const a = (base as unknown as Record<string, unknown>)[key];
    const b = (result as unknown as Record<string, unknown>)[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) spill.push(key);
  }
  return spill.sort();
}

function replaceOrAttachSubtree(mergedRoot: MapTreeNode, resultRoot: MapTreeNode | undefined, mapId: string): void {
  const resultNode = findMapTreeNode(resultRoot, mapId);
  const mergedParent = findMapTreeParent(mergedRoot, mapId);
  if (!resultNode) {
    // 에이전트가 트리에서 맵을 뺐다 — 묶음 소유자니 그대로 따른다.
    if (mergedParent) mergedParent.children = mergedParent.children.filter((child) => child.mapId !== mapId);
    return;
  }
  const replacement = clone(resultNode);
  if (mergedParent) {
    mergedParent.children = mergedParent.children.map((child) => (child.mapId === mapId ? replacement : child));
    return;
  }
  if (mergedRoot.mapId === mapId) {
    mergedRoot.children = replacement.children;
    return;
  }
  // base 트리에 없던 맵: 결과 트리의 부모가 병합 트리에 있으면 그 밑에, 아니면 루트에 단다.
  const resultParent = findMapTreeParent(resultRoot, mapId);
  const target = (resultParent && findMapTreeNode(mergedRoot, resultParent.mapId)) ?? mergedRoot;
  target.children = [...(target.children ?? []), replacement];
}

/** id 로 식별되는 레코드(id 를 가진 객체). 스위치·DB 레코드·엔딩 등 프로젝트 컬렉션의 공통 형태. */
interface IdRecord {
  readonly id: string;
}

/**
 * `started` 에 없고 `target` 에도 없는(= 묶음이 새로 만든) `result` 항목만 `target` 뒤에 얹는다.
 * 셋을 다 받는 이유: 「만든 것」의 기준은 에이전트가 출발한 사본이고, 중복 방지의 기준은 지금까지
 * 병합된 결과다. 둘을 한 집합으로 뭉개면 이미 병합된 항목을 두 번째 결과가 덮어쓴다.
 */
function createdById<T extends IdRecord>(
  started: readonly T[],
  result: readonly T[],
  target: readonly T[],
): readonly T[] {
  const known = new Set([...started, ...target].map((entry) => entry.id));
  const added = result.filter((entry) => !known.has(entry.id));
  return added.length === 0 ? target : [...target, ...clone(added)];
}

/** id 키로 묶인 레코드(tilesets·assets.sprites 처럼 키가 곧 id 인 것)의 새 항목만 얹는다. */
function createdByKey<T>(
  started: Record<string, T>,
  result: Record<string, T>,
  target: Record<string, T>,
): Record<string, T> {
  const added = Object.entries(result).filter(([key]) => !(key in started) && !(key in target));
  return added.length === 0
    ? target
    : { ...target, ...Object.fromEntries(added.map(([key, value]) => [key, clone(value)])) };
}

/**
 * 묶음이 **덧댄 타일 이식**만 기존 타일셋에 옮긴다.
 *
 * 타일셋은 `createdByKey` 가 «새 타일셋» 만 옮기므로, 집·여관 시공이 기존 타일셋에 미는 이식
 * (`village/builder.ts` 의 `ensureInnSignGraft` 가 그렇다 — combined_town 에 없는 여관 간판을
 * 슬롯 443 에 이식한다)은 통째로 버려졌다. 실측: 이식 1건이 병합본에서 0건이 되는데 **커밋
 * 게이트는 통과**한다 — 맵은 443 을 깔았지만 이식이 없어 엉뚱한 타일이 그려진 채 저장된다.
 *
 * 옮기는 것은 «없던 targetTile 을 덧댄 것» 뿐이다. 이식 교체·삭제와 타일셋의 다른 필드는 여전히
 * 범위 밖 편집이라 버리고 보고한다 — 저작 범위 규칙(`authorVillageScope.allowedTargetTilesetChange`)
 * 이 허용하는 것과 같은 모양이다.
 */
function carryCreatedGrafts(merged: Project, started: Project, result: Project): void {
  for (const [id, resultTileset] of Object.entries(result.tilesets)) {
    const target = merged.tilesets[id];
    const startedTileset = started.tilesets[id];
    // 새 타일셋은 createdByKey 가 통째로 옮긴다. 여기는 «양쪽에 있는» 타일셋만 본다.
    if (!target || !startedTileset) continue;
    const known = new Set([...(startedTileset.tileGrafts ?? []), ...(target.tileGrafts ?? [])].map((graft) => graft.targetTile));
    const added = (resultTileset.tileGrafts ?? []).filter((graft) => !known.has(graft.targetTile));
    if (added.length === 0) continue;
    merged.tilesets[id] = { ...target, tileGrafts: [...(target.tileGrafts ?? []), ...clone(added)] };
  }
}

/** database 의 컬렉션은 전부 id 가진 레코드 배열이다 — 종류를 나열하지 않고 그대로 훑는다. */
function createdDatabaseEntries(
  started: Project["database"],
  result: Project["database"],
  target: Project["database"],
): Project["database"] {
  const merged = { ...target } as Record<string, unknown>;
  const startedRows = started as unknown as Record<string, unknown>;
  const resultRows = result as unknown as Record<string, unknown>;
  for (const [key, rows] of Object.entries(resultRows)) {
    const current = merged[key];
    if (!Array.isArray(rows) || !Array.isArray(current)) continue;
    const previous = startedRows[key];
    merged[key] = createdById(
      Array.isArray(previous) ? (previous as IdRecord[]) : [],
      rows as IdRecord[],
      current as IdRecord[],
    );
  }
  return merged as unknown as Project["database"];
}

/**
 * 묶음이 **만든** 정의를 병합본에 얹는다. 맵이 가리키는 정의가 묶음과 함께 오게 하려는 것이고,
 * 기존 정의의 수정·삭제는 옮기지 않는다(그건 범위 밖 편집이라 spill 보고 대상이다).
 */
function carryCreatedEntries(merged: Project, started: Project, result: Project): void {
  merged.switches = createdById(started.switches, result.switches, merged.switches) as Project["switches"];
  merged.variables = createdById(started.variables, result.variables, merged.variables) as Project["variables"];
  merged.commonEvents = createdById(started.commonEvents, result.commonEvents, merged.commonEvents) as Project["commonEvents"];
  // endings 는 optional 이다 — 없는 프로젝트에 빈 배열을 심으면 저작하지 않은 키가 diff 에 생긴다.
  if (merged.endings !== undefined || result.endings !== undefined) {
    merged.endings = createdById(started.endings ?? [], result.endings ?? [], merged.endings ?? []) as Project["endings"];
  }
  merged.tilesets = createdByKey(started.tilesets, result.tilesets, merged.tilesets);
  carryCreatedGrafts(merged, started, result);
  merged.assets = {
    sprites: createdByKey(started.assets.sprites, result.assets.sprites, merged.assets.sprites),
    uploaded: createdByKey(started.assets.uploaded, result.assets.uploaded, merged.assets.uploaded),
  };
  // 새 스위치/변수의 시작값. 없으면 로드 정규화가 채우지만, 그 전까지 spill 로 잡혀
  // 「범위 밖 N건 버림」 경고가 성공 캡션에 붙는다.
  merged.session = {
    ...merged.session,
    switches: createdByKey(started.session.switches, result.session.switches, merged.session.switches),
    variables: createdByKey(started.session.variables, result.session.variables, merged.session.variables),
  };
  merged.database = createdDatabaseEntries(started.database, result.database, merged.database);
}

/**
 * 이 키가 병합본에 반영되지 **않았는가** — 「버렸다」고 말해도 되는 유일한 조건.
 *
 * 감사(`mapBundleSpill`)는 병합 **전** 에 «묶음 밖에서 달라진 키» 를 센다. 그 목록을 그대로
 * 보고하면 «달라졌지만 결국 잘 옮겨진» 변경까지 버렸다고 말하게 된다 — 실측(2026-09-17 조수
 * 로그 [33][37][59][61]): 시작 맵에 실내 맵을 새로 단 턴이 「범위 밖 변경 버림 (시공): mapTree」
 * 를 띄웠지만 실내 맵도 트리 노드도 병합본에 멀쩡히 들어 있었다.
 */
function droppedFromMerge(merged: Project, result: Project, key: string): boolean {
  if (key.startsWith("maps.")) {
    const id = key.slice("maps.".length);
    return JSON.stringify(merged.maps?.[id]) !== JSON.stringify(result.maps?.[id]);
  }
  const read = (project: Project): unknown => (project as unknown as Record<string, unknown>)[key];
  return JSON.stringify(read(merged)) !== JSON.stringify(read(result));
}

/** base 에 각 결과의 맵 묶음만 얹는다. 같은 맵을 두 결과가 주장하면 뒤의 것이 이긴다. */
export function mergeMapBundles(base: Project, results: readonly MapBundleResult[]): MergeMapBundlesResult {
  const merged = clone(base);
  const spills: MapBundleSpill[] = [];
  const claimed = new Set<string>();
  const conflicts = new Set<string>();
  for (const result of results) {
    const started = result.base ?? base;
    const rawKeys = mapBundleSpill(started, result.project, result.mapIds);
    carryCreatedEntries(merged, started, result.project);
    const bundle = new Set<string>();
    for (const id of result.mapIds) {
      for (const bid of mapBundleIds(result.project, id)) bundle.add(bid);
      for (const bid of mapBundleIds(base, id)) bundle.add(bid);
    }
    for (const id of bundle) {
      if (claimed.has(id)) conflicts.add(id);
      claimed.add(id);
      const row = result.project.maps?.[id];
      if (row) merged.maps[id] = clone(row);
      else delete merged.maps[id];
    }
    if (merged.mapTree) {
      for (const id of result.mapIds) replaceOrAttachSubtree(merged.mapTree, result.project.mapTree, id);
    }
    // 보고는 병합이 끝난 **뒤** 에 한다. 이 결과까지 얹은 병합본과 대조해, 끝내 반영되지 않은
    // 키만 남긴다 — 그래야 「버렸다」가 사실이 된다. 앞으로 `carryCreatedEntries` 가 무엇을 더
    // 옮기더라도 보고가 저절로 따라온다(예외 목록을 손볼 필요가 없다).
    const keys = rawKeys.filter((key) => droppedFromMerge(merged, result.project, key));
    if (keys.length > 0) spills.push({ mapIds: result.mapIds, keys });
  }
  return { project: merged, spills, conflicts: [...conflicts].sort() };
}
