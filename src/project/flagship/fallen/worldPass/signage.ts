/**
 * 가게 간판 — 「마을 대장간 이런 데가 구체적으로 어딘지 모르겠네」(사용자 2026-11-04).
 * 대장간·약방·빵집·공방은 바깥에서 그냥 집이었다(걸이 간판은 여관만). 집 키트에 이미 있는 걸이 간판(23605, 버들항 번들)을 문 옆 벽에 걸고,
 * 간판 아래 벽 칸(문 옆, 막힌 칸)에 읽기 이벤트를 달아 문 옆 길에서 벽을 보고 확인하면 가게 이름과 파는 것을 말한다.
 * 광장 이정표(외곽 이정표 1×2)는 큰길 갈림목에 가게 방향을 적는다. 새 그림 없음.
 */
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { type Cell, mustMap, narrate, page, putEvent } from "./common";

const HANGING_SIGN = 23605;
const SIGNPOST_TOP = 23697;
const SIGNPOST_FOOT = 23698;
/** 광산 골짜기 게시판 2×2(번들 키트 bd-pick-mining-valley-board) — 윗줄 걸음, 아랫줄 막힘. */
const BOARD = [[25056, 25057], [25058, 25059]] as const;

export type ShopSign = { readonly mapId: string; readonly title: string; readonly line: string };

export function doorOf(hub: GameMap, mapId: string): Cell | undefined {
  const gate = hub.events.find((e) => String(e.id).startsWith("ev_gate_") && JSON.stringify(e.pages ?? []).includes(`"mapId":"${mapId}"`));
  return gate ? { x: gate.x, y: gate.y } : undefined;
}

function signCell(hub: GameMap, door: Cell): Cell {
  const overlay = hub.upperOverlayTiles!;
  for (const dx of [1, -1]) {
    const x = door.x + dx, y = door.y - 1;
    const i = y * hub.width + x;
    if ((hub.upperTiles[i] ?? -1) >= 0 && ((overlay[i] ?? -1) < 0 || overlay[i] === HANGING_SIGN)) return { x, y };
  }
  return { x: door.x + 1, y: door.y - 1 };
}

export function hangShopSigns(project: Project, hubId: string, signs: readonly ShopSign[]): Cell[] {
  const hub = mustMap(project, hubId);
  hub.upperOverlayTiles ??= new Array(hub.width * hub.height).fill(-1);
  const hung: Cell[] = [];
  for (const sign of signs) {
    const door = doorOf(hub, sign.mapId);
    if (!door) throw new Error(`[fallen-world] ${sign.title} 문이 왕도에 없다`);
    const at = signCell(hub, door);
    hub.upperOverlayTiles[at.y * hub.width + at.x] = HANGING_SIGN;
    putEvent(hub, `ev_fs_sign_${sign.mapId}`, `간판 · ${sign.title}`, { x: at.x, y: door.y }, [
      page(`ev_fs_sign_${sign.mapId}_p`, "읽는다", [], [narrate(`「${sign.title}」\n${sign.line}`)]),
    ]);
    hung.push(at);
  }
  return hung;
}

/** at = 게시판 왼쪽 위 칸. 읽기 이벤트는 부르는 쪽이 막힌 아랫줄 칸에 단다(그 아래 칸에서 위를 보고 읽는다). */
export function placeNoticeBoard(project: Project, hubId: string, at: Cell): void {
  const hub = mustMap(project, hubId);
  BOARD.forEach((row, dy) => row.forEach((t, dx) => {
    const i = (at.y + dy) * hub.width + at.x + dx;
    if ((hub.upperTiles[i] ?? -1) >= 0) throw new Error(`[fallen-world] 게시판 자리 (${at.x + dx},${at.y + dy}) 에 이미 무언가 있다`);
    hub.upperTiles[i] = t;
  }));
}

/** at = 이정표 윗칸(걸을 수 있는 칸). 발(아랫칸)은 막히고 그 칸에 읽기 이벤트를 단다. */
export function plantSignpost(project: Project, hubId: string, at: Cell, lines: readonly string[]): void {
  const hub = mustMap(project, hubId);
  const foot = { x: at.x, y: at.y + 1 };
  if (!isPassable(project, hub, foot.x, foot.y)) throw new Error(`[fallen-world] 이정표 자리 (${foot.x},${foot.y}) 가 막혀 있다`);
  hub.upperTiles[at.y * hub.width + at.x] = SIGNPOST_TOP;
  hub.upperTiles[foot.y * hub.width + foot.x] = SIGNPOST_FOOT;
  putEvent(hub, "ev_fs_signpost_plaza", "광장 이정표", foot, [
    page("ev_fs_signpost_plaza_p", "읽는다", [], lines.map((l) => narrate(l))),
  ]);
}
