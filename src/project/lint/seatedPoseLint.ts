// project/lint/seatedPoseLint.ts
// 앉은 자세 검사 — 의자에 앉은 사람과 graphic.pose = "seated" 가 어긋나면 경고한다(첫사랑 r7 의자 세 개가 사람에 가려진 일).
// 의자 칸은 이름 추측이 아니라 타일 메타 태그(「의자」/chair)로만 판정한다(@/project/seatedPose).
//
//  - scene-seated-standing    사람 그림(스프라이트)이 의자 칸에 있는데 pose 가 없다 — 서 있는 그림이 의자를 가려 앉은 사람이 아니라 서 있는 사람으로 읽힌다
//  - scene-seated-off-chair   pose: "seated" 인데 의자 칸이 아니다 — 앉은 그림이 맨바닥에 낮게 서 있다
//
// 보이는 그림이 있는 페이지만 본다(투명 페이지는 몸이 없다). 선 자세 경고는 «앉은 페이지가 하나도 없는» 이벤트만 받는다 —
// 앉았다가 일어서는 인물은 일어선 뒤 페이지(같은 칸에 선 그림, 이동은 명령으로)가 따로 있어 그것까지 틀렸다고 하면 오탐이다.
import { cellHasChair, isSeatedGraphic } from "@/project/seatedPose";
import type { EventPage, GameEvent, Project } from "../types";
import type { LintIssue } from "./projectLint";

function pagesOf(event: GameEvent): readonly EventPage[] {
  return event.pages ?? [];
}

function shown(page: EventPage): boolean {
  const g = page.graphic;
  return Boolean(g && !g.transparent && (g.sprite || g.appearanceId));
}

export function checkSeatedPose(project: Project, issues: LintIssue[]): void {
  for (const map of Object.values(project.maps)) {
    for (const host of map.events ?? []) {
      const onChair = cellHasChair(project, map, host.x, host.y);
      const anySeated = pagesOf(host).some((page) => shown(page) && isSeatedGraphic(page.graphic));
      for (const page of pagesOf(host)) {
        if (!shown(page)) continue;
        const seated = isSeatedGraphic(page.graphic);
        if (seated && !onChair) {
          issues.push({
            severity: "warning", code: "scene-seated-off-chair", mapId: map.id, eventId: host.id, x: host.x, y: host.y,
            message: `이벤트 ${host.id} 의 페이지 ${page.id ?? ""} 는 앉은 자세(pose: seated)인데 (${host.x},${host.y}) 는 의자 칸이 아니다 — 앉은 그림은 의자가 있는 칸에만 쓴다.`,
          });
        } else if (!seated && onChair && !anySeated && page.priority !== "below") {
          issues.push({
            severity: "warning", code: "scene-seated-standing", mapId: map.id, eventId: host.id, x: host.x, y: host.y,
            message: `이벤트 ${host.id} 의 페이지 ${page.id ?? ""} 는 의자 칸 (${host.x},${host.y}) 에 선 자세 그림을 놓았다 — 서 있는 그림이 의자를 가려 사람이 서 있는 것처럼 읽힌다. 앉은 사람이면 graphic.pose 를 seated 로 둔다(일어선 뒤 바닥 칸으로 옮긴 페이지는 괜찮다).`,
          });
        }
      }
    }
  }
}
