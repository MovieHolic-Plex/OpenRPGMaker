import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { appearanceGenerationController } from "@/editor/characterAppearanceGeneration";
import { resolveAppearancePortrait } from "@/project/characterAppearances";
import { store } from "@/project/store";
import type { CharacterAppearanceRecord } from "@/project/types";
import { el } from "@/util/dom";
import { graphicPreview } from "./actorRecordControls";
import { listToolbar, sectionCard } from "./databaseWorkspace";
import { openDatabaseResourcePickerDialog } from "./databaseResourcePickerDialog";
import { openResourceModal } from "./resourceModal";
import { updateAppearance } from "./databaseAppearanceView";

type Slot = "charset" | "face" | "bust";
const labels = { charset: "걷기 캐릭터", face: "얼굴", bust: "흉상" } as const;
const subscriptions = new Map<Slot, () => void>();

export function disposeAppearanceSlots(): void {
  for (const unsubscribe of subscriptions.values()) unsubscribe();
  subscriptions.clear();
  appearanceGenerationController.cancel();
}

export function appearanceSlotCard(record: CharacterAppearanceRecord, slot: Slot, refresh: () => void): HTMLElement {
  subscriptions.get(slot)?.();
  const resourceId = record[slot]?.resourceId;
  const preview = slot === "charset"
    ? graphicPreview(labels[slot], resourceId ?? "(없음)", "charset", record.charset?.characterIndex ?? 0)
    : portraitPreview(resourceId, labels[slot]);
  preview.classList.add("appearance-slot-preview");
  const choose = (): void => openDatabaseResourcePickerDialog({
    kind: slot === "bust" ? "picture" : slot === "face" ? "faceset" : "charset",
    title: `${labels[slot]} 선택`,
    currentId: resourceId,
    currentCharacterIndex: record.charset?.characterIndex,
    testidPrefix: `appearance-picker-${slot}`,
    onConfirm: (result) => {
      if (slot === "charset") updateAppearance(record.id, { charset: { resourceId: result.resourceId, characterIndex: result.characterIndex ?? 0 } });
      else updateAppearance(record.id, { [slot]: { resourceId: result.resourceId } });
      refresh();
    },
  });
  const actions = listToolbar([
    { label: resourceId ? "그림 변경" : "그림 선택", testid: `appearance-choose-${slot}`, onClick: choose },
    { label: "업로드", testid: `appearance-upload-${slot}`, onClick: () => openResourceModal(slot === "charset" ? "charset" : slot === "face" ? "faceset" : "picture") },
    { label: "연결 해제", testid: `appearance-clear-${slot}`, disabled: !resourceId, title: resourceId ? "이 슬롯의 그림 연결 해제" : "연결된 그림이 없습니다.",
      onClick: () => { updateAppearance(record.id, { [slot]: undefined }); refresh(); } },
  ]);
  const children: HTMLElement[] = [preview, el("p", { class: "appearance-help", text: slot === "charset"
    ? `수동 선택 전용 · 슬롯 ${(record.charset?.characterIndex ?? 0) + 1}`
    : slot === "bust" ? "선택 사항 · 없으면 대사에서 얼굴을 사용합니다." : "선택 사항 · 얼굴 한 장을 연결합니다." }), actions,
    el("p", { class: "appearance-help", text: "업로드 후 ‘그림 선택’에서 새 리소스를 연결하세요." })];
  if (slot !== "charset") {
    const candidateHost = el("div", { class: "appearance-candidate", attrs: { "aria-live": "polite" }, dataset: { testid: `appearance-candidate-${slot}` } });
    const renderCandidate = (): void => {
      const state = appearanceGenerationController.getState();
      const current = store.getCurrent().database.characterAppearances?.find((entry) => entry.id === record.id);
      const occupied = Boolean(current?.[slot]);
      const belongs = state.appearanceId === record.id && state.slot === slot;
      candidateHost.dataset.status = belongs ? state.status : "idle";
      candidateHost.replaceChildren();
      const generation = listToolbar([{
        label: occupied ? `${labels[slot]} 교체 후보 생성` : `${labels[slot]} AI 생성`,
        testid: `appearance-generate-${slot}`,
        disabled: state.status === "generating",
        title: state.status === "generating" ? "현재 후보 생성이 끝나거나 취소된 뒤 다시 생성할 수 있습니다." : "검토할 후보만 생성하며 적용 전에는 프로젝트를 바꾸지 않습니다.",
        onClick: () => { void appearanceGenerationController.generate({ appearanceId: record.id, slot, replace: occupied }); },
      }]);
      candidateHost.append(generation);
      if (state.status === "generating") {
        candidateHost.append(el("p", { class: "appearance-help", text: belongs ? "후보 생성 중입니다. 적용 전까지 기존 그림이 유지됩니다." : "다른 슬롯의 후보를 생성 중입니다." }));
        if (belongs) candidateHost.append(listToolbar([{ label: "생성 취소", testid: "appearance-cancel-generation", onClick: () => appearanceGenerationController.cancel() }]));
      }
      if (!belongs) return;
      if (state.status === "error") candidateHost.append(el("p", { class: "appearance-error", text: state.error ?? "후보 생성에 실패했습니다. 다시 시도하세요." }));
      if (state.status === "candidate" && state.candidate) {
        const image = el("img", { attrs: { alt: "미적용 후보 미리보기" } });
        const visual = el("div", { class: "appearance-portrait", children: [image] });
        let decoded = false;
        const status = el("p", { class: "appearance-help", text: "후보 그림을 불러오는 중입니다. 확인 후 적용할 수 있습니다." });
        const actions = listToolbar([
          { label: occupied ? "기존 그림 교체 적용" : "후보 적용", kind: "primary", testid: `appearance-apply-${slot}`,
            disabled: true, title: "후보 그림을 불러온 뒤 적용할 수 있습니다.",
            onClick: () => { if (decoded && appearanceGenerationController.apply(slot)) refresh(); } },
          { label: "후보 버리기", testid: "appearance-cancel-generation", onClick: () => appearanceGenerationController.cancel() },
        ]);
        const apply = actions.querySelector("button");
        const ready = (): void => {
          if (image.naturalWidth <= 0) return;
          decoded = true;
          if (apply instanceof HTMLButtonElement) { apply.disabled = false; apply.title = "확인한 후보를 외형에 적용합니다."; }
          status.textContent = "미적용 후보 · 아래 적용 버튼을 눌러야 저장됩니다.";
          candidateHost.dataset.imageStatus = "ready";
        };
        if (image instanceof HTMLImageElement) {
          image.addEventListener("load", ready, { once: true });
          image.addEventListener("error", () => {
            decoded = false;
            if (apply instanceof HTMLButtonElement) apply.disabled = true;
            status.textContent = "후보 그림을 불러올 수 없어 적용할 수 없습니다. 후보를 버리고 다시 생성하세요.";
            candidateHost.dataset.imageStatus = "error";
            visual.replaceChildren(el("span", { text: "후보 그림 오류" }));
          }, { once: true });
          candidateHost.dataset.imageStatus = "loading";
          image.src = state.candidate.dataUrl;
          if (image.complete && image.naturalWidth > 0) ready();
        }
        candidateHost.append(visual, status, actions);
      }
    };
    subscriptions.set(slot, appearanceGenerationController.subscribe(renderCandidate));
    renderCandidate();
    children.push(candidateHost);
  }
  return sectionCard({ title: labels[slot], children, testid: `appearance-slot-${slot}` });
}

function portraitPreview(resourceId: string | undefined, label: string): HTMLElement {
  const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
  if (!url) return el("div", { class: "appearance-portrait", text: "그림 없음" });
  const image = el("img", { attrs: { src: url, alt: `${label} 미리보기` } });
  const preview = el("div", { class: "appearance-portrait", children: [image] });
  image.addEventListener("error", () => { preview.replaceChildren(el("span", { text: "그림을 불러올 수 없습니다." })); });
  return preview;
}

export function appearanceDialoguePreview(record: CharacterAppearanceRecord): HTMLElement {
  const face = resolveAppearancePortrait(store.getCurrent(), record.id, "face");
  const bust = resolveAppearancePortrait(store.getCurrent(), record.id, "bust");
  return sectionCard({ title: "대사 미리보기", children: [
    el("div", { class: "appearance-dialogue", dataset: { testid: "appearance-dialogue-preview" }, children: [
      portraitPreview(bust?.resourceId ?? face?.resourceId, record.name),
      el("div", { children: [el("strong", { text: record.name || "이름 없는 외형" }), el("p", { text: "안녕하세요. 이 모습으로 이야기를 시작할게요." })] }),
    ] }),
  ] });
}
