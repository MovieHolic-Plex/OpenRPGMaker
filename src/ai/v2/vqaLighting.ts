// 화면 검수(VQA) 맵 그림에 게임 조명을 입힌다(2026-10-26 hf2-school-claude-j79).
//
// 왜: 맵 그림(편집기 렌더)은 조명을 그리지 않는다. 조수가 어둠을 0.88 로 올려도 검수자는 밝은 맵을 보고 「너무 밝다」를 세 판 내내 다시 냈다
// (결함 2→2→2, 조수 보고 「맵 미리보기 그림에는 조명이 그려지지 않아서 여전히 밝게 보입니다」). 게임의 조명 마스크(player/lighting.ts
// drawLightingMask — ambient 만큼 덮고 광원마다 방사형으로 걷어 낸다)를 같은 식으로 RGBA 에 칠한다. 순수 함수 — 그림 해독·인코딩은 호출자.
import type { GameMap, LightSource, Project } from "@/project/types";

export interface LitShot { readonly applied: boolean; readonly ambient: number; readonly lights: number; readonly playerLightAtStart: boolean }

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const hex = (color: string | undefined): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/iu.exec((color ?? "").trim());
  if (!m) return [0, 0, 0];
  const n = Number.parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** 게임 마스크의 걷어 내기 기울기(0 → alpha, 0.7 → 0.65·alpha, 1 → 0). */
const cutAt = (t: number, alpha: number): number => t >= 1 ? 0 : t <= 0.7 ? alpha * (1 - (0.35 * t) / 0.7) : alpha * 0.65 * (1 - (t - 0.7) / 0.3);

/** 맵 기본 조명(defaultLighting)을 rgba(가로 width) 에 칠한다. 플레이어를 따라가는 빛은 시작 맵이면 시작 자리에 그린다. */
export function applyMapLighting(rgba: Uint8Array, width: number, height: number, map: GameMap, project: Project): LitShot {
  const lighting = map.defaultLighting;
  const ambient = clamp01(lighting?.ambient ?? 0);
  if (!lighting || ambient <= 0 || !map.width || !map.height) return { applied: false, ambient, lights: 0, playerLightAtStart: false };
  const tile = width / map.width;
  // 높이 지형(relief) 맵은 그림이 위아래로 더 크고 내용이 아래로 밀린다 — 남는 높이를 위 여백으로 본다.
  const padY = Math.max(0, height - map.height * tile);
  const isStart = project.startMapId === map.id;
  let playerLightAtStart = false;
  const centers: { x: number; y: number; r: number; a: number }[] = [];
  for (const source of lighting.sources ?? [] as readonly LightSource[]) {
    let cell: { x: number; y: number } | undefined;
    const at = source.at as unknown;
    if (at === "player" || (at && typeof at === "object" && (at as { kind?: string }).kind === "player")) {
      if (isStart && project.startPos) { cell = project.startPos; playerLightAtStart = true; }
    } else if (at && typeof at === "object" && "eventId" in (at as object)) {
      const ev = (map.events ?? []).find((e) => e.id === (at as { eventId: string }).eventId);
      if (ev) cell = { x: ev.x, y: ev.y };
    } else if (at && typeof at === "object" && "x" in (at as object)) cell = at as { x: number; y: number };
    if (!cell || !(source.radius > 0)) continue;
    centers.push({ x: (cell.x + 0.5) * tile, y: padY + (cell.y + 0.5) * tile, r: source.radius * tile, a: clamp01(source.intensity ?? 1) });
  }
  const [cr, cg, cb] = hex(lighting.color);
  // 어둠 한 겹을 먼저 칠할 몫(keep=1)으로 두고, 광원 둘레 네모 안에서만 걷어 낼 몫을 곱한다(큰 맵 × 광원 여럿도 빛 둘레만 계산).
  const keep = new Float32Array(width * height).fill(1);
  for (const c of centers) {
    const x0 = Math.max(0, Math.floor(c.x - c.r)), x1 = Math.min(width - 1, Math.ceil(c.x + c.r));
    const y0 = Math.max(0, Math.floor(c.y - c.r)), y1 = Math.min(height - 1, Math.ceil(c.y + c.r));
    const r2 = c.r * c.r;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - c.x, dy = y + 0.5 - c.y, d2 = dx * dx + dy * dy;
      if (d2 < r2) keep[y * width + x]! *= 1 - cutAt(Math.sqrt(d2) / c.r, c.a);
    }
  }
  for (let p = 0; p < width * height; p++) {
    const m = ambient * keep[p]!;
    if (m <= 0) continue;
    const i = p * 4;
    rgba[i] = Math.round(rgba[i]! * (1 - m) + cr * m);
    rgba[i + 1] = Math.round(rgba[i + 1]! * (1 - m) + cg * m);
    rgba[i + 2] = Math.round(rgba[i + 2]! * (1 - m) + cb * m);
  }
  return { applied: true, ambient, lights: centers.length, playerLightAtStart };
}

/** 검수자에게 붙이는 자리 이름 꼬리 — 그림이 조명을 반영했음을 알린다. */
export function litShotNote(lit: LitShot): string {
  if (!lit.applied) return "";
  return ` — 게임 조명 반영(어둠 ${lit.ambient.toFixed(2)}, 빛 ${lit.lights}${lit.playerLightAtStart ? ", 손전등은 시작 자리" : ""})`;
}
