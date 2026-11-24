// 자료집 「전투 화면」 탭의 실시간 미리보기 패널(qa1124 항목 6-1·6-2·6-3).
//
// 진짜 전투 화면을 작게 띄우고, 설정이 바뀌면 그 설정이 보이는 장면(대기·공격·피격·연계기·결과)을 처음부터 다시 재생한다.
// 격리: 무대 상자는 `contain: layout paint; overflow: hidden` 4:3 틀(.db-battle-screen-preview-box)이고 `inert` 라 편집기 포커스·클릭·키보드가
// 들어가지 않는다. 전투가 마운트되는 동안만 살아 있다 — 탭을 떠나거나 접으면 전투를 해제한다(타이머·창 리스너·소리 잠금 0).
// 프로젝트는 읽기만 한다(데모는 복제본, battleScreenPreviewDemo.ts).
import { store } from "@/project/store";
import { el } from "@/util/dom";
import {
  BATTLE_PREVIEW_SCENES,
  BATTLE_PREVIEW_SCENE_HELP,
  BATTLE_PREVIEW_SCENE_LABELS,
  prepareBattleScreenDemo,
  startBattleScreenDemo,
  type BattlePreviewScene,
  type BattleScreenDemoHandle,
} from "@/editor/panels/battleScreenPreviewDemo";
import { registerDatabasePreview, type DatabasePreviewLifecycle } from "@/editor/panels/databasePreviewLifecycle";

export interface BattleScreenPreview {
  readonly element: HTMLElement;
  /** 장면을 바꿔 처음부터 다시 돌린다. 장면을 생략하면 지금 장면을 다시 돌린다. 멈춰 있었으면 다시 시작한다. */
  replay(scene?: BattlePreviewScene): void;
  /** 편집기 밖 전투(전투 테스트)가 소리·화면을 쓰는 동안 미리보기를 내려 둔다. 다시 재생을 누르면 돌아온다. */
  pause(): void;
  isMounted(): boolean;
  isDisposed(): boolean;
  dispose(): void;
}

type PreviewState = "mounted" | "idle" | "collapsed" | "paused" | "unavailable" | "error";

export function createBattleScreenPreview(initialScene: BattlePreviewScene = "idle"): BattleScreenPreview {
  let scene = initialScene;
  let sound = false;
  let collapsed = false;
  let paused = false;
  let active = false;
  let disposed = false;
  let mounted: BattleScreenDemoHandle | undefined;
  let mountCount = 0;

  const box = el("div", { class: "db-battle-screen-preview-box", dataset: { testid: "db-battle-preview-stage" } });
  // inert: 편집기 포커스·클릭·키보드가 미리보기 안으로 들어가지 않는다(전투는 포커스를 가져오려는 코드가 있다).
  box.setAttribute("inert", "");
  const status = el("p", { class: "db-battle-preview-status", attrs: { role: "status", "aria-live": "polite" }, dataset: { testid: "db-battle-preview-status" } });
  const sceneButtons = new Map<BattlePreviewScene, HTMLButtonElement>();
  const sceneRow = el("div", { class: "db-battle-preview-scenes", attrs: { role: "radiogroup", "aria-label": "장면 고르기" } });
  for (const id of BATTLE_PREVIEW_SCENES) {
    const button = el("button", {
      class: "db-battle-preview-scene",
      text: BATTLE_PREVIEW_SCENE_LABELS[id],
      attrs: { type: "button", role: "radio", title: BATTLE_PREVIEW_SCENE_HELP[id] },
      dataset: { testid: `db-battle-preview-scene-${id}` },
      on: { click: () => replay(id) },
    });
    sceneButtons.set(id, button);
    sceneRow.append(button);
  }
  const replayButton = el("button", {
    class: "db-ws-btn",
    text: "다시 재생",
    attrs: { type: "button" },
    dataset: { testid: "db-battle-preview-replay" },
    on: { click: () => replay() },
  });
  const soundInput = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "db-battle-preview-sound" } });
  soundInput.addEventListener("change", () => {
    sound = soundInput.checked;
    render();
  });
  const collapseButton = el("button", {
    class: "db-battle-preview-collapse",
    attrs: { type: "button", "aria-expanded": "true", "aria-controls": "db-battle-preview-body" },
    dataset: { testid: "db-battle-preview-collapse" },
    on: { click: () => {
      collapsed = !collapsed;
      render();
    } },
  });
  const body = el("div", {
    class: "db-battle-preview-body",
    attrs: { id: "db-battle-preview-body" },
    children: [
      sceneRow,
      box,
      el("div", { class: "db-battle-preview-foot", children: [
        replayButton,
        el("label", { class: "db-checkbox-field", children: [soundInput, el("span", { text: "소리" })] }),
      ] }),
      status,
    ],
  });
  const element = el("section", {
    class: "db-battle-screen-preview",
    attrs: { "aria-label": "실제 전투 미리보기" },
    dataset: { testid: "db-battle-screen-preview" },
    children: [
      el("header", { class: "db-battle-preview-head", children: [
        el("h4", { text: "실제 전투 미리보기" }),
        collapseButton,
      ] }),
      body,
    ],
  });

  function teardown(): void {
    const current = mounted;
    mounted = undefined;
    current?.destroy();
    box.replaceChildren();
  }

  function paint(state: PreviewState, note: string): void {
    element.dataset.previewState = state;
    element.dataset.previewScene = scene;
    element.dataset.previewMounts = String(mountCount);
    status.textContent = note;
    collapseButton.textContent = collapsed ? "펼치기" : "접기";
    collapseButton.setAttribute("aria-expanded", String(!collapsed));
    body.hidden = collapsed;
    for (const [id, button] of sceneButtons) {
      button.classList.toggle("is-active", id === scene);
      button.setAttribute("aria-checked", String(id === scene));
    }
  }

  function render(): void {
    teardown();
    if (disposed) return;
    if (collapsed) return paint("collapsed", "");
    if (paused) return paint("paused", "전투 테스트를 여는 동안 미리보기를 멈췄습니다. 「다시 재생」을 누르면 돌아옵니다.");
    if (!active) return paint("idle", "");
    const demo = prepareBattleScreenDemo(store.getCurrent(), scene);
    if (!demo) return paint("unavailable", "미리보기에 쓸 아군이나 적이 없습니다.");
    try {
      mounted = startBattleScreenDemo(box, demo, { muted: !sound });
      mountCount += 1;
      const note = scene === "combo" && demo.scene !== "combo" ? "아군이 한 명뿐이라 연계기 대신 공격을 보여 줍니다." : "";
      paint("mounted", `${BATTLE_PREVIEW_SCENE_LABELS[demo.scene]} 장면${sound ? "" : " · 소리 꺼짐"}${note ? ` · ${note}` : ""}`);
    } catch (error) {
      console.warn("[battle-preview] 미리보기를 만들지 못했다:", error);
      paint("error", "미리보기를 만들지 못했습니다.");
    }
  }

  function replay(next?: BattlePreviewScene): void {
    if (next) scene = next;
    paused = false;
    render();
  }

  const lifecycle: DatabasePreviewLifecycle = registerDatabasePreview(element, {
    suspend: () => {
      active = false;
      teardown();
      if (!disposed) paint("idle", "");
    },
    resume: () => {
      active = true;
      render();
    },
    dispose: () => {
      disposed = true;
      active = false;
      teardown();
    },
  });
  paint("idle", "");

  return {
    element,
    replay,
    pause(): void {
      paused = true;
      render();
    },
    isMounted: () => mounted !== undefined,
    isDisposed: () => disposed,
    dispose: () => lifecycle.dispose(),
  };
}
