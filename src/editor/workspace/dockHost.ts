// editor/workspace/dockHost.ts
// 도크 컨테이너 — 레이아웃 데이터(어떤 패널이 어느 도크에 어떤 순서로)를 실제 DOM 으로 만든다.
// 이전에는 `editor.ts` 의 renderEditor 가 좌패널 자식 3개를 손으로 조립했다.
//
// ── testid·클래스를 새로 짓지 않는 이유 ──────────────────────────────────────────
// `.left-panel-stack[data-testid="left-palette-root"]` / `[data-testid="left-map-root"]` 는
// **CSS 계약**이다. src/styles 에 이 두 셀렉터를 쓰는 규칙이 300줄 넘게 있고
// (`> .panel-section:nth-child(1)` 같은 위치 셀렉터까지), e2e 계약도 여기에 걸려 있다.
// 개명 대상이었던 DOM 지문(금지 목록은 test/detsukuruBrandStrings.test.ts 가 유일한 원천)과
// 달리 이 이름들은 타사 제품 용어가 아니라 우리 레이아웃의 구조 이름이므로 그대로 둔다.
// 그래서 도크는 **같은 DOM 모양을 데이터로부터** 만든다 — 껍데기는 그대로, 조립 근거만 바뀐다.
//
// ⚠ 아직 도크가 갖지 않은 것: 패널 표시/숨김 게이팅. `EditorChromeVisibility.mapTree` 가
// 여전히 맵 패널을 `.is-ui-hidden` 으로 숨긴다(CSS 게이트 38곳이 그걸 본다). 도크에서
// 패널을 빼는 것과 밀도로 숨기는 것을 한 번에 합치면 CSS 를 동시에 고쳐야 해서
// 검증 단위가 커진다 — 다음 라운드로 남긴다.

import { panelById, type DockZone, type PanelId } from "@/editor/workspace/panelRegistry";
import { clearChildren, el } from "@/util/dom";

/**
 * 패널 → 고정 testid. CSS·e2e 계약이라 값을 바꾸면 안 된다.
 * `assistant` 는 도크가 만들지 않는다(AI 독이 자기 호스트를 갖는다) — 참고용으로만 적는다.
 */
const HOST_TESTID: Record<PanelId, string> = {
  tiles: "left-palette-root",
  maps: "left-map-root",
  assistant: "chat-side-panel",
};

export function panelHostTestId(id: PanelId): string {
  return HOST_TESTID[id];
}

export type DockMount = {
  readonly zone: DockZone;
  readonly container: HTMLElement;
  readonly hosts: ReadonlyMap<PanelId, HTMLElement>;
  readonly splitters: readonly HTMLElement[];
  /** 구성 서명 — 같으면 다시 조립할 필요가 없다(멱등 동기화용). */
  readonly signature: string;
};

export type MountDockArgs = {
  readonly container: HTMLElement;
  readonly zone: DockZone;
  readonly panels: readonly PanelId[];
  /** 패널 사이에 끼울 리사이저를 만든다. 없으면 붙이지 않는다. */
  readonly makeSplitter?: (index: number) => HTMLElement | null;
  /** 도크가 직접 만들지 않고 외부가 소유하는 패널(예: assistant). */
  readonly externalPanels?: readonly PanelId[];
};

export function dockSignature(zone: DockZone, panels: readonly PanelId[]): string {
  return `${zone}:${panels.join(">")}`;
}

/**
 * 컨테이너를 비우고 레이아웃 순서대로 패널 호스트를 만든다.
 * 그리기는 하지 않는다 — `renderDockPanels` 가 별개다(호스트 생성과 렌더 시점이 다르다).
 */
export function mountDock(args: MountDockArgs): DockMount {
  const external = new Set(args.externalPanels ?? []);
  const owned = args.panels.filter((id) => !external.has(id));
  clearChildren(args.container);
  const hosts = new Map<PanelId, HTMLElement>();
  const splitters: HTMLElement[] = [];
  owned.forEach((id, index) => {
    if (index > 0) {
      const splitter = args.makeSplitter?.(index) ?? null;
      if (splitter) {
        splitters.push(splitter);
        args.container.append(splitter);
      }
    }
    const host = el("div", {
      class: "left-panel-stack",
      dataset: {
        testid: HOST_TESTID[id],
        dockPanel: id,
        dockZone: args.zone,
      },
    });
    hosts.set(id, host);
    args.container.append(host);
  });
  return {
    zone: args.zone,
    container: args.container,
    hosts,
    splitters,
    signature: dockSignature(args.zone, owned),
  };
}

/** 레지스트리의 render 를 각 호스트에 적용. render 가 없는 패널(assistant)은 건너뛴다. */
export function renderDockPanels(mount: DockMount, only?: readonly PanelId[]): void {
  const filter = only ? new Set(only) : null;
  for (const [id, host] of mount.hosts) {
    if (filter && !filter.has(id)) continue;
    const def = panelById(id);
    if (!def?.render) continue;
    def.render(host);
  }
}
