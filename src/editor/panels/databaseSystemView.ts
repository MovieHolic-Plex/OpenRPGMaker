import {
  FACESET_COLUMNS,
  FACESET_FACE_HEIGHT,
  FACESET_FACE_WIDTH,
  FACESET_ROWS,
} from "@/assets/easyrpgRtp";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { BATTLE_SKINS, listBattleSkinIds, resolveSkinId } from "@/battle/skins/registry";
import {
  emptyToUndefined,
  field,
  numberField,
  selectField,
  selectLiteral,
  textControl,
} from "@/editor/panels/databaseControls";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { renderSystemStudioOverview, wireSystemStudioOverview } from "@/editor/panels/databaseSystemStudio";
import { MAX_TITLE_BACKGROUND_LAYERS, normalizeTimeSystemConfig, normalizeTypeChart } from "@/project/databaseRecordModel";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import {
  DEFAULT_DAY_END_HOUR,
  DEFAULT_DAY_START_HOUR,
  DEFAULT_TIME_MINUTES_PER_REAL_SECOND,
} from "@/project/gameTime";
import { store } from "@/project/store";
import type {
  ActorRecord,
  BattleFlow,
  Project,
  TitleBackgroundLayer,
  TitleIntroLogoAnimation,
  TitleIntroMenuAnimation,
  TitleParticlePreset,
  TitleScreenSettings,
  TitleScreenTitleMode,
  TypeChartRecord,
} from "@/project/types";
import { el } from "@/util/dom";
import { playAudioCommand, stopAudioCommand } from "@/player/audio";
import { listTitleMenuOptions, renderTitleFxStack, titleIntroClass } from "@/player/titleScreen";
import {
  normalizePlayResolution,
  PLAY_RESOLUTION_LIMITS,
  resolvePlayResolution,
} from "@/project/playResolution";
import type { PlayResolution, SystemRecords } from "@/project/types";

const START_PARTY_SLOTS = 4;
const BATTLE_FLOW_OPTIONS = ["gauge", "strict"] as const satisfies readonly BattleFlow[];
const BATTLE_UI_STYLE_OPTIONS = listBattleSkinIds();
const TITLE_PRESENTATION_MODES = ["text", "graphic", "both"] as const satisfies readonly TitleScreenTitleMode[];
const TITLE_PARTICLE_PRESET_OPTIONS = ["none", "snow", "rain", "fireflies"] as const satisfies readonly ("none" | TitleParticlePreset)[];
const TITLE_INTRO_LOGO_OPTIONS = ["none", "fadeIn", "riseIn"] as const satisfies readonly TitleIntroLogoAnimation[];
const TITLE_INTRO_MENU_OPTIONS = ["none", "fadeIn", "slideUp"] as const satisfies readonly TitleIntroMenuAnimation[];
const PLAY_RESOLUTION_PRESETS = ["320x240", "426x240", "640x360", "640x480", "custom"] as const;
type PlayResolutionPreset = (typeof PLAY_RESOLUTION_PRESETS)[number];

/** 시스템 탭 좌측 섹션 내비 슬러그 — SYSTEM_SECTION_ORDER 순서가 곧 내비 순서. */
type SystemSectionSlug = "overview" | "party" | "display" | "resources" | "startup" | "optin" | "time" | "typechart" | "title";

const SYSTEM_SECTION_ORDER: readonly { readonly slug: SystemSectionSlug; readonly label: string }[] = [
  { slug: "overview", label: "개요" },
  { slug: "party", label: "플레이어" },
  { slug: "display", label: "화면과 사운드" },
  { slug: "resources", label: "리소스" },
  { slug: "startup", label: "시작과 세이브" },
  { slug: "optin", label: "기능 확장" },
  { slug: "time", label: "시간과 생활" },
  { slug: "typechart", label: "전투 규칙" },
  { slug: "title", label: "타이틀" },
];

export function renderSystemTab(host: HTMLElement, rerender: () => void = () => undefined): void {
  const project = store.getCurrent();
  const titleScreen = project.system.titleScreen ?? defaultTitleScreenSettings();
  const titleBackgroundResourceId = titleScreen.backgroundResourceId ?? project.system.titleResourceId;
  const form = el("section", { class: "db-detail-form db-system-form", dataset: { testid: "db-detail-form" } });

  // 섹션 전환은 로컬 상태(host.dataset)만 갱신한다 — store.update/스냅샷을 건드리지 않아
  // undo 이력이 오염되지 않는다. 전체 재렌더(updateSystem 경로)에서도 host 는 유지되므로
  // 활성 섹션이 초기 파티로 되돌아가지 않는다.
  const activeSlug = readActiveSystemSection(host);
  const sections = systemSectionNodes(project, titleScreen, titleBackgroundResourceId, rerender, activeSlug);
  const sectionHost = el("div", { class: "db-system-sections", dataset: { testid: "db-system-sections" } });
  for (const { slug } of SYSTEM_SECTION_ORDER) sectionHost.append(sections[slug]);
  const nav = systemSectionNav(activeSlug, host, sectionHost);

  form.append(nav, sectionHost);
  wireSystemStudioOverview(form);
  host.append(el("h3", { text: "시스템" }), form);
}

function readActiveSystemSection(host: HTMLElement): SystemSectionSlug {
  const stored = host.dataset.dbSystemSection;
  return SYSTEM_SECTION_ORDER.some((section) => section.slug === stored) ? (stored as SystemSectionSlug) : "overview";
}

function systemSectionNav(activeSlug: SystemSectionSlug, host: HTMLElement, sectionHost: HTMLElement): HTMLElement {
  const nav = el("nav", {
    class: "db-system-section-nav",
    dataset: { testid: "db-system-section-nav" },
    attrs: { "aria-label": "시스템 설정 섹션" },
  });
  for (const { slug, label } of SYSTEM_SECTION_ORDER) {
    nav.append(
      el("button", {
        class: `db-system-section-nav${slug === activeSlug ? " active" : ""}`,
        text: label,
        attrs: { type: "button", ...(slug === activeSlug ? { "aria-current": "true" } : {}) },
        dataset: { testid: `db-system-nav-${slug}` },
        on: {
          click: () => {
            activateSystemSection(slug, host, nav, sectionHost);
          },
        },
      }),
    );
  }
  return nav;
}

/** 섹션 전환 핸들러 — DOM 토글만 수행하며 store.update/스냅샷을 만들지 않는다. */
function activateSystemSection(slug: SystemSectionSlug, host: HTMLElement, nav: HTMLElement, sectionHost: HTMLElement): void {
  if (host.dataset.dbSystemSection === slug) return;
  host.dataset.dbSystemSection = slug;
  for (const button of Array.from(nav.querySelectorAll<HTMLElement>(".db-system-section-nav"))) {
    const isActive = button.dataset.testid === `db-system-nav-${slug}`;
    button.classList.toggle("active", isActive);
    if (isActive) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  }
  for (const section of Array.from(sectionHost.querySelectorAll<HTMLElement>(".db-system-section"))) {
    section.hidden = section.dataset.systemSection !== slug;
  }
}

/**
 * 시스템 탭의 7개 섹션을 모두 마운트하고 비활성 섹션만 [hidden] 처리한다.
 * 모든 섹션이 DOM 에 존재하므로 기존 testid 조회(databaseSystemView.test.ts)가
 * 섹션 상태와 무관하게 그대로 동작한다.
 */
function systemSectionNodes(
  project: Project,
  titleScreen: TitleScreenSettings,
  titleBackgroundResourceId: string | undefined,
  rerender: () => void,
  activeSlug: SystemSectionSlug,
): Record<SystemSectionSlug, HTMLElement> {
  const section = (slug: SystemSectionSlug, children: readonly HTMLElement[]): HTMLElement => {
    const node = el("div", { class: "db-system-section", dataset: { systemSection: slug }, children });
    node.hidden = slug !== activeSlug;
    return node;
  };
  return {
    overview: section("overview", [renderSystemStudioOverview(project)]),
    party: section("party", [
      rm2k3Fieldset("초기 파티", [
        startPartyFaceStrip(project.system.startActorIds, project.database.actors),
        ...startPartySlots(project.system.startActorIds, project.database.actors, rerender),
      ]),
    ]),
    display: section("display", [playResolutionFieldset(project.system, rerender)]),
    resources: section("resources", [
      rm2k3Fieldset("리소스", [
        resourcePickerControl({
          label: "타이틀 리소스",
          resourceId: project.system.titleResourceId,
          kind: "title",
          testid: "db-field-title-resource",
          allowClear: true,
          dialogTitle: "타이틀 그래픽",
          onChange: (result) => {
            const resourceId = emptyToUndefined(result.resourceId);
            updateSystem((draft) => {
              draft.system.titleResourceId = resourceId;
              draft.system.titleScreen ??= defaultTitleScreenSettings();
              draft.system.titleScreen.backgroundResourceId = resourceId;
            });
          },
          rerender,
        }),
        resourcePickerControl({
          label: "시스템 리소스",
          resourceId: project.system.systemResourceId,
          kind: "system",
          testid: "db-field-system-resource",
          allowClear: true,
          dialogTitle: "시스템 그래픽",
          onChange: (result) => {
            updateSystem((draft) => {
              draft.system.systemResourceId = emptyToUndefined(result.resourceId);
            });
          },
          rerender,
        }),
        resourcePickerControl({
          label: "전투 시스템 리소스",
          resourceId: project.system.battleSystemResourceId,
          kind: "system2",
          testid: "db-field-battle-system-resource",
          allowClear: true,
          dialogTitle: "전투 시스템 그래픽",
          onChange: (result) => {
            updateSystem((draft) => {
              draft.system.battleSystemResourceId = emptyToUndefined(result.resourceId);
            });
          },
          rerender,
        }),
        el("div", {
          class: "db-system-resource-actions",
          children: [
            el("button", {
              class: "btn small",
              text: "미리보기 갱신",
              attrs: { type: "button" },
              dataset: { testid: "db-system-refresh-previews" },
              on: { click: () => rerender() },
            }),
          ],
        }),
      ]),
    ]),
    startup: section("startup", [
      rm2k3Fieldset("시작 설정", [
        selectField("초기 적 그룹", "db-picker-system-initial-troop", project.system.initialTroopId ?? "", project.database.troops, (value) => {
          updateSystem((draft) => {
            draft.system.initialTroopId = emptyToUndefined(value);
          });
        }),
        selectLiteral(
          "전투 흐름",
          "db-field-system-battle-flow",
          project.system.battleFlow === "strict" ? "strict" : "gauge",
          BATTLE_FLOW_OPTIONS,
          (value) => {
            updateSystem((draft) => {
              draft.system.battleFlow = value;
            });
          },
        ),
        field("전투 UI 스타일", (() => {
          // literalLabel 스위치에는 스킨 라벨이 없으므로 레지스트리 라벨로 직접 빌드한다.
          const select = el("select", { dataset: { testid: "db-field-system-battle-ui-style" } });
          for (const id of BATTLE_UI_STYLE_OPTIONS) {
            select.append(el("option", { text: BATTLE_SKINS[id].label, attrs: { value: id } }));
          }
          select.value = resolveSkinId(project.system.battleUiStyle);
          select.addEventListener("change", () => {
            updateSystem((draft) => {
              draft.system.battleUiStyle = select.value as (typeof BATTLE_UI_STYLE_OPTIONS)[number];
            });
          });
          return select;
        })()),
        field("배틀 모델", (() => {
          // 전투 규칙 엔진 선택. rm2k3(기본/생략) 또는 gen1(포켓몬 레드 스타일).
          // 기본은 JSON 에 생략하고 gen1 만 보존한다(normalizeSystemRecords 와 동일 계약).
          // Gen1 규칙 엔진은 아직 미구현이다(데미지 공식·상태·포획은 계획서 task 2+). 현재 gen1 을
          // 골라도 바뀌는 것은 magical 속성의 mind 방어 라우팅과 body[data-battle-model] 뿐이므로,
          // 완성된 모드처럼 보이지 않게 라벨에 명시한다.
          const select = el("select", {
            dataset: { testid: "db-field-system-battle-model" },
            attrs: { title: "Gen1 규칙 엔진은 구현 중입니다. 현재는 마법 속성의 마법방어 적용만 달라집니다." },
          });
          select.append(
            el("option", { text: "RM2k3 (기본)", attrs: { value: "rm2k3" } }),
            el("option", { text: "Gen1 (포켓몬 레드 스타일 · 구현 중)", attrs: { value: "gen1" } }),
          );
          select.value = project.system.battleModel === "gen1" ? "gen1" : "rm2k3";
          select.addEventListener("change", () => {
            updateSystem((draft) => {
              if (select.value === "gen1") draft.system.battleModel = "gen1";
              else delete draft.system.battleModel;
            });
          });
          return select;
        })()),
        numberField("기본 참전 수", "db-field-system-active-slots", project.system.activeSlots ?? 0, (value) => {
          updateSystem((draft) => {
            draft.system.activeSlots = optionalPositiveInteger(value);
          }, "system:active-slots");
        }),
        checkboxField("몬스터 수집", "db-field-system-monster-collection", project.system.monsterCollection === true, (checked) => {
          updateSystem((draft) => {
            if (checked) draft.system.monsterCollection = true;
            else delete draft.system.monsterCollection;
          });
        }),
        checkboxField("몬스터 파티 전투", "db-field-system-monster-battle-party", project.system.monsterBattleParty === true, (checked) => {
          updateSystem((draft) => {
            if (checked) draft.system.monsterBattleParty = true;
            else delete draft.system.monsterBattleParty;
          });
        }),
        checkboxField("선물 시스템", "db-field-system-gift-system", project.system.giftSystem === true, (checked) => {
          updateSystem((draft) => {
            if (checked) draft.system.giftSystem = true;
            else delete draft.system.giftSystem;
          });
        }),
        checkboxField(
          "참전 보상만",
          "db-field-system-reward-participation-only",
          project.system.rewardPolicy?.participationOnly === true,
          (checked) => {
            updateSystem((draft) => {
              draft.system.rewardPolicy = nextRewardPolicy(draft.system.rewardPolicy, { participationOnly: checked });
            });
          },
        ),
        checkboxField(
          "레벨 격차 패널티",
          "db-field-system-reward-level-gap",
          project.system.rewardPolicy?.levelGapPenalty === true,
          (checked) => {
            updateSystem((draft) => {
              draft.system.rewardPolicy = nextRewardPolicy(draft.system.rewardPolicy, { levelGapPenalty: checked });
            });
          },
        ),
      ]),
    ]),
    optin: section("optin", [rm2k3Fieldset("옵트인 시스템", optInSystemFields(project, rerender))]),
    time: section("time", [timeSystemFieldset(project.system.timeSystem, project.commonEvents, rerender)]),
    typechart: section("typechart", [typeChartFieldset(project.system.typeChart, rerender)]),
    title: section("title", [
      rm2k3Fieldset("게임 시작화면", [
        el("div", {
          class: "db-title-workbench",
          dataset: { testid: "db-title-workbench" },
          children: [
            el("div", {
              class: "db-title-workbench-fields",
              children: [
                titleScreenDisplayFieldset(titleScreen, titleBackgroundResourceId, project.system.titleResourceId, rerender),
                titleScreenAudioFieldset(titleScreen, rerender),
                titleScreenMenuFieldset(titleScreen, rerender),
                titleScreenEffectsFieldset(titleScreen, rerender),
              ],
            }),
            titleScreenWorkbenchPreview(project, titleScreen, titleBackgroundResourceId),
          ],
        }),
      ]),
      rm2k3Fieldset("그래픽 미리보기", [
        systemPreviewWell("타이틀", project.system.titleResourceId),
        systemPreviewWell("시작화면", titleBackgroundResourceId),
        systemPreviewWell("시스템", project.system.systemResourceId),
        systemPreviewWell("전투", project.system.battleSystemResourceId),
      ]),
    ]),
  };
}

/**
 * 옵트인 시스템 토글 + 배열 개수 표시. 편집이 아닌 "켰는데 비어 있다"를 보이게 하는 것이 목적.
 * 배열 편집은 각자의 전용 DB 탭/도구가 담당한다.
 */
function playResolutionFieldset(system: SystemRecords, rerender: () => void): HTMLElement {
  const resolution = resolvePlayResolution(system);
  const preset = playResolutionPreset(resolution);
  const presetSelect = el("select", { dataset: { testid: "db-field-system-resolution-preset" } }) as HTMLSelectElement;
  const labels: Record<PlayResolutionPreset, string> = {
    "320x240": "320 × 240 · 클래식 4:3",
    "426x240": "426 × 240 · 와이드 16:9",
    "640x360": "640 × 360 · 와이드",
    "640x480": "640 × 480 · 확장 4:3",
    custom: "직접 입력",
  };
  for (const value of PLAY_RESOLUTION_PRESETS) {
    presetSelect.append(el("option", { text: labels[value], attrs: { value } }));
  }
  presetSelect.value = preset;
  presetSelect.addEventListener("change", () => {
    const next = presetResolution(presetSelect.value as PlayResolutionPreset);
    if (!next) return;
    updateSystem((draft) => storePlayResolution(draft.system, next));
    rerender();
  });

  return rm2k3Fieldset("게임 화면 해상도", [
    el("p", {
      class: "db-system-resolution-help",
      text: "플레이 화면이 보여 주는 논리 영역입니다. 값이 커질수록 한 화면에 더 넓은 맵이 보이며, 다음 테스트 플레이부터 적용됩니다.",
      dataset: { testid: "db-system-resolution-help" },
    }),
    field("빠른 선택", presetSelect),
    numberField("가로", "db-field-system-resolution-width", resolution.width, (value) => {
      updateSystem((draft) => {
        const current = resolvePlayResolution(draft.system);
        storePlayResolution(draft.system, { width: value, height: current.height });
      }, "system:play-resolution:width");
      rerender();
    }),
    numberField("세로", "db-field-system-resolution-height", resolution.height, (value) => {
      updateSystem((draft) => {
        const current = resolvePlayResolution(draft.system);
        storePlayResolution(draft.system, { width: current.width, height: value });
      }, "system:play-resolution:height");
      rerender();
    }),
    el("div", {
      class: "db-field db-field-readonly",
      children: [
        el("span", { text: "허용 범위" }),
        el("code", {
          text: `${PLAY_RESOLUTION_LIMITS.minWidth}–${PLAY_RESOLUTION_LIMITS.maxWidth} × ${PLAY_RESOLUTION_LIMITS.minHeight}–${PLAY_RESOLUTION_LIMITS.maxHeight}`,
        }),
      ],
    }),
  ]);
}

function playResolutionPreset(resolution: Readonly<PlayResolution>): PlayResolutionPreset {
  const value = `${resolution.width}x${resolution.height}`;
  return PLAY_RESOLUTION_PRESETS.includes(value as PlayResolutionPreset)
    ? value as PlayResolutionPreset
    : "custom";
}

function presetResolution(preset: PlayResolutionPreset): PlayResolution | undefined {
  if (preset === "custom") return undefined;
  const [width, height] = preset.split("x").map(Number);
  return { width, height };
}

function storePlayResolution(system: SystemRecords, value: PlayResolution): void {
  const normalized = normalizePlayResolution(value);
  if (normalized) system.playResolution = normalized;
  else delete system.playResolution;
}

function optInSystemFields(project: Project, rerender: () => void): readonly HTMLElement[] {
  const { system } = project;
  const fields: HTMLElement[] = [
    checkboxField("생활 스킬 레벨링", "db-field-system-skill-system", system.skillSystem?.enabled === true, (checked) => {
      updateSystem((draft) => {
        draft.system.skillSystem = { enabled: checked };
      });
    }),
    checkboxField("액션 전투", "db-field-system-action-combat", system.actionCombat?.enabled === true, (checked) => {
      updateSystem((draft) => {
        if (checked) {
          draft.system.actionCombat = {
            enabled: true,
            ...(draft.system.actionCombat ?? {}),
          };
        } else {
          if (draft.system.actionCombat) draft.system.actionCombat.enabled = false;
          else draft.system.actionCombat = { enabled: false };
        }
      });
    }),
  ];

  // 액션 전투 상세 필드 (활성일 때만)
  if (system.actionCombat?.enabled === true) {
    fields.push(
      numberField("피격 무적(ms)", "db-field-system-action-combat-iframes", system.actionCombat.playerIframesMs ?? 800, (value) => {
        updateSystem((draft) => {
          draft.system.actionCombat ??= { enabled: true };
          draft.system.actionCombat.playerIframesMs = value;
        });
      }),
      numberField("스윙 쿨다운(ms)", "db-field-system-action-combat-swing-cooldown", system.actionCombat.swingCooldownMs ?? 350, (value) => {
        updateSystem((draft) => {
          draft.system.actionCombat ??= { enabled: true };
          draft.system.actionCombat.swingCooldownMs = value;
        });
      }),
      numberField("스윙 데미지 가산", "db-field-system-action-combat-swing-bonus", system.actionCombat.swingDamageBonus ?? 0, (value) => {
        updateSystem((draft) => {
          draft.system.actionCombat ??= { enabled: true };
          draft.system.actionCombat.swingDamageBonus = value;
        });
      }),
    );
  }

  // 몬스터 돌봄 number fields
  if (system.monsterCare) {
    fields.push(
      numberField("돌봄 걸음/tick", "db-field-system-monster-care-steps", system.monsterCare.stepsPerTick ?? 50, (value) => {
        updateSystem((draft) => {
          draft.system.monsterCare ??= { stepsPerTick: 50, walkFriendship: 1, walkExp: 1, dailyCareCap: 30 };
          draft.system.monsterCare.stepsPerTick = value;
        });
      }),
      numberField("산책 호감도", "db-field-system-monster-care-walk-friendship", system.monsterCare.walkFriendship ?? 1, (value) => {
        updateSystem((draft) => {
          draft.system.monsterCare ??= { stepsPerTick: 50, walkFriendship: 1, walkExp: 1, dailyCareCap: 30 };
          draft.system.monsterCare.walkFriendship = value;
        });
      }),
      numberField("산책 경험치", "db-field-system-monster-care-walk-exp", system.monsterCare.walkExp ?? 1, (value) => {
        updateSystem((draft) => {
          draft.system.monsterCare ??= { stepsPerTick: 50, walkFriendship: 1, walkExp: 1, dailyCareCap: 30 };
          draft.system.monsterCare.walkExp = value;
        });
      }),
      numberField("일일 돌봄 상한", "db-field-system-monster-care-daily-cap", system.monsterCare.dailyCareCap ?? 30, (value) => {
        updateSystem((draft) => {
          draft.system.monsterCare ??= { stepsPerTick: 50, walkFriendship: 1, walkExp: 1, dailyCareCap: 30 };
          draft.system.monsterCare.dailyCareCap = value;
        });
      }),
    );
  }

  // 배열 개수 읽기 전용 표시
  const toolActionsCount = (system.toolActions ?? []).length;
  const craftRecipesCount = (system.craftRecipes ?? []).length;
  const itemUpgradesCount = (system.itemUpgrades ?? []).length;
  const sellPricesCount = (system.sellPrices ?? []).length;
  fields.push(
    el("div", { class: "db-field db-field-readonly", children: [
      el("span", { text: `도구 규칙: ${toolActionsCount}개` }),
    ] }),
    el("div", { class: "db-field db-field-readonly", children: [
      el("span", { text: `제작 레시피: ${craftRecipesCount}개` }),
    ] }),
    el("div", { class: "db-field db-field-readonly", children: [
      el("span", { text: `업그레이드 규칙: ${itemUpgradesCount}개` }),
    ] }),
    el("div", { class: "db-field db-field-readonly", children: [
      el("span", { text: `판매 가격 재정의: ${sellPricesCount}개` }),
    ] }),
  );

  void rerender;
  return fields;
}

function startPartySlots(
  startActorIds: readonly string[],
  actors: readonly { readonly id: string; readonly name: string }[],
  rerender: () => void,
): HTMLElement[] {
  const slots: HTMLElement[] = [];
  for (let index = 0; index < START_PARTY_SLOTS; index += 1) {
    const value = startActorIds[index] ?? "";
    // 첫 슬롯은 레거시 단일 피커 testid(`db-picker-system-start-actor`)를 유지한다.
    const testid = index === 0 ? "db-picker-system-start-actor" : `db-picker-system-start-actor-${index + 1}`;
    slots.push(
      selectField(`멤버 ${index + 1}`, testid, value, actors, (next) => {
        updateSystem((draft) => {
          const nextSlots = Array.from({ length: START_PARTY_SLOTS }, (_, slot) => draft.system.startActorIds[slot] ?? "");
          nextSlots[index] = next;
          const party = nextSlots.filter((id) => id.length > 0);
          draft.system.startActorIds = party;
          draft.session.partyActorIds = [...party];
        });
        rerender();
      }),
    );
  }
  return slots;
}

function startPartyFaceStrip(startActorIds: readonly string[], actors: readonly ActorRecord[]): HTMLElement {
  const project = store.getCurrent();
  const faces = Array.from({ length: START_PARTY_SLOTS }, (_, index) => {
    const actorId = startActorIds[index];
    const actor = actorId ? actors.find((entry) => entry.id === actorId) : undefined;
    if (!actor?.faceResourceId) {
      return el("span", {
        class: "db-system-party-face empty",
        attrs: { "aria-label": `파티 슬롯 ${index + 1} 비어 있음` },
      });
    }
    const url = resolveAssetResourceUrl(actor.faceResourceId, { project });
    if (!url) {
      return el("span", { class: "db-system-party-face empty", attrs: { "aria-label": actor.name } });
    }
    const faceIndex = actor.faceIndex ?? 0;
    const column = faceIndex % FACESET_COLUMNS;
    const row = Math.floor(faceIndex / FACESET_COLUMNS);
    const scale = 40 / FACESET_FACE_WIDTH;
    return el("span", {
      class: "db-system-party-face",
      attrs: {
        "aria-label": actor.name,
        role: "img",
        title: actor.name,
        style: [
          `background-image:url("${url}")`,
          `background-position:-${column * FACESET_FACE_WIDTH * scale}px -${row * FACESET_FACE_HEIGHT * scale}px`,
          `background-size:${FACESET_COLUMNS * FACESET_FACE_WIDTH * scale}px ${FACESET_ROWS * FACESET_FACE_HEIGHT * scale}px`,
        ].join(";"),
      },
    });
  });
  return el("div", {
    class: "db-system-party-face-strip",
    dataset: { testid: "db-system-party-face-strip" },
    children: faces,
  });
}

function timeSystemFieldset(
  timeSystem: ReturnType<typeof normalizeTimeSystemConfig>,
  commonEvents: readonly { readonly id: string; readonly name: string }[],
  rerender: () => void,
): HTMLElement {
  const enabled = timeSystem?.enabled === true;
  const children: HTMLElement[] = [
    checkboxField("시간/달력 사용", "db-field-system-time-enabled", enabled, (checked) => {
      updateSystem((draft) => {
        if (!checked) {
          delete draft.system.timeSystem;
          return;
        }
        draft.system.timeSystem = normalizeTimeSystemConfig({
          enabled: true,
          minutesPerRealSecond: draft.system.timeSystem?.minutesPerRealSecond ?? DEFAULT_TIME_MINUTES_PER_REAL_SECOND,
          dayStartHour: draft.system.timeSystem?.dayStartHour ?? DEFAULT_DAY_START_HOUR,
          dayEndHour: draft.system.timeSystem?.dayEndHour ?? DEFAULT_DAY_END_HOUR,
          forceSleep: draft.system.timeSystem?.forceSleep === true,
          onDayEnd: draft.system.timeSystem?.onDayEnd,
        });
      });
      rerender();
    }),
  ];
  if (enabled && timeSystem) {
    children.push(
      numberField("분/초 배속", "db-field-system-time-minutes-per-second", timeSystem.minutesPerRealSecond ?? DEFAULT_TIME_MINUTES_PER_REAL_SECOND, (value) => {
        updateSystem((draft) => {
          draft.system.timeSystem = normalizeTimeSystemConfig({
            ...draft.system.timeSystem,
            enabled: true,
            minutesPerRealSecond: Number.isFinite(value) && value > 0 ? value : DEFAULT_TIME_MINUTES_PER_REAL_SECOND,
          });
        }, "system:time:minutes-per-second");
      }),
      numberField("하루 시작 시", "db-field-system-time-day-start", timeSystem.dayStartHour ?? DEFAULT_DAY_START_HOUR, (value) => {
        updateSystem((draft) => {
          draft.system.timeSystem = normalizeTimeSystemConfig({
            ...draft.system.timeSystem,
            enabled: true,
            dayStartHour: Number.isFinite(value) ? Math.trunc(value) : DEFAULT_DAY_START_HOUR,
          });
        }, "system:time:day-start");
      }),
      numberField("하루 종료 시", "db-field-system-time-day-end", timeSystem.dayEndHour ?? DEFAULT_DAY_END_HOUR, (value) => {
        updateSystem((draft) => {
          draft.system.timeSystem = normalizeTimeSystemConfig({
            ...draft.system.timeSystem,
            enabled: true,
            dayEndHour: Number.isFinite(value) ? Math.trunc(value) : DEFAULT_DAY_END_HOUR,
          });
        }, "system:time:day-end");
      }),
      checkboxField("종료 시 강제 취침", "db-field-system-time-force-sleep", timeSystem.forceSleep === true, (checked) => {
        updateSystem((draft) => {
          draft.system.timeSystem = normalizeTimeSystemConfig({
            ...draft.system.timeSystem,
            enabled: true,
            forceSleep: checked,
          });
        });
      }),
      selectField("하루 종료 공통 이벤트", "db-picker-system-time-on-day-end", timeSystem.onDayEnd ?? "", commonEvents, (value) => {
        updateSystem((draft) => {
          draft.system.timeSystem = normalizeTimeSystemConfig({
            ...draft.system.timeSystem,
            enabled: true,
            onDayEnd: emptyToUndefined(value),
          });
        });
      }),
    );
  }
  return rm2k3Fieldset("시간 시스템", children);
}

function typeChartFieldset(chart: TypeChartRecord | undefined, rerender: () => void): HTMLElement {
  const types = chart?.types ?? [];
  const typeInput = el("input", {
    attrs: { type: "text", placeholder: "불, 물, 풀 — 또는 fire, water, grass" },
    value: types.join(", "),
    dataset: { testid: "db-field-system-type-chart-types" },
  }) as HTMLInputElement;
  typeInput.addEventListener("change", () => {
    const nextTypes = parseTypes(typeInput.value);
    if (types.length > 0 && nextTypes.length === 0) {
      const ok = globalThis.confirm(
        "타입 목록을 비우면 상성표 전체가 삭제되고, 타입 배율은 전부 1배가 됩니다. 비울까요?"
      );
      if (!ok) {
        typeInput.value = types.join(", ");
        return;
      }
    }
    updateSystem((draft) => {
      const normalized = normalizeTypeChart({ types: nextTypes, multipliers: draft.system.typeChart?.multipliers ?? {} });
      if (normalized) draft.system.typeChart = normalized;
      else delete draft.system.typeChart;
    });
    rerender();
  });
  const children: HTMLElement[] = [
    el("p", {
      class: "db-type-chart-help",
      text: "상성표는 배율을 고치는 표입니다. 칸을 누르면 배율이 바로 바뀝니다. 타입 목록을 비우면 표 전체가 사라집니다.",
      dataset: { testid: "db-type-chart-help" },
    }),
    el("label", { class: "db-field", children: [el("span", { text: "타입 목록" }), typeInput] }),
  ];
  if (types.length > 0) children.push(typeChartMatrix(chart));
  return rm2k3Fieldset("타입 상성", children);
}

/** 타입칩 클릭 사이클 — 0→0.25→0.5→1→1.5→2→3→4 (끝에서 0 으로 wrap). */
const TYPE_CHART_CYCLE = [0, 0.25, 0.5, 1, 1.5, 2, 3, 4] as const;

function typeChartMatrix(chart: TypeChartRecord | undefined): HTMLElement {
  const types = chart?.types ?? [];
  const multipliers = chart?.multipliers ?? {};

  // 대미지 미리보기 배지 — 여기선 타입차트 승수만 표기한다. 등급(RM2k3 elementRates) ×
  // 타입차트 × 장비(elementalDefenseIds) 3중 컴파운딩은 openwiki/editor-database.md B5
  // 문서가 다루며(런타임 elementMultiplierFor), 셀 하나의 예상 배율로 과잉 정밀하게
  // 보여주지 않는다.
  const previewLine = el("span", { class: "db-type-chart-preview-line", text: "칸을 누르면 배율이 바로 바뀝니다" });
  const preview = el("div", {
    class: "db-type-chart-preview",
    dataset: { testid: "db-type-preview" },
    children: [el("span", { class: "db-type-chart-preview-legend", text: "공격→방어" }), previewLine],
  });
  const showPreview = (attacker: string, defender: string, value: number): void => {
    previewLine.textContent = `${attacker} → ${defender} ${formatTypeChartMultiplier(value)}x`;
  };

  // 우클릭 직접 입력 팝오버 — 매트릭스와 함께 1회 생성, contextmenu 시 열고
  // 확인/Escape 시 닫는다. 값은 항상 updateTypeChartCell 경로로 쓴다.
  const popoverInput = el("input", {
    attrs: { type: "number", min: "0", max: "4", step: "0.25" },
    dataset: { testid: "db-type-chart-popover-input" },
  }) as HTMLInputElement;
  const popoverConfirm = el("button", {
    class: "btn small",
    text: "확인",
    attrs: { type: "button" },
    dataset: { testid: "db-type-chart-popover-confirm" },
  }) as HTMLButtonElement;
  const popover = el("div", {
    class: "db-type-chart-popover",
    dataset: { testid: "db-type-chart-popover" },
    children: [popoverInput, popoverConfirm],
  });
  popover.hidden = true;

  let popoverTarget: { readonly chip: HTMLButtonElement; readonly attacker: string; readonly defender: string } | null = null;
  const closePopover = (): void => {
    popover.hidden = true;
    popoverTarget?.chip.focus();
    popoverTarget = null;
  };
  popoverConfirm.addEventListener("click", () => {
    const target = popoverTarget;
    if (!target) return;
    const value = clampTypeChartValue(parseFloat(popoverInput.value));
    updateTypeChartCell(target.attacker, target.defender, value);
    applyChipValue(target.chip, value);
    showPreview(target.attacker, target.defender, value);
    closePopover();
  });
  popoverInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePopover();
    }
  });

  const table = el("table", { class: "db-type-chart-matrix" });
  const head = el("tr", { children: [el("th", { text: "공\\방" }), ...types.map((type) => el("th", { text: type }))] });
  table.append(el("thead", { children: [head] }));
  const body = el("tbody");
  for (const attacker of types) {
    const row = el("tr", { children: [el("th", { text: attacker })] });
    for (const defender of types) {
      const isDiagonal = attacker === defender;
      const value = multipliers[attacker]?.[defender] ?? 1;
      const chip = el("button", {
        class: "db-type-chip",
        attrs: { type: "button" },
        text: formatChipValue(value),
        dataset: {
          testid: `db-type-chart-${attacker}-${defender}`,
          attacker,
          defender,
          value: String(value),
          state: isDiagonal ? "diag" : typeChartState(value),
        },
      }) as HTMLButtonElement;
      if (isDiagonal) chip.disabled = true;
      else {
        chip.addEventListener("click", () => {
          const current = parseFloat(chip.dataset.value ?? "1");
          const next = nextTypeChartCycleValue(current);
          updateTypeChartCell(attacker, defender, next);
          applyChipValue(chip, next);
          showPreview(attacker, defender, next);
        });
        chip.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          popoverInput.value = String(parseFloat(chip.dataset.value ?? "1"));
          popoverTarget = { chip, attacker, defender };
          popover.hidden = false;
          // 칩 근처에 띄운다 — fakeDom 의 getBoundingClientRect 는 0 을 돌려줘도 동작엔 영향 없다.
          const chipRect = chip.getBoundingClientRect();
          const hostRect = popover.parentElement?.getBoundingClientRect();
          popover.style.left = `${chipRect.left - (hostRect?.left ?? 0)}px`;
          popover.style.top = `${chipRect.bottom - (hostRect?.top ?? 0) + 4}px`;
          popoverInput.focus();
        });
        chip.addEventListener("mouseenter", () => {
          showPreview(attacker, defender, parseFloat(chip.dataset.value ?? "1"));
        });
      }
      row.append(el("td", { children: [chip] }));
    }
    body.append(row);
  }
  table.append(body);

  return el("div", {
    class: "db-type-chart-wrap",
    dataset: { testid: "db-type-chart-matrix" },
    children: [preview, table, popover],
  });
}

function nextTypeChartCycleValue(current: number): number {
  const next = TYPE_CHART_CYCLE.find((value) => value > current + 1e-9);
  return next ?? TYPE_CHART_CYCLE[0];
}

function typeChartState(value: number): "up" | "down" | "neutral" {
  if (value > 1) return "up";
  if (value < 1) return "down";
  return "neutral";
}

/** 칩 라벨 — 0.25 / 1.5 / 2 형태(불필요한 .0 생략). */
function formatChipValue(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** 미리보기 라벨 — 2 → "2.0", 1.5 → "1.5", 0.25 → "0.25" (정수에 .0 유지). */
function formatTypeChartMultiplier(value: number): string {
  const text = formatChipValue(value);
  return text.includes(".") ? text : `${text}.0`;
}

function clampTypeChartValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(4, Math.max(0, value));
}

function applyChipValue(chip: HTMLButtonElement, value: number): void {
  chip.dataset.value = String(value);
  chip.dataset.state = typeChartState(value);
  chip.textContent = formatChipValue(value);
}

function updateTypeChartCell(attacker: string, defender: string, value: number): void {
  updateSystem((draft) => {
    const chart = draft.system.typeChart;
    if (!chart) return;
    const multipliers = { ...chart.multipliers, [attacker]: { ...(chart.multipliers[attacker] ?? {}), [defender]: value } };
    const normalized = normalizeTypeChart({ types: chart.types, multipliers });
    if (normalized) draft.system.typeChart = normalized;
  });
}

function parseTypes(value: string): string[] {
  return [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];
}

function updateTitleScreen(mutator: (settings: ReturnType<typeof defaultTitleScreenSettings>) => void, snapshotKey?: string): void {
  updateSystem((draft) => {
    draft.system.titleScreen ??= defaultTitleScreenSettings();
    mutator(draft.system.titleScreen);
  }, snapshotKey);
}

// snapshotKey가 있으면 텍스트/숫자 연속 입력으로 보고 병합 스냅샷(recordCoalescedSnapshot)을,
// 없으면 이산 토글/선택으로 보고 매번 새 스냅샷(recordProjectSnapshot)을 남긴다 — 그래야
// 이 시스템 뷰의 모든 필드에서 Ctrl+Z가 똑같이 동작한다.
function updateSystem(mutator: (draft: ReturnType<typeof store.getCurrent>) => void, snapshotKey?: string): void {
  if (snapshotKey) recordCoalescedSnapshot(`db-utility:${snapshotKey}`);
  else recordProjectSnapshot();
  store.update(mutator, { scope: "system" });
}

function nextRewardPolicy(
  current: { participationOnly?: boolean; levelGapPenalty?: boolean } | undefined,
  patch: { participationOnly?: boolean; levelGapPenalty?: boolean },
): { participationOnly?: boolean; levelGapPenalty?: boolean } | undefined {
  const participationOnly = patch.participationOnly ?? current?.participationOnly === true;
  const levelGapPenalty = patch.levelGapPenalty ?? current?.levelGapPenalty === true;
  if (!participationOnly && !levelGapPenalty) return undefined;
  return {
    ...(participationOnly ? { participationOnly: true } : {}),
    ...(levelGapPenalty ? { levelGapPenalty: true } : {}),
  };
}

function rm2k3Fieldset(title: string, children: readonly HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "oprn-db-fieldset", children: [el("legend", { text: title }), ...children] });
}

function clampStageCoordinate(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.trunc(value)));
}

function optionalPositiveInteger(value: number): number | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.trunc(value);
}

function checkboxField(label: string, testid: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid } }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  return el("label", { class: "db-field", children: [el("span", { text: label }), input] });
}

function systemPreviewWell(label: string, resourceId: string | undefined): HTMLElement {
  const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
  const preview = url
    ? el("img", { attrs: { alt: `${label} 미리보기`, src: url } })
    : el("span", { class: "db-system-preview-empty", text: resourceId ?? "(없음)" });
  return el("div", {
    class: "db-system-preview-well",
    children: [
      el("span", { class: "db-system-preview-label", text: label }),
      el("div", { class: "db-system-preview-frame", children: [preview] }),
      el("code", { text: resourceId ?? "(없음)" }),
    ],
  });
}

function titleScreenDisplayFieldset(
  titleScreen: TitleScreenSettings,
  titleBackgroundResourceId: string | undefined,
  systemTitleResourceId: string | undefined,
  rerender: () => void,
): HTMLElement {
  const presentationMode = titleScreen.titleGraphic?.mode ?? "text";
  const showLogoFields = presentationMode === "graphic" || presentationMode === "both";
  const children: HTMLElement[] = [
    textControl("게임 타이틀", titleScreen.title, (value) => {
      updateTitleScreen((settings) => {
        settings.title = value;
      }, "system:title-screen:title");
      rerender();
    }, "db-field-title-screen-title"),
    selectLiteral(
      "타이틀 표시 방식",
      "db-field-title-screen-presentation",
      presentationMode,
      TITLE_PRESENTATION_MODES,
      (value) => {
        updateTitleScreen((settings) => {
          patchTitleGraphic(settings, { mode: value });
        });
        rerender();
      },
    ),
  ];

  if (showLogoFields) {
    children.push(
      resourcePickerControl({
        label: "타이틀 로고",
        resourceId: titleScreen.titleGraphic?.resourceId,
        kind: "title",
        testid: "db-field-title-screen-logo",
        allowClear: true,
        dialogTitle: "타이틀 로고",
        onChange: (result) => {
          updateTitleScreen((settings) => {
            patchTitleGraphic(settings, { resourceId: emptyToUndefined(result.resourceId) });
          }, "system:title-screen:logo");
        },
        rerender,
      }),
      numberField("로고 X", "db-field-title-screen-logo-x", titleScreen.titleGraphic?.x ?? titleScreen.layout.titleX, (value) => {
        updateTitleScreen((settings) => {
          patchTitleGraphic(settings, { x: clampStageCoordinate(value, 320) });
        }, "system:title-screen:logo-x");
        rerender();
      }),
      numberField("로고 Y", "db-field-title-screen-logo-y", titleScreen.titleGraphic?.y ?? titleScreen.layout.titleY, (value) => {
        updateTitleScreen((settings) => {
          patchTitleGraphic(settings, { y: clampStageCoordinate(value, 240) });
        }, "system:title-screen:logo-y");
        rerender();
      }),
    );
  }

  children.push(
    resourcePickerControl({
      label: "배경 리소스",
      resourceId: titleBackgroundResourceId,
      kind: "title",
      testid: "db-field-title-screen-background",
      allowClear: true,
      dialogTitle: "타이틀 배경",
      onChange: (result) => {
        // Background writes only touch titleScreen.backgroundResourceId — never clear system.titleResourceId.
        updateTitleScreen((settings) => {
          settings.backgroundResourceId = emptyToUndefined(result.resourceId);
        }, "system:title-screen:background");
      },
      rerender,
    }),
    el("code", {
      class: "db-title-workbench-system-title-id",
      text: `system.titleResourceId: ${systemTitleResourceId ?? "(없음)"}`,
      dataset: { testid: "db-title-workbench-system-title-id" },
    }),
    numberField("타이틀 X", "db-field-title-screen-title-x", titleScreen.layout.titleX, (value) => {
      updateTitleScreen((settings) => {
        settings.layout.titleX = clampStageCoordinate(value, 320);
      }, "system:title-screen:title-x");
      rerender();
    }),
    numberField("타이틀 Y", "db-field-title-screen-title-y", titleScreen.layout.titleY, (value) => {
      updateTitleScreen((settings) => {
        settings.layout.titleY = clampStageCoordinate(value, 240);
      }, "system:title-screen:title-y");
      rerender();
    }),
    numberField("선택지 X", "db-field-title-screen-menu-x", titleScreen.layout.menuX, (value) => {
      updateTitleScreen((settings) => {
        settings.layout.menuX = clampStageCoordinate(value, 320);
      }, "system:title-screen:menu-x");
      rerender();
    }),
    numberField("선택지 Y", "db-field-title-screen-menu-y", titleScreen.layout.menuY, (value) => {
      updateTitleScreen((settings) => {
        settings.layout.menuY = clampStageCoordinate(value, 240);
      }, "system:title-screen:menu-y");
      rerender();
    }),
    checkboxField("조작 힌트 표시", "db-field-title-screen-show-input-hint", titleScreen.showInputHint !== false, (checked) => {
      updateTitleScreen((settings) => {
        settings.showInputHint = checked;
      });
      rerender();
    }),
  );

  return el("fieldset", {
    class: "oprn-db-fieldset db-title-workbench-group",
    dataset: { testid: "db-title-workbench-display" },
    children: [el("legend", { text: "표시" }), ...children],
  });
}

function titleScreenAudioFieldset(titleScreen: TitleScreenSettings, rerender: () => void): HTMLElement {
  return el("fieldset", {
    class: "oprn-db-fieldset db-title-workbench-group",
    dataset: { testid: "db-title-workbench-audio" },
    children: [
      el("legend", { text: "오디오" }),
      resourcePickerControl({
        label: "타이틀 BGM",
        resourceId: titleScreen.musicResourceId,
        kind: "music",
        testid: "db-field-title-screen-music",
        allowClear: true,
        dialogTitle: "타이틀 BGM",
        onChange: (result) => {
          updateTitleScreen((settings) => {
            settings.musicResourceId = emptyToUndefined(result.resourceId);
          }, "system:title-screen:music");
        },
        rerender,
      }),
      resourcePickerControl({
        label: "커서 SE",
        resourceId: titleScreen.sounds?.cursorSeResourceId,
        kind: "sound",
        testid: "db-field-title-screen-se-cursor",
        allowClear: true,
        dialogTitle: "타이틀 커서 SE",
        onChange: (result) => {
          updateTitleScreen((settings) => {
            patchTitleSounds(settings, { cursorSeResourceId: emptyToUndefined(result.resourceId) });
          }, "system:title-screen:se-cursor");
        },
        rerender,
      }),
      resourcePickerControl({
        label: "결정 SE",
        resourceId: titleScreen.sounds?.confirmSeResourceId,
        kind: "sound",
        testid: "db-field-title-screen-se-confirm",
        allowClear: true,
        dialogTitle: "타이틀 결정 SE",
        onChange: (result) => {
          updateTitleScreen((settings) => {
            patchTitleSounds(settings, { confirmSeResourceId: emptyToUndefined(result.resourceId) });
          }, "system:title-screen:se-confirm");
        },
        rerender,
      }),
      resourcePickerControl({
        label: "취소 SE",
        resourceId: titleScreen.sounds?.cancelSeResourceId,
        kind: "sound",
        testid: "db-field-title-screen-se-cancel",
        allowClear: true,
        dialogTitle: "타이틀 취소 SE",
        onChange: (result) => {
          updateTitleScreen((settings) => {
            patchTitleSounds(settings, { cancelSeResourceId: emptyToUndefined(result.resourceId) });
          }, "system:title-screen:se-cancel");
        },
        rerender,
      }),
    ],
  });
}

function titleScreenMenuFieldset(titleScreen: TitleScreenSettings, rerender: () => void): HTMLElement {
  const visibility = titleScreen.menuVisibility ?? {
    newGame: true,
    continueGame: true,
    quit: true,
  };
  return el("fieldset", {
    class: "oprn-db-fieldset db-title-workbench-group",
    dataset: { testid: "db-title-workbench-menu" },
    children: [
      el("legend", { text: "메뉴" }),
      el("div", {
        class: "db-title-menu-option-row",
        dataset: { testid: "db-title-menu-option-new-game" },
        children: [
          textControl("새 게임", titleScreen.menuLabels.newGame, (value) => {
            updateTitleScreen((settings) => {
              settings.menuLabels.newGame = value;
            }, "system:title-screen:menu-new-game");
            rerender();
          }, "db-field-title-screen-new-game"),
          lockedCheckboxField("표시", "db-field-title-screen-visible-new-game", true),
        ],
      }),
      el("div", {
        class: "db-title-menu-option-row",
        dataset: { testid: "db-title-menu-option-continue" },
        children: [
          textControl("이어 하기", titleScreen.menuLabels.continueGame, (value) => {
            updateTitleScreen((settings) => {
              settings.menuLabels.continueGame = value;
            }, "system:title-screen:menu-continue");
            rerender();
          }, "db-field-title-screen-continue"),
          checkboxField("표시", "db-field-title-screen-visible-continue", visibility.continueGame !== false, (checked) => {
            updateTitleScreen((settings) => {
              settings.menuVisibility = {
                newGame: true,
                continueGame: checked,
                quit: settings.menuVisibility?.quit !== false,
                ...(typeof settings.menuVisibility?.resume === "boolean" ? { resume: settings.menuVisibility.resume } : {}),
              };
            });
            rerender();
          }),
        ],
      }),
      el("div", {
        class: "db-title-menu-option-row",
        dataset: { testid: "db-title-menu-option-resume" },
        children: [
          textControl("이어하기(자동 저장)", titleScreen.menuLabels.resume ?? "이어하기", (value) => {
            updateTitleScreen((settings) => {
              settings.menuLabels.resume = value;
            }, "system:title-screen:menu-resume");
            rerender();
          }, "db-field-title-screen-resume"),
          checkboxField("표시", "db-field-title-screen-visible-resume", visibility.resume !== false, (checked) => {
            updateTitleScreen((settings) => {
              settings.menuVisibility = {
                newGame: true,
                continueGame: settings.menuVisibility?.continueGame !== false,
                quit: settings.menuVisibility?.quit !== false,
                resume: checked,
              };
            });
            rerender();
          }),
        ],
      }),
      el("div", {
        class: "db-title-menu-option-row",
        dataset: { testid: "db-title-menu-option-quit" },
        children: [
          textControl("종료", titleScreen.menuLabels.quit, (value) => {
            updateTitleScreen((settings) => {
              settings.menuLabels.quit = value;
            }, "system:title-screen:menu-quit");
            rerender();
          }, "db-field-title-screen-quit"),
          checkboxField("표시", "db-field-title-screen-visible-quit", visibility.quit !== false, (checked) => {
            updateTitleScreen((settings) => {
              settings.menuVisibility = {
                newGame: true,
                continueGame: settings.menuVisibility?.continueGame !== false,
                quit: checked,
                ...(typeof settings.menuVisibility?.resume === "boolean" ? { resume: settings.menuVisibility.resume } : {}),
              };
            });
            rerender();
          }),
        ],
      }),
    ],
  });
}

function lockedCheckboxField(label: string, testid: string, checked: boolean): HTMLElement {
  const input = el("input", {
    attrs: { type: "checkbox", disabled: "true", ...(checked ? { checked: "true" } : {}) },
    dataset: { testid },
  }) as HTMLInputElement;
  input.checked = checked;
  input.disabled = true;
  return el("label", { class: "db-field db-field-locked", children: [el("span", { text: label }), input] });
}

function patchTitleGraphic(
  settings: TitleScreenSettings,
  patch: {
    readonly mode?: TitleScreenTitleMode;
    readonly resourceId?: string | undefined;
    readonly x?: number;
    readonly y?: number;
  },
): void {
  const current = settings.titleGraphic;
  const mode = patch.mode ?? current?.mode ?? "text";
  const resourceId = patch.resourceId !== undefined ? patch.resourceId : current?.resourceId;
  const x = patch.x ?? current?.x ?? settings.layout.titleX;
  const y = patch.y ?? current?.y ?? settings.layout.titleY;
  if (mode === "text" && !resourceId) {
    delete settings.titleGraphic;
    return;
  }
  settings.titleGraphic = {
    mode,
    ...(resourceId ? { resourceId } : {}),
    x: clampStageCoordinate(x, 320),
    y: clampStageCoordinate(y, 240),
  };
}

function patchTitleSounds(
  settings: TitleScreenSettings,
  patch: {
    readonly cursorSeResourceId?: string | undefined;
    readonly confirmSeResourceId?: string | undefined;
    readonly cancelSeResourceId?: string | undefined;
  },
): void {
  const current = settings.sounds ?? {};
  const next = {
    cursorSeResourceId: patch.cursorSeResourceId !== undefined ? patch.cursorSeResourceId : current.cursorSeResourceId,
    confirmSeResourceId: patch.confirmSeResourceId !== undefined ? patch.confirmSeResourceId : current.confirmSeResourceId,
    cancelSeResourceId: patch.cancelSeResourceId !== undefined ? patch.cancelSeResourceId : current.cancelSeResourceId,
  };
  const cleaned = {
    ...(next.cursorSeResourceId ? { cursorSeResourceId: next.cursorSeResourceId } : {}),
    ...(next.confirmSeResourceId ? { confirmSeResourceId: next.confirmSeResourceId } : {}),
    ...(next.cancelSeResourceId ? { cancelSeResourceId: next.cancelSeResourceId } : {}),
  };
  if (Object.keys(cleaned).length === 0) delete settings.sounds;
  else settings.sounds = cleaned;
}

/** 배경 레이어 · 파티클 · 등장 연출 — 데이터 구동 타이틀 연출 3필드셋. */
function titleScreenEffectsFieldset(titleScreen: TitleScreenSettings, rerender: () => void): HTMLElement {
  const layers = titleScreen.backgroundLayers ?? [];
  const layerRows = layers.map((layer, index) => titleLayerRow(layer, index, rerender));
  const addLayer = el("button", {
    class: "btn small",
    text: "레이어 추가",
    attrs: { type: "button", ...(layers.length >= MAX_TITLE_BACKGROUND_LAYERS ? { disabled: "true" } : {}) },
    dataset: { testid: "db-title-layer-add" },
    on: {
      click: () => {
        updateTitleScreen((settings) => {
          const current = settings.backgroundLayers ?? [];
          if (current.length >= MAX_TITLE_BACKGROUND_LAYERS) return;
          // 새 레이어는 항상 유효한 번들 리소스로 시작한다(참조 검증이 error 를 내지 않도록).
          settings.backgroundLayers = [
            ...current,
            { resourceId: settings.backgroundResourceId ?? "oprn-title-field" },
          ];
        });
        rerender();
      },
    },
  });

  const preset = titleScreen.particles?.preset ?? "none";
  const particleControls = [
    selectLiteral(
      "파티클 프리셋",
      "db-field-title-screen-particle-preset",
      preset,
      TITLE_PARTICLE_PRESET_OPTIONS,
      (value) => {
        updateTitleScreen((settings) => {
          if (value === "none") {
            delete settings.particles;
            return;
          }
          settings.particles = {
            preset: value,
            ...(settings.particles?.density !== undefined ? { density: settings.particles.density } : {}),
          };
        });
        rerender();
      },
    ),
    densitySliderField(
      "파티클 밀도",
      "db-field-title-screen-particle-density",
      titleScreen.particles?.density ?? 50,
      preset === "none",
      (value) => {
        updateTitleScreen((settings) => {
          if (!settings.particles) return;
          settings.particles = { ...settings.particles, density: Math.max(0, Math.min(100, Math.trunc(value))) };
        }, "system:title-screen:particle-density");
        rerender();
      },
    ),
  ];

  const introControls = [
    selectLiteral(
      "로고 등장",
      "db-field-title-screen-intro-logo",
      titleScreen.intro?.logo ?? "none",
      TITLE_INTRO_LOGO_OPTIONS,
      (value) => {
        updateTitleScreen((settings) => {
          patchTitleIntro(settings, { logo: value });
        });
        rerender();
      },
    ),
    selectLiteral(
      "메뉴 등장",
      "db-field-title-screen-intro-menu",
      titleScreen.intro?.menu ?? "none",
      TITLE_INTRO_MENU_OPTIONS,
      (value) => {
        updateTitleScreen((settings) => {
          patchTitleIntro(settings, { menu: value });
        });
        rerender();
      },
    ),
    numberField("등장 지연(ms)", "db-field-title-screen-intro-delay", titleScreen.intro?.delayMs ?? 0, (value) => {
      updateTitleScreen((settings) => {
        patchTitleIntro(settings, { delayMs: value });
      }, "system:title-screen:intro-delay");
      rerender();
    }),
    numberField("메뉴 시차(ms)", "db-field-title-screen-intro-stagger", titleScreen.intro?.staggerMs ?? 90, (value) => {
      updateTitleScreen((settings) => {
        patchTitleIntro(settings, { staggerMs: value });
      }, "system:title-screen:intro-stagger");
      rerender();
    }),
  ];

  return el("fieldset", {
    class: "oprn-db-fieldset db-title-workbench-group",
    dataset: { testid: "db-title-workbench-effects" },
    children: [
      el("legend", { text: "연출" }),
      el("div", {
        class: "db-title-effects-layers",
        dataset: { testid: "db-title-effects-layers" },
        children: [...layerRows, addLayer],
      }),
      ...particleControls,
      ...introControls,
    ],
  });
}

function titleLayerRow(layer: TitleBackgroundLayer, index: number, rerender: () => void): HTMLElement {
  return el("div", {
    class: "db-title-layer-row",
    dataset: { testid: `db-title-layer-row-${index}` },
    children: [
      resourcePickerControl({
        label: `레이어 ${index + 1}`,
        resourceId: layer.resourceId,
        kind: "title",
        testid: `db-field-title-screen-layer-${index}`,
        dialogTitle: "배경 레이어",
        onChange: (result) => {
          updateTitleScreen((settings) => {
            patchTitleLayer(settings, index, { resourceId: result.resourceId });
          }, `system:title-screen:layer-${index}`);
        },
        rerender,
      }),
      numberField("스크롤X(px/s)", `db-field-title-screen-layer-${index}-scroll-x`, layer.scrollXPerSec ?? 0, (value) => {
        updateTitleScreen((settings) => {
          patchTitleLayer(settings, index, { scrollXPerSec: value });
        }, `system:title-screen:layer-${index}-scroll-x`);
        rerender();
      }),
      numberField("스크롤Y(px/s)", `db-field-title-screen-layer-${index}-scroll-y`, layer.scrollYPerSec ?? 0, (value) => {
        updateTitleScreen((settings) => {
          patchTitleLayer(settings, index, { scrollYPerSec: value });
        }, `system:title-screen:layer-${index}-scroll-y`);
        rerender();
      }),
      numberField("불투명도(%)", `db-field-title-screen-layer-${index}-opacity`, Math.round((layer.opacity ?? 1) * 100), (value) => {
        updateTitleScreen((settings) => {
          patchTitleLayer(settings, index, { opacityPercent: value });
        }, `system:title-screen:layer-${index}-opacity`);
        rerender();
      }),
      el("button", {
        class: "btn small",
        text: "삭제",
        attrs: { type: "button" },
        dataset: { testid: `db-title-layer-remove-${index}` },
        on: {
          click: () => {
            updateTitleScreen((settings) => {
              const next = [...(settings.backgroundLayers ?? [])];
              next.splice(index, 1);
              if (next.length === 0) delete settings.backgroundLayers;
              else settings.backgroundLayers = next;
            });
            rerender();
          },
        },
      }),
    ],
  });
}

/** normalize 와 같은 규칙(0/기본값 생략, 클램프)으로 레이어 한 장을 갱신한다. */
function patchTitleLayer(
  settings: TitleScreenSettings,
  index: number,
  patch: {
    readonly resourceId?: string;
    readonly scrollXPerSec?: number;
    readonly scrollYPerSec?: number;
    readonly opacityPercent?: number;
  },
): void {
  const layers = [...(settings.backgroundLayers ?? [])];
  const current = layers[index];
  if (!current) return;
  const resourceId = (patch.resourceId ?? current.resourceId).trim();
  if (!resourceId) {
    // 리소스를 비우면 레이어를 지운 것과 같다.
    layers.splice(index, 1);
    if (layers.length === 0) delete settings.backgroundLayers;
    else settings.backgroundLayers = layers;
    return;
  }
  const next: TitleBackgroundLayer = { resourceId };
  const scrollX = patch.scrollXPerSec ?? current.scrollXPerSec;
  if (typeof scrollX === "number" && Number.isFinite(scrollX) && scrollX !== 0) {
    next.scrollXPerSec = Math.max(-480, Math.min(480, scrollX));
  }
  const scrollY = patch.scrollYPerSec ?? current.scrollYPerSec;
  if (typeof scrollY === "number" && Number.isFinite(scrollY) && scrollY !== 0) {
    next.scrollYPerSec = Math.max(-480, Math.min(480, scrollY));
  }
  const opacity = patch.opacityPercent !== undefined ? patch.opacityPercent / 100 : current.opacity;
  if (typeof opacity === "number" && Number.isFinite(opacity) && opacity < 1) {
    next.opacity = Math.max(0, Math.min(1, opacity));
  }
  // UI 에 노출하지 않는 parallax 저작값은 보존한다.
  if (current.parallax !== undefined) next.parallax = current.parallax;
  layers[index] = next;
  settings.backgroundLayers = layers;
}

/** intro 를 normalize 와 같은 규칙(none/무연출이면 필드 생략)으로 갱신한다. */
function patchTitleIntro(
  settings: TitleScreenSettings,
  patch: {
    readonly logo?: TitleIntroLogoAnimation;
    readonly menu?: TitleIntroMenuAnimation;
    readonly delayMs?: number;
    readonly staggerMs?: number;
  },
): void {
  const current = settings.intro ?? {};
  const logo = patch.logo ?? current.logo ?? "none";
  const menu = patch.menu ?? current.menu ?? "none";
  if (logo === "none" && menu === "none") {
    delete settings.intro;
    return;
  }
  const delayMs = patch.delayMs ?? current.delayMs;
  const staggerMs = patch.staggerMs ?? current.staggerMs;
  settings.intro = {
    ...(logo !== "none" ? { logo } : {}),
    ...(menu !== "none" ? { menu } : {}),
    ...(typeof delayMs === "number" && Number.isFinite(delayMs)
      ? { delayMs: Math.max(0, Math.min(10000, Math.trunc(delayMs))) }
      : {}),
    ...(typeof staggerMs === "number" && Number.isFinite(staggerMs)
      ? { staggerMs: Math.max(0, Math.min(2000, Math.trunc(staggerMs))) }
      : {}),
  };
}

function densitySliderField(
  label: string,
  testid: string,
  value: number,
  disabled: boolean,
  onChange: (value: number) => void,
): HTMLElement {
  const input = el("input", {
    attrs: { type: "range", min: "0", max: "100", step: "5", ...(disabled ? { disabled: "true" } : {}) },
    dataset: { testid },
  }) as HTMLInputElement;
  input.value = String(value);
  input.disabled = disabled;
  const valueLabel = el("span", { class: "db-title-density-value", text: String(value) });
  input.addEventListener("input", () => {
    valueLabel.textContent = input.value;
  });
  input.addEventListener("change", () => {
    valueLabel.textContent = input.value;
    onChange(Number(input.value));
  });
  return el("label", { class: "db-field", children: [el("span", { text: label }), input, valueLabel] });
}

function titleScreenWorkbenchPreview(
  project: Project,
  titleScreen: TitleScreenSettings,
  backgroundResourceId: string | undefined,
): HTMLElement {
  const introLogoClass = titleIntroClass("logo", titleScreen.intro);
  const introMenuClass = titleIntroClass("menu", titleScreen.intro);
  const introDelayMs = titleScreen.intro?.delayMs ?? 0;
  const introStaggerMs = titleScreen.intro?.staggerMs ?? 90;

  // 스테이지 전체를 다시 만들면 CSS 애니메이션(레이어 스크롤 시작·등장 연출)이 처음부터
  // 재생된다 — "연출 다시 재생" 버튼이 이 함수를 재호출해 노드를 갈아끼운다.
  const buildStage = (): HTMLElement => {
    const bgUrl = resolveAssetResourceUrl(backgroundResourceId, { project });
    const stage = el("div", {
      class: "db-title-workbench-stage",
      dataset: { testid: "db-title-workbench-stage" },
      attrs: bgUrl
        ? {
            style: [
              `background-image:url("${bgUrl}")`,
              "background-size:100% 100%",
              "background-repeat:no-repeat",
              "background-position:center",
              "image-rendering:pixelated",
            ].join(";"),
          }
        : {},
    });

    // 배경 레이어 + 파티클은 런타임과 **같은 렌더러**(renderTitleFxStack)를 그대로 마운트한다
    // — 에디터 전용 복제가 낡을 수 없다. rAF 는 스테이지 교체 시 canvas 분리로 자체 해제된다.
    const fx = renderTitleFxStack(titleScreen, project, null);
    if (fx) stage.append(fx);

    const presentationMode = titleScreen.titleGraphic?.mode ?? "text";
    const showText = presentationMode === "text" || presentationMode === "both" || !titleScreen.titleGraphic;
    const showLogo = (presentationMode === "graphic" || presentationMode === "both") && !!titleScreen.titleGraphic?.resourceId;

    const appendTitleText = (): void => {
      const titleNode = el("div", {
        class: "db-title-workbench-title",
        text: titleScreen.title || "(제목 없음)",
        dataset: { testid: "db-title-workbench-title-text" },
      });
      titleNode.style.left = `${(titleScreen.layout.titleX / 320) * 100}%`;
      titleNode.style.top = `${(titleScreen.layout.titleY / 240) * 100}%`;
      if (introLogoClass) {
        titleNode.classList.add(introLogoClass);
        if (introDelayMs > 0) titleNode.style.animationDelay = `${introDelayMs}ms`;
      }
      stage.append(titleNode);
    };

    if (showText) appendTitleText();

    if (showLogo && titleScreen.titleGraphic) {
      const logo = titleScreen.titleGraphic;
      const logoUrl = resolveAssetResourceUrl(logo.resourceId, { project });
      const logoNode = el("div", {
        class: "db-title-workbench-logo",
        dataset: {
          testid: "db-title-workbench-logo",
          ...(logo.resourceId ? { titleLogoResource: logo.resourceId } : {}),
        },
        attrs: logoUrl
          ? {
              style: [
                `background-image:url("${logoUrl}")`,
                "background-size:contain",
                "background-repeat:no-repeat",
                "background-position:center",
                "image-rendering:pixelated",
              ].join(";"),
            }
          : {},
      });
      logoNode.style.left = `${(logo.x / 320) * 100}%`;
      logoNode.style.top = `${(logo.y / 240) * 100}%`;
      if (introLogoClass) {
        logoNode.classList.add(introLogoClass);
        if (introDelayMs > 0) logoNode.style.animationDelay = `${introDelayMs}ms`;
      }
      stage.append(logoNode);
    }

    // graphic mode without logo still needs a stable title node for layout tests.
    if (!showText && !showLogo) appendTitleText();

    const visibleOptions = listTitleMenuOptions(titleScreen);
    const menu = el("div", {
      class: "db-title-workbench-menu",
      dataset: { testid: "db-title-workbench-menu-preview" },
      children: visibleOptions.map((option, index) => {
        const item = el("div", {
          class: "db-title-workbench-menu-item",
          text: option.label,
          dataset: { titleMenuOption: option.id },
        });
        if (introMenuClass) {
          item.classList.add(introMenuClass);
          const delay = introDelayMs + index * introStaggerMs;
          if (delay > 0) item.style.animationDelay = `${delay}ms`;
        }
        return item;
      }),
    });
    menu.style.left = `${(titleScreen.layout.menuX / 320) * 100}%`;
    menu.style.top = `${(titleScreen.layout.menuY / 240) * 100}%`;
    stage.append(menu);
    return stage;
  };

  let stage = buildStage();
  const replay = el("button", {
    class: "btn small",
    text: "연출 다시 재생",
    attrs: { type: "button" },
    dataset: { testid: "db-title-fx-replay" },
    on: {
      click: () => {
        const next = buildStage();
        stage.replaceWith(next);
        stage = next;
      },
    },
  });

  const musicId = titleScreen.musicResourceId;
  const play = el("button", {
    class: "btn small",
    text: "BGM 재생",
    attrs: { type: "button", ...(musicId ? {} : { disabled: "true" }) },
    dataset: { testid: "db-title-bgm-play" },
    on: {
      click: () => {
        if (!musicId) return;
        playAudioCommand({ resourceId: musicId, loop: true }, project);
      },
    },
  });
  const stop = el("button", {
    class: "btn small",
    text: "BGM 정지",
    attrs: { type: "button" },
    dataset: { testid: "db-title-bgm-stop" },
    on: {
      click: () => {
        stopAudioCommand();
      },
    },
  });
  return el("div", {
    class: "db-title-workbench-preview",
    dataset: { testid: "db-title-workbench-preview" },
    children: [
      el("span", { class: "db-title-workbench-preview-label", text: "라이브 프리뷰" }),
      stage,
      el("div", {
        class: "db-title-workbench-audio",
        children: [
          play,
          stop,
          replay,
          el("code", {
            class: "db-title-workbench-music-id",
            text: musicId ?? "(BGM 없음)",
            dataset: { testid: "db-title-workbench-music-id" },
          }),
        ],
      }),
    ],
  });
}
