import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { objectChromeState } from "@/editor/panels/spatialObjectChromeState";
import {
  objectDraftTarget,
  objectInspectorHandlers,
} from "@/editor/panels/spatialObjectCommands";
import { previewObjectDelete } from "@/editor/panels/spatialObjectDraft";
import { renderSpatialObjectInspector } from "@/editor/panels/spatialObjectInspector";
import { renderSpatialCardThumb } from "@/editor/panels/spatialGallery";
import { visibleAuthoringProject } from "@/editor/panels/spatialAuthoringAccess";
import { el } from "@/util/dom";
import { sharedObjectDef } from "@/editor/tools/sharedDesignCatalog";
import { applyToolToStore } from "@/editor/tools/applyChangesetToStore";
import { prepareTool } from "@/editor/tools/asyncToolRunner";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { setSpatialAdvancedEdit, spatialAdvancedEdit } from "@/editor/panels/spatialAdvancedEdit";
import { openAiAssistantPanel } from "@/editor/aiAssistantBridge";
import { prefillAiAssistantInput, setPendingAiBootIntent } from "@/editor/aiBootIntent";

/** 선택한 오브젝트를 조수 입력창에 채운다. 보내지는 않는다 — 무엇을 시킬지는 사람이 잇는다. */
function askAssistantAbout(card: SpatialGalleryCard): void {
  const ref = card.sharedObjectId ? `shared-object:${card.sharedObjectId}` : card.canonicalSource ? card.canonicalSource.id : `${card.tilesetId ?? ""}/${card.objectId ?? card.localId ?? card.id}`;
  const text = `오브젝트 「${card.name}」(${ref}) `;
  openAiAssistantPanel();
  if (!prefillAiAssistantInput(text, { preserveDraft: true })) setPendingAiBootIntent(text);
}

function askAssistantButton(card: SpatialGalleryCard): HTMLButtonElement {
  return el("button", { class: "spatial-action", text: "조수에게 시키기", attrs: { type: "button", title: "이 오브젝트를 조수 입력창에 넣는다(보내지 않음)" },
    dataset: { testid: "spatial-object-ask-assistant" }, on: { click: () => askAssistantAbout(card) } });
}

/**
 * 고급 편집이 꺼진 기본 상세 — 그림·이름·위치와 두 버튼만. 칸 그리기 캔버스는 만들지 않는다(qa1124 오너 11).
 * 그림은 목록 카드와 같은 재료라 thumbCache 메모리 적중이면 <img> 하나다.
 */
function simpleObjectInspector(card: SpatialGalleryCard, open: boolean, rerender: () => void): HTMLElement {
  const art = renderSpatialCardThumb(card);
  art.classList.add("spatial-object-simple-art");
  const facts: [string, string][] = [
    ["출처", card.source === "default" ? "공용 오브젝트" : "내 오브젝트"],
    ...(card.subtitle ? [["분류", card.subtitle] as [string, string]] : []),
    ...(card.tilesetId ? [["타일셋", card.tilesetId] as [string, string]] : []),
  ];
  return el("aside", {
    class: `spatial-inspector${open ? " is-open" : ""}`,
    attrs: { "aria-label": "속성", id: "spatial-inspector" },
    dataset: { testid: "spatial-inspector", inspectorView: "simple" },
    children: [
      el("h3", { class: "spatial-inspector-name", text: card.name }),
      el("div", { class: "spatial-object-simple-preview", dataset: { testid: "spatial-object-simple-preview" }, children: [art] }),
      el("dl", { class: "spatial-inspector-facts", children: facts.flatMap(([label, value]) => [el("dt", { text: label }), el("dd", { text: value })]) }),
      el("div", { class: "spatial-object-actions", children: [
        askAssistantButton(card),
        el("button", { class: "spatial-action", text: "고급 편집 열기", attrs: { type: "button", title: "칸 그리기·앵커·삭제 편집기를 펼친다" },
          dataset: { testid: "spatial-object-advanced" }, on: { click: () => { setSpatialAdvancedEdit(true); rerender(); } } }),
      ] }),
    ],
  });
}


let lastStamp: { objectId: string; text: string } | null = null;

/** 공용 오브젝트 속성 — 이름·크기·타일셋·통행·태그·「주인」(어디 곁에 두나)과 현재 맵에 찍기. */
function sharedObjectInspector(objectId: string, open: boolean, _rerender: () => void): HTMLElement {
  const def = sharedObjectDef(objectId);
  const facts = (pairs: [string, string][]) => el("dl", { class: "spatial-inspector-facts",
    children: pairs.flatMap(([label, value]) => [el("dt", { text: label }), el("dd", { text: value })]) });
  // The panel re-renders on every store change, so the last result is kept per object and shown again.
  const note = el("p", { class: "spatial-inspector-sub", text: lastStamp?.objectId === objectId ? lastStamp.text : "", dataset: { testid: "shared-object-stamp-note" } });
  const say = (text: string) => { lastStamp = { objectId, text }; note.textContent = text; };
  const stamp = el("button", { class: "spatial-action", text: "현재 맵 가운데에 찍기", attrs: { type: "button" },
    dataset: { testid: "shared-object-stamp" } });
  stamp.addEventListener("click", () => {
    const mapId = editorState.get().currentMapId;
    const map = mapId ? store.getCurrent().maps[mapId] : undefined;
    if (!def || !map) { say("먼저 맵을 여세요."); return; }
    const args = { objectId, mapId: map.id, x: Math.max(0, Math.floor((map.width - def.width) / 2)), y: Math.max(0, Math.floor((map.height - def.height) / 2)) };
    say("찍는 중…");
    void prepareTool("stamp_object", args).then(() => {
      const result = applyToolToStore("stamp_object", args);
      say(result.ok ? `${result.summary} — 되돌리기로 취소할 수 있다` : `실패: ${result.summary ?? ""}`);
    });
  });
  return el("aside", {
    class: `spatial-inspector${open ? " is-open" : ""}`,
    attrs: { "aria-label": "속성", id: "spatial-inspector" },
    dataset: { testid: "spatial-inspector" },
    children: def ? [
      el("h3", { class: "spatial-inspector-name", text: def.name }),
      el("p", { class: "spatial-inspector-sub", text: "공용 오브젝트" }),
      el("p", { class: "spatial-inspector-sub", text: `어디 곁에: ${def.owner}`, dataset: { testid: "shared-object-owner" } }),
      facts([["크기", `${def.width}×${def.height}칸`], ["타일셋", def.tilesetId], ["통행", def.passage], ["태그", def.tags.join(", ")], ["조수", `stamp_object({objectId:'${def.id}', mapId, x, y})`]]),
      el("div", { class: "spatial-object-actions", children: [stamp, el("button", { class: "spatial-action", text: "조수에게 시키기", attrs: { type: "button" },
        dataset: { testid: "spatial-object-ask-assistant" }, on: { click: () => { openAiAssistantPanel(); const text = `공용 오브젝트 「${def.name}」(shared-object:${def.id}) `; if (!prefillAiAssistantInput(text, { preserveDraft: true })) setPendingAiBootIntent(text); } } })] }),
      note,
    ] : [el("h3", { class: "spatial-inspector-name", text: objectId })],
  });
}

export { resetSpatialObjectsTabChrome } from "@/editor/panels/spatialObjectChromeState";
export {
  objectDraftTarget,
  placeObjectOnCurrentMap,
  spatialObjectsChrome,
} from "@/editor/panels/spatialObjectCommands";

export function renderSpatialObjectsCanvas(
  _session: SpatialAuthoringSession,
  card: SpatialGalleryCard | undefined,
): HTMLElement {
  if (!card) {
    return el("div", {
      class: "spatial-canvas spatial-objects-canvas",
      attrs: { tabindex: "0", "aria-label": "오브젝트 캔버스" },
      dataset: { testid: "spatial-canvas" },
      children: [el("div", { class: "spatial-canvas-empty" })],
    });
  }
  const art = renderSpatialCardThumb(card);
  art.classList.add("spatial-canvas-art", "spatial-object-stage-art");
  art.dataset.testid = "spatial-object-stage-art";
  return el("div", {
    class: "spatial-canvas spatial-objects-canvas",
    attrs: { tabindex: "0", "aria-label": "오브젝트 캔버스" },
    dataset: { testid: "spatial-canvas" },
    children: [art],
  });
}

export function renderSpatialObjectsInspector(
  card: SpatialGalleryCard | undefined,
  open: boolean,
  rerender: () => void,
): HTMLElement {
  if (!card) {
    return el("aside", {
      class: `spatial-inspector${open ? " is-open" : ""}`,
      attrs: { "aria-label": "속성", id: "spatial-inspector" },
      dataset: { testid: "spatial-inspector" },
    });
  }
  if (card.sharedObjectId) return sharedObjectInspector(card.sharedObjectId, open, rerender);
  const target = objectDraftTarget(card);
  if (!target) {
    return el("aside", {
      class: `spatial-inspector${open ? " is-open" : ""}`,
      attrs: { "aria-label": "속성", id: "spatial-inspector" },
      dataset: { testid: "spatial-inspector" },
      children: [el("h3", { class: "spatial-inspector-name", text: card.name })],
    });
  }
  if (!spatialAdvancedEdit()) return simpleObjectInspector(card, open, rerender);
  const design = target.libraryId
    ? visibleAuthoringProject().spatialAuthoring?.library.objects[target.libraryId]
    : undefined;
  const deletePreview = objectChromeState.deleteOpen ? previewObjectDelete(visibleAuthoringProject(), target) : null;
  const inspector = renderSpatialObjectInspector({
    card,
    open,
    target,
    design,
    deletePreview,
    handlers: objectInspectorHandlers(target, design, rerender),
  });
  inspector.prepend(el("div", { class: "spatial-object-actions", children: [
    askAssistantButton(card),
    el("button", { class: "spatial-action", text: "간단히 보기", attrs: { type: "button", title: "편집기를 접고 그림·이름만 본다" },
      dataset: { testid: "spatial-object-simple" }, on: { click: () => { setSpatialAdvancedEdit(false); rerender(); } } }),
  ] }));
  return inspector;
}
