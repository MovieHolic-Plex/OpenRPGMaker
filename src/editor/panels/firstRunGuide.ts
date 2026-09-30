import { el } from "@/util/dom";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { focusProjectStartMap } from "@/editor/mapSelection";
import { SEGMENT_STARTER_EVENT_ID } from "@/project/playableSegmentContract";
import { AUTHORING_TEST_BOOT_SUCCESS_EVENT, authoringProjectFingerprint } from "@/editor/authoringJourney";
import type { Command, GameMap } from "@/project/types";
import "@/styles/shell/first-run-guide.css";

function firstDialogue(map: GameMap | undefined) {
  for (const event of [...(map?.events ?? [])].sort((a, b) => Number(b.id === SEGMENT_STARTER_EVENT_ID) - Number(a.id === SEGMENT_STARTER_EVENT_ID))) {
    const commands = event.pages?.[0]?.commands ?? event.commands;
    const index = commands.findIndex(command => command.kind === "text");
    const command = commands[index];
    if (command?.kind === "text") return { event, index, command };
  }
  return null;
}

/** Uses the existing assistant dock. Disposes subscriptions when the editor leaves or the project changes. */
export function mountFirstRunGuide(dock: HTMLElement, layout: HTMLElement): () => void {
  const host = el("section", { class: "first-run-guide", attrs: { "aria-label": "첫 편집 안내" }, dataset: { testid: "first-run-guide" } });
  dock.prepend(host);
  let editing = false;
  let draft = "";
  let draftTarget = "";
  let projectScope = JSON.stringify(store.getProjectIdentity());
  let addingMap = false;
  const action = (text: string, id: string, run: () => void, primary = false) => el("button", {
    class: `first-run-guide-button${primary ? " is-primary" : ""}`, text, attrs: { type: "button" }, dataset: { testid: id }, on: { click: run },
  });
  const dismiss = () => store.update(project => { project.flags.firstRunGuide = false; }, { label: "첫 편집 안내 닫기", origin: "human" });
  const render = () => {
    const project = store.getCurrent();
    const scope = JSON.stringify(store.getProjectIdentity());
    if (scope !== projectScope) { editing = false; addingMap = false; projectScope = scope; }
    const visible = project.flags.firstRunGuide === true;
    host.hidden = !visible;
    layout.classList.toggle("has-first-run-guide", visible);
    if (!visible) return;
    // Keep a user's unfinished edit intact during autosave or unrelated store notifications.
    if (editing && host.querySelector("textarea")) return;
    const map = project.maps[project.startMapId];
    const target = firstDialogue(map);
    host.replaceChildren(el("header", { class: "first-run-guide-header", children: [
      el("h2", { text: editing ? "대사 수정" : "처음 만드는 게임" }), action(editing ? "뒤로" : "접기", "first-run-guide-close", () => { if (editing) { editing = false; render(); } else dismiss(); }),
    ] }));
    if (editing && target && map) {
      host.append(el("p", { class: "first-run-guide-hint", text: `${map.name} / ${target.event.name ?? "첫 대화"}`, attrs: { translate: "no" } }));
      const input = el("textarea", { class: "first-run-guide-input", value: draft, attrs: { rows: "5", maxlength: "2000", "aria-label": "등장인물의 대사", translate: "no" }, dataset: { testid: "first-run-dialogue-input" } }) as HTMLTextAreaElement;
      input.addEventListener("input", () => { draft = input.value; });
      const apply = action("대사 적용하기", "first-run-dialogue-apply", () => {
        if (JSON.stringify(store.getProjectIdentity()) !== projectScope) return;
        const current = firstDialogue(store.getCurrent().maps[map.id]);
        if (!current || `${map.id}/${current.event.id}/${current.index}` !== draftTarget) { editing = false; render(); return; }
        if (!draft.trim()) { input.focus(); return; }
        editing = false;
        store.updateMap(map.id, edited => {
          const event = edited.events.find(item => item.id === current.event.id);
          const commands: Command[] | undefined = event?.pages?.[0]?.commands ?? event?.commands;
          const command = commands?.[current.index];
          if (command?.kind === "text") command.body = draft;
        }, { eventId: current.event.id, label: "첫 대사 수정", origin: "human" });
        store.update(p => { p.flags.firstRunDialogueEdited = true; p.flags.firstRunTested = false; }, { label: "첫 편집 진행", origin: "human" });
      }, true);
      host.append(el("label", { text: "무슨 말을 할까요?" }), input, apply,
        el("p", { class: "first-run-guide-hint", text: "적용한 뒤 테스트 플레이에서 확인해요." }),
        action("이벤트 편집기에서 열기", "first-run-event-editor", () => {
          void import("@/editor/panels/eventEditor/modal").then(module => module.openEventEditorModal(map.id, target.event.id));
        }));
      input.focus();
      return;
    }
    host.append(el("p", { class: "first-run-guide-hint", text: "작은 수정 한 번으로 시작해요." }));
    const step = (number: string, title: string, description: string, done: boolean, button?: HTMLElement) => el("div", {
      class: `first-run-guide-step${done ? " is-done" : ""}`, children: [
        el("span", { class: "first-run-guide-number", text: done ? "✓" : number, attrs: { "aria-hidden": "true" } }),
        el("div", { children: [el("h3", { text: title }), el("p", { text: description }), ...(button ? [button] : [])] }),
      ],
    });
    host.append(step("1", target ? "시작 장면 준비됨" : "첫 장면 만들기", target ? "맵과 대화 이벤트를 열었어요." : "작은 마을을 추가하거나 직접 맵을 꾸며요.", Boolean(target), target ? undefined : action("작은 마을 추가하기", "first-run-add-map", () => {
      if (addingMap) return;
      addingMap = true;
      const scope = projectScope;
      void import("@/project/defaults/defaultMaps").then(({ createStarterMap, singleNodeTree }) => {
        if (JSON.stringify(store.getProjectIdentity()) !== scope || !store.getCurrent().flags.firstRunGuide) return;
        const added = createStarterMap();
        store.update(p => { p.maps[added.id] = added; p.mapTree.children.push(singleNodeTree(added.id)); p.startMapId = added.id; p.startPos = { x: 15, y: 16 }; }, { label: "첫 마을 예제 추가", origin: "human" });
        focusProjectStartMap();
      }).finally(() => { addingMap = false; });
    }, true)));
    const edited = project.flags.firstRunDialogueEdited === true;
    const tested = project.flags.firstRunTested === true;
    host.append(step("2", "첫 대사 바꾸기", edited ? "작성한 대사를 적용했어요." : "등장인물의 말을 내 이야기로 바꿔 보세요.", edited, target && map ? action(edited ? "다시 수정" : "대사 수정하기", "first-run-edit-dialogue", () => {
      focusProjectStartMap();
      draft = target.command.body;
      draftTarget = `${map.id}/${target.event.id}/${target.index}`;
      editing = true; render();
    }, !edited) : undefined));
    host.append(step("3", "게임에서 확인하기", tested ? "첫 플레이를 마쳤어요. 다음 장면을 만들어 볼까요?" : "내가 만든 장면을 직접 플레이해요.", tested, target ? action("테스트 플레이", "first-run-test-play", () => {
      void import("@/editor/panels/testPlayModal").then(module => module.openTestPlayModal());
    }, edited && !tested) : undefined));
    if (tested) host.append(action("맵 꾸미기", "first-run-paint", () => { editorState.set({ tool: "paint", layer: "lower" }); dismiss(); }, true));
    host.append(el("footer", { class: "first-run-guide-ai", children: [el("h3", { text: "필요할 때 AI 조수" }),
      el("p", { text: "다음 장면을 만드는 데 도움을 받을 수 있어요." }), action("조수 열기", "first-run-open-ai", dismiss),
    ] }));
  };
  const unsubscribe = store.subscribe(() => render());
  const tested = (event: Event) => {
    const project = store.getCurrent();
    if (!project.flags.firstRunGuide || !project.flags.firstRunDialogueEdited || project.flags.firstRunTested) return;
    if ((event as CustomEvent<{ projectFingerprint?: string }>).detail?.projectFingerprint !== authoringProjectFingerprint(project)) return;
    store.update(p => { p.flags.firstRunTested = true; }, { label: "첫 테스트 플레이 확인", origin: "system" });
  };
  window.addEventListener(AUTHORING_TEST_BOOT_SUCCESS_EVENT, tested);
  render();
  return () => { unsubscribe(); window.removeEventListener(AUTHORING_TEST_BOOT_SUCCESS_EVENT, tested); layout.classList.remove("has-first-run-guide"); host.remove(); };
}
