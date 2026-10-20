// src/editor/assetStore/storeOpenLink.ts
/**
 * 「에디터에서 열기」 링크(oprn://store/install?…)를 편집기에서 받는다. 메인이 출처·slug·판본을 검사하고
 * 요청을 맡겨 두면, 프로젝트가 열린 이 편집기가 꺼내 스토어 창을 그 상품에 연다(확인 카드 → 넣기).
 * 부팅 전에 들어온 요청은 부팅 뒤 한 번 꺼낸다. 위키: openwiki/asset-store.md 「에디터에서 열기 링크」.
 */
import type { OprnStoreBridge } from "@/assetStore/bridgeTypes";
import { t } from "@/i18n";
import { toast } from "@/util/toast";
import { storeBridge } from "./storeBridge";

let installed = false;

export function installStoreOpenLinks(bridge: OprnStoreBridge | null = storeBridge()): void {
  // 팀 호스트 창(브라우저 브리지)에는 스토어 다리가 없다.
  if (installed || !bridge || typeof bridge.takeOpenLink !== "function" || typeof bridge.onOpenLink !== "function") return;
  installed = true;
  const take = async (): Promise<void> => {
    const request = await bridge.takeOpenLink().catch(() => null);
    if (!request) return;
    const { openAssetStoreForLink } = await import("./storeWorkspace");
    openAssetStoreForLink(request);
  };
  bridge.onOpenLink((event) => {
    if (event.kind === "error") {
      console.warn("[store-link] 링크를 열지 않았습니다:", event.reason);
      toast(t(event.reason), "info");
      return;
    }
    void take();
  });
  void take();
}
