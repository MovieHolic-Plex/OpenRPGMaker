// 이 기기에서 조수가 지은 게임들의 겉모습 기록(localStorage) — 새 게임이 «이미 만든 게임들이 덜 쓴» 겉모습을 먼저 고르게 한다.
// 왜(2026-11-13 오너 «특히 숲쪽», 표본 여섯 게임 가운데 둘이 같은 귤밭): 겉모습은 게임 열쇠 해시로만 골라 게임끼리 서로를 몰랐다 — 숲 구성 스물한 가지에서
// 여섯 게임이 한 쌍도 안 겹칠 확률은 절반쯤이었다. 조수 요청을 보낼 때 다른 게임들의 기록을 실어 보내면(lookTaken) 고르는 쪽
// (project/tilesetLook.ts chooseTilesetLook)이 갈래마다 가장 덜 쓴 선택지 안에서 고른다. 기록이 없거나 저장소를 못 쓰면 전과 같다(열쇠 해시만).
// 이미 겉모습이 적힌 게임은 영향받지 않는다 — 한 게임의 겉모습은 첫 맵에서 한 번 정해져 프로젝트에 남는다.
import type { Project, TilesetLook } from "@/project/types";

const STORAGE_KEY = "oprn-game-looks-v1";
/** 기억하는 게임 수(가장 오래된 것부터 잊는다). */
const MAX_GAMES = 24;

type Entry = { key: string; looks: Record<string, TilesetLook> };

function storage(): Storage | undefined {
  try { return typeof localStorage === "undefined" ? undefined : localStorage; } catch { return undefined; }
}

function readBook(): Entry[] {
  try {
    const parsed = JSON.parse(storage()?.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((row): row is Entry => !!row && typeof (row as Entry).key === "string" && typeof (row as Entry).looks === "object" && !!(row as Entry).looks) : [];
  } catch { return []; }
}

/** 이 게임(열쇠)의 타일셋 겉모습을 적어 둔다 — 겉모습이 하나도 없는 프로젝트는 적지 않는다(전에 적은 것은 그대로 둔다). */
export function rememberGameLooks(projectKey: string | undefined, project: Pick<Project, "tilesets"> | undefined): void {
  const store = storage();
  if (!store || !projectKey?.trim() || !project?.tilesets) return;
  const looks: Record<string, TilesetLook> = {};
  for (const [id, tileset] of Object.entries(project.tilesets)) if (tileset?.look) looks[id] = tileset.look;
  if (!Object.keys(looks).length) return;
  const book = readBook();
  const before = book.find((row) => row.key === projectKey);
  if (before && JSON.stringify(before.looks) === JSON.stringify(looks)) return;
  const next = [...book.filter((row) => row.key !== projectKey), { key: projectKey, looks }].slice(-MAX_GAMES);
  try { store.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* 저장소가 찼으면 기록 없이 간다 — 고르기는 열쇠 해시로 돌아간다 */ }
}

/** 이 게임이 아닌 게임들의 겉모습(타일셋 구분 없이 — 고르는 쪽이 그림판 열쇠로 자기 타일셋 것만 센다). */
export function otherGameLooks(projectKey: string | undefined): TilesetLook[] {
  if (!projectKey?.trim()) return [];
  return readBook().filter((row) => row.key !== projectKey).flatMap((row) => Object.values(row.looks));
}
