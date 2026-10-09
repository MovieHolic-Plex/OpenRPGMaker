import { deserializeParsed } from "@/project/io/serialize";
import { borrowSpatial } from "@/project/spatial/domain";
import type { Project, TilesetDef } from "@/project/types";

/**
 * 공간 컴파일의 격리 경계. 예전에는 `deserialize(JSON.stringify(project))` 로 프로젝트 전체를 왕복했다.
 * 프로젝트 무게의 약 97% 는 타일셋(참고문서·tileMeta·그룹 등, 실측 26~42MB 이상)인데 컴파일은 타일셋을 읽기만 한다
 * (쓰는 곳은 maps·mapTree·mapConnections·spatialAuthoring·맵 이벤트뿐). 그래서:
 *
 *  1. 타일셋 밖의 나머지만 JSON 왕복으로 복제한다(예전과 똑같이 undefined 키가 사라지고 참조 공유가 끊긴다).
 *  2. 검증(deserializeParsed)에는 무거운 필드를 뺀 얕은 타일셋 스텁을 넣는다. 배열(passability/priority/terrain)은
 *     같은 참조로 넘겨 길이만 검사받는다 — 검증은 그것들을 읽기만 한다.
 *  3. 검증이 끝난 프로젝트의 tilesets 를 원본 타일셋 객체(포인터)로 되돌린다. 저장소의 타일셋 항목은 절대
 *     제자리 변경하지 않는다는 계약(projectClone.ts)에 기대며, 이 객체들은 freezeSpatial 이 건너뛰게 표시한다.
 *
 * 검증 자체는 그대로다: 참조 무결성(map.tilesetId, 타일 번호 < count, 키트 tileSize 등)과 소유 계약을 같이 확인한다.
 */

// 스텁에서 빼는 필드: 검증이 내용까지 읽는 큰 필드(문서·타일별 메타·그룹)와 검증 대상이 아닌 프리셋.
const HEAVY_TILESET_KEYS: ReadonlySet<string> = new Set([
  "referenceDocuments", "tileMeta", "tileGroups", "autotileGroups", "palettePresets", "structureKits",
]);

function tilesetStub(tileset: TilesetDef): Record<string, unknown> {
  const stub: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(tileset)) if (!HEAVY_TILESET_KEYS.has(key)) stub[key] = value;
  const kits = (tileset as { structureKits?: readonly Record<string, unknown>[] }).structureKits;
  if (Array.isArray(kits)) {
    stub.structureKits = kits.map(kit => {
      const { referenceDocuments: _docs, ...rest } = kit;
      return rest;
    });
  }
  return stub;
}

/** 타일셋을 뺀 프로젝트를 예전과 같은 JSON 왕복으로 복제하고, 그 자리에 스텁을 넣어 완전 검증한 뒤 원본 타일셋을 되돌린다. */
export function isolateProject(input: Project): Project {
  const light = JSON.parse(JSON.stringify({ ...input, tilesets: {} })) as Record<string, unknown>;
  const stubs: Record<string, unknown> = {};
  for (const [id, tileset] of Object.entries(input.tilesets)) stubs[id] = tilesetStub(tileset);
  light.tilesets = stubs;
  const project = deserializeParsed(light);
  const shared: Record<string, TilesetDef> = { ...input.tilesets };
  for (const tileset of Object.values(shared)) borrowSpatial(tileset);
  (project as { tilesets: Project["tilesets"] }).tilesets = shared;
  return project;
}
