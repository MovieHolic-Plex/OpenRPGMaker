import { LIFE_SIM_CLOSED_BODY, LIFE_SIM_CLOSED_TITLE } from "../../../electron/shared/lifeSim";
import { emptyState } from "@/editor/panels/databaseWorkspace";
import { el } from "@/util/dom";

/**
 * 생활 그룹이 닫혀 있을 때(LIFE_SIM_ENABLED=false) 그룹의 어느 탭에 닿아도 본문에 그리는 안내 한 장.
 * 편집 컨트롤은 하나도 없다. 데이터는 지우지 않으므로 그 사실만 말한다.
 */
export function renderLifeClosedNotice(body: HTMLElement): void {
  body.append(el("div", {
    // 새 CSS 선언은 CSS 승자 기준선(check-css-winners)을 건드리므로 여백만 인라인으로 준다.
    attrs: { style: "display:flex;justify-content:center;padding:40px 24px" },
    dataset: { testid: "db-life-closed-notice" },
    children: [emptyState({
      icon: "…",
      title: LIFE_SIM_CLOSED_TITLE,
      body: LIFE_SIM_CLOSED_BODY,
      testid: "db-life-closed-card",
    })],
  }));
}
