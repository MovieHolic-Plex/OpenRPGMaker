import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { appearanceGenerationController } from "@/editor/characterAppearanceGeneration";
import { resolveAppearancePortrait } from "@/project/characterAppearances";
import { sharedExpressionSetIdOf, sharedPortraitId } from "@/assets/sharedPortraitAssets";
import { sharedCharsetRow, sharedFaceForCharset, sharedFaceRow } from "@/project/sharedCharacterFaceResolver";
import { store } from "@/project/store";
import type { CharacterAppearanceRecord } from "@/project/types";
import { el } from "@/util/dom";
import { graphicPreview } from "./actorRecordControls";
import { listToolbar, sectionCard } from "./databaseWorkspace";
import { openDatabaseResourcePickerDialog } from "./databaseResourcePickerDialog";
import { openResourceModal } from "./resourceModal";
import { updateAppearance } from "./databaseAppearanceView";

type Slot = "charset" | "face" | "bust" | "full";
const labels = { charset: "걷기 캐릭터", face: "얼굴", bust: "흉상", full: "전신" } as const;
const SHARED_STATUS_LABELS = { pending: "미검토", mapped: "얼굴 지정", "no-face": "얼굴 없음 확정" } as const;
const SHARED_QUALITY_LABELS = { unspecified: "미지정", exact: "정확", approximate: "근사" } as const;

/** Read-only shared-catalog line. Bust has no shared concept; missing rows are stated, never synced. */
function sharedSlotLine(record: CharacterAppearanceRecord, slot: Slot): HTMLElement | null {
  if (slot === "bust" || slot === "full") return null;
  const resourceId = record[slot]?.resourceId;
  if (!resourceId) return el("p", { class: "appearance-help", text: "공용 분류 · 아직 그림이 없습니다.", dataset: { testid: `appearance-shared-${slot}` } });
  if (slot === "charset") {
    const row = sharedCharsetRow(resourceId, record.charset?.characterIndex ?? 0);
    if (!row) return el("p", { class: "appearance-help", text: "공용 분류 없음 · 업로드 그림은 시스템 › 캐릭터·얼굴 대상이 아닙니다.", dataset: { testid: "appearance-shared-charset" } });
    const attrs = Object.values(row.attributes ?? {}).filter((value): value is string => typeof value === "string" && value.length > 0).join(" · ");
    return el("p", { class: "appearance-help", text: `공용 분류 · ${row.label} · ${SHARED_STATUS_LABELS[row.status]} · ${SHARED_QUALITY_LABELS[row.quality]}${attrs ? ` · ${attrs}` : ""}`, dataset: { testid: "appearance-shared-charset" } });
  }
  const face = sharedFaceRow(resourceId);
  if (!face) return el("p", { class: "appearance-help", text: "공용 분류 없음 · 업로드 또는 생성 그림입니다.", dataset: { testid: "appearance-shared-face" } });
  const attrs = Object.values(face.attributes ?? {}).filter((value): value is string => typeof value === "string" && value.length > 0).join(" · ");
  return el("p", { class: "appearance-help", text: `공용 분류 · ${face.label}${attrs ? ` · ${attrs}` : ""}`, dataset: { testid: "appearance-shared-face" } });
}
const subscriptions = new Map<Slot | "walkchip", () => void>();

/**
 * 걷기 칩 만들기 — 사진 또는 외형 설명으로 호스트 char-gen 작업을 공방 작업 줄에 세운다(알아서 고르기: 오류 검사 → Opus 쌍 비교 1위).
 * 다 되면 줄이 묶음을 넣고 이 외형의 걷기 칩을 바꾼다(afterPackInstalled). 사진은 호스트 작업 폴더에만 간다.
 */
function walkChipMaker(record: CharacterAppearanceRecord): HTMLElement {
  const host = el("div", { class: "appearance-candidate", attrs: { "aria-live": "polite" }, dataset: { testid: "appearance-walkchip" } });
  const file = el("input", { attrs: { type: "file", accept: "image/jpeg,image/png,image/webp", hidden: "" }, dataset: { testid: "appearance-walkchip-photo-file" } }) as HTMLInputElement;
  let error = "";
  const start = (mode: "photo" | "text", photo?: string): void => {
    error = "";
    void import("@/editor/workshop/queue/workshopQueue").then(({ workshopQueue }) => workshopQueue().enqueueRemote({
      kind: "char-gen", mode, text: mode === "text" ? record.description.trim() : record.name || "사진 속 사람", appearanceId: record.id,
      title: record.name || "새 인물", ...(photo ? { photo } : {}),
    })).catch((reason: unknown) => { error = reason instanceof Error ? reason.message : String(reason); render(); });
  };
  file.addEventListener("change", () => {
    const chosen = file.files?.[0];
    file.value = "";
    if (!chosen) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => { if (typeof reader.result === "string") start("photo", reader.result); }, { once: true });
    reader.readAsDataURL(chosen);
  });
  let views: readonly import("@/editor/workshop/queue/workshopQueue").JobView[] = [];
  const render = (): void => {
    const mine = views.filter((view) => view.job.remote?.appearanceId === record.id);
    const live = mine.find((view) => view.state !== "installed" && view.state !== "failed" && view.state !== "cancelled");
    const last = mine.at(-1);
    host.dataset.status = live ? "generating" : last?.state ?? "idle";
    const hasText = record.description.trim().length >= 6;
    const toolbar = listToolbar([
      { label: "사진으로 걷기 칩 만들기", testid: "appearance-walkchip-photo", disabled: Boolean(live),
        title: live ? "만드는 중입니다." : "사람 사진 한 장으로 맞는 머리·몸을 고르고 색을 칠해 이 외형의 걷기 칩으로 겁니다(수 분).", onClick: () => file.click() },
      { label: "설명으로 걷기 칩 만들기", testid: "appearance-walkchip-text", disabled: Boolean(live) || !hasText,
        title: live ? "만드는 중입니다." : hasText ? "외형 설명(머리·수염·모자·옷 색)으로 걷기 칩을 만들어 겁니다(수 분)." : "외형 설명을 먼저 적으세요.",
        onClick: () => start("text") },
    ]);
    const lines: HTMLElement[] = [toolbar];
    if (live) lines.push(el("p", { class: "appearance-help", dataset: { testid: "appearance-walkchip-status" }, text: `걷기 칩을 만드는 중 · ${Math.round(live.progress * 100)}% · 다 되면 이 외형의 칩이 저절로 바뀝니다(공방 작업 줄).` }));
    else if (last?.state === "installed") lines.push(el("p", { class: "appearance-help", dataset: { testid: "appearance-walkchip-status" }, text: "만든 걷기 칩을 걸었습니다. 되돌리기로 이전 칩으로 돌아갈 수 있습니다." }));
    else if (last?.state === "failed") lines.push(el("p", { class: "appearance-error", dataset: { testid: "appearance-walkchip-status" }, text: `걷기 칩을 만들지 못했습니다: ${last.job.error ?? "알 수 없는 오류"}` }));
    if (error) lines.push(el("p", { class: "appearance-error", text: error }));
    host.replaceChildren(...lines, file);
  };
  void import("@/editor/workshop/queue/workshopQueue").then(({ workshopQueue }) => {
    const queue = workshopQueue();
    const refresh = (): void => { views = queue.snapshot().jobs; render(); };
    subscriptions.get("walkchip")?.();
    subscriptions.set("walkchip", queue.subscribe(refresh));
    refresh();
  });
  render();
  return host;
}

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
    kind: slot === "bust" || slot === "full" ? "picture" : slot === "face" ? "faceset" : "charset",
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
    : slot === "bust" ? "선택 사항 · 없으면 대사에서 얼굴을 사용합니다."
    : slot === "full" ? "선택 사항 · 대사 창 뒤에 크게 섭니다. 없으면 흉상, 그것도 없으면 얼굴." : "선택 사항 · 얼굴 한 장을 연결합니다." })];
  const sharedLine = sharedSlotLine(record, slot);
  if (sharedLine) children.push(sharedLine);
  children.push(actions);
  // 얼굴이 공용 표정 세트면 그 인물의 공용 흉상을 한 번에 잇는다(대사 표정이 나머지 표정 그림을 고른다).
  // 얼굴 칸이 비어 있어도 걷기 칩의 검토된 짝이 공용 흉상이면(현대 연애 칩 12종) 그 인물의 흉상·전신을 잇는다.
  const pairedFace = record.charset ? sharedFaceForCharset(record.charset.resourceId, record.charset.characterIndex)?.resourceId : undefined;
  const faceSet = slot === "bust" || slot === "full" ? sharedExpressionSetIdOf(record.face?.resourceId ?? pairedFace) : undefined;
  if (faceSet && (slot === "bust" || slot === "full")) {
    const portraitId = sharedPortraitId(faceSet, slot, "base");
    const linked = resourceId === portraitId;
    children.push(listToolbar([{
      label: linked ? `공용 ${labels[slot]} 연결됨` : `이 얼굴의 공용 ${labels[slot]} 연결`,
      testid: `appearance-link-shared-${slot}`,
      disabled: linked,
      title: `얼굴과 같은 인물의 공용 ${labels[slot]}을 연결합니다. 대사에 표정을 고르면 기쁨·슬픔·분노·놀람 ${labels[slot]}으로 바뀝니다.`,
      onClick: () => { updateAppearance(record.id, { [slot]: { resourceId: portraitId } }); refresh(); },
    }]));
  }
  children.push(el("p", { class: "appearance-help", text: "업로드 후 ‘그림 선택’에서 새 리소스를 연결하세요." }));
  if (slot === "charset") children.push(walkChipMaker(record));
  // AI 후보 생성은 얼굴·흉상만(전신은 공용 그림을 잇거나 업로드한다).
  if (slot === "face" || slot === "bust") {
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
