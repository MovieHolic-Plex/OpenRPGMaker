/**
 * One-click field-monster template: battle → victory fork → clear switch + Erase Event + cleared page.
 */
import { editorState } from "@/editor/editorState";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { ensureNamedSwitch } from "@/editor/tools/flagHelpers";
import {
  buildFieldMonsterPages,
  defaultFieldMonsterClearSwitchId,
  hasFieldMonsterVictoryErasePattern,
} from "@/project/fieldMonsterTemplate";
import { store } from "@/project/store";
import type { EventPage, EventPageGraphic, MapId } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { imageIconOf, recordPickerWithPreview } from "./recordPicker";
import { openEventSubdialog } from "./subdialog";

export function openFieldMonsterTemplateDialog(mapId: MapId, eventId: string, page: EventPage): void {
  const project = store.getCurrent();
  const event = project.maps[mapId]?.events.find((entry) => entry.id === eventId);
  if (!event) {
    toast("이벤트를 찾을 수 없습니다.", "error");
    return;
  }
  if (project.database.troops.length === 0) {
    toast("적 그룹(troop)이 없습니다. 데이터베이스에서 먼저 만드세요.", "error");
    return;
  }

  const existingTroopId =
    page.commands.find((command) => command.kind === "battleProcessing")?.troopId ??
    project.database.troops[0]?.id ??
    "";
  const defaultClearSwitch = defaultFieldMonsterClearSwitchId(eventId);

  openEventSubdialog({
    title: "필드 몬스터 템플릿",
    subtitle: "전투 → 승리 시 스위치 ON + 이벤트 소거 + 정리 페이지",
    testId: "field-monster-template-dialog",
    width: "wide",
    render: (body, close) => {
      const troop = recordPickerWithPreview({
        records: store.getCurrent().database.troops,
        selectedId: existingTroopId,
        placeholder: "적 그룹 선택",
        testid: "field-monster-template-troop",
        iconOf: (record) => {
          const firstEnemyId = record.enemyIds[0];
          const enemy = store.getCurrent().database.enemies.find((entry) => entry.id === firstEnemyId);
          return imageIconOf(store.getCurrent(), enemy?.monsterResourceId);
        },
        subtitleOf: (record) => (record.enemyIds.length ? `적 ${record.enemyIds.length}명` : null),
      });

      const intro = el("textarea", {
        class: "field-monster-template-textarea",
        attrs: { rows: "2", "aria-label": "전투 전 대사" },
        dataset: { testid: "field-monster-template-intro" },
        text: "적이 앞을 가로막았다!",
      }) as HTMLTextAreaElement;

      const victory = el("textarea", {
        class: "field-monster-template-textarea",
        attrs: { rows: "2", "aria-label": "승리 후 대사" },
        dataset: { testid: "field-monster-template-victory" },
        text: "길이 열렸다.",
      }) as HTMLTextAreaElement;

      const clearSwitch = el("input", {
        class: "field-monster-template-input",
        attrs: { type: "text", "aria-label": "클리어 스위치 ID" },
        value: defaultClearSwitch,
        dataset: { testid: "field-monster-template-clear-switch" },
      }) as HTMLInputElement;

      const keepGraphic = el("input", {
        attrs: { type: "checkbox" },
        dataset: { testid: "field-monster-template-keep-graphic" },
      }) as HTMLInputElement;
      keepGraphic.checked = true;

      const canEscape = el("input", {
        attrs: { type: "checkbox" },
        dataset: { testid: "field-monster-template-can-escape" },
      }) as HTMLInputElement;
      canEscape.checked = true;

      const canLose = el("input", {
        attrs: { type: "checkbox" },
        dataset: { testid: "field-monster-template-can-lose" },
      }) as HTMLInputElement;

      const apply = el("button", {
        class: "btn primary",
        text: "템플릿 적용",
        attrs: { type: "button" },
        dataset: { testid: "field-monster-template-apply" },
        on: {
          click: () => {
            const troopId = troop.select.value.trim();
            if (!troopId) {
              toast("적 그룹을 선택하세요.", "error");
              return;
            }
            if (!store.getCurrent().database.troops.some((entry) => entry.id === troopId)) {
              toast("존재하지 않는 적 그룹입니다.", "error");
              return;
            }
            const switchId = clearSwitch.value.trim() || defaultClearSwitch;
            const introLines = splitLines(intro.value, "적이 앞을 가로막았다!");
            const victoryLines = splitLines(victory.value, "길이 열렸다.");
            const liveEvent = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === eventId);
            if (!liveEvent) {
              toast("이벤트를 찾을 수 없습니다.", "error");
              return;
            }
            const graphic: EventPageGraphic = keepGraphic.checked
              ? structuredClone(page.graphic)
              : structuredClone(liveEvent.pages?.[0]?.graphic ?? page.graphic);
            const pages = buildFieldMonsterPages({
              eventId,
              troopId,
              clearSwitchId: switchId,
              intro: introLines,
              victory: victoryLines,
              canEscape: canEscape.checked,
              canLose: canLose.checked,
              graphic,
            });
            recordProjectSnapshot("필드 몬스터 템플릿", mapId, { kind: "map" });
            store.update((draft) => {
              ensureNamedSwitch(draft, switchId, `전투 완료: ${eventId}`);
              const target = draft.maps[mapId]?.events.find((entry) => entry.id === eventId);
              if (!target) return;
              target.pages = pages;
              target.trigger = { kind: "action" };
              target.commands = [];
            });
            editorState.set({ selectedEventPageId: pages[0]?.id ?? null });
            toast("필드 몬스터 템플릿을 적용했습니다.", "ok");
            close();
          },
        },
      });

      const cancel = el("button", {
        class: "btn",
        text: "취소",
        attrs: { type: "button" },
        dataset: { testid: "field-monster-template-cancel" },
        on: { click: close },
      });

      body.append(
        el("div", {
          class: "field-monster-template-form",
          dataset: { testid: "field-monster-template-form" },
          children: [
            el("p", {
              class: "field-monster-template-hint",
              text: "적용 시 이 이벤트의 페이지를 전투/정리 2페이지로 교체합니다. 승리할 때만 스위치 ON + 이벤트 소거가 실행됩니다.",
            }),
            labeled("적 그룹", troop.root),
            labeled("전투 전 대사 (줄바꿈 = 여러 문장)", intro),
            labeled("승리 후 대사", victory),
            labeled("클리어 스위치 ID", clearSwitch),
            el("div", {
              class: "field-monster-template-checks",
              children: [
                checkLabel(keepGraphic, "현재 그래픽 유지"),
                checkLabel(canEscape, "탈출 허용"),
                checkLabel(canLose, "패배 허용"),
              ],
            }),
            el("div", {
              class: "field-monster-template-actions",
              children: [apply, cancel],
            }),
          ],
        })
      );
    },
  });
}

export function fieldMonsterTemplateQualityLabel(page: EventPage): string | null {
  return hasFieldMonsterVictoryErasePattern(page.commands) ? "필드 몬스터 템플릿 적용됨" : null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "field-monster-template-field",
    children: [el("span", { class: "field-monster-template-label", text: label }), control],
  });
}

function checkLabel(input: HTMLInputElement, text: string): HTMLElement {
  return el("label", {
    class: "field-monster-template-check",
    children: [input, el("span", { text })],
  });
}

function splitLines(raw: string, fallback: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : [fallback];
}
