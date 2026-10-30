// 내보낸 게임의 project.json 에서 번들 타일셋을 «참조»로 바꾸고, 플레이어가 읽을 때 번들 정의로 되돌린다.
//
// 왜(2026-10-25 조수 단독 게임 심사 S4): 내보내기 투영(webExport.ts exportProjection)은 안 쓰는 타일셋과 참고문서를 빼지만,
// 쓰는 번들 타일셋은 정의(칸 통행·층·tileMeta 설명·킷)를 통째로 실었다 — jp_city 하나가 8.8MB, beodeul_city 8.1MB.
// 플레이어는 같은 정의를 따로 갖고 있으므로 같은 바이트를 두 번 받고 두 번 메모리에 올린다. 웹 플레이어는 정의를 지연 자산
// (assets/*Tileset-*.json)으로 갖고 exportEntry 가 이 게임이 참조하는 것만 미리 받는다. 실행형 HTML 은 정적 출처로 갖는다.
// 98MB 급 프로젝트가 출하 플레이어 부팅 중 렌더러를 잃었다(salad-omo-1 6건).
//
// 계약:
//  - 저장본 사본이 번들 정의와 «내보내기 모양»(참고문서 뺀 것)까지 JSON 동치일 때만 참조로 바꾼다. 한 칸이라도 고친 타일셋
//    (공방 칸, 옛 판본, 저자가 고친 tileMeta)은 그대로 싣는다.
//  - 참조에는 정의의 지문(digest)을 남긴다. 읽는 쪽의 번들 정의가 다르면(다른 판의 플레이어) 조용히 다른 칸 표로 놀지 않고 막는다.
//  - 되돌린 프로젝트는 참조로 바꾸기 전의 투영과 JSON 동치다.
import { bundledTilesetById } from "./defaults/defaultAssets";
import { structuralJson } from "@/util/structuralJson";
import type { TilesetDef } from "./types";

export const BUNDLED_TILESET_REF = "bundledTilesetRef";

/** 참조 자리에 남기는 가벼운 머리(그림 수집·이름 표시가 정의 없이도 쓴다). */
const HEADER_KEYS = ["id", "name", "image", "kind", "family", "tileSize", "tilesPerRow", "count"] as const;

/** 내보내기 투영과 같은 모양: 편집기 참고문서를 뺀다(webExport.ts exportProjection 과 같은 규칙). */
function exportShape(tileset: TilesetDef): TilesetDef {
  const copy = { ...tileset } as TilesetDef & Record<string, unknown>;
  delete copy.referenceDocuments;
  delete copy.referenceSourceTilesetId;
  delete copy.terrainTemplates;
  if (copy.structureKits) copy.structureKits = copy.structureKits.map((kit) => {
    const next = { ...kit } as typeof kit & { referenceDocuments?: unknown };
    delete next.referenceDocuments;
    return next;
  });
  return copy;
}

function digestOf(text: string): string {
  let h1 = 2166136261;
  let h2 = 0x811c9dc5 ^ text.length;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 16777619);
    h2 = Math.imul(h2 ^ code, 2246822519);
  }
  return `${text.length.toString(36)}-${(h1 >>> 0).toString(36)}-${(h2 >>> 0).toString(36)}`;
}

/** 번들 정의의 내보내기 모양과 그 지문. 프로세스마다 id 당 한 번만 만든다(정의는 수 MB). */
const canonical = new Map<string, { readonly text: string; readonly digest: string } | null>();
function canonicalOf(id: string): { readonly text: string; readonly digest: string } | null {
  if (!canonical.has(id)) {
    const bundled = bundledTilesetById(id);
    if (!bundled) canonical.set(id, null);
    else {
      const text = structuralJson(exportShape(bundled));
      canonical.set(id, { text, digest: digestOf(text) });
    }
  }
  return canonical.get(id)!;
}

/** 이 투영 사본이 번들 정의와 같으면 참조 머리를, 아니면 undefined. */
export function bundledTilesetRefView(id: string, tileset: TilesetDef): Record<string, unknown> | undefined {
  const owned = canonicalOf(id);
  if (!owned || structuralJson(exportShape(tileset)) !== owned.text) return undefined;
  const record = tileset as unknown as Record<string, unknown>;
  const view: Record<string, unknown> = {};
  for (const key of HEADER_KEYS) if (record[key] !== undefined) view[key] = record[key];
  view[BUNDLED_TILESET_REF] = owned.digest;
  return view;
}

/** 내보낼 project 의 타일셋 사전을 참조로 바꾼 얕은 사본(바꿀 것이 없으면 그대로). 원본은 건드리지 않는다. */
export function withBundledTilesetRefs<T extends { tilesets: Record<string, TilesetDef> }>(project: T): T {
  let tilesets: Record<string, unknown> | undefined;
  for (const [id, tileset] of Object.entries(project.tilesets)) {
    const view = bundledTilesetRefView(id, tileset);
    if (!view) continue;
    tilesets ??= { ...project.tilesets };
    tilesets[id] = view;
  }
  return tilesets ? { ...project, tilesets } as T : project;
}

export class BundledTilesetRefError extends Error {}

/**
 * 읽은 JSON(검사 전)의 참조 타일셋을 번들 정의로 되돌린다. 되돌린 수를 돌려준다.
 * 이 플레이어에 그 번들이 없거나 지문이 다르면 던진다 — 다른 칸 표로 맵을 그리면 통행·층이 조용히 틀어진다.
 */
export function restoreBundledTilesetRefs(data: { tilesets?: unknown }): number {
  const tilesets = data.tilesets;
  if (!tilesets || typeof tilesets !== "object") return 0;
  let restored = 0;
  for (const [id, value] of Object.entries(tilesets as Record<string, unknown>)) {
    const ref = value && typeof value === "object" ? (value as Record<string, unknown>)[BUNDLED_TILESET_REF] : undefined;
    if (ref === undefined) continue;
    const owned = canonicalOf(id);
    if (!owned) throw new BundledTilesetRefError(`번들 타일셋 ${id} 을(를) 이 플레이어가 갖고 있지 않습니다 — 게임을 같은 판의 편집기로 다시 내보내 주세요.`);
    if (ref !== owned.digest) throw new BundledTilesetRefError(`번들 타일셋 ${id} 의 판이 이 플레이어와 다릅니다(${String(ref)} ≠ ${owned.digest}) — 게임을 다시 내보내 주세요.`);
    (tilesets as Record<string, unknown>)[id] = JSON.parse(owned.text) as unknown;
    restored += 1;
  }
  return restored;
}
