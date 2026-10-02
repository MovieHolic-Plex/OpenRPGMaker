/**
 * 자료집 시스템 탭 「전투 화면 꾸미기」 — system.battleLook(project/battleLook.ts) 편집 칸.
 *
 * 위: 프리셋 12종 갤러리(실제 런타임 화면 축소판). 아래: 칸별 덮어쓰기(파티·명령·전장·창·글꼴·강조색·연출).
 * 칸을 바꾸면 바탕 프리셋은 그대로 두고 그 칸만 저장한다 — 프리셋과 같은 값은 정규화가 지운다.
 * 갤러리 그림은 프리셋 그대로의 모습이다. 칸을 바꾼 결과는 「전투 테스트」로 실제 전투에서 본다.
 */
import { el } from "@/util/dom";
import { field } from "@/editor/panels/databaseControls";
import { BATTLE_SKINS, resolveSkinId } from "@/battle/skins/registry";
import {
  BATTLE_LOOK_COMMAND_IDS,
  BATTLE_LOOK_COMMAND_LABELS,
  BATTLE_LOOK_FIELD_IDS,
  BATTLE_LOOK_FIELD_LABELS,
  BATTLE_LOOK_GROUP_LABELS,
  BATTLE_LOOK_LEVEL_LABELS,
  BATTLE_LOOK_LEVELS,
  BATTLE_LOOK_PARTY_IDS,
  BATTLE_LOOK_PARTY_LABELS,
  BATTLE_LOOK_PRESET_IDS,
  BATTLE_LOOK_PRESETS,
  BATTLE_LOOK_WINDOW_FONTS,
  BATTLE_LOOK_WINDOW_IDS,
  BATTLE_LOOK_WINDOW_LABELS,
  battleLookForPreset,
  isBattleAccentColor,
  patchBattleLook,
  resolveBattleLook,
  type BattleLookPreset,
  type BattleLookPresetId,
  type BattleLookSettings,
} from "@/project/battleLook";
import { FONT_REGISTRY, isFontFamilyId } from "@/project/fontRegistry";
import type { Project } from "@/project/types";

type SystemUpdate = (mutator: (draft: Project) => void) => void;

export function battleLookThumbnailUrl(preset: BattleLookPresetId): string {
  return `${import.meta.env.BASE_URL}assets/battle-look/${preset}.jpg`;
}

export function battleLookFields(project: Project, updateSystem: SystemUpdate, rerender: () => void): HTMLElement[] {
  const look = resolveBattleLook(project.system.battleLook);
  const saved: BattleLookSettings = project.system.battleLook ?? {};
  // 새 값은 렌더 시점 값이 아니라 지금 저장값(draft) 위에서 만든다 — 다시 그리기 전 연속 변경이 서로를 지우지 않게.
  const commit = (next: (current: BattleLookSettings | undefined) => BattleLookSettings | undefined): void => {
    updateSystem((draft) => {
      const value = next(draft.system.battleLook);
      if (value) draft.system.battleLook = value;
      else delete draft.system.battleLook;
    });
    rerender();
  };
  const write = (value: BattleLookSettings | undefined): void => commit(() => value);
  const patch = (value: Partial<BattleLookSettings>): void => commit((current) => patchBattleLook(current, value));
  const presetAxes = BATTLE_LOOK_PRESETS[look.preset].axes;

  const skin = BATTLE_SKINS[resolveSkinId(project.system.battleUiStyle)];
  const notes: HTMLElement[] = [
    el("p", {
      class: "db-system-help",
      text: "프리셋을 고른 뒤 아래 칸을 바꾸면 그 칸만 따로 저장됩니다. 도트 측면 전투 스킨에 적용됩니다.",
    }),
  ];
  if (skin?.motionStyle !== "retro") {
    notes.push(el("p", {
      class: "db-system-help db-battle-look-warning",
      dataset: { testid: "db-battle-look-skin-warning" },
      // 정면 스킨은 2026-10-02 지웠다 — 도트 측면이 아닌 스킨은 몬스터 대치(pokemon)뿐이다.
      text: "지금 전투 UI 스타일은 몬스터 대치라 이 꾸밈이 보이지 않습니다.",
    }));
  }

  const gallery = el("div", { class: "db-battle-look-gallery", dataset: { testid: "db-battle-look-gallery" } });
  for (const group of Object.keys(BATTLE_LOOK_GROUP_LABELS) as BattleLookPreset["group"][]) {
    const row = el("div", { class: "db-battle-look-row" });
    for (const id of BATTLE_LOOK_PRESET_IDS) {
      const preset = BATTLE_LOOK_PRESETS[id];
      if (preset.group !== group) continue;
      const active = id === look.preset;
      row.append(el("button", {
        class: `db-battle-look-card${active ? " is-active" : ""}`,
        attrs: { type: "button", "aria-pressed": String(active), title: preset.description },
        dataset: { testid: `db-battle-look-preset-${id}`, preset: id },
        on: { click: () => write(battleLookForPreset(id)) },
        children: [
          el("img", { attrs: { src: battleLookThumbnailUrl(id), alt: "", loading: "lazy", width: "128", height: "96" } }),
          el("strong", { text: preset.label }),
          el("small", { text: preset.summary }),
        ],
      }));
    }
    gallery.append(el("h5", { class: "db-battle-look-group", text: BATTLE_LOOK_GROUP_LABELS[group] }), row);
  }

  const status = el("div", {
    class: "db-battle-look-status",
    dataset: { testid: "db-battle-look-status" },
    children: [
      el("span", { text: `지금: ${BATTLE_LOOK_PRESETS[look.preset].label}` }),
      ...(look.customized
        ? [
            el("em", { class: "db-battle-look-custom", text: "사용자 설정" }),
            el("button", {
              class: "btn",
              text: "프리셋 값으로 되돌리기",
              attrs: { type: "button" },
              dataset: { testid: "db-battle-look-reset" },
              on: { click: () => write(battleLookForPreset(look.preset)) },
            }),
          ]
        : []),
      el("button", {
        class: "btn",
        text: "전투 테스트",
        attrs: { type: "button", title: "지금 설정으로 시작 적 그룹(없으면 아무 적 그룹)과 전투를 엽니다" },
        dataset: { testid: "db-battle-look-test" },
        on: { click: () => void openLookBattleTest(project.system.initialTroopId) },
      }),
    ],
  });

  const choice = <T extends string | number>(
    label: string,
    testid: string,
    ids: readonly T[],
    labels: Readonly<Record<T, string>>,
    value: T,
    presetValue: T,
    onChange: (value: T) => void,
  ): HTMLElement => {
    const select = el("select", { dataset: { testid } }) as HTMLSelectElement;
    for (const id of ids) {
      select.append(el("option", { text: id === presetValue ? `${labels[id]} · 프리셋` : labels[id], attrs: { value: String(id) } }));
    }
    select.value = String(value);
    select.addEventListener("change", () => {
      const next = ids.find((id) => String(id) === select.value);
      if (next !== undefined) onChange(next);
    });
    return field(label, select);
  };
  const toggle = (label: string, testid: string, key: "turnOrder" | "enemyNames" | "letterbox" | "grade"): HTMLElement => {
    const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid } }) as HTMLInputElement;
    input.checked = look[key];
    input.addEventListener("change", () => patch({ [key]: input.checked } as Partial<BattleLookSettings>));
    return el("label", { class: "db-battle-look-toggle", children: [input, el("span", { text: label })] });
  };
  const level = (label: string, testid: string, key: "light" | "dust" | "vignette" | "blur"): HTMLElement =>
    choice(label, testid, BATTLE_LOOK_LEVELS, BATTLE_LOOK_LEVEL_LABELS, look[key], presetAxes[key], (value) => patch({ [key]: value } as Partial<BattleLookSettings>));

  const fontSelect = el("select", { dataset: { testid: "db-battle-look-font" } }) as HTMLSelectElement;
  const presetFont = presetAxes.font ?? BATTLE_LOOK_WINDOW_FONTS[look.window];
  fontSelect.append(el("option", {
    text: `프리셋 기본 (${presetFont ? FONT_REGISTRY.find((entry) => entry.id === presetFont)?.label ?? presetFont : "프로젝트 픽셀 글꼴"})`,
    attrs: { value: "" },
  }));
  for (const entry of FONT_REGISTRY) fontSelect.append(el("option", { text: entry.label, attrs: { value: entry.id } }));
  fontSelect.value = saved.font && isFontFamilyId(saved.font) ? saved.font : "";
  fontSelect.addEventListener("change", () => patch({ font: isFontFamilyId(fontSelect.value) ? fontSelect.value : undefined }));

  // 강조색: 색 입력은 빈 값을 못 가지므로 「꾸밈 기본」 체크와 둘로 나눈다. field() 라벨은 첫 컨트롤을 누르므로 색을 앞에 둔다.
  const accentSaved = isBattleAccentColor(look.accent) ? look.accent : undefined;
  const usesDefault = el("input", { attrs: { type: "checkbox", "aria-label": "꾸밈 기본 강조색" }, dataset: { testid: "db-battle-look-accent-default" } }) as HTMLInputElement;
  usesDefault.checked = !accentSaved;
  const color = el("input", { attrs: { type: "color", "aria-label": "전투 강조색" }, dataset: { testid: "db-battle-look-accent" } }) as HTMLInputElement;
  color.value = accentSaved ?? "#d9b86c";
  color.disabled = !accentSaved;
  const applyAccent = (): void => {
    color.disabled = usesDefault.checked;
    patch({ accent: usesDefault.checked || !isBattleAccentColor(color.value) ? undefined : color.value.toLowerCase() });
  };
  usesDefault.addEventListener("change", applyAccent);
  color.addEventListener("change", applyAccent);

  const axes = el("div", {
    class: "db-battle-look-axes",
    dataset: { testid: "db-battle-look-axes" },
    children: [
      choice("파티 상태", "db-battle-look-party", BATTLE_LOOK_PARTY_IDS, BATTLE_LOOK_PARTY_LABELS, look.party, presetAxes.party, (value) => patch({ party: value })),
      choice("명령", "db-battle-look-command", BATTLE_LOOK_COMMAND_IDS, BATTLE_LOOK_COMMAND_LABELS, look.command, presetAxes.command, (value) => patch({ command: value })),
      choice("전장 크기", "db-battle-look-field", BATTLE_LOOK_FIELD_IDS, BATTLE_LOOK_FIELD_LABELS, look.field, presetAxes.field, (value) => patch({ field: value })),
      choice("창 꾸밈", "db-battle-look-window", BATTLE_LOOK_WINDOW_IDS, BATTLE_LOOK_WINDOW_LABELS, look.window, presetAxes.window, (value) => patch({ window: value })),
      field("전투 글꼴", fontSelect),
      field("강조색", el("span", { class: "db-battle-look-accent-row", children: [color, el("label", { children: [usesDefault, " 꾸밈 기본"] })] })),
      level("빛내림", "db-battle-look-light", "light"),
      level("떠다니는 먼지", "db-battle-look-dust", "dust"),
      level("가장자리 어둡게", "db-battle-look-vignette", "vignette"),
      level("위아래 흐림", "db-battle-look-blur", "blur"),
    ],
  });
  const toggles = el("div", {
    class: "db-battle-look-toggles",
    children: [
      toggle("차례 순서 줄", "db-battle-look-turn-order", "turnOrder"),
      toggle("적 이름표", "db-battle-look-enemy-names", "enemyNames"),
      toggle("영화 띠", "db-battle-look-letterbox", "letterbox"),
      toggle("색보정", "db-battle-look-grade", "grade"),
    ],
  });

  return [...notes, gallery, status, axes, toggles];
}

async function openLookBattleTest(initialTroopId: string | undefined): Promise<void> {
  const modal = await import("@/editor/panels/testPlayModal");
  if (initialTroopId) await modal.openTroopBattleTestModal(initialTroopId);
  else await modal.openRandomTroopBattleTestModal();
}
