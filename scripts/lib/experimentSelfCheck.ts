// 실험(img-room-test 조건 V, 2026-10-30): 조수가 목업을 «내내» 보고 스스로 맞춰 가게 하는 보조 장치. 맵은 조수가 깐다 — 여기서는 놓지 않는다.
//   ① 이어 하기 글(할 일 재주입·관문 후속)마다 칸 좌표를 그린 목업(OPRN_EXPERIMENT_AID_IMAGE)을 다시 붙인다(대화 기록을 비워도 다시 본다).
//   ② 자기 검사: 큰 짓기 차례가 끝날 때마다(맵이 바뀌었을 때만, 최대 OPRN_EXPERIMENT_SELFCHECK 번) 지금 맵 그림과 목업을 같은 칸 크기로
//      나란히 붙여 «차이를 적고 할 일로 올린 뒤 고쳐라»를 영어로 묻는다. 차이를 할 일로 올리는 것도, 고치는 것도 조수다.
//   그림과 조수 답은 OPRN_EXPERIMENT_SELFCHECK_DIR 에 round-N.png / round-N.json 으로 남긴다(실시간 페이지가 읽는다).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import type { Project } from "../../src/project/types";
import { roomSpecOf } from "../../src/editor/handInterior/builder";

export type ExperimentImage = { type: "image"; mimeType: string; data: string };

const env = () => (typeof process !== "undefined" ? process.env : {}) as Record<string, string | undefined>;

export function readExperimentImage(file: string): ExperimentImage | undefined {
  try {
    const data = readFileSync(file).toString("base64");
    return { type: "image", mimeType: /\.jpe?g$/iu.test(file) ? "image/jpeg" : "image/png", data };
  } catch { return undefined; }
}

/** 이어 하기 글마다 다시 붙일 보조 그림(칸 좌표 목업). 없으면 undefined. */
export function experimentContinuationImages(): ExperimentImage[] | undefined {
  const f = env().OPRN_EXPERIMENT_AID_IMAGE;
  if (!f) return undefined;
  const im = readExperimentImage(f);
  return im ? [im] : undefined;
}

const CELL = 24;

function scaleNearest(src: PNG, cellsW: number, cellsH: number, srcCell: number): PNG {
  const out = new PNG({ width: cellsW * CELL, height: cellsH * CELL });
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    const sx = Math.min(src.width - 1, Math.floor((x / CELL) * srcCell)), sy = Math.min(src.height - 1, Math.floor((y / CELL) * srcCell));
    const s = (sy * src.width + sx) * 4, d = (y * out.width + x) * 4;
    out.data[d] = src.data[s]!; out.data[d + 1] = src.data[s + 1]!; out.data[d + 2] = src.data[s + 2]!; out.data[d + 3] = 255;
  }
  for (let c = 0; c <= cellsW; c += 5) for (let y = 0; y < out.height; y++) { const x = Math.min(out.width - 1, c * CELL); const d = (y * out.width + x) * 4; out.data[d] = 255; out.data[d + 1] = 255; out.data[d + 2] = 255; }
  for (let r = 0; r <= cellsH; r += 5) for (let x = 0; x < out.width; x++) { const y = Math.min(out.height - 1, r * CELL); const d = (y * out.width + x) * 4; out.data[d] = 255; out.data[d + 1] = 255; out.data[d + 2] = 255; }
  return out;
}

/** 왼쪽 = 지금 맵 그림, 오른쪽 = 목업(16px 칸), 둘 다 칸 24px, 5칸마다 흰 선. */
export function sideBySide(mapPngB64: string, mapW: number, mapH: number, mockupNative: Buffer): Buffer {
  const map = PNG.sync.read(Buffer.from(mapPngB64, "base64"));
  const mock = PNG.sync.read(mockupNative);
  const a = scaleNearest(map, mapW, mapH, map.width / mapW);
  const b = scaleNearest(mock, Math.round(mock.width / 16), Math.round(mock.height / 16), 16);
  const gap = 24; const out = new PNG({ width: a.width + gap + b.width, height: Math.max(a.height, b.height) });
  out.data.fill(0); for (let i = 3; i < out.data.length; i += 4) { out.data[i - 3] = 30; out.data[i - 2] = 30; out.data[i - 1] = 36; out.data[i] = 255; }
  PNG.bitblt(a, out, 0, 0, a.width, a.height, 0, 0);
  PNG.bitblt(b, out, 0, 0, b.width, b.height, a.width + gap, 0);
  return PNG.sync.write(out);
}

function mapFingerprint(m: Project["maps"][string] | undefined): string {
  if (!m) return "";
  const keys = ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles"] as const;
  return `${m.width}x${m.height}|` + keys.map((k) => ((m as unknown as Record<string, number[] | undefined>)[k] ?? []).join(",")).join("|");
}

export interface SelfCheckDeps {
  readonly project: () => Project;
  readonly base: Project;
  readonly render: (mapId: string, w: number, h: number) => Promise<string>;
  readonly emit: (summary: string, data?: unknown) => void;
}

export interface SelfCheckRound { readonly round: number; readonly max: number; readonly mapId: string; readonly text: string; readonly images: ExperimentImage[] }

export function experimentSelfCheckOn(): boolean { return Number(env().OPRN_EXPERIMENT_SELFCHECK ?? 0) > 0 && !!env().OPRN_EXPERIMENT_MOCKUP_NATIVE; }

export function makeSelfCheck(deps: SelfCheckDeps) {
  const max = Math.max(0, Math.min(5, Number(env().OPRN_EXPERIMENT_SELFCHECK ?? 0)));
  const dir = env().OPRN_EXPERIMENT_SELFCHECK_DIR;
  const native = readFileSync(env().OPRN_EXPERIMENT_MOCKUP_NATIVE!);
  let rounds = 0; let lastFp = "";
  /** 손 도트 실내 칩셋으로 바뀐(또는 새로 생긴) 맵 중 가장 큰 것. */
  const target = (): string | undefined => {
    const p = deps.project(); let best: { id: string; n: number } | undefined;
    for (const [id, m] of Object.entries(p.maps)) {
      if (!roomSpecOf(p.tilesets[m.tilesetId])) continue;
      if (mapFingerprint(deps.base.maps[id]) === mapFingerprint(m)) continue;
      const n = m.width * m.height; if (!best || n > best.n) best = { id, n };
    }
    return best?.id;
  };
  return {
    max,
    async next(): Promise<SelfCheckRound | undefined> {
      if (rounds >= max) return undefined;
      const mapId = target(); if (!mapId) return undefined;
      const m = deps.project().maps[mapId]!; const fp = mapFingerprint(m);
      if (fp === lastFp) return undefined;
      let png: string;
      try { png = await deps.render(mapId, m.width, m.height); } catch (e) { deps.emit(`self-check render failed: ${(e as Error).message}`); return undefined; }
      rounds += 1; lastFp = fp;
      const pair = sideBySide(png, m.width, m.height, native);
      if (dir) { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, `round-${rounds}.png`), pair); }
      const text = [
        `[self-check ${rounds}/${max}] The attached picture: LEFT = your current map «${m.name ?? mapId}» (map ${mapId}, ${m.width}×${m.height} cells, rendered just now), RIGHT = the mockup at the same scale (one cell = one chipset tile; thin white lines every 5 cells on both).`,
        "Compare your map to the mockup. List the differences in room shape, walls, doors and object groups (name each one with its approximate cells), then fix them.",
        "Add each difference as a todo item with the todo tool, then fix them yourself — edit_place with the whole fixed design (shape, side rooms, partitions, groups and their positions), move_object, or other tools — and inspect. If nothing important differs any more, say «matches the mockup».",
      ].join("\n");
      deps.emit(`self-check ${rounds}/${max} — map ${mapId} next to the mockup`, { round: rounds, mapId });
      return { round: rounds, max, mapId, text, images: [{ type: "image", mimeType: "image/png", data: pair.toString("base64") }] };
    },
    record(round: number, reply: string, todo: unknown[]): void {
      if (!dir) return;
      writeFileSync(join(dir, `round-${round}.json`), JSON.stringify({ round, at: new Date().toISOString(), reply: reply.slice(0, 6000), todo }, null, 1));
    },
  };
}
