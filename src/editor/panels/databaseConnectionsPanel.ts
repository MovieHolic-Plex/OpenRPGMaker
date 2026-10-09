import type { DatabaseCollection } from "@/editor/databaseActions";
import { CONNECTION_COLLECTIONS, createRecordConnectionsReader, type RecordConnections, type RecordUse } from "@/editor/databaseRecordConnections";
import { inventoryCatalogSession, selectedRecordIdForSession, setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { jsonEqual } from "@/util/structuralJson";

/**
 * 자료집 오른쪽 「연결」 칸(2026-09-27 개선안). 본문(.db-body) 밖의 형제라 탭 캐시·부분 렌더와
 * 얽히지 않는다 — 활성 탭이나 선택이 바뀌면 호출자가 paint 를 다시 부른다.
 *
 * 레코드 탭(주인공·직업·스킬·아이템·장비·몬스터·적 그룹·상태)에서만 보이고, 그 밖의 탭에서는
 * hidden 이다. 편집 필드는 없다 — 읽기와 이동만 한다.
 */

const TAB_COLLECTION: Readonly<Record<string, DatabaseCollection>> = {
  actors: "actors",
  classes: "classes",
  skills: "skills",
  enemies: "enemies",
  troops: "troops",
  states: "states",
};

export function connectionsCollectionForTab(tab: string): DatabaseCollection | undefined {
  if (tab === "items") return inventoryCatalogSession().collection;
  return TAB_COLLECTION[tab];
}

export type ConnectionsPanel = {
  readonly element: HTMLElement;
  /** 호스트(.database-modal-body). 전체 재렌더가 호스트를 비우면 paint 가 다시 붙인다. */
  host?: HTMLElement;
  paint(tab: string): void;
};

export function createConnectionsPanel(navigate: (target: NonNullable<RecordUse["target"]>) => void): ConnectionsPanel {
  const element = el("aside", {
    class: "db-connections",
    attrs: { "aria-label": "연결과 확인", hidden: "" },
    dataset: { testid: "db-connections" },
  });
  let lastKey = "";
  let lastResult: RecordConnections | undefined;
  let readConnections = createRecordConnectionsReader();
  let lastLineage = store.getVersionToken().lineage;
  // 종류별로 「더 보기」를 펼친 묶음. 레코드가 바뀌면 비운다.
  const expanded = new Set<string>();
  const panel: ConnectionsPanel = { element, paint: () => {} };

  const paint = (tab: string): void => {
    const host = panel.host;
    if (host && element.parentElement !== host) host.append(element);
    const collection = connectionsCollectionForTab(tab);
    const records = collection ? store.getCurrent().database[collection] as readonly { readonly id: string; readonly name: string }[] : [];
    const selectedId = collection ? selectedRecordIdForSession(collection) : undefined;
    const record = collection ? (records.find((entry) => entry.id === selectedId) ?? records[0]) : undefined;
    if (!collection || !CONNECTION_COLLECTIONS.has(collection) || !record) {
      element.hidden = true;
      lastKey = "";
      lastResult = undefined;
      return;
    }
    element.hidden = false;
    const project = store.getCurrent();
    const lineage = store.getVersionToken().lineage;
    if (lineage !== lastLineage) {
      lastLineage = lineage;
      readConnections = createRecordConnectionsReader();
      lastKey = "";
      lastResult = undefined;
      expanded.clear();
    }
    const key = `${collection}:${record.id}`;
    const result = readConnections(project, collection, record.id);
    if (key === lastKey && jsonEqual(result, lastResult)) return;
    if (key !== lastKey) expanded.clear();
    lastKey = key;
    lastResult = result;
    const { uses, checks } = result;
    // Expansion is presentation only; redraw the already computed uses.
    const repaint = (): void => {
      const active = document.activeElement as HTMLElement | null;
      const focusedKind = active && usesSection.contains(active) ? active.dataset.connectionKind : undefined;
      usesSection.replaceChildren(
        el("h4", { class: "db-connections-title", text: "쓰는 곳" }),
        ...groupedUses(uses, expanded, navigate, repaint),
      );
      if (focusedKind) {
        Array.from(usesSection.querySelectorAll<HTMLButtonElement>(".db-connections-more"))
          .find((button) => button.dataset.connectionKind === focusedKind)?.focus({ preventScroll: true });
      }
    };
    const usesSection = section("쓰는 곳", "db-connections-uses", uses.length
      ? groupedUses(uses, expanded, navigate, repaint)
      : [el("p", { class: "db-connections-none", text: "아직 아무 데서도 쓰지 않아요" })]);
    element.replaceChildren(
      section("확인할 것", "db-connections-checks", checks.length
        ? checks.map((text) => el("p", { class: "db-connections-check", attrs: { role: "note" }, text }))
        : [el("p", { class: "db-connections-none", text: "문제 없어요" })]),
      usesSection,
    );
  };

  panel.paint = paint;
  return panel;
}

function section(title: string, testid: string, children: readonly HTMLElement[]): HTMLElement {
  return el("section", {
    class: "db-connections-section",
    dataset: { testid },
    children: [el("h4", { class: "db-connections-title", text: title }), ...children],
  });
}

/** 종류(주인공·장비 허용·맵 이벤트…)별 묶음. 묶음마다 셋까지 보이고 나머지는 「N개 더」로 편다. */
const GROUP_PREVIEW = 3;

function groupedUses(
  uses: readonly RecordUse[],
  expanded: Set<string>,
  navigate: (target: NonNullable<RecordUse["target"]>) => void,
  repaint: () => void,
): HTMLElement[] {
  const groups = new Map<string, RecordUse[]>();
  for (const use of uses) {
    const list = groups.get(use.kind);
    if (list) list.push(use);
    else groups.set(use.kind, [use]);
  }
  const out: HTMLElement[] = [];
  for (const [kind, list] of groups) {
    out.push(el("p", {
      class: "db-connections-kind-head",
      children: [el("span", { text: kind }), el("span", { class: "db-connections-count", text: String(list.length) })],
    }));
    const open = expanded.has(kind);
    const shown = open ? list : list.slice(0, GROUP_PREVIEW);
    for (const use of shown) out.push(useRow(use, navigate));
    if (list.length > GROUP_PREVIEW) {
      out.push(el("button", {
        class: "db-connections-more",
        dataset: { connectionKind: kind },
        attrs: { type: "button", "aria-expanded": String(open) },
        text: open ? "접기" : `${list.length - GROUP_PREVIEW}개 더 보기`,
        on: {
          click: () => {
            if (open) expanded.delete(kind);
            else expanded.add(kind);
            repaint();
          },
        },
      }));
    }
  }
  return out;
}

function useRow(use: RecordUse, navigate: (target: NonNullable<RecordUse["target"]>) => void): HTMLElement {
  const label = [el("span", { class: "db-connections-name", text: use.name })];
  if (!use.target) return el("div", { class: "db-connections-use", children: label });
  const target = use.target;
  return el("button", {
    class: "db-connections-use db-connections-link",
    attrs: { type: "button", title: `${use.kind} ${use.name}(으)로 이동` },
    children: label,
    on: {
      click: () => {
        setSelectedRecordId(target.collection, target.id, { reveal: true });
        navigate(target);
      },
    },
  });
}
