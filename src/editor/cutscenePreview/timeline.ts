// 컷신 미리보기용 타임라인 시뮬레이터 — 컴파일된 이벤트 명령(showPicture·Move Picture·wait·flash·shake·text)을
// 가상 시계 위에서 돌려 «시각 t 의 그림 배치»를 낸다. 브라우저·이미지 없이 도는 순수 함수라 도구 결과(글)와
// 합성 이미지가 같은 계산을 쓴다. 맵 위 NPC·플레이어 이동(moveEvent)은 그리지 못한다 — unsupported 로 알린다.
import type { Command } from "@/project/types";

export interface PicturePose {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly opacity: number;
  readonly rotation: number;
}

export interface PictureSnapshot extends PicturePose {
  readonly pictureId: string;
  readonly resourceId: string;
}

export type TimelineMark =
  | { readonly kind: "flash" | "shake"; readonly t: number; readonly durationMs: number }
  | { readonly kind: "say"; readonly t: number; readonly text: string }
  | { readonly kind: "audio"; readonly t: number; readonly resourceId: string };

interface Segment {
  readonly start: number;
  readonly duration: number;
  readonly erased?: boolean;
  readonly resourceId: string;
  readonly from: PicturePose;
  readonly to: PicturePose;
}

export interface CutsceneTimeline {
  readonly durationMs: number;
  readonly marks: readonly TimelineMark[];
  readonly pictureIds: readonly string[];
  readonly unsupported: readonly string[];
  snapshotAt(t: number): PictureSnapshot[];
}

const DEFAULT_POSE: PicturePose = { x: 0, y: 0, scale: 100, opacity: 255, rotation: 0 };
const SAY_READ_MS = 1400;

const num = (value: unknown, fallback: number): number => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

function lerpPose(from: PicturePose, to: PicturePose, k: number): PicturePose {
  const l = (a: number, b: number): number => a + (b - a) * k;
  return { x: l(from.x, to.x), y: l(from.y, to.y), scale: l(from.scale, to.scale), opacity: l(from.opacity, to.opacity), rotation: l(from.rotation, to.rotation) };
}

export function simulateCutscene(commands: readonly Command[]): CutsceneTimeline {
  const segments = new Map<string, Segment[]>();
  const marks: TimelineMark[] = [];
  const unsupported = new Set<string>();
  let clock = 0;

  const poseAt = (id: string, t: number): { pose: PicturePose; resourceId: string; erased: boolean } | undefined => {
    const list = segments.get(id);
    if (!list) return undefined;
    let current: Segment | undefined;
    for (const segment of list) if (segment.start <= t) current = segment;
    if (!current) return undefined;
    if (current.erased) return { pose: current.to, resourceId: current.resourceId, erased: true };
    const k = current.duration <= 0 ? 1 : Math.max(0, Math.min(1, (t - current.start) / current.duration));
    return { pose: lerpPose(current.from, current.to, k), resourceId: current.resourceId, erased: false };
  };
  const push = (id: string, segment: Segment): void => {
    const list = segments.get(id) ?? [];
    list.push(segment);
    segments.set(id, list);
  };

  for (const command of commands) {
    switch (command.kind) {
      case "showPicture": {
        const to: PicturePose = { x: num(command.x, 0), y: num(command.y, 0), scale: num(command.scale, 100), opacity: num(command.opacity, 255), rotation: num(command.rotation, 0) };
        push(command.pictureId, { start: clock, duration: 0, resourceId: command.resourceId, from: to, to });
        break;
      }
      case "erasePicture": {
        const prev = poseAt(command.pictureId, clock);
        const pose = prev?.pose ?? DEFAULT_POSE;
        push(command.pictureId, { start: clock, duration: 0, erased: true, resourceId: prev?.resourceId ?? "", from: pose, to: pose });
        break;
      }
      case "wait":
        clock += Math.max(0, num((command as { ms?: unknown }).ms, 0));
        break;
      case "text": {
        const body = String((command as { body?: unknown }).body ?? "");
        marks.push({ kind: "say", t: clock, text: body.replace(/\[[^\]]*\]/gu, "").replace(/\s+/gu, " ").trim().slice(0, 60) });
        clock += SAY_READ_MS;
        break;
      }
      case "playAudio":
        marks.push({ kind: "audio", t: clock, resourceId: command.resourceId });
        break;
      case "moveEvent":
        unsupported.add("moveEvent(맵 위 이동은 미리보기에 그려지지 않습니다)");
        break;
      case "m2Command": {
        const fields = (command.fields ?? {}) as Record<string, unknown>;
        if (command.commandId === "m2-052-move-picture") {
          const id = String(fields.pictureId ?? "");
          const prev = poseAt(id, clock);
          if (!prev || prev.erased) break;
          const duration = Math.max(0, num(fields.durationMs, 0));
          const to: PicturePose = {
            x: num(fields.x, prev.pose.x), y: num(fields.y, prev.pose.y), scale: num(fields.scale, prev.pose.scale),
            opacity: num(fields.opacity, prev.pose.opacity), rotation: num(fields.rotation, prev.pose.rotation),
          };
          push(id, { start: clock, duration, resourceId: typeof fields.resourceId === "string" && fields.resourceId ? fields.resourceId : prev.resourceId, from: prev.pose, to });
          if (fields.wait === true || fields.waitForPicture === true) clock += duration;
        } else if (command.commandId === "m2-047-flash-screen") {
          marks.push({ kind: "flash", t: clock, durationMs: num(fields.durationMs, 300) });
        } else if (command.commandId === "m2-048-shake-screen") {
          marks.push({ kind: "shake", t: clock, durationMs: num(fields.durationMs, 400) });
        }
        break;
      }
      default:
        break;
    }
  }

  const tail = Math.max(0, ...[...segments.values()].flat().map((segment) => segment.start + segment.duration));
  const durationMs = Math.max(clock, tail);
  const pictureIds = [...segments.keys()].sort((a, b) => zOrder(a) - zOrder(b));
  return {
    durationMs,
    marks,
    pictureIds,
    unsupported: [...unsupported],
    snapshotAt(t: number): PictureSnapshot[] {
      const out: PictureSnapshot[] = [];
      for (const id of pictureIds) {
        const state = poseAt(id, t);
        if (state && !state.erased && state.resourceId) out.push({ pictureId: id, resourceId: state.resourceId, ...state.pose });
      }
      return out;
    },
  };
}

/** 런타임과 같은 규칙 — 그림 id 끝 숫자가 클수록 위(pictureZIndex). */
export function zOrder(pictureId: string): number {
  const match = pictureId.match(/(\d+)\s*$/u);
  return match ? Number(match[1]) : 0;
}

export interface Box {
  readonly pictureId: string;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** 회전을 무시한 화면 상자 — 겹침 진단용. */
export function pictureBox(snapshot: PictureSnapshot, size: { readonly width: number; readonly height: number }): Box {
  const w = (size.width * snapshot.scale) / 100;
  const h = (size.height * snapshot.scale) / 100;
  return { pictureId: snapshot.pictureId, x0: snapshot.x, y0: snapshot.y, x1: snapshot.x + w, y1: snapshot.y + h };
}

/** a 의 넓이 중 b 와 겹치는 비율(0~1). */
export function overlapRatio(a: Box, b: Box): number {
  const w = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const h = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const area = (a.x1 - a.x0) * (a.y1 - a.y0);
  return area > 0 ? (w * h) / area : 0;
}
