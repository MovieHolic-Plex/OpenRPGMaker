// preview_cutscene — 조수가 자기가 만든 컷신을 «눈으로» 확인하는 도구.
// 글(run): 타임라인·표식·충돌 시점의 그림 겹침 진단. 그림(cutscenePreviewImages): 핵심 장면 접촉 시트 한 장.
// 어긋남(트럭이 인물에 닿지 않음 등)은 숫자로도 잡아 경고한다 — 2026-10-02 조수 시험은 «완료» 로 끝났는데 닿지 않았다.
import { pictureSize } from "@/editor/cutsceneArt/pictureSize";
import { pictureBox, overlapRatio, simulateCutscene, type CutsceneTimeline } from "@/editor/cutscenePreview/timeline";
import { DEFAULT_PLAY_RESOLUTION } from "@/project/playResolution";
import type { Command, GameEvent, Project } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const CUTSCENE_PREVIEW_TOOL = "preview_cutscene";

function eventCommands(event: GameEvent): Command[] {
  const pages = event.pages ?? [];
  const page = pages.find((entry) => entry.commands.some((command) => command.kind === "showPicture")) ?? pages.find((entry) => entry.name === "컷신") ?? pages[0];
  return page?.commands ?? event.commands;
}

/** 충돌 시점 표식 — 첫 플래시, 없으면 마지막 흔들림(앞선 작은 흔들림은 경적 연출일 수 있다). */
function impactMark(timeline: CutsceneTimeline): { readonly kind: "flash" | "shake"; readonly t: number; readonly durationMs: number } | undefined {
  const effects = timeline.marks.filter((mark): mark is { kind: "flash" | "shake"; t: number; durationMs: number } => mark.kind === "flash" || mark.kind === "shake");
  return effects.find((mark) => mark.kind === "flash") ?? effects.at(-1);
}

/** 핵심 장면 시각 6개(ms). 충돌 표식(플래시·흔들림)이 있으면 그 둘레를 촘촘히 본다. */
export function pickPreviewTimes(timeline: CutsceneTimeline): number[] {
  const end = Math.max(0, timeline.durationMs);
  const impact = impactMark(timeline);
  const raw = impact
    ? [Math.min(600, end), impact.t * 0.55, impact.t - 350, impact.t + 120, impact.t + 700, end - 50]
    : Array.from({ length: 6 }, (_, i) => (end * (i + 0.5)) / 6);
  return [...new Set(raw.map((t) => Math.round(Math.max(0, Math.min(end, t)))))].sort((a, b) => a - b);
}

interface PreviewData {
  readonly eventId: string;
  readonly durationMs: number;
  readonly frameTimesMs: readonly number[];
  readonly pictures: readonly string[];
  readonly marks: readonly unknown[];
  readonly impactOverlap: readonly { readonly pictures: string; readonly overlap: number }[];
}

function locateEvent(draft: Project, args: Record<string, unknown>): { event: GameEvent; mapId: string } {
  const map = requireMap(draft, args.mapId as string);
  const eventId = typeof args.eventId === "string" ? args.eventId.trim() : "";
  const event = map.events.find((entry) => entry.id === eventId);
  if (!event) throw new ToolError(`이벤트 '${eventId}' 가 ${map.name} 에 없습니다 — 컷신 도구가 돌려준 eventId 를 쓰세요.`, { code: "unknown-event" });
  return { event, mapId: map.id };
}

export function cutscenePreviewPlan(draft: Project, args: Record<string, unknown>): { timeline: CutsceneTimeline; times: number[]; viewport: { width: number; height: number }; event: GameEvent } {
  const { event } = locateEvent(draft, args);
  const timeline = simulateCutscene(eventCommands(event));
  return { timeline, times: pickPreviewTimes(timeline), viewport: { ...(draft.system.playResolution ?? DEFAULT_PLAY_RESOLUTION) }, event };
}

const previewCutscene: ToolDefinition = {
  name: CUTSCENE_PREVIEW_TOOL,
  description:
    "컷신 이벤트의 핵심 장면 6컷을 한 장의 그림(접촉 시트)으로 합성해 눈으로 확인한다. 컷신을 만든 직후(script_cutscene·script_cutscene_impact) 반드시 호출한다. "
    + "글로는 타임라인(대사·효과음·플래시·흔들림 시각)과 충돌 시점의 그림 겹침 진단을 준다 — 겹치지 않는다는 경고가 뜨면 좌표·그림 크기를 고쳐 다시 만든다. "
    + "그림 기반(picture) 연출만 그려진다. 맵 위 NPC·플레이어 이동은 그려지지 않고, 번들(내장) 그림은 회색 자리표시 상자로 나온다. 프레임 순서는 왼쪽 위에서 오른쪽, 아래 줄 순이다.",
  mode: "read",
  domains: ["event"],
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["mapId", "eventId"],
    properties: {
      mapId: { type: "string" },
      eventId: { type: "string", description: "컷신 이벤트 id(컷신 도구 결과의 eventId)" },
    },
  },
  invalidArgsExample: { mapId: "map1", eventId: "ev_opening_cutscene" },
  run(draft, args): ToolExecResult {
    const { timeline, times, viewport, event } = cutscenePreviewPlan(draft, args);
    const warnings: string[] = [];
    if (timeline.pictureIds.length === 0) warnings.push("이 이벤트에는 그림(picture) 연출이 없어 합성할 장면이 없습니다.");
    for (const note of timeline.unsupported) warnings.push(`미리보기 제한: ${note}`);
    const impact = impactMark(timeline);
    const impactOverlap: PreviewData["impactOverlap"][number][] = [];
    if (impact) {
      const viewportArea = viewport.width * viewport.height;
      const boxes = timeline.snapshotAt(impact.t).map((snapshot) => ({ snapshot, box: pictureBox(snapshot, pictureSize(draft, snapshot.resourceId, { width: 48, height: 48 })) }))
        // 배경·흰 화면처럼 화면 대부분을 덮는 그림은 충돌 상대가 아니다.
        .filter(({ box }) => (box.x1 - box.x0) * (box.y1 - box.y0) < viewportArea * 0.6);
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const ratio = Math.max(overlapRatio(boxes[i]!.box, boxes[j]!.box), overlapRatio(boxes[j]!.box, boxes[i]!.box));
          impactOverlap.push({ pictures: `${boxes[i]!.snapshot.pictureId}↔${boxes[j]!.snapshot.pictureId}`, overlap: Math.round(ratio * 100) / 100 });
        }
      }
      if (boxes.length >= 2 && !impactOverlap.some((entry) => entry.overlap >= 0.12)) {
        warnings.push(`충돌 효과(${impact.kind}, ${Math.round(impact.t)}ms) 시점에 인물·탈것 그림이 겹치지 않습니다(겹침 ${impactOverlap.map((entry) => `${entry.pictures}=${entry.overlap}`).join(", ")}). 닿기 전에 효과가 나가는 연출이 됩니다 — 이동 도착 좌표나 효과 시점을 고치세요.`);
      }
      if (boxes.length < 2) warnings.push("충돌 효과 시점에 겹칠 그림이 2장 미만입니다(인물·탈것 그림이 화면에 있어야 합니다).");
    }
    const data: PreviewData = {
      eventId: event.id,
      durationMs: Math.round(timeline.durationMs),
      frameTimesMs: times,
      pictures: timeline.pictureIds,
      marks: timeline.marks.slice(0, 24),
      impactOverlap,
    };
    return {
      summary: `컷신 ${event.id}: 약 ${(timeline.durationMs / 1000).toFixed(1)}초, 그림 ${timeline.pictureIds.length}장, 핵심 장면 ${times.length}컷(${times.map((t) => `${(t / 1000).toFixed(1)}s`).join(", ")}). 합성 그림은 이미지로 함께 전달됩니다.`,
      data,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

export const CUTSCENE_PREVIEW_TOOLS: readonly ToolDefinition[] = [previewCutscene];

/** Pi 에이전트 어댑터가 도구 결과에 붙이는 합성 시트. 브라우저·헤드리스 모두 같은 순수 합성기를 쓴다. */
export async function cutscenePreviewImages(project: Project, args: Record<string, unknown>): Promise<{ dataUrl: string; label: string }[]> {
  try {
    const { timeline, times, viewport } = cutscenePreviewPlan(project, args);
    if (timeline.pictureIds.length === 0 || times.length === 0) return [];
    const { renderContactSheet } = await import("@/editor/cutscenePreview/render");
    return [{ dataUrl: await renderContactSheet(project, timeline, times, viewport), label: `컷신 미리보기 ${String(args.eventId)}` }];
  } catch {
    return [];
  }
}
