// src/editor/panels/leftStorePane.ts
/**
 * 왼쪽 활동 막대 「스토어」: 받은 목록보다 인기·추천 상품을 먼저 보여 주고, 큰 화면(에셋 스토어)을 연다.
 * 스토어는 데스크톱 앱에서만 열린다(메인 프로세스가 서버와 통신한다). 위키: openwiki/asset-store.md.
 */
import "@/styles/database/assetStore/index.css";
import { storeBridge } from "@/editor/assetStore/storeBridge";
import { clearChildren, el } from "@/util/dom";

export function createLeftStorePane(): { root: HTMLElement; show(): void; dispose(): void } {
  const root = el("section", { class: "left-store-pane", attrs: { "aria-label": "에셋 스토어" }, dataset: { testid: "left-store-pane" } });
  const open = (): void => {
    void import("@/editor/assetStore/storeWorkspace").then(({ openAssetStore }) => openAssetStore("browse"));
  };
  const render = (): void => {
    if (root.hidden) return;
    clearChildren(root);
    root.append(
      el("h2", { class: "left-store-title", text: "에셋 스토어" }),
      el("p", { class: "left-store-lead", text: "받은 목록이 아니라, 지금 프로젝트에 잘 맞는 인기·추천 에셋을 먼저 살펴보세요." }),
      el("ul", {
        class: "left-store-guide",
        children: [
          el("li", { children: [el("strong", { text: "인기" }), el("span", { text: " 많이 쓰인 타일셋·캐릭터·음악을 확인합니다." })] }),
          el("li", { children: [el("strong", { text: "추천" }), el("span", { text: " 조수가 바로 쓸 수 있는 팩을 크게 비교합니다." })] }),
          el("li", { children: [el("strong", { text: "사용" }), el("span", { text: " 마음에 들면 자세히 보고 프로젝트에 넣습니다." })] }),
        ],
      }),
    );
    const bridge = storeBridge();
    if (!bridge) {
      root.append(el("p", { class: "left-store-lead", text: "스토어는 OPRN 데스크톱 앱에서 열 수 있습니다." }));
      return;
    }
    root.append(el("button", {
      class: "left-store-open", text: "인기 에셋 둘러보기", attrs: { type: "button" }, dataset: { testid: "left-store-open" }, on: { click: open },
    }));
  };
  return { root, show: render, dispose: () => {} };
}
