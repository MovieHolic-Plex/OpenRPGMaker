import type {
  CinematicMediaSlot,
  CinematicMediaTicket,
  DatabaseCinematicActions,
} from "@/editor/panels/databaseCinematicActions";
import { cinematicButton } from "@/editor/panels/databaseCinematicControls";
import { field } from "@/editor/panels/databaseControls";
import {
  openDatabaseResourcePickerDialog,
  resourcePickerControl,
} from "@/editor/panels/databaseResourcePickerDialog";
import { el } from "@/util/dom";

type MediaRequest = {
  readonly ticket: CinematicMediaTicket;
  readonly controller: AbortController;
  readonly revision: number;
};

export type CinematicMediaField = (
  suffix: "resource" | "voice" | "music" | "background",
  label: string,
  slot: CinematicMediaSlot,
  resourceId: string | undefined,
) => HTMLElement;

/**
 * One request owner per View lifetime. The View retains revision ownership and
 * calls cancel before preview, redraw or disposal, in its existing order.
 */
export function createCinematicMediaFields(options: {
  readonly actions: DatabaseCinematicActions;
  readonly getRevision: () => number;
  readonly clearPendingKind: () => void;
  readonly redraw: () => void;
  readonly setStatus: (message: string) => void;
}): {
  readonly field: CinematicMediaField;
  readonly cancel: () => void;
} {
  const { actions, getRevision, clearPendingKind, redraw, setStatus } = options;
  let request: MediaRequest | undefined;

  function cancel(): void {
    const previous = request;
    request = undefined;
    previous?.controller.abort();
  }

  function begin(slot: CinematicMediaSlot): MediaRequest {
    cancel();
    actions.endTyping();
    const next = {
      ticket: actions.captureMedia(slot),
      controller: new AbortController(),
      revision: getRevision(),
    };
    request = next;
    return next;
  }

  function current(next: MediaRequest): boolean {
    return actions.isActive() && request === next && next.revision === getRevision()
      && !next.controller.signal.aborted;
  }

  const mediaField: CinematicMediaField = (suffix, label, slot, resourceId) => {
    const ownRevision = getRevision();
    const usable = (): boolean => actions.isActive() && ownRevision === getRevision();
    // 그림 칸은 스틸 카탈로그(배경화·타이틀 아트 + AI 생성) — 아이템 아이콘만 나오던 배선을 고친다.
    const kind = slot.kind === "video" ? "movie"
      : slot.kind === "voice" ? "sound"
        : slot.kind === "music" ? "music" : "still";
    const allowClear = slot.kind === "voice" || slot.kind === "music" || slot.kind === "background";
    const testid = `db-cinematic-${suffix}`;

    const committed = (next: MediaRequest, id: string): void => {
      if (!usable() || !current(next)) return;
      const changed = actions.selectMedia(next.ticket, id);
      if (changed) {
        if (suffix === "resource") clearPendingKind();
        redraw();
        setStatus("미디어를 설정했습니다.");
      } else {
        setStatus("변경하지 않았습니다. 현재 프로젝트의 올바른 미디어를 선택하세요.");
      }
    };

    const picker = resourcePickerControl({
      label,
      resourceId,
      kind,
      testid,
      allowClear,
      // The raw-ID input starts its own request. Each dialog below closes over
      // the immutable request captured at that particular opening.
      onChange: result => {
        if (usable()) committed(begin(slot), result.resourceId);
      },
      rerender: () => {
        if (!usable()) return;
        const input = picker.querySelector<HTMLInputElement>(`[data-testid="${testid}"]`);
        if (input) input.value = resourceId ?? "";
      },
    });
    const choose = cinematicButton(`${suffix}-set`, `${label} 선택`, () => {
      if (!usable()) return;
      const next = begin(slot);
      openDatabaseResourcePickerDialog({
        kind,
        title: `${label} 선택`,
        currentId: resourceId,
        allowClear,
        testidPrefix: `${testid}-dialog`,
        onConfirm: result => committed(next, result.resourceId),
      });
    });
    // The shared control owns one opener with this ID. Replace that node
    // rather than retaining its unticketed dialog callback.
    for (const original of picker.querySelectorAll<HTMLButtonElement>(`[data-testid="${testid}-set"]`)) {
      original.replaceWith(choose);
    }

    const fileInput = el("input", {
      attrs: {
        type: "file",
        accept: slot.kind === "video" ? ".webm,.mp4,.m4v,.ogv"
          : slot.kind === "voice" || slot.kind === "music" ? ".wav,.mp3,.ogg" : ".png,.jpg,.jpeg,.gif,.webp",
      },
      dataset: { testid: `${testid}-upload` },
    });
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file || !usable()) return;
      const next = begin(slot);
      setStatus(`${file.name} 확인 중…`);
      void actions.uploadMedia(next.ticket, file, next.controller.signal).then(changed => {
        if (!current(next)) return;
        if (changed) {
          if (suffix === "resource") clearPendingKind();
          redraw();
          setStatus(`${file.name} 가져오기 완료`);
        } else {
          request = undefined;
          setStatus("편집 내용이 변경되어 가져온 파일을 적용하지 않았습니다.");
        }
      }, error => {
        if (!current(next)) return;
        request = undefined;
        setStatus(error instanceof Error && error.name === "AbortError"
          ? "가져오기를 취소했습니다."
          : error instanceof Error ? error.message : String(error));
      });
    });

    return el("div", {
      class: "db-cinematic-media",
      children: [picker, field(`${label} 파일 가져오기`, fileInput)],
    });
  };

  return { field: mediaField, cancel };
}
