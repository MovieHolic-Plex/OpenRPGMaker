// 데이터베이스 '개요' 대시보드 셸(todo 13).
// 지금은 9개 컬렉션 통계 칩 + 차트 자리 표시자만 렌더한다. todo 15가 곡선/산점도/문제 카드를 채운다.
// 성능 계약: 카운트(length)만 읽는다 — battlePredict/parameterCurves 등 무거운 계산 호출 금지(추후 lazy).
import type { DatabaseCollection } from "@/editor/databaseActions";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";

// DatabaseRecords 의 9개 컬렉션 — DatabaseCollection(= keyof DatabaseRecords)과 동일한 집합.
const STAT_COLLECTIONS: readonly { readonly collection: DatabaseCollection; readonly label: string }[] = [
  { collection: "actors", label: "주인공" },
  { collection: "classes", label: "직업" },
  { collection: "skills", label: "스킬" },
  { collection: "items", label: "아이템" },
  { collection: "equipment", label: "장비" },
  { collection: "enemies", label: "몬스터" },
  { collection: "troops", label: "적 그룹" },
  { collection: "states", label: "상태" },
  { collection: "battleAnimations", label: "전투 애니메이션" },
];

export function renderOverviewTab(host: HTMLElement, _rerender: () => void): void {
  clearChildren(host);
  const database = store.getCurrent().database;
  const statsRow = el("div", { class: "db-overview-stats" });
  for (const { collection, label } of STAT_COLLECTIONS) {
    const count = database[collection].length;
    statsRow.append(
      el("div", {
        class: "db-overview-stat",
        dataset: { testid: `db-overview-stat-${collection}` },
        children: [
          el("span", { class: "db-overview-stat-label", text: label }),
          el("span", { class: "db-overview-stat-count", text: String(count) }),
        ],
      }),
    );
  }
  host.append(statsRow);
  // todo 15: 곡선/산점도/문제 카드가 이 자리를 채운다(여기선 자리 표시자만).
  host.append(
    el("section", {
      class: "db-overview-charts",
      dataset: { testid: "db-overview-charts" },
      text: "대시보드 차트 (todo 15)",
    }),
  );
}
