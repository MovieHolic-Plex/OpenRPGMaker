// 컷신 객관 측정기 — 컴파일된 이벤트 명령을 가상 시계로 돌려 «보이는가·크기·겹침·움직임·소리·분위기»를 숫자로 낸다.
// 조수의 말(「완료했습니다」)이 아니라 이 숫자가 오프닝 완료 검사의 근거다. 브라우저·모델 없이 도는 순수 함수.
import { pictureSize } from "@/editor/cutsceneArt/pictureSize";
import { overlapRatio, pictureBox, simulateCutscene, type Box } from "./timeline";
import type { Command, Project } from "@/project/types";

const STEP_MS = 200;
const FULLSCREEN = 0.6;

export interface SubjectProbe {
  readonly pictureId: string;
  readonly resourceId: string;
  readonly visibleMs: number;
  readonly maxHeightRatio: number;
  readonly travelPx: number;
}

export interface CutsceneProbe {
  readonly durationMs: number;
  readonly subjects: readonly SubjectProbe[];
  readonly tintCount: number;
  readonly weatherCount: number;
  readonly audioCount: number;
  readonly sayCount: number;
  /** 두 주체가 절반 넘게 겹쳐 있던 시간 비율(함께 보인 시간 대비). */
  readonly overlapShare: number;
  readonly issues: readonly string[];
  readonly summary: string;
}

export function probeCutscene(project: Project, commands: readonly Command[], viewport: { readonly width: number; readonly height: number }): CutsceneProbe {
  const timeline = simulateCutscene(commands);
  const area = viewport.width * viewport.height;
  const sizeOf = (id: string): { width: number; height: number } => pictureSize(project, id, { width: 48, height: 48 });
  const per = new Map<string, { resourceId: string; visible: number; maxH: number; first?: { x: number; y: number }; travel: number; last?: { x: number; y: number } }>();
  let togetherSamples = 0, overlappedSamples = 0; let coverSamples = 0; let heroHitSamples = 0, heroSamples = 0;
  // 맵 위 주인공 자리(시작 위치) — 컷신이 주인공을 옮기지 않는다면 그 자리를 그림 배우가 가로지르면 안 된다.
  const heroBox = ((): Box | null => {
    if (commands.some((c) => c.kind === "moveActor" && (c as { target?: unknown }).target === "player")) return null;
    const map = project.maps[project.startMapId as string];
    const pos = project.startPos as { x?: number; y?: number } | undefined;
    if (!map || typeof pos?.x !== "number" || typeof pos?.y !== "number") return null;
    const T = map.tileSize ?? project.tilesets[map.tilesetId]?.tileSize ?? 16;
    const mapW = map.width * T, mapH = map.height * T;
    const camX = mapW <= viewport.width ? (mapW - viewport.width) / 2 : Math.max(0, Math.min(mapW - viewport.width, pos.x * T + T / 2 - viewport.width / 2));
    const camY = mapH <= viewport.height ? (mapH - viewport.height) / 2 : Math.max(0, Math.min(mapH - viewport.height, pos.y * T + T / 2 - viewport.height / 2));
    const cx = pos.x * T + T / 2 - camX, bottom = (pos.y + 1) * T - camY;
    return { pictureId: "hero", x0: cx - 12, y0: bottom - 32, x1: cx + 12, y1: bottom };
  })();
  for (let t = 0; t <= timeline.durationMs; t += STEP_MS) {
    const boxes: Box[] = [];
    for (const snap of timeline.snapshotAt(t)) {
      const size = sizeOf(snap.resourceId);
      const box = pictureBox(snap, size);
      const full = (box.x1 - box.x0) * (box.y1 - box.y0) >= area * FULLSCREEN;
      if (full) { if (snap.opacity > 40 && !/white|black|fade|blank/iu.test(snap.resourceId)) coverSamples += 1; continue; } // 배경·흰 막
      const entry = per.get(snap.pictureId) ?? { resourceId: snap.resourceId, visible: 0, maxH: 0, travel: 0 };
      entry.maxH = Math.max(entry.maxH, (box.y1 - box.y0) / viewport.height);
      const w = Math.max(0, Math.min(box.x1, viewport.width) - Math.max(box.x0, 0)), h = Math.max(0, Math.min(box.y1, viewport.height) - Math.max(box.y0, 0));
      const inside = (w * h) / Math.max(1, (box.x1 - box.x0) * (box.y1 - box.y0));
      if (inside >= 0.5 && snap.opacity > 40) {
        entry.visible += STEP_MS;
        boxes.push(box);
        if (entry.last) entry.travel += Math.hypot(snap.x - entry.last.x, snap.y - entry.last.y);
        entry.last = { x: snap.x, y: snap.y };
        entry.first ??= { x: snap.x, y: snap.y };
      }
      per.set(snap.pictureId, entry);
    }
    if (heroBox && boxes.length > 0) {
      heroSamples += 1;
      if (boxes.some((b) => overlapRatio(heroBox, b) >= 0.3)) heroHitSamples += 1;
    }
    if (boxes.length >= 2) {
      togetherSamples += 1;
      let worst = 0;
      for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) worst = Math.max(worst, overlapRatio(boxes[i]!, boxes[j]!), overlapRatio(boxes[j]!, boxes[i]!));
      if (worst >= 0.5) overlappedSamples += 1;
    }
  }
  const coverShare = timeline.durationMs > 0 ? Math.min(1, (coverSamples * STEP_MS) / timeline.durationMs) : 0;
  const subjects: SubjectProbe[] = [...per.entries()].map(([pictureId, e]) => ({ pictureId, resourceId: e.resourceId, visibleMs: e.visible, maxHeightRatio: Math.round(e.maxH * 100) / 100, travelPx: Math.round(e.travel) }));
  const count = (pred: (c: Command) => boolean): number => commands.filter(pred).length;
  const tintCount = count((c) => c.kind === "m2Command" && (c as { commandId?: string }).commandId === "m2-046-tint-screen");
  const weatherCount = count((c) => c.kind === "setWeather" && (c as { weather?: string }).weather !== "none");
  const audioCount = timeline.marks.filter((m) => m.kind === "audio").length;
  const sayCount = timeline.marks.filter((m) => m.kind === "say").length;
  const overlapShare = togetherSamples ? Math.round((overlappedSamples / togetherSamples) * 100) / 100 : 0;

  const issues: string[] = [];
  if (subjects.length > 0) {
    if (timeline.durationMs < 6000) issues.push(`컷신이 ${(timeline.durationMs / 1000).toFixed(1)}초로 너무 짧습니다(6초 미만) — 도입은 분위기를 깔 시간이 필요합니다.`);
    for (const s of subjects) {
      if (s.visibleMs < 1500) issues.push(`그림 ${s.pictureId}(${s.resourceId})는 화면 안에 ${(s.visibleMs / 1000).toFixed(1)}초만 보입니다(1.5초 미만) — 화면 밖에서 시작하거나 밖에서 끝나 사실상 안 보입니다. 시작 좌표와 이동 목표를 화면 안으로 두세요.`);
      if (s.maxHeightRatio > 0.55) issues.push(`그림 ${s.pictureId}가 화면 높이의 ${Math.round(s.maxHeightRatio * 100)}%로 너무 큽니다 — 배우 scale(%)로 줄이세요.`);
      if (s.maxHeightRatio < 0.12 && s.visibleMs > 0) issues.push(`그림 ${s.pictureId}가 화면 높이의 ${Math.round(s.maxHeightRatio * 100)}%로 너무 작아 안 보입니다(scale 로 키우세요).`);
    }
    if (Math.max(...subjects.map((s) => s.maxHeightRatio)) < 0.3) issues.push(`가장 큰 주체도 화면 높이의 ${Math.round(Math.max(...subjects.map((s) => s.maxHeightRatio)) * 100)}% 입니다 — 장면의 주연이면 최소 30%(24×32 캐릭터셋은 scale 250~300)로 키워 위압감·존재감을 주세요.`);
    if (!subjects.some((s) => s.travelPx >= 24)) issues.push("화면 안 주체가 하나도 움직이지 않습니다(이동 24px 미만) — enter/move/exit 로 실제로 이동시키세요.");
    if (coverShare >= 0.4) issues.push(`전체 화면을 덮는 그림이 컷신의 ${Math.round(coverShare * 100)}% 동안 보입니다 — 실제 시작 맵이 가려집니다. 맵 위 장면이어야 하면 전체 화면 배경 그림을 쓰지 말고 맵·캐릭터셋으로 연출하세요.`);
    if (heroSamples > 0 && heroHitSamples / heroSamples >= 0.1) issues.push(`주체가 맵 위 주인공이 서 있는 자리를 ${Math.round((heroHitSamples / heroSamples) * 100)}% 동안 가립니다 — 주인공을 ghost 배우(character 로 hero:true)로 두고 이동 단계로 길 밖으로 비키게 하거나, 주체의 동선(fy)을 주인공 자리에서 떼세요.`);
    if (overlapShare >= 0.4) issues.push(`주체끼리 절반 넘게 겹친 채로 보이는 시간이 ${Math.round(overlapShare * 100)}%입니다 — 서로 다른 fx 로 간격을 벌리세요.`);
    if (audioCount === 0) issues.push("컷신에 효과음·음악이 하나도 없습니다 — se/bgm 단계로 소리를 깔아야 합니다.");
  }
  const summary = `길이 ${(timeline.durationMs / 1000).toFixed(1)}s · 주체 ${subjects.map((s) => `${s.pictureId}(보임 ${(s.visibleMs / 1000).toFixed(1)}s, 키 ${Math.round(s.maxHeightRatio * 100)}%, 이동 ${s.travelPx}px)`).join(" ") || "없음"} · 겹침 ${Math.round(overlapShare * 100)}% · 색조 ${tintCount} · 날씨 ${weatherCount} · 소리 ${audioCount} · 글 ${sayCount}`;
  return { durationMs: Math.round(timeline.durationMs), subjects, tintCount, weatherCount, audioCount, sayCount, overlapShare, issues, summary };
}
