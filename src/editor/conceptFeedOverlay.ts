// 편집기 안의 새 게임 창 — 메뉴 「새 프로젝트」와 첫 부팅 환영이 같은 컨셉 피드를 덮는 창으로 연다.
// 결과: "made" = 만들기 시작(메뉴는 이미 새로 읽는 중, 환영은 기획이 심겼다), "blank" = 빈 프로젝트로, "closed" = 닫음.
import { createConceptFeed } from "@/start/conceptFeed/conceptFeed";
import { createConceptSource } from "@/concepts/source";
import { menuMakeHandler, welcomeMakeHandler } from "./conceptMake";
import { registerModal, unregisterModal } from "./ui/modalStack";

export type ConceptFeedOverlayResult = "made" | "closed" | "blank";

async function ensureAiConnected(label: string): Promise<boolean> {
  const { ensureAiConnectedForPreset } = await import("@/editor/ui/aiConnectGate");
  return ensureAiConnectedForPreset({ presetLabel: label });
}

let open: Promise<ConceptFeedOverlayResult> | null = null;

export function openConceptFeedOverlay(mode: "menu" | "welcome"): Promise<ConceptFeedOverlayResult> {
  if (open) return open;
  open = new Promise<ConceptFeedOverlayResult>((resolve) => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const source = createConceptSource();
    let settled = false;
    const finish = (result: ConceptFeedOverlayResult): void => {
      if (settled) return;
      settled = true;
      unregisterModal(feed.element);
      feed.dispose();
      feed.element.remove();
      document.documentElement.classList.remove("cf-overlay-open");
      open = null;
      if (result === "closed") opener?.focus();
      resolve(result);
    };
    const made = (slug: string): void => source.made(slug);
    const handler = mode === "menu"
      ? menuMakeHandler({ ensureAiConnected, made, reload: () => window.location.reload() })
      : welcomeMakeHandler({ ensureAiConnected, made });
    const feed = createConceptFeed({
      mode: "overlay",
      source,
      onMake: async (concept, tweak) => {
        const started = await handler(concept, tweak);
        // 메뉴는 곧 새로 읽으므로 창을 그대로 둔다(만드는 중… 표시). 환영은 창을 닫고 생성 전달로 넘어간다.
        if (started && mode === "welcome") finish("made");
        else if (started) settled = true;
        return started;
      },
      beforeDraft: () => ensureAiConnected("내가 쓴 컨셉"),
      onBlank: mode === "menu" ? () => void createBlankFromMenu().then((ok) => { if (ok) settled = true; }) : () => finish("blank"),
      onClose: () => finish("closed"),
    });
    document.documentElement.classList.add("cf-overlay-open");
    document.body.append(feed.element);
    // Escape 층: 상세면 피드로(층을 다시 건다), 피드면 창을 닫는다. 메뉴로 만드는 중(새로 읽기 대기)이면 무시한다.
    const register = (): void => {
      registerModal(feed.element, () => {
        if (settled) return;
        if (feed.escape()) register();
        else finish("closed");
      });
    };
    register();
    feed.element.querySelector<HTMLInputElement>("input[type=search]")?.focus();
  });
  return open;
}

/** 메뉴의 「빈 프로젝트로 시작」 — 장르 없이 새 폴더. 예전 다이얼로그의 빈 프로젝트와 같다. */
async function createBlankFromMenu(): Promise<boolean> {
  const { toast } = await import("@/util/toast");
  try {
    const { store } = await import("@/project/store");
    const { saveProjectNow } = await import("@/editor/saveActions");
    if (store.hasUnsavedChanges() && !store.isSharedDemoSession() && !(await saveProjectNow())) return false;
    const { createProjectStartSeed } = await import("@/editor/projectStartSeed");
    const title = "새 프로젝트";
    const seed = await createProjectStartSeed(null, title, "blank", "wide");
    const suggested = await window.oprn?.start?.suggestProjectDir?.({ title }).catch(() => null);
    const { createProjectFolderWithSeed } = await import("@/editor/projectFolderActions");
    if (!(await createProjectFolderWithSeed(title, seed, suggested?.projectDir))) {
      toast("프로젝트 저장 서버에 연결하거나 데스크톱 앱에서 열어 주세요.", "error");
      return false;
    }
    window.location.reload();
    return true;
  } catch (error) {
    toast(`새 프로젝트를 만들지 못했습니다: ${error instanceof Error ? error.message : String(error)}`, "error");
    return false;
  }
}
