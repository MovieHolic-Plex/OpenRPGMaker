import { summarizeTilesetGenerationReadiness } from "@/project/tilesetSemanticChecker";
import type { TileGroupRole, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

/* 감사 규칙은 AI 프롬프트와 공유하는 데이터라 id·역할명이 영어다. 화면에 그대로 나오면
   한국어 UI 안에 영어 한 덩어리가 박히므로, 여기서만 표시용 한국어로 바꾼다.
   (모델 쪽 문자열은 건드리지 않는다 — 프롬프트 호환을 깨지 않기 위해.) */

const ROLE_NAMES: Record<TileGroupRole | string, string> = {
  building: "건물",
  castle: "성벽",
  decor: "장식",
  fence: "울타리",
  prop: "소품",
  roof: "지붕",
  terrain: "지면",
  wall: "벽",
  water: "물",
};

const CHECK_NAMES: Record<string, string> = {
  city: "도시",
  decor: "장식",
  house: "집",
  road: "길",
  water: "물",
};

function roleName(role: string): string {
  return ROLE_NAMES[role] ?? role;
}

function roleList(roles: readonly string[]): string {
  return roles.map(roleName).join(" · ");
}

export function renderTilesetCheckerSummary(tileset: TilesetDef): HTMLElement {
  const summary = summarizeTilesetGenerationReadiness(tileset);
  return el("fieldset", {
    class: "oprn-db-fieldset oprn-tileset-checker",
    dataset: { testid: "tileset-generation-checker" },
    children: [
      el("legend", { text: "생성 감사" }),
      el("div", {
        class: `tileset-checker-status ${summary.ready ? "ready" : "missing"}`,
        text: summary.ready
          ? "도시 · 집 · 길 · 물 · 장식 모두 생성 준비됨"
          : "의미 역할이 덜 채워졌습니다",
      }),
      el("div", {
        class: "tileset-checker-list",
        children: summary.checks.map((check) =>
          el("div", {
            class: `tileset-checker-row ${check.ready ? "ready" : "missing"}`,
            dataset: { testid: `tileset-generation-check-${check.id}` },
            children: [
              el("strong", { text: CHECK_NAMES[check.id] ?? check.label }),
              el("span", {
                text: check.ready
                  ? `충족: ${roleList(check.coveredRoles)}`
                  : `필요: ${roleList(check.missingRoleSlots)}`,
              }),
            ],
          })
        ),
      }),
      ...(summary.invalidGroups.length > 0
        ? [el("div", { class: "tileset-checker-note", text: `잘못된 그룹 ${summary.invalidGroups.length}개는 무시했습니다` })]
        : []),
    ],
  });
}
