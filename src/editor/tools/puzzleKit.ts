// src/editor/tools/puzzleKit.ts
// 퍼즐 프리셋 공용 부품: 이벤트 명령 조각(효과음·흔들림·입자·대사·페이지)·세 물결 해제 연출, 그리고
// 「상태가 있는 기물」을 가진 20×15 손 도트 실내 방을 짓는 PuzzleRoom.
//
// PuzzleRoom 은 방 하나를 기본 설계 + 기물 상태(prop states)로 정의한다. 기물마다 상태 그림(레버 끔/켬, 수정 꺼짐/켜짐,
// 철창 닫힘/열림, 판자 있음/무너짐…)을 손 도트 실내 칩셋 문법(buildHandInteriorLayers)으로 각각 지어 비교하고,
// 「이 기물을 상태 i 로」 바꾸는 절대 changeTile 묶음을 만든다. 절대 묶음이라 어떤 순서·몇 번을 오가도 그림이 어긋나지 않는다.

import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { puzzleSfxResourceId, type PuzzleSfxCue } from "@/assets/puzzleSfxAssets";
import type { HandInteriorInput, HandInteriorLine, HandInteriorObject, HandInteriorZone, HandInteriorDais } from "@/editor/handInterior/builder";
import { changeTileProblems } from "@/project/changeTileValidation";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import type { Command, Condition, Dir, EventPage, EventPageCondition, EventPageGraphic, GameEvent, GameMap, Project } from "@/project/types";
import { charsetGraphic } from "./eventCompile";
import type { Cell } from "./jrpgVolumeTools";
import {
  buildLayers,
  LAYER_KEYS,
  PUZZLE_ROOM_H,
  PUZZLE_ROOM_W,
  roomPlan,
  writeLayers,
  type Layers,
  type Rect,
} from "./puzzleRoomScenery";
import { ToolError } from "./types";

export const FIXED_MOVEMENT: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };

export function m2(title: string, fields: Record<string, string | number | boolean>): Command {
  const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
  if (!entry) throw new ToolError(`M2 명령 '${title}' 을 카탈로그에서 찾지 못했습니다.`, { code: "m2-missing" });
  return { kind: "m2Command", commandId: entry.id, fields };
}

export function se(name: string): Command {
  return { kind: "playAudio", resourceId: `easyrpg-sound-${name}`, loop: false, channel: "se" };
}

/** 퍼즐 전용 원본 효과음(밀기·발판·레버·오답·해결 징글…). public/assets/puzzle-sfx. */
export function sfx(cue: PuzzleSfxCue): Command {
  return { kind: "playAudio", resourceId: puzzleSfxResourceId(cue), loop: false, channel: "se" };
}

export function flash(color: string, durationMs = 300): Command {
  return m2("Flash Screen", { color, durationMs });
}

export function shake(intensity: 1 | 3 | 6 | 10 = 3, durationMs = 500): Command {
  return m2("Shake Screen", { value: intensity, intensity: String(intensity), durationMs });
}

export function particles(preset: string, durationMs = 800, at?: Cell): Command {
  return at
    ? m2("Particle Effect", { preset, target: "tile", x: at.x, y: at.y, durationMs, wait: false })
    : m2("Particle Effect", { preset, target: "player", durationMs, wait: false });
}

/**
 * 화면 전체를 잠깐 물들인다. Flash Screen 은 런타임이 최소 800ms 동안 85% 불투명으로 붙잡아(playSceneMapCommands.flashCamera)
 * 해제 장면을 통째로 가린다 — 새 프리셋은 색조 펄스(45% 이하, 짧게)로 「번쩍」을 낸다.
 */
export function tintPulse(rgb: string, peakAlpha = 0.3, inMs = 120, outMs = 520): Command[] {
  return [
    m2("Tint Screen", { value: `${rgb},${peakAlpha}`, durationMs: inMs }),
    { kind: "wait", ms: inMs },
    m2("Tint Screen", { value: "neutral", durationMs: outMs }),
  ];
}

const FLASH_RGB: Readonly<Record<string, string>> = { white: "255,255,255", red: "255,120,90", yellow: "255,230,120", blue: "150,200,255", gold: "255,236,170" };

/** 해제 연출의 색과 세 물결 입자(1물결 균열 먼지 → 2물결 본 붕괴 → 3물결 완성 빛). pulse 를 주면 섬광 대신 색조 펄스. */
export interface RevealTheme {
  readonly flash: string;
  readonly waves: readonly [string, string, string];
  readonly pulse?: string;
}

/**
 * changeTile 묶음을 한 번에 갈지 않고 플레이어 쪽(남쪽)부터 세 물결로 연다. 물결마다 바뀌는 칸 위에 입자를 뿜고
 * 칸을 간 뒤 흔들림이 다음 물결까지의 틈이 된다(Shake Screen 은 끝날 때까지 기다리는 명령이라 흔들리는 동안 먼지가 보인다).
 */
export function revealInWaves(cmds: readonly Command[], theme: RevealTheme): Command[] {
  const byCell = new Map<string, { x: number; y: number; cmds: Command[] }>();
  for (const cmd of cmds) {
    if (cmd.kind !== "changeTile") continue;
    const key = `${cmd.x},${cmd.y}`;
    let cell = byCell.get(key);
    if (!cell) byCell.set(key, (cell = { x: cmd.x, y: cmd.y, cmds: [] }));
    cell.cmds.push(cmd);
  }
  const cells = [...byCell.values()].sort((a, b) => b.y - a.y || a.x - b.x);
  if (cells.length === 0) return [...cmds];
  // 직전 대사·선택지 창이 완전히 닫힌 뒤 연출이 시작되고, 마지막 물결 뒤에도 잠깐 여유를 두어
  // 캡처 프레임에 반쯤 닫히는 대사창이 절대 겹치지 않게 한다.
  // 풀린 순간 해결 징글이 먼저 울리고(젤다식 「비밀 발견」), 첫 물결에서 문·창살이 갈리는 낮은 굉음이 이어진다.
  // Flash Screen 은 런타임이 최소 800ms 동안 85% 로 붙잡아 해제 장면을 통째로 가린다(옛 판 시간의 문에서 흰 화면만 찍혔다) — 늘 색조 펄스로 낸다.
  const out: Command[] = [{ kind: "wait", ms: 250 }, sfx("secret-solved"), ...(theme.pulse ? tintPulse(theme.pulse) : tintPulse(FLASH_RGB[theme.flash] ?? "255,255,255", 0.4))];
  const per = Math.ceil(cells.length / 3);
  const mid = cells[Math.floor(cells.length / 2)]!;
  for (let wave = 0; wave < 3; wave += 1) {
    const group = cells.slice(wave * per, (wave + 1) * per);
    if (group.length === 0) continue;
    // 물결마다 입자는 최대 4곳 — 칸마다 뿜으면 큰 다리·갱도에서 입자가 수십 개 겹쳐 오히려 뭉개진다.
    const step = Math.max(1, Math.floor(group.length / 4));
    for (let i = 0; i < group.length; i += step) out.push(particles(theme.waves[wave]!, 1200, group[i]!));
    if (wave === 0) out.push(se("earth2"));
    if (wave === 2) out.push(particles("sparkle", 1200, mid));
    for (const cell of group) out.push(...cell.cmds);
    out.push(shake(wave === 2 ? 10 : 6, wave === 2 ? 600 : 300));
  }
  out.push({ kind: "wait", ms: 220 });
  return out;
}

export function textCmd(body: string): Command {
  return { kind: "text", body };
}

export function wait(ms: number): Command {
  return { kind: "wait", ms };
}

export function setSw(switchId: string, value: boolean): Command {
  return { kind: "setSwitch", switchId, value };
}

export function setVar(variableId: string, value: number, op: "=" | "+=" | "-=" = "="): Command {
  return { kind: "setVariable", variableId, op, value };
}

export function ifSw(switchId: string, value: boolean, then: readonly Command[], otherwise: readonly Command[] = []): Command {
  return { kind: "fork", condition: { kind: "switch", switchId, value }, then: [...then], else: [...otherwise] };
}

export function ifVar(
  variableId: string,
  op: "==" | ">=" | "<=" | ">" | "<" | "!=",
  value: number,
  then: readonly Command[],
  otherwise: readonly Command[] = [],
): Command {
  return { kind: "fork", condition: { kind: "variable", variableId, op, value }, then: [...then], else: [...otherwise] };
}

export function ifCond(condition: Condition, then: readonly Command[], otherwise: readonly Command[] = []): Command {
  return { kind: "fork", condition, then: [...then], else: [...otherwise] };
}

export function choices(prompt: string | undefined, options: ReadonlyArray<{ readonly text: string; readonly branch: readonly Command[] }>): Command {
  return {
    kind: "choices",
    ...(prompt ? { prompt } : {}),
    options: options.map((o) => ({ text: o.text, branch: [...o.branch] })),
    cancelBehavior: "branch",
    cancelBranch: [],
  };
}

export function objGraphic(sheet: "object1" | "object2", characterIndex: number, direction: Dir = "down"): EventPageGraphic {
  const base = charsetGraphic(`tex_easyrpg_charset_${sheet}`, characterIndex);
  return {
    ...base,
    direction,
    pattern: charsetFrameIndex({ characterIndex, direction, pattern: 1 }),
  };
}

export const TRANSPARENT: EventPageGraphic = { transparent: true };

export function makePage(opts: {
  readonly id: string;
  readonly name: string;
  readonly conditions?: readonly EventPageCondition[];
  readonly graphic: EventPageGraphic;
  readonly trigger?: "action" | "playerTouch" | "eventTouch" | "touch" | "auto" | "parallel";
  readonly priority?: EventPage["priority"];
  readonly overlapForbidden?: boolean;
  readonly commands: readonly Command[];
  readonly interaction?: EventPage["interaction"];
  readonly animationType?: EventPage["animationType"];
}): EventPage {
  const priority = opts.priority ?? "same";
  return {
    id: opts.id,
    name: opts.name,
    conditions: [...(opts.conditions ?? [])],
    graphic: opts.graphic,
    trigger: { kind: opts.trigger ?? "action" },
    priority,
    overlapForbidden: opts.overlapForbidden ?? (priority === "same"),
    animationType: opts.animationType ?? "fixedGraphic",
    movement: FIXED_MOVEMENT,
    commands: [...opts.commands],
    ...(opts.interaction ? { interaction: opts.interaction } : {}),
  };
}

export function allSwitchesFork(switchIds: readonly string[], onTrue: readonly Command[]): Command[] {
  const build = (index: number): Command[] => {
    const switchId = switchIds[index];
    if (!switchId) return [...onTrue];
    return [
      {
        kind: "fork",
        condition: { kind: "switch", switchId, value: true },
        then: build(index + 1),
        else: [],
      },
    ];
  };
  return build(0);
}

// ---------------------------------------------------------------------------
// PuzzleRoom — 상태가 있는 기물을 가진 20×15 방
// ---------------------------------------------------------------------------

/** 기물 한 상태의 그림: 이 상태에서만 놓이는 물건·바닥 구역·줄(레일·양탄자)·벽 틈(open)·심연(voids). */
export interface PropState {
  readonly objects?: readonly HandInteriorObject[];
  readonly zones?: readonly HandInteriorZone[];
  readonly lines?: readonly HandInteriorLine[];
  readonly daises?: readonly HandInteriorDais[];
  readonly open?: readonly Rect[];
  readonly voids?: readonly Rect[];
  /** 심연 위에 얹는 밟는 기물(판자 프레임) — 심연을 판 뒤 2층에 쓴다. */
  readonly overlays?: readonly HandInteriorObject[];
}

export interface PuzzleRoomSpec {
  readonly top: number;
  readonly left?: number;
  readonly right?: number;
  readonly door?: readonly number[];
  readonly open?: readonly Rect[];
  readonly floor: string;
  readonly wall: string;
  readonly ceiling?: string;
  readonly zones?: readonly HandInteriorZone[];
  readonly objects?: readonly HandInteriorObject[];
  readonly lines?: readonly HandInteriorLine[];
  readonly daises?: readonly HandInteriorDais[];
  readonly voids?: readonly Rect[];
  readonly overlays?: readonly HandInteriorObject[];
  /** 기물 키 → 상태 그림 목록. 상태 0 이 처음 그림이다. */
  readonly props?: Readonly<Record<string, readonly PropState[]>>;
}

export const obj = (id: string, x: number, y: number): HandInteriorObject => ({ id, x, y });
export const rect = (x0: number, y0: number, x1: number, y1: number): Rect => ({ x0, y0, x1, y1 });

export class PuzzleRoom {
  readonly origin: Cell;
  private readonly states: Record<string, number>;
  private readonly propCells = new Map<string, Set<number>>();
  private readonly stateLayers = new Map<string, Layers[]>();
  readonly base: Layers;

  constructor(
    private readonly project: Project,
    private readonly map: GameMap,
    win: Cell,
    private readonly spec: PuzzleRoomSpec,
    private readonly label: string,
  ) {
    this.origin = win;
    this.states = Object.fromEntries(Object.keys(spec.props ?? {}).map((k) => [k, 0]));
    this.base = this.layersWith({});
    const owner = new Map<number, string>();
    for (const [key, list] of Object.entries(spec.props ?? {})) {
      const layers = list.map((_, i) => (i === 0 ? this.base : this.layersWith({ [key]: i })));
      this.stateLayers.set(key, layers);
      const touched = new Set<number>();
      for (let c = 0; c < PUZZLE_ROOM_W * PUZZLE_ROOM_H; c += 1) {
        for (const layer of layers) {
          if (LAYER_KEYS.some((k) => layer[k][c] !== this.base[k][c])) touched.add(c);
        }
      }
      for (const c of touched) {
        const prev = owner.get(c);
        if (prev) throw new Error(`퍼즐 방 ${label}: 기물 '${prev}' 와 '${key}' 의 그림이 칸 (${c % PUZZLE_ROOM_W},${Math.floor(c / PUZZLE_ROOM_W)}) 에서 겹칩니다.`);
        owner.set(c, key);
      }
      this.propCells.set(key, touched);
    }
  }

  private layersWith(override: Readonly<Record<string, number>>): Layers {
    const spec = this.spec;
    const objects: HandInteriorObject[] = [...(spec.objects ?? [])];
    const zones: HandInteriorZone[] = [...(spec.zones ?? [])];
    const lines: HandInteriorLine[] = [...(spec.lines ?? [])];
    const daises: HandInteriorDais[] = [...(spec.daises ?? [])];
    const open: Rect[] = [...(spec.open ?? [])];
    const voids: Rect[] = [...(spec.voids ?? [])];
    const overlays: HandInteriorObject[] = [...(spec.overlays ?? [])];
    for (const [key, list] of Object.entries(spec.props ?? {})) {
      const st = list[override[key] ?? this.states[key] ?? 0];
      if (!st) continue;
      objects.push(...(st.objects ?? []));
      zones.push(...(st.zones ?? []));
      lines.push(...(st.lines ?? []));
      daises.push(...(st.daises ?? []));
      open.push(...(st.open ?? []));
      voids.push(...(st.voids ?? []));
      overlays.push(...(st.overlays ?? []));
    }
    const input: HandInteriorInput = {
      plan: roomPlan({ top: spec.top, left: spec.left, right: spec.right, door: spec.door ?? [10], open }),
      floor: spec.floor,
      wall: spec.wall,
      ...(spec.ceiling ? { ceiling: spec.ceiling } : {}),
      zones,
      objects,
      lines,
      daises,
      start: [{ x: (spec.door ?? [10])[0]!, y: PUZZLE_ROOM_H - 1 }],
    };
    return buildLayers(this.project, { input, chasm: voids, overlays }, this.label);
  }

  /** 처음 그림을 맵에 쓴다. initial 을 주면 그 기물들은 그 상태로 시작한다(나머지는 상태 0). */
  paint(initial: Readonly<Record<string, number>> = {}): void {
    writeLayers(this.map, this.origin.x, this.origin.y, Object.keys(initial).length > 0 ? this.layersWith(initial) : this.base);
  }

  /** 기물을 상태 index 로 바꾸는 절대 changeTile 묶음(그 기물이 어떤 상태에서든 쓸 수 있다). */
  set(key: string, index: number): Command[] {
    const layers = this.stateLayers.get(key)?.[index];
    const cells = this.propCells.get(key);
    if (!layers || !cells) throw new Error(`퍼즐 방 ${this.label}: 기물 '${key}' 상태 ${index} 가 없습니다.`);
    const out: Command[] = [];
    for (const c of [...cells].sort((a, b) => a - b)) {
      for (const k of LAYER_KEYS) {
        const cmd: Command = {
          kind: "changeTile",
          mapId: this.map.id,
          layer: k,
          x: this.origin.x + (c % PUZZLE_ROOM_W),
          y: this.origin.y + Math.floor(c / PUZZLE_ROOM_W),
          tile: layers[k][c] ?? -1,
        };
        const problems = changeTileProblems(cmd, this.project);
        if (problems.length > 0) throw new Error(`퍼즐 방 ${this.label} changeTile 검증 실패: ${problems.join(" ")}`);
        out.push(cmd);
      }
    }
    return out;
  }

  /** 방 좌표 → 맵 좌표. */
  at(x: number, y: number): Cell {
    return { x: this.origin.x + x, y: this.origin.y + y };
  }
}

/** 퍼즐 이벤트 하나 — 페이지 목록만 받는다(트리거는 페이지가 가진다). */
export function puzzleEvent(id: string, name: string, at: Cell, pages: readonly EventPage[]): GameEvent {
  return { id, name, x: at.x, y: at.y, trigger: { kind: "action" }, commands: [], pages: [...pages] };
}
