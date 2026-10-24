// 불러오기 화면의 클라우드 세이브 부분: 상태 한 줄과 「다른 기기 세이브」(충돌 때 남긴 쪽) 고르기.
// 스토어 play 화면 밖(내보낸 게임·새 창)에서는 아무것도 붙지 않는다.
import { el } from "../util/dom";
import type { SaveSlotIndex } from "./saveSlots";
import { chooseCloudOtherSave, cloudSaveStatusText, listCloudOtherSaves } from "./storeCloudSync";

function formatSavedAt(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

export function cloudStatusLine(): HTMLElement | null {
  const text = cloudSaveStatusText();
  return text ? el("div", { class: "oprn-load-message oprn-cloud-status", text, attrs: { role: "status" }, dataset: { testid: "cloud-save-status" } }) : null;
}

/** 메뉴 저장·불러오기 안내 끝에 붙인다. */
export function withCloudStatus(hint: string): string {
  const text = cloudSaveStatusText();
  return text ? `${hint} · ${text}` : hint;
}

export function appendCloudOtherSaves(host: HTMLElement, options: {
  readonly onLoadSlot: (slot: SaveSlotIndex) => void;
  readonly onLoadAutosave?: () => void;
}): void {
  for (const other of listCloudOtherSaves()) {
    if (other.slot === "clear" || (other.slot === "auto" && !options.onLoadAutosave)) continue;
    const where = other.slot === "auto" ? "자동 저장" : `${other.slot}번 칸`;
    const when = other.savedAt ? ` · ${formatSavedAt(other.savedAt)}` : "";
    host.append(el("button", {
      class: "oprn-load-slot system-shell-button is-cloud-other",
      text: `☁ 다른 기기 세이브 · ${where}${when} — 이걸로 이어하기 (지금 ${where} 세이브는 남겨 둡니다)`,
      dataset: { testid: `cloud-other-${other.slot}` },
      on: { click: () => {
        if (!chooseCloudOtherSave(other.slot)) return;
        if (other.slot === "auto") options.onLoadAutosave?.();
        else options.onLoadSlot(Number(other.slot) as SaveSlotIndex);
      } },
    }));
  }
}
