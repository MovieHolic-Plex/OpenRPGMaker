// editor/sharedDemoIntro.ts
// 공용 데모 세션 안내 — 읽기 전용임을 알리고 "편집용 사본" 포크 액션을 단다.
//
// 첫 방문은 「무엇을 만들지」 묻는 대신 잘 만든 마을을 바로 보여준다(mode.ts 게이트).
// 데모 행은 store 가 읽기 전용으로 열기 때문에 여기서 하는 일은 안내 + 사본 전환뿐이다.

import { NewRemoteProjectTransactionError, store } from "@/project/store";
import { toast } from "@/util/toast";

export const SHARED_DEMO_FORK_TESTID = "shared-demo-fork";
export const SHARED_DEMO_INTRO_TESTID = "shared-demo-intro";

const introToastKey = Symbol("shared-demo-intro");

/** 데모를 연 직후 한 번 띄우는 안내 토스트 — 원본 보호 + 사본 CTA. */
export function presentSharedDemoIntro(): void {
  toast("예제 마을을 보고 있습니다 — 원본은 바뀌지 않습니다. 마음껏 둘러보고, 편집은 내 사본에서 시작하세요.", {
    kind: "info",
    key: introToastKey,
    durationMs: 20_000,
    action: {
      label: "편집용 사본 만들기",
      testid: SHARED_DEMO_FORK_TESTID,
      onClick: () => void forkSharedDemoToEditableCopy(),
    },
  });
}

/** 저장 단축키 등 "저장" 의도가 데모 세션에 닿았을 때 보여 줄 안내 — 사본 CTA 로 이어준다. */
export function presentSharedDemoSaveHint(): void {
  toast("공용 예제 원본은 바뀌지 않습니다. 편집을 저장하려면 내 사본을 만드세요.", {
    kind: "info",
    action: {
      label: "편집용 사본 만들기",
      testid: SHARED_DEMO_FORK_TESTID,
      onClick: () => void forkSharedDemoToEditableCopy(),
    },
  });
}

/**
 * 지금 보고 있는 데모 화면(방문자의 로컬 편집 포함)을 새 **폴더 프로젝트**로 복사한다.
 * 원본 데모는 어디에도 쓰이지 않는다 — 씨앗으로만 넘어간다.
 */
export async function forkSharedDemoToEditableCopy(): Promise<boolean> {
  toast("편집용 사본을 새 폴더에 만드는 중...", { kind: "info", durationMs: 8000 });
  try {
    const source = structuredClone(store.getCurrent());
    const { createProjectFolderWithSeed } = await import("@/editor/projectFolderActions");
    const created = await createProjectFolderWithSeed(source.meta?.title ?? "내 사본", source);
    if (!created) throw new Error("새 폴더는 데스크톱 앱에서만 만들 수 있습니다.");
    toast("내 사본 폴더를 열었습니다 — 이제 자유롭게 편집하세요.", { kind: "ok", durationMs: 6000 });
    window.location.reload();
    return true;
  } catch (error) {
    const message =
      error instanceof NewRemoteProjectTransactionError || error instanceof Error
        ? error.message
        : "알 수 없는 오류";
    toast(`사본을 만들지 못했습니다: ${message}`, { kind: "error", durationMs: 6000 });
    return false;
  }
}
