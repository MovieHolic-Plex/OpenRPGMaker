// src/editor/panels/leftStorePane.ts
/**
 * 왼쪽 활동 막대 「스토어」: 받은 것·이 프로젝트에 든 스토어 상품 수를 보이고, 큰 화면(에셋 스토어)을 연다.
 * 스토어는 데스크톱 앱에서만 열린다(메인 프로세스가 서버와 통신한다). 위키: openwiki/asset-store.md.
 */
import "@/styles/database/assetStore/index.css";
import { storeItemsInProject } from "@/assetStore/pack";
import { storeBridge } from "@/editor/assetStore/storeBridge";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";

export function createLeftStorePane(): { root: HTMLElement; show(): void; dispose(): void } {
  const root = el("section", { class: "left-store-pane", attrs: { "aria-label": "에셋 스토어" }, dataset: { testid: "left-store-pane" } });
  let installedCount: number | null = null;
  const open = (tab: "browse" | "installed" | "project" | "upload") => {
    void import("@/editor/assetStore/storeWorkspace").then(({ openAssetStore }) => openAssetStore(tab));
  };
  const render = (): void => {
    if (root.hidden) return;
    clearChildren(root);
    const bridge = storeBridge();
    const inProject = storeItemsInProject(store.getCurrent()).length;
    root.append(
      el("h2", { class: "left-store-title", text: "에셋 스토어" }),
      el("p", { class: "left-store-lead", text: "타일셋·캐릭터·음악을 받아 이 프로젝트에 넣습니다. 「조수 사용 가능」 팩은 조수가 그 타일로 바로 맵을 깝니다." }),
    );
    if (!bridge) {
      root.append(el("p", { class: "left-store-lead", text: "스토어는 OPRN 데스크톱 앱에서 열 수 있습니다." }));
      return;
    }
    root.append(
      el("button", { class: "left-store-open", text: "스토어 열기", attrs: { type: "button" }, dataset: { testid: "left-store-open" }, on: { click: () => open("browse") } }),
      el("button", { class: "left-store-row", attrs: { type: "button" }, on: { click: () => open("installed") }, children: [el("span", { text: "받은 것" }), el("span", { class: "left-store-count", text: installedCount === null ? "…" : String(installedCount) })] }),
      el("button", { class: "left-store-row", attrs: { type: "button" }, on: { click: () => open("project") }, children: [el("span", { text: "이 프로젝트" }), el("span", { class: "left-store-count", text: String(inProject) })] }),
      el("button", { class: "left-store-row", attrs: { type: "button" }, on: { click: () => open("upload") }, children: [el("span", { text: "내 에셋 올리기" }), el("span", { class: "left-store-count", text: "→" })] }),
    );
  };
  const refresh = (): void => {
    const bridge = storeBridge();
    if (!bridge) { render(); return; }
    void bridge.installed().then((items) => { installedCount = items.length; render(); }).catch(() => { installedCount = null; render(); });
  };
  const off = storeBridge()?.onChanged(() => refresh()) ?? (() => {});
  return { root, show: refresh, dispose: off };
}
