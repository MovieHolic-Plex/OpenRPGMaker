// editor/aiPlacementPop.ts
// 조수가 맵에 인물·이벤트를 놓으면 그 칸에서 캐릭터가 톡 튀어나오고 이름표가 잠깐 뜬다(2026-11-04 오너 승인 4안 중 2).
// 지금 보고 있는 맵일 때만 그린다 — 다른 맵이면 따라가기 카메라(aiFollowCamera)가 먼저 그 맵을 연다.
// 칸 → 화면 좌표는 EditScene 이 등록한 해석기(regionClientRect)를 쓴다. 캔버스는 건드리지 않는 DOM 덧그림이다.
import { editorState } from "@/editor/editorState";
import { eventCharsetGraphic, walkingCharset } from "@/editor/panels/aiCreationCards";
import type { ChangeItem } from "@/editor/panels/aiChangeSummaryCard";
import { resolveRegionClientRect } from "@/editor/regionClientRect";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

const SHOW_MS = 2600;
const MAX_LIVE = 6;

export function announceAiPlacement(project: Project, item: ChangeItem): void {
  if (item.kind !== "event" || !item.mapId) return;
  if (editorState.get().currentMapId !== item.mapId) return;
  const event = project.maps[item.mapId]?.events.find((entry) => entry.id === item.id);
  const host = document.querySelector<HTMLElement>(".phaser-container");
  if (!event || !host) return;
  // 따라가기 카메라가 같은 프레임에 화면을 옮긴다 — 다음 프레임의 카메라로 자리를 잡는다.
  requestAnimationFrame(() => requestAnimationFrame(() => place(host, project, event, item)));
}

function place(host: HTMLElement, project: Project, event: Project["maps"][string]["events"][number], item: ChangeItem): void {
  const cell = resolveRegionClientRect({ x: event.x, y: event.y, width: 1, height: 1 });
  if (!cell) return;
  const box = host.getBoundingClientRect();
  const left = cell.x - box.left + cell.width / 2;
  const top = cell.y - box.top + cell.height;
  if (left < 0 || top < 0 || left > box.width || top > box.height) return;
  for (const stale of [...host.querySelectorAll(".canvas-ai-place-pop")].slice(0, -MAX_LIVE + 1)) stale.remove();
  const graphic = eventCharsetGraphic(event);
  const size = Math.max(24, Math.round(cell.height * 2));
  const sprite = graphic?.sprite?.id ? walkingCharset(project, graphic.sprite.id, 0, size, "canvas-ai-place-sprite") : null;
  const pop = el("div", {
    class: "canvas-ai-place-pop", dataset: { testid: "ai-place-pop", eventId: item.id },
    attrs: { role: "status", "aria-label": `${event.name?.trim() || item.id} 배치` },
    children: [
      el("span", { class: "canvas-ai-place-tag", text: event.name?.trim() || item.id }),
      sprite ?? el("span", { class: "canvas-ai-place-dot", attrs: { "aria-hidden": "true" } }),
    ],
  });
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
  host.append(pop);
  setTimeout(() => pop.remove(), SHOW_MS);
}
