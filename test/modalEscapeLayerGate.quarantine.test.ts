/** @vitest-environment happy-dom */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NEW_PROJECT_DIALOG_TESTIDS, showNewProjectDialog } from "@/editor/ui/newProjectDialog";
import { openWorldPanel } from "@/editor/panels/worldPanel";
import { requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { modalStackEntryCountForTest, registerModal, resetModalStackForTest } from "@/editor/ui/modalStack";

// 데이터베이스 모달은 자기 document keydown 리스너로 Escape 를 잡아 통째로 닫는다
// (databaseModal.ts). 물러서는 유일한 일반 규칙은 modalStack 에 등록된 계층이
// 살아 있는지다(editorModalDirtyState.handleKeyDown → hasOpenModalLayer).
//
// 그래서 body 에 띄우는 새 오버레이가 modalStack 을 쓰지 않으면, 그 위에서 Escape 를
// 누를 때 바깥 데이터베이스가 대신 닫힌다. 이 버그를 세 번 연속으로 놓쳤다 —
// 파일명(database*)으로만 훑고, DB 내부 호출자만 보고, 배우 탭 곡선 편집기를 빠뜨렸다.
// 사람이 훑는 대신 이 게이트가 잡는다.
//
// 새 오버레이를 만들면 둘 중 하나를 하라:
//   1) registerModal / unregisterModal 을 짝지어 쓴다(권장).
//   2) 정말 Escape 계층이 아니면 아래 EXEMPT 에 이유와 함께 등록한다.

const EDITOR_ROOT = path.resolve(__dirname, "..", "src", "editor");
const APPEND_PATTERN = /document\.body\.(append|appendChild)\s*\(/;

/**
 * Escape 계층에 참여하지 않아도 되는(또는 아직 정리되지 않은) body 부착 지점.
 * 값은 이유다. 새 파일을 여기 넣으려면 이유를 적어야 한다.
 */
const EXEMPT: Readonly<Record<string, string>> = {
  // Escape 로 닫는 표면이 아니다.
  "coachMarks.ts": "온보딩 코치마크 — 포인터 상호작용으로만 사라진다",
  "layoutBboxOverlay.ts": "디버그 계측 오버레이 — 사용자 입력을 받지 않는다",
  "panels/eventListHoverTooltip.ts": "hover 툴팁 — 포인터를 떼면 사라진다",
  "delayedTooltip.ts": "공통 지연 툴팁 — pointer-events:none 이고 포인터를 떼거나 blur 하면 사라진다. Escape 는 툴팁만 닫고 그 자리에서 stopPropagation 하지 않으므로 위 모달의 취소 키를 훔치지 않는다",
  "panels/editorZoomToolbar.ts": "상시 표시 툴바 — 닫는 개념이 없다",
  "panels/editActivityPanel.ts": "상시 표시 패널 — 닫는 개념이 없다",
  "panels/canvasInspectionPanel.ts": "상시 표시 진단 패널 — 닫는 개념이 없다",
  "panels/aiChatPanelHelpers.ts": "조수 패널 셸 — 모달이 아니다",
  "panels/menu.ts": "톱바/메뉴 셸 자체 — 개별 팝오버는 각자 등록한다",
  "panels/mapList.ts": "맵 목록 패널 셸 — 모달이 아니다",
  "panels/localDiagnosticsDialog.ts": "Body attachments are the persistent indicator and transient download anchor; the actual dialog registers through openEventSubdialog (runtime Escape contract in aiEmptyExportFeedback.test.ts).",

  // Escape 라우팅을 자기가 소유한다(의도된 예외).
  "panels/databaseModal.ts": "Escape 라우터 본인. 더티 프롬프트가 닫기를 거부할 수 있어 스택 API 로는 표현되지 않는다",
  "panels/tilesetTileContextMenu.ts": "capture 단계 + stopImmediatePropagation 으로 직접 가로챈다",
  "panels/testPlayModal.ts": "실행 중인 게임이 Escape 를 취소 키로 쓴다. 데이터베이스는 열기 전에 requestDatabaseModalClose 로 닫힌다",

  // 아직 정리되지 않은 백로그. 데이터베이스 위에 뜰 수 있으면 같은 버그가 난다.
  // PR #430 범위 밖 — 각각 동작 확인이 필요해 별도로 다룬다.
  "panels/aiChangePreview.ts": "백로그: 자체 Escape 처리, 계층 미참여",
  "panels/aiHarnessModal.ts": "백로그: 자체 Escape 처리, 계층 미참여",
  "panels/clusterAiModal.ts": "백로그: 자체 Escape 처리, 계층 미참여",
  "panels/eventEditor/characterIdAutocomplete.ts": "백로그: 자체 Escape 처리, 계층 미참여",
  "panels/eventEditor/commandListContextMenu.ts": "백로그: 자체 Escape 처리, 계층 미참여",
  "panels/mapContextMenu.ts": "백로그: 자체 Escape 처리, 계층 미참여",
  "panels/regionTaskModal.ts": "백로그: 자체 Escape 처리, 계층 미참여",
  "panels/tilesetAiWorkspaceModal.ts": "백로그: 자체 Escape 처리, 계층 미참여",
  "panels/tilesetPassageModal.ts": "백로그: Escape 처리 없음",
  "panels/tilesetReviewWizard.ts": "백로그: Escape 처리 없음",
  "panels/toolBrowserModal.ts": "백로그: 자체 Escape 처리, 계층 미참여",
  "panels/villageInfoModal.ts": "백로그: 자체 Escape 처리, 계층 미참여",
};

function collectTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectTsFiles(full, out);
      continue;
    }
    if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

function relativeToEditor(file: string): string {
  return path.relative(EDITOR_ROOT, file).split(path.sep).join("/");
}

function filesAppendingToBody(): string[] {
  return collectTsFiles(EDITOR_ROOT).filter((file) => APPEND_PATTERN.test(readFileSync(file, "utf8")));
}

afterEach(() => {
  requestDatabaseModalClose("battleTest");
  resetModalStackForTest();
  document.body.replaceChildren();
});

describe("Escape 계층 게이트", () => {
  it("new-project Escape closes only its layer and resolves cancellation", async () => {
    const bottom = document.createElement("div");
    document.body.append(bottom);
    let bottomClosed = false;
    registerModal(bottom, () => { bottomClosed = true; bottom.remove(); });
    const pending = showNewProjectDialog({ defaultValue: "fixture-title" });
    expect(modalStackEntryCountForTest()).toBe(2);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await expect(pending).resolves.toBeNull();
    expect(bottomClosed).toBe(false);
    expect(modalStackEntryCountForTest()).toBe(1);
    expect(document.querySelector(`[data-testid="${NEW_PROJECT_DIALOG_TESTIDS.host}"]`)).toBeNull();
  });

  it("new-project confirmation unregisters its layer without cancelling the selection", async () => {
    const pending = showNewProjectDialog({ defaultValue: "fixture-title" });
    document.querySelector<HTMLButtonElement>(`[data-testid="${NEW_PROJECT_DIALOG_TESTIDS.confirm}"]`)?.click();
    await expect(pending).resolves.toEqual({ title: "fixture-title", choiceId: null });
    expect(modalStackEntryCountForTest()).toBe(0);
  });

  it("world entry uses the database Escape owner instead of mounting a second modal", async () => {
    store.replace(createBlankProject());
    await openWorldPanel();
    expect(document.querySelector('[data-testid="database-modal"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="world-modal"]')).toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(document.querySelector('[data-testid="database-modal"]')).toBeNull();
  });
  it("body 에 오버레이를 붙이는 파일은 modalStack 에 참여하거나 이유와 함께 면제된다", () => {
    const offenders = filesAppendingToBody()
      .filter((file) => !readFileSync(file, "utf8").includes("registerModal"))
      .map(relativeToEditor)
      .filter((relative) => !(relative in EXEMPT))
      .sort();

    expect(
      offenders,
      "body 에 띄운 새 오버레이가 Escape 계층에 참여하지 않는다. registerModal/unregisterModal 을 짝지어 쓰거나, 정말 계층이 아니면 EXEMPT 에 이유를 적어라."
    ).toEqual([]);
  });

  it("면제 목록에 죽은 항목이 남지 않는다", () => {
    const live = new Set(filesAppendingToBody().map(relativeToEditor));
    const stale = Object.keys(EXEMPT)
      .filter((relative) => !live.has(relative))
      .sort();

    expect(stale, "면제 사유가 사라진 파일이다. EXEMPT 에서 지워라.").toEqual([]);
  });

  it("이번에 고친 표면들은 면제가 아니라 실제로 등록한다", () => {
    const fixed = [
      "panels/actorRecordCurveEditors.ts",
      "panels/aiConversationHistoryModal.ts",
      "panels/aiInstructionsModal.ts",
      "panels/commandPalette.ts",
      "panels/databaseAnimationPreview.ts",
      "panels/databaseClassCurveEditors.ts",
      "panels/databaseClassExperienceCurveEditor.ts",
      "panels/databaseElementsClassic.ts",
      "panels/databaseEnemyActionDialog.ts",
      "panels/demoTeachCanvas.ts",
      "panels/helpModal.ts",
      "panels/quickBattleModal.ts",
      "panels/resourceModal.ts",
    ];
    const missing = fixed.filter((relative) => {
      const source = readFileSync(path.join(EDITOR_ROOT, relative), "utf8");
      return !source.includes("registerModal") || relative in EXEMPT;
    });

    expect(missing, "회귀: 이 표면들은 modalStack 에 등록되어 있어야 한다").toEqual([]);
  });
});
