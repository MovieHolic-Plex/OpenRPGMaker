import { focusEditorRegion } from "@/editor/editorReferenceNavigation";
import { editorState } from "@/editor/editorState";
import { selectEditorMap } from "@/editor/mapSelection";
import { collectMapLinkGraph, type MapLinkEdge, type MapLinkNode } from "@/project/mapLinkStats";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

/**
 * 왼쪽 활동 막대 「연결」: 맵마다 나가는·들어오는 이동을 보이고, 시작 맵에서 못 닿는 맵과 문이 하나도 없는 맵을
 * 위에 모은다. 맵 이름을 누르면 그 맵을 열고, 이동 행을 누르면 그 이동 이벤트로 카메라를 보낸다.
 */
export function createLeftLinksPane(): { root: HTMLElement; show(): void; dispose(): void } {
  const root = el("section", { class: "left-links-pane", attrs: { "aria-label": "맵 연결" }, dataset: { testid: "left-links-pane" } });
  let lastProject: Project | null = null;
  let lastMapId: string | null = null;

  const name = (project: Project, mapId: string) => project.maps[mapId]?.name?.trim() || mapId;

  const goToEdge = (edge: MapLinkEdge): void => {
    if (edge.kind !== "transfer" || edge.x === undefined || edge.y === undefined) { selectEditorMap(edge.from); return; }
    if (!selectEditorMap(edge.from, { clearEventSelection: false })) return;
    editorState.set({ selectedEventId: edge.eventId ?? null, selectedEventPageId: null });
    focusEditorRegion({ mapId: edge.from, x: edge.x, y: edge.y, w: 1, h: 1 }, { highlight: true });
  };

  const edgeRow = (project: Project, edge: MapLinkEdge, direction: "out" | "in" | "both"): HTMLElement => {
    const other = direction === "in" ? edge.from : edge.to;
    const via = edge.kind === "transfer" ? `이벤트 (${edge.x}, ${edge.y})` : "맵 가장자리";
    const arrow = direction === "both" ? "↔" : direction === "out" ? "→" : "←";
    const title = direction === "in" ? `${name(project, other)}에서 들어옴` : `${via}에서 ${name(project, other)}(으)로${direction === "both" ? " · 돌아오는 이동 있음" : ""}`;
    return el("button", {
      class: "left-links-edge",
      attrs: { type: "button", title },
      dataset: { testid: `left-links-edge-${direction}-${other}` },
      children: [
        el("span", { class: "left-links-arrow", attrs: { "aria-hidden": "true" }, text: arrow }),
        el("span", { class: "left-links-target", text: name(project, other) }),
        el("span", { class: "left-links-via", text: direction === "in" ? "들어옴만" : via }),
      ],
      on: { click: () => goToEdge(edge) },
    });
  };

  // 양방향 이동(마을 → 집, 집 → 마을)은 한 줄(↔)로 합친다. 마을 하나에 집 15채면 30줄이 15줄이 된다.
  const edgeRows = (project: Project, node: MapLinkNode): HTMLElement[] => {
    const back = new Set(node.incoming.map((edge) => edge.from));
    const out = new Set(node.outgoing.map((edge) => edge.to));
    const seen = new Set<string>();
    const rows: HTMLElement[] = [];
    for (const edge of node.outgoing) {
      if (seen.has(edge.to)) continue;
      seen.add(edge.to);
      rows.push(edgeRow(project, edge, back.has(edge.to) ? "both" : "out"));
    }
    for (const edge of node.incoming) {
      if (out.has(edge.from) || seen.has(`in:${edge.from}`)) continue;
      seen.add(`in:${edge.from}`);
      rows.push(edgeRow(project, edge, "in"));
    }
    return rows;
  };

  const card = (project: Project, node: MapLinkNode, current: string | null): HTMLElement => {
    const isolated = node.outgoing.length === 0 && node.incoming.length === 0;
    const unreachable = !node.reachableFromStart;
    const flags = [
      node.isStart ? "시작" : null,
      isolated ? "고립" : unreachable ? "도달 불가" : null,
    ].filter((flag): flag is string => flag !== null);
    return el("article", {
      class: "left-links-card" + (node.mapId === current ? " is-current" : "") + (isolated ? " is-isolated" : unreachable ? " is-unreachable" : ""),
      dataset: { testid: `left-links-map-${node.mapId}`, state: isolated ? "isolated" : unreachable ? "unreachable" : "ok" },
      children: [
        el("button", {
          class: "left-links-name",
          attrs: { type: "button", "aria-current": node.mapId === current ? "true" : "false" },
          dataset: { testid: `left-links-open-${node.mapId}` },
          on: { click: () => selectEditorMap(node.mapId) },
          children: [
            el("strong", { text: name(project, node.mapId) }),
            ...flags.map((flag) => el("span", { class: `left-links-flag is-${flag === "시작" ? "start" : "warn"}`, text: flag })),
            el("span", { class: "left-links-counts", text: `나감 ${node.outgoing.length} · 들어옴 ${node.incoming.length}` }),
          ],
        }),
        ...(node.mapId === current || isolated || unreachable
          ? [el("div", {
            class: "left-links-edges",
            children: [
              ...edgeRows(project, node),
              ...(isolated ? [el("p", { class: "left-links-hint", text: "이 맵으로 들어오거나 나가는 이동이 없습니다. 문 이벤트에 「장소 이동」을 넣으면 연결됩니다." })] : []),
              ...(!isolated && unreachable ? [el("p", { class: "left-links-hint", text: "시작 맵에서 이동을 따라가도 닿지 않습니다." })] : []),
            ],
          })]
          : []),
      ],
    });
  };

  const render = (force = false): void => {
    if (root.hidden) return;
    const project = store.getCurrent();
    const current = editorState.get().currentMapId ?? null;
    if (!force && project === lastProject && current === lastMapId) return;
    lastProject = project;
    lastMapId = current;
    const nodes = collectMapLinkGraph(project);
    const problem = (node: MapLinkNode) => !node.reachableFromStart;
    const problems = nodes.filter(problem);
    const ordered = [...nodes].sort((a, b) => Number(problem(b)) - Number(problem(a)) || Number(b.isStart) - Number(a.isStart));
    root.replaceChildren(
      el("div", {
        class: "left-links-head",
        children: [
          el("strong", { text: "맵 연결" }),
          el("span", {
            class: "left-links-summary" + (problems.length ? " has-problems" : ""),
            dataset: { testid: "left-links-summary" },
            text: problems.length ? `닿지 않는 맵 ${problems.length}개` : `맵 ${nodes.length}개 모두 연결됨`,
          }),
        ],
      }),
      el("div", { class: "left-links-list", children: ordered.map((node) => card(project, node, current)) }),
    );
  };

  const onChange = (): void => render();
  const unsubStore = store.subscribe(onChange);
  const unsubEditor = editorState.subscribe(onChange);
  return {
    root,
    show: () => render(true),
    dispose: () => { unsubStore(); unsubEditor(); },
  };
}
