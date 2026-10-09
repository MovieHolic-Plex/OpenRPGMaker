// 보존 기획(OPRN-019) 편집기 배선: 목록 편집·수명·재사용 선택의 실제 표면 계약.
//
// 여기서 잠그는 것:
//  1. 항목이 새 대화와 프로젝트 재열기(직렬화 왕복 후 replaceProject)를 넘어 살아남는다.
//  2. 편집·은퇴·삭제가 각각 다른 일이다.
//  3. 컴포저는 none/all/selected 를 내놓고, 고른 결과가 **보내기 전에** 보인다.
//  4. 고른 항목만 세션 payload 에 실리고, 고르지 않으면 아무 문장도 실리지 않는다.
//  5. 보존 항목은 수동 편집도, 재사용을 고르지 않은 조수 작업도 막지 않는다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { clearConversations } from "@/ai/conversationStore";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { addChildMap, renameMap } from "@/editor/actions";
import {
  addMapPlanningItem,
  deleteMapPlanningItem,
  listMapPlanningItems,
  setMapPlanningItemRetired,
  updateMapPlanningItem,
} from "@/editor/mapPlanningActions";
import { createPlanningListView } from "@/editor/panels/aiPlanningList";
import { createPlanningReuseControl } from "@/editor/panels/aiPlanningReuse";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { createStudioShell } from "@/editor/panels/aiStudioShell";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

function installFakeLocalStorage(): void {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
}

function startMapId(): string {
  return store.getCurrent().startMapId;
}

beforeEach(() => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  store.replace(createBlankProject());
  resetMapEditHistory();
  editorState.set({ currentMapId: store.getCurrent().startMapId, layer: "lower", tool: "paint", selection: null });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(defaultAiConfig()));
});

afterEach(async () => {
  teardownAiChatPanel();
  await clearConversations();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("보존 기획 항목의 수명", () => {
  it("새 대화를 시작해도 항목은 남는다", async () => {
    // Break: 항목이 세션 상태로 돌아가 dropSession(새 대화·복원·프로젝트 전환)이 쓸어간다 —
    // 이것이 OPRN-019 가 신고한 바로 그 결함이다.
    const mapId = startMapId();
    addMapPlanningItem(mapId, "북쪽 광장은 남긴다");
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    findByTestId(panel, "ai-new-session")?.click();
    await Promise.resolve();
    expect(listMapPlanningItems(mapId).map((row) => row.text)).toEqual(["북쪽 광장은 남긴다"]);
  });

  it("프로젝트를 저장하고 다시 여는 경로(직렬화 왕복)에서도 남는다", () => {
    // Break: 항목이 프로젝트 JSON 에 실리지 않아 재접속하면 사라진다.
    const mapId = startMapId();
    addMapPlanningItem(mapId, "동쪽 부두 유지");
    setMapPlanningItemRetired(mapId, listMapPlanningItems(mapId)[0]!.id, true);
    const reopened = deserialize(serialize(store.getCurrent()));
    store.replaceProject(reopened);
    const restored = listMapPlanningItems(mapId);
    expect(restored).toHaveLength(1);
    expect(restored[0]?.status).toBe("retired");
  });

  it("항목은 맵마다 따로다 — 다른 맵 작업에 조용히 실리지 않는다", () => {
    // Break: 프로젝트 단위 저장이면 한 맵의 기획이 모든 맵 작업에 붙는다.
    const first = startMapId();
    const second = addChildMap(first, "장터", { width: 20, height: 15 });
    if (!second) throw new Error("child map missing");
    addMapPlanningItem(first, "첫 맵의 광장");
    addMapPlanningItem(second, "장터의 노점 배치");
    expect(listMapPlanningItems(first).map((row) => row.text)).toEqual(["첫 맵의 광장"]);
    expect(listMapPlanningItems(second).map((row) => row.text)).toEqual(["장터의 노점 배치"]);
  });

  it("수정·은퇴·삭제가 각각 다른 일이다", () => {
    // Break: 은퇴가 삭제와 같아지면 사용자가 「나중에 다시 볼 기록」을 잃는다.
    const mapId = startMapId();
    const id = addMapPlanningItem(mapId, "옛 다리 철거 예정");
    if (!id) throw new Error("item not created");

    updateMapPlanningItem(mapId, id, "  옛   다리는  보존 ");
    expect(listMapPlanningItems(mapId)[0]?.text).toBe("옛 다리는 보존");
    expect(listMapPlanningItems(mapId)[0]?.updatedAt).toBeDefined();

    setMapPlanningItemRetired(mapId, id, true);
    expect(listMapPlanningItems(mapId)[0]?.status).toBe("retired");
    setMapPlanningItemRetired(mapId, id, false);
    expect(listMapPlanningItems(mapId)[0]?.status).toBe("active");

    deleteMapPlanningItem(mapId, id);
    expect(listMapPlanningItems(mapId)).toEqual([]);
    // 마지막 항목을 지우면 필드 자체가 없어야 한다(옛 저장본과 같은 모양).
    expect(store.getCurrent().maps[mapId]?.planningItems).toBeUndefined();
  });

  it("같은 본문·같은 밑그림 에셋은 두 번 담기지 않는다", () => {
    // Break: 「담기」를 두 번 누르면 목록이 배로 불어난다.
    const mapId = startMapId();
    expect(addMapPlanningItem(mapId, "광장 유지")).toBeTruthy();
    expect(addMapPlanningItem(mapId, "광장 유지")).toBeNull();
    expect(addMapPlanningItem(mapId, "부두", { origin: "spec", specAssetId: "m:dock" })).toBeTruthy();
    expect(addMapPlanningItem(mapId, "부두 다른 문장", { origin: "spec", specAssetId: "m:dock" })).toBeNull();
    expect(listMapPlanningItems(mapId)).toHaveLength(2);
  });

  it("빈 본문은 항목이 되지 않고, 삭제로 취급되지도 않는다", () => {
    // Break: 공백 입력이 항목을 만들거나 기존 본문을 지운다.
    const mapId = startMapId();
    expect(addMapPlanningItem(mapId, "   ")).toBeNull();
    const id = addMapPlanningItem(mapId, "유지할 문장");
    if (!id) throw new Error("item not created");
    updateMapPlanningItem(mapId, id, "  ");
    expect(listMapPlanningItems(mapId)[0]?.text).toBe("유지할 문장");
  });
});

describe("보존 기획 목록 화면", () => {
  it("현재 맵의 항목을 상태·출처와 함께 보여주고 편집·은퇴·삭제 컨트롤을 낸다", () => {
    // Break: 사용자가 목록을 볼 곳이 없으면 「보존됐다」를 믿을 근거가 없다.
    const mapId = startMapId();
    renameMap(mapId, "이슬 마을");
    const kept = addMapPlanningItem(mapId, "북쪽 광장은 남긴다");
    addMapPlanningItem(mapId, "부두 목재", { origin: "spec", specAssetId: "m:dock" });
    if (!kept) throw new Error("item not created");

    const view = createPlanningListView();
    const root = view.root as unknown as FakeElement;
    expect(findByTestId(root, "ai-planning-summary")?.textContent).toContain("이슬 마을");
    expect(findByTestId(root, "ai-planning-summary")?.textContent).toContain("사용 가능 2 / 전체 2");
    const rows = root.querySelectorAll("[data-testid=ai-planning-item]");
    expect(rows).toHaveLength(2);
    expect(rows[1]?.dataset.origin).toBe("spec");

    findByTestId(root, `ai-planning-retire-${kept}`)?.click();
    expect(listMapPlanningItems(mapId).find((row) => row.id === kept)?.status).toBe("retired");
    view.refresh();
    expect(findByTestId(root, "ai-planning-summary")?.textContent).toContain("사용 가능 1 / 전체 2");

    findByTestId(root, `ai-planning-delete-${kept}`)?.click();
    expect(listMapPlanningItems(mapId).some((row) => row.id === kept)).toBe(false);
  });

  it("입력줄로 항목을 추가한다", () => {
    // Break: 밑그림 없이는 항목을 만들 수 없어 사람이 직접 적을 길이 사라진다.
    const view = createPlanningListView();
    const root = view.root as unknown as FakeElement;
    const input = findByTestId(root, "ai-planning-input") as unknown as HTMLInputElement;
    input.value = "남쪽 숲은 그대로";
    findByTestId(root, "ai-planning-add")?.click();
    expect(listMapPlanningItems(startMapId()).map((row) => row.text)).toEqual(["남쪽 숲은 그대로"]);
    expect(input.value).toBe("");
  });

  it("항목이 없으면 보존을 권하는 빈 안내를 낸다", () => {
    // Break: 빈 목록이 아무 말도 안 하면 기능이 있는지조차 알 수 없다.
    const view = createPlanningListView();
    expect(findByTestId(view.root as unknown as FakeElement, "ai-planning-empty")).toBeTruthy();
  });
});

describe("재사용 선택 — 없음 / 전체 / 선택", () => {
  it("기본은 사용 안 함이고 아무 지침도 만들지 않는다", () => {
    // Break: 기본이 「전체」면 보존 목록이 곧 강제 기억이 된다.
    addMapPlanningItem(startMapId(), "북쪽 광장은 남긴다");
    const control = createPlanningReuseControl();
    const root = control.content as unknown as FakeElement;
    expect(findByTestId(root, "ai-planning-reuse-mode-none")?.className).toContain("is-on");
    expect(control.choice().mode).toBe("none");
    expect(control.guidanceBlock()).toBe("");
    expect(findByTestId(root, "ai-planning-reuse-effect")?.textContent).toContain("넣지 않습니다");
    expect(findByTestId(root, "ai-planning-reuse-preview")?.hidden).toBe(true);
  });

  it("전체를 고르면 실릴 원문이 보내기 전에 보인다", () => {
    // Break: 「효과가 보이지 않는 선택」은 사용자가 결과를 예측할 수 없다(수락 기준 3).
    const mapId = startMapId();
    addMapPlanningItem(mapId, "북쪽 광장은 남긴다");
    addMapPlanningItem(mapId, "동쪽 부두 유지");
    const control = createPlanningReuseControl();
    const root = control.content as unknown as FakeElement;
    findByTestId(root, "ai-planning-reuse-mode-all")?.click();

    const preview = findByTestId(root, "ai-planning-reuse-preview");
    expect(preview?.hidden).toBe(false);
    expect(preview?.textContent).toBe(control.guidanceBlock());
    expect(preview?.textContent).toContain("1. 북쪽 광장은 남긴다");
    expect(preview?.textContent).toContain("2. 동쪽 부두 유지");
    expect(findByTestId(root, "ai-planning-reuse-effect")?.textContent).toContain("항목 2개");
    expect(findByTestId(root, "ai-planning-chip-text")).toBeNull();
    expect((control.chip as unknown as FakeElement).textContent).toContain("전체 2개 사용");
  });

  it("선택을 고르면 체크한 항목만 실린다", () => {
    // Break: 「선택」이 전체와 같아져 사용자가 범위를 좁힐 수 없다.
    const mapId = startMapId();
    addMapPlanningItem(mapId, "광장 유지");
    const second = addMapPlanningItem(mapId, "부두 유지");
    if (!second) throw new Error("item not created");
    const control = createPlanningReuseControl();
    const root = control.content as unknown as FakeElement;
    findByTestId(root, "ai-planning-reuse-mode-selected")?.click();
    // 아무 것도 고르지 않은 「선택」은 결과가 없음과 같다 — 자동 전체 선택을 하지 않는다.
    expect(control.resolvedItems()).toEqual([]);

    const pick = findByTestId(root, `ai-planning-reuse-pick-${second}`) as unknown as HTMLInputElement;
    pick.checked = true;
    pick.dispatchEvent(new Event("change"));
    expect(control.resolvedItems().map((row) => row.text)).toEqual(["부두 유지"]);
    expect(findByTestId(root, "ai-planning-reuse-preview")?.textContent).toContain("1. 부두 유지");
  });

  it("항목이 없으면 전체·선택을 고를 수 없다", () => {
    // Break: 고를 게 없는데 모드를 켜면 빈 지침 블록이 실린다.
    const control = createPlanningReuseControl();
    const root = control.content as unknown as FakeElement;
    expect(findByTestId(root, "ai-planning-reuse-mode-all")?.getAttribute("disabled")).not.toBeNull();
    expect(findByTestId(root, "ai-planning-reuse-mode-selected")?.getAttribute("aria-disabled")).toBe("true");
  });

  it("고른 항목이 은퇴·삭제되면 선택에서 조용히 사라진다", () => {
    // Break: 삭제한 항목이 다음 턴 지침으로 되살아난다.
    const mapId = startMapId();
    const first = addMapPlanningItem(mapId, "광장 유지");
    const second = addMapPlanningItem(mapId, "부두 유지");
    if (!first || !second) throw new Error("items not created");
    const control = createPlanningReuseControl();
    const root = control.content as unknown as FakeElement;
    findByTestId(root, "ai-planning-reuse-mode-all")?.click();
    expect(control.resolvedItems()).toHaveLength(2);

    setMapPlanningItemRetired(mapId, first, true);
    control.refresh();
    expect(control.resolvedItems().map((row) => row.id)).toEqual([second]);

    deleteMapPlanningItem(mapId, second);
    control.refresh();
    expect(control.resolvedItems()).toEqual([]);
    expect(control.choice().mode).toBe("none");
  });

  it("맵을 바꾸면 선택이 초기화된다", () => {
    // Break: 한 맵의 기획 선택이 다른 맵 작업에 그대로 실린다.
    const first = startMapId();
    addMapPlanningItem(first, "첫 맵의 광장");
    const control = createPlanningReuseControl();
    findByTestId(control.content as unknown as FakeElement, "ai-planning-reuse-mode-all")?.click();
    expect(control.resolvedItems()).toHaveLength(1);

    const second = addChildMap(first, "장터", { width: 20, height: 15 });
    if (!second) throw new Error("child map missing");
    editorState.set({ currentMapId: second });
    control.refresh();
    expect(control.choice().mode).toBe("none");
    expect(control.resolvedItems()).toEqual([]);
  });
});

describe("스튜디오 덱 「기획」 탭", () => {
  it("현재 맵의 목록을 싣고 항목 수를 배지로 말한다", () => {
    // Break: 보존 기획의 집이 컴포저 팝오버뿐이라 목록을 편집할 토대가 사라진다.
    addMapPlanningItem(startMapId(), "북쪽 광장은 남긴다");
    const host = new FakeElement("div");
    const log = new FakeElement("div");
    log.className = "ai-history-log-mount";
    const bar = new FakeElement("div");
    bar.className = "ai-command-bar";
    host.append(log, bar);

    const shell = createStudioShell({ onExit: () => {}, onFontZoom: () => {} });
    shell.attach(host as unknown as HTMLElement, {
      historyLogMount: log as unknown as HTMLElement,
      commandBar: bar as unknown as HTMLElement,
    });
    const root = shell.root as unknown as FakeElement;

    // 2026-09-17 §11: 기획은 덱 탭이 아니라 머리띠의 「기획」 팝오버다.
    const tab = findByTestId(root, "ai-studio-planning");
    expect(tab).toBeTruthy();
    expect(tab?.textContent).toContain("1");
    tab?.click();
    expect(findByTestId(root, "ai-planning")).toBeTruthy();
    expect(root.textContent).toContain("사용 가능 1 / 전체 1");
    // 본문은 편집 가능한 입력줄이다 — 보기만 하는 라벨이 아니라 그 자리에서 고칠 수 있어야 한다.
    const rows = root.querySelectorAll("[data-testid=ai-planning-item]");
    expect(rows).toHaveLength(1);
    const itemId = rows[0]?.dataset.itemId ?? "";
    expect((findByTestId(root, `ai-planning-text-${itemId}`) as unknown as HTMLInputElement).value)
      .toBe("북쪽 광장은 남긴다");

    shell.dispose();
  });
});

describe("재사용이 실제 턴에 실리는 경로", () => {
  async function sendFromPanel(panel: FakeElement, text: string): Promise<void> {
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = text;
    findByTestId(panel, "ai-send")?.click();
  }

  it("사용 안 함이면 payload 에 보존 기획 문장이 없다", async () => {
    // Break: 목록이 있다는 사실만으로 프롬프트가 오염된다(숨은 강제 기억 금지).
    const spy = vi
      .spyOn(AssistantSession.prototype, "sendUserMessage")
      .mockResolvedValue({ assistantText: "", proposedCalls: [], stoppedReason: "final" });
    addMapPlanningItem(startMapId(), "북쪽 광장은 남긴다");
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    await sendFromPanel(panel, "이 맵을 다시 꾸며줘");

    await vi.waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 2_000, interval: 5 });
    expect(String(spy.mock.calls[0]?.[0])).not.toContain("[보존 기획]");
  });

  it("전체를 고르면 payload 에 지침 블록이 실리고 그 사실이 대화에 남는다", async () => {
    // Break: 선택이 화면에만 있고 실제 payload 에 없으면 재사용이 거짓말이 된다.
    const spy = vi
      .spyOn(AssistantSession.prototype, "sendUserMessage")
      .mockResolvedValue({ assistantText: "", proposedCalls: [], stoppedReason: "final" });
    const mapId = startMapId();
    addMapPlanningItem(mapId, "북쪽 광장은 남긴다");
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    findByTestId(panel, "ai-planning-toggle")?.click();
    findByTestId(panel, "ai-planning-reuse-mode-all")?.click();
    // 칩이 보내기 전에 선택을 말한다.
    expect(findByTestId(panel, "ai-planning-chip")?.textContent).toContain("전체 1개 사용");

    await sendFromPanel(panel, "이 맵을 다시 꾸며줘");
    await vi.waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 2_000, interval: 5 });
    const payload = String(spy.mock.calls[0]?.[0]);
    expect(payload).toContain("이 맵을 다시 꾸며줘");
    expect(payload).toContain("[보존 기획]");
    expect(payload).toContain("북쪽 광장은 남긴다");
    expect(payload).toContain("지침이며 차단 규칙이 아니다");
    // 사용자 발화 원문(instruction)에는 기계 텍스트가 섞이지 않는다.
    expect(spy.mock.calls[0]?.[3]?.instruction).toBe("이 맵을 다시 꾸며줘");

    // 보낸 뒤 선택은 풀린다 — 한 번 고른 재사용이 다음 턴에 조용히 또 실리지 않는다.
    expect(findByTestId(panel, "ai-planning-chip")).toBeNull();
  });

  it("보존 항목이 있어도 수동 편집과 재사용 없는 조수 작업은 막히지 않는다", async () => {
    // Break: 보존 목록이 게이트가 되어 맵 편집이나 다른 작업이 거절된다.
    const spy = vi
      .spyOn(AssistantSession.prototype, "sendUserMessage")
      .mockResolvedValue({ assistantText: "", proposedCalls: [], stoppedReason: "final" });
    const mapId = startMapId();
    addMapPlanningItem(mapId, "북쪽 광장은 남긴다");

    // 수동 편집: 이름 변경이 그대로 통과한다.
    renameMap(mapId, "손으로 고친 이름");
    expect(store.getCurrent().maps[mapId]?.name).toBe("손으로 고친 이름");

    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    await sendFromPanel(panel, "데이터베이스에 아이템 추가해줘");
    await vi.waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 2_000, interval: 5 });
    expect(String(spy.mock.calls[0]?.[0])).not.toContain("[보존 기획]");
  });
});
