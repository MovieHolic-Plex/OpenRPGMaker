// src/editor/panels/leftStorePane.ts
/**
 * 왼쪽 활동 막대 「스토어」: 받은 목록보다 인기·추천 상품을 먼저 보여 주고, 큰 화면(에셋 스토어)을 연다.
 * 스토어는 데스크톱 앱에서만 열린다(메인 프로세스가 서버와 통신한다). 위키: openwiki/asset-store.md.
 */
import "@/styles/database/assetStore/index.css";
import { storeBridge } from "@/editor/assetStore/storeBridge";
import { clearChildren, el } from "@/util/dom";

const STORE_WEB_URL = "https://store.openrpgmaker.com";

export function createLeftStorePane(): { root: HTMLElement; show(): void; dispose(): void } {
  const root = el("section", { class: "left-store-pane", attrs: { "aria-label": "에셋 스토어" }, dataset: { testid: "left-store-pane" } });
  const open = (tab: "browse" | "upload"): void => {
    void import("@/editor/assetStore/storeWorkspace").then(({ openAssetStore }) => openAssetStore(tab));
  };
  const render = (): void => {
    if (root.hidden) return;
    clearChildren(root);
    root.append(
      el("h2", { class: "left-store-title", text: "에셋 스토어" }),
      el("p", { class: "left-store-lead", text: "타일·캐릭터·음악을 무료로 받아 내 게임에 바로 넣어요." }),
      el("ul", {
        class: "left-store-guide",
        children: [
          el("li", { children: [el("strong", { text: "찾기" }), el("span", { text: " 「마을」「전투 음악」처럼 쉬운 말로 찾아요." })] }),
          el("li", { children: [el("strong", { text: "넣기" }), el("span", { text: " 단추 한 번이면 팔레트와 캐릭터 목록에 들어가요." })] }),
          el("li", { children: [el("strong", { text: "되돌리기" }), el("span", { text: " 마음이 바뀌면 바로 뺄 수 있어요." })] }),
        ],
      }),
    );
    const bridge = storeBridge();
    if (!bridge) {
      // 웹 편집기에는 스토어 중계가 없다 — 소개만 두지 않고 웹 스토어로 가는 길을 준다.
      root.append(
        el("a", {
          class: "left-store-open",
          text: "웹에서 스토어 둘러보기",
          attrs: { href: STORE_WEB_URL, target: "_blank", rel: "noopener" },
          dataset: { testid: "left-store-web" },
        }),
        el("p", { class: "left-store-lead", text: "받은 에셋을 프로젝트에 바로 넣기는 OPRN 데스크톱 앱에서 할 수 있어요." }),
      );
      return;
    }
    root.append(
      el("button", { class: "left-store-open", text: "인기 에셋 둘러보기", attrs: { type: "button" }, dataset: { testid: "left-store-open" }, on: { click: () => open("browse") } }),
      el("button", { class: "left-store-share", text: "내 에셋 나누기", attrs: { type: "button" }, dataset: { testid: "left-store-share" }, on: { click: () => open("upload") } }),
    );
  };
  return { root, show: render, dispose: () => {} };
}
