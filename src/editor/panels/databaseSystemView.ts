import { fieldHudEditor } from "./databaseFieldHud";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { GUARD_MAX_DAMAGE_REDUCTION_PERCENT } from "@/battle/action/guard";
import { BATTLE_SKINS, isDeprecatedBattleSkin, listActiveBattleSkinIds, listBattleSkinIds, resolveSkinId } from "@/battle/skins/registry";
import {
  emptyToUndefined,
  field,
  numberField as baseNumberField,
  selectField,
  selectLiteral,
  textControl,
} from "@/editor/panels/databaseControls";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { resourcePickerControl as baseResourcePickerControl, listDatabaseResourceOptions } from "@/editor/panels/databaseResourcePickerDialog";
import { sectionCard } from "@/editor/panels/databaseWorkspace";
import { recordListThumbnail, markDatabaseImageFailed } from "@/editor/panels/databaseRecordThumbnails";
import { renderSystemStudioOverview, wireSystemStudioOverview } from "@/editor/panels/databaseSystemStudio";
import { dialogueStyleSection } from "@/editor/panels/databaseDialogueStyleSection";
import {
  DEFAULT_DODGE_IFRAMES_MS,
  DEFAULT_DODGE_STAMINA_COST,
  DEFAULT_GUARD_DAMAGE_REDUCTION_PERCENT,
  DEFAULT_GUARD_STAMINA_DRAIN_PER_SEC,
  DEFAULT_PLAYER_IFRAMES_MS,
  DEFAULT_SWING_COOLDOWN_MS,
  normalizeActionCombatConfig,
} from "@/project/actionCombat";
import { MAX_TITLE_BACKGROUND_LAYERS, normalizeMonsterCare, normalizeTimeSystemConfig, normalizeTypeChart } from "@/project/databaseRecordModel";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import {
  DEFAULT_DAY_END_HOUR,
  DEFAULT_DAY_START_HOUR,
  DEFAULT_DAYS_PER_SEASON,
  MIN_DAYS_PER_SEASON,
  MAX_DAYS_PER_SEASON,
  DEFAULT_TIME_MINUTES_PER_REAL_SECOND,
} from "@/project/gameTime";
import {
  DEFAULT_FONT_SELECTION,
  FONT_ROLE_LABELS,
  FONT_ROLES,
  fontOptionsForRole,
  isFontFamilyId,
  resolveFontSelection,
  resolveFontStack,
  type FontFamilyId,
  type FontRole,
} from "@/project/fontRegistry";
import { store } from "@/project/store";
import type {
  ActionCombatHudConfig,
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
import { DEFAULT_MENU_SKIN_ID, listMenuSkinIds, MENU_SKINS, resolveMenuSkinId } from "@/player/menuSkins/registry";
import type { MenuSkinId } from "@/player/menuSkins/types";
import { calculatePlaySurfaceScale } from "@/player/playSurfaceScale";
import { listTitleMenuOptions, renderTitleEffectsLayer, renderTitleFxStack, titleIntroClass } from "@/player/titleScreen";
import {
  MAX_TITLE_LOGO_SUBTITLE_LENGTH,
  TITLE_EFFECT_LABELS,
  TITLE_OPENING_PRESETS,
  findTitleOpeningPreset,
  titleOpeningPresetEffects,
} from "@/project/titleEffects";
import { applyToolSequenceToStore } from "@/editor/tools/applyChangesetToStore";
import {
  analyzePlayResolution,
  normalizePlayResolution,
  PLAY_RESOLUTION_LIMITS,
  resolvePlayResolution,
} from "@/project/playResolution";
import { CAMERA_ZOOM_LIMITS, resolveCameraZoom, storeCameraZoom } from "@/project/cameraZoom";
import type { PlayResolution, SystemRecords } from "@/project/types";

type SystemRefresh = (kind?: "values" | "effects") => void;
const titleStageRefreshers = new WeakMap<HTMLElement, (kind: "values" | "effects") => void>();
const systemNumberBindings = new WeakMap<HTMLInputElement, () => void>();

const START_PARTY_SLOTS = 4;

const ENEMY_HP_BAR_OPTIONS: readonly { readonly id: string; readonly name: string }[] = [
  { id: "damaged", name: "피해 입은 개체만" },
  { id: "always", name: "항상" },
  { id: "never", name: "숨김" },
];
/** 시작 파티 얼굴 칸 표시 크기(px). 낱장 얼굴 48px 을 그대로 담는다. */
const START_PARTY_FACE_SIZE = 40;
const BATTLE_FLOW_OPTIONS = ["gauge", "strict"] as const satisfies readonly BattleFlow[];
const BATTLE_UI_STYLE_OPTIONS = listBattleSkinIds();
const TITLE_PRESENTATION_MODES = ["text", "graphic", "both"] as const satisfies readonly TitleScreenTitleMode[];
const TITLE_PARTICLE_PRESET_OPTIONS = ["none", "snow", "rain", "fireflies"] as const satisfies readonly ("none" | TitleParticlePreset)[];
const TITLE_INTRO_LOGO_OPTIONS = ["none", "fadeIn", "riseIn"] as const satisfies readonly TitleIntroLogoAnimation[];
const TITLE_INTRO_MENU_OPTIONS = ["none", "fadeIn", "slideUp"] as const satisfies readonly TitleIntroMenuAnimation[];
const PLAY_RESOLUTION_PRESETS = ["320x240", "426x240", "640x360", "640x480", "custom"] as const;
type PlayResolutionPreset = (typeof PLAY_RESOLUTION_PRESETS)[number];

/** 시스템 탭 좌측 섹션 내비 슬러그 — SYSTEM_SECTION_ORDER 순서가 곧 내비 순서. */
export type SystemSectionSlug =
  | "overview"
  | "party"
  | "display"
  | "hud"
  | "menu"
  | "dialogue"
  | "font"
  | "resources"
  | "startup"
  | "optin"
  | "time"
  | "typechart"
  | "title";

type RequestedSystemSection = {
  readonly slug: SystemSectionSlug;
  readonly focusTestId?: string;
};

let requestedSystemSection: RequestedSystemSection | undefined;

/** 다른 탭의 준비 칩이 시스템 탭을 열 때, 개요가 아니라 해당 섹션으로 착지시킨다. */
export function requestSystemSection(slug: SystemSectionSlug, focusTestId?: string): void {
  requestedSystemSection = { slug, focusTestId };
}

export function resetRequestedSystemSection(): void {
  requestedSystemSection = undefined;
}

function consumeRequestedSystemSection(): RequestedSystemSection | undefined {
  const requested = requestedSystemSection;
  requestedSystemSection = undefined;
  return requested;
}

const SYSTEM_SECTION_ORDER: readonly { readonly slug: SystemSectionSlug; readonly label: string }[] = [
  { slug: "overview", label: "개요" },
  { slug: "party", label: "초기 파티" },
  { slug: "display", label: "화면" },
  { slug: "menu", label: "게임 메뉴" },
  { slug: "dialogue", label: "대화창" },
  { slug: "hud", label: "인게임 HUD" },
  { slug: "font", label: "폰트" },
  { slug: "resources", label: "리소스" },
  { slug: "startup", label: "시작 설정" },
  { slug: "optin", label: "기능 확장" },
  { slug: "time", label: "시간" },
  { slug: "typechart", label: "타입 상성" },
  { slug: "title", label: "타이틀" },
];

export function renderSystemTab(host: HTMLElement, rerender: SystemRefresh = () => undefined): void {
  const project = store.getCurrent();
  const titleScreen = project.system.titleScreen ?? defaultTitleScreenSettings();
  const titleBackgroundResourceId = titleScreen.backgroundResourceId ?? project.system.titleResourceId;
  const form = el("section", { class: "db-detail-form db-system-form", dataset: { testid: "db-detail-form" } });

  // 섹션 전환은 로컬 상태(host.dataset)만 갱신한다 — store.update/스냅샷을 건드리지 않아
  // undo 이력이 오염되지 않는다. 전체 재렌더(updateSystem 경로)에서도 host 는 유지되므로
  // 활성 섹션이 초기 파티로 되돌아가지 않는다.
  const requested = consumeRequestedSystemSection();
  if (requested) host.dataset.dbSystemSection = requested.slug;
  const activeSlug = requested?.slug ?? readActiveSystemSection(host);
  host.dataset.dbSystemSection = activeSlug;
  const refresh: SystemRefresh = (kind) => {
    if (kind) {
      refreshSystemDerived(form, kind);
      return;
    }
    const active = document.activeElement;
    const focusId = active instanceof HTMLElement ? active.dataset.testid : undefined;
    const scrollTop = sectionHost.scrollTop;
    const navScroll = nav.scrollLeft;
    rerender();
    const nextSections = host.querySelector<HTMLElement>(".db-system-sections");
    if (nextSections) nextSections.scrollTop = scrollTop;
    const nextNav = host.querySelector<HTMLElement>(".db-system-section-nav");
    if (nextNav) nextNav.scrollLeft = navScroll;
    if (focusId) host.querySelector<HTMLElement>(`[data-testid="${focusId}"]`)?.focus({ preventScroll: true });
  };
  const sections = systemSectionNodes(project, titleScreen, titleBackgroundResourceId, refresh, activeSlug);
  const sectionHost = el("div", { class: "db-system-sections", dataset: { testid: "db-system-sections" } });
  for (const { slug } of SYSTEM_SECTION_ORDER) sectionHost.append(sections[slug]);
  const nav = systemSectionNav(activeSlug, host, sectionHost);

  form.append(nav, sectionHost);
  wireSystemStudioOverview(form);
  host.append(el("h3", { text: "시스템" }), form);
  if (requested?.focusTestId) focusSystemField(form, requested.focusTestId);
}

function readActiveSystemSection(host: HTMLElement): SystemSectionSlug {
  const stored = host.dataset.dbSystemSection;
  return SYSTEM_SECTION_ORDER.some((section) => section.slug === stored) ? (stored as SystemSectionSlug) : "overview";
}

function focusSystemField(root: HTMLElement, testid: string): void {
  const field = root.querySelector(`[data-testid="${testid}"]`);
  if (!(field instanceof HTMLElement)) return;
  if (typeof field.focus === "function") field.focus();
  if (typeof field.scrollIntoView === "function") field.scrollIntoView({ block: "nearest" });
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
        class: `db-system-section-button${slug === activeSlug ? " active" : ""}`,
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
  for (const button of Array.from(nav.querySelectorAll<HTMLElement>(".db-system-section-button"))) {
    const isActive = button.dataset.testid === `db-system-nav-${slug}`;
    button.classList.toggle("active", isActive);
    if (isActive) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  }
  if (slug === "overview") {
    const overview = sectionHost.querySelector<HTMLElement>('[data-system-section="overview"]');
    overview?.replaceChildren(renderSystemStudioOverview(store.getCurrent()));
    if (overview && nav.parentElement) wireSystemStudioOverview(nav.parentElement, overview);
  }
  sectionHost.scrollTop = 0;
  for (const section of Array.from(sectionHost.querySelectorAll<HTMLElement>(".db-system-section"))) {
    section.hidden = section.dataset.systemSection !== slug;
  }
}

/**
 * 시스템 탭의 10개 섹션을 모두 마운트하고 비활성 섹션만 [hidden] 처리한다.
 * 모든 섹션이 DOM 에 존재하므로 기존 testid 조회(databaseSystemView.test.ts)가
 * 섹션 상태와 무관하게 그대로 동작한다.
 */
function systemSectionNodes(
  project: Project,
  titleScreen: TitleScreenSettings,
  titleBackgroundResourceId: string | undefined,
  rerender: SystemRefresh,
  activeSlug: SystemSectionSlug,
): Record<SystemSectionSlug, HTMLElement> {
  const section = (slug: SystemSectionSlug, children: readonly HTMLElement[]): HTMLElement => {
    const label = SYSTEM_SECTION_ORDER.find((entry) => entry.slug === slug)!.label;
    const node = el("div", {
      class: "db-system-section", dataset: { systemSection: slug },
      children: slug === "overview" ? children : [el("header", {
        class: "db-system-panel-heading",
        children: [el("h2", { text: label }), el("p", { text: SYSTEM_SECTION_HELP[slug] })],
      }), ...children],
    });
    node.hidden = slug !== activeSlug;
    return node;
  };
  return {
    overview: section("overview", [renderSystemStudioOverview(project)]),
    party: section("party", [
      rm2k3Fieldset("초기 파티", [
        el("div", {
          class: "db-system-party-roster", dataset: { testid: "db-system-party-face-strip" },
          children: startPartySlots(project.system.startActorIds, project.database.actors, rerender),
        }),
        systemHelp("빈 슬롯을 선택하면 뒤의 멤버가 앞으로 이동합니다. 이 순서는 시작 파티와 플레이 세션에 함께 적용됩니다."),
      ]),
    ]),
    display: section("display", [playResolutionFieldset(project, rerender)]),
    menu: section("menu", [menuSkinFieldset(project)]),
    dialogue: section("dialogue", dialogueStyleSection(project, { updateSystem, fieldset: rm2k3Fieldset, help: systemHelp })),
    hud: section("hud", [fieldHudEditor(project, config => updateSystem(draft => { draft.system.fieldHud = config; }))]),
    font: section("font", [systemFontFieldset(project, rerender)]),
    resources: section("resources", [
      rm2k3Fieldset("공유 그래픽", [
        systemHelp("타이틀 리소스를 바꾸면 시작화면 배경도 함께 바뀝니다. 타이틀의 배경 선택은 이 원본 리소스를 지우지 않습니다."),
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
            systemSectionLink("타이틀 구성 열기", "title", "db-system-resources-open-title"),
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
      rm2k3Fieldset("전투 설정", [
        systemHelp("초기 적 그룹은 선택 사항입니다. 기본 참전 수 0은 규칙 모델에 맞춰 자동으로 정합니다."),
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
          // 지원 스킨은 3종(정면 rm2000 · 측면 rm2003 · 몬스터 대치 pokemon)이다. 저장된 프로젝트가 지원 종료 스킨을 쓰고 있으면 그 항목만 추가로 남겨
          // 저작자가 자기 설정을 보고 유지할 수 있게 한다(암묵 remap 금지).
          const select = el("select", { dataset: { testid: "db-field-system-battle-ui-style" } });
          const savedId = resolveSkinId(project.system.battleUiStyle);
          for (const id of listActiveBattleSkinIds()) {
            select.append(el("option", { text: BATTLE_SKINS[id].label, attrs: { value: id } }));
          }
          if (isDeprecatedBattleSkin(savedId)) {
            select.append(el("option", { text: `${BATTLE_SKINS[savedId].label} (지원 종료)`, attrs: { value: savedId } }));
          }
          select.value = savedId;
          select.addEventListener("change", () => {
            updateSystem((draft) => {
              draft.system.battleUiStyle = select.value as (typeof BATTLE_UI_STYLE_OPTIONS)[number];
            });
          });
          return select;
        })()),
        field("규칙 모델", (() => {
          // 전투 규칙 엔진 선택. rm2k3(기본/생략) 또는 gen1(포켓몬 레드 스타일).
          // 기본은 JSON 에 생략하고 gen1 만 보존한다(normalizeSystemRecords 와 동일 계약).
          // Both supported models route through battle/runtime.ts; skins are a separate choice.
          const select = el("select", {
            dataset: { testid: "db-field-system-battle-model" },
            attrs: { title: "RM식과 Gen1은 대미지·상태·포획 규칙이 다릅니다. 전투 UI 스타일은 별도로 선택합니다." },
          });
          select.append(
            el("option", { text: "RM2k3 (기본)", attrs: { value: "rm2k3" } }),
            el("option", { text: "Gen1 (포켓몬 레드 스타일)", attrs: { value: "gen1" } }),
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
        numberField("기본 참전 수 (0 = 자동)", "db-field-system-active-slots", () => store.getCurrent().system.activeSlots ?? 0, (value) => {
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
      ]),
      rm2k3Fieldset("전투 오디오", [
        resourcePickerControl({
          label: "기본 BGM",
          resourceId: project.system.defaultBgmResourceId,
          kind: "music",
          testid: "db-field-system-default-bgm",
          allowClear: true,
          dialogTitle: "기본 BGM",
          onChange: (result) => {
            updateSystem((draft) => {
              draft.system.defaultBgmResourceId = emptyToUndefined(result.resourceId);
            }, "system:default-bgm");
          },
          rerender,
        }),
        resourcePickerControl({
          label: "전투 BGM",
          resourceId: project.system.battleBgmResourceId,
          kind: "music",
          testid: "db-field-system-battle-bgm",
          allowClear: true,
          dialogTitle: "전투 BGM",
          onChange: (result) => {
            updateSystem((draft) => {
              draft.system.battleBgmResourceId = emptyToUndefined(result.resourceId);
            }, "system:battle-bgm");
          },
          rerender,
        }),
        resourcePickerControl({
          label: "승리 팡파레",
          resourceId: project.system.battleVictoryMeResourceId,
          kind: "music",
          testid: "db-field-system-battle-victory-me",
          allowClear: true,
          dialogTitle: "승리 팡파레",
          onChange: (result) => {
            updateSystem((draft) => {
              draft.system.battleVictoryMeResourceId = emptyToUndefined(result.resourceId);
            }, "system:battle-victory-me");
          },
          rerender,
        }),
        resourcePickerControl({
          label: "패배 SE",
          resourceId: project.system.battleDefeatSeResourceId,
          kind: "sound",
          testid: "db-field-system-battle-defeat-se",
          allowClear: true,
          dialogTitle: "패배 SE",
          onChange: (result) => {
            updateSystem((draft) => {
              draft.system.battleDefeatSeResourceId = emptyToUndefined(result.resourceId);
            }, "system:battle-defeat-se");
          },
          rerender,
        }),
        resourcePickerControl({
          label: "도주 SE",
          resourceId: project.system.battleEscapeSeResourceId,
          kind: "sound",
          testid: "db-field-system-battle-escape-se",
          allowClear: true,
          dialogTitle: "도주 SE",
          onChange: (result) => {
            updateSystem((draft) => {
              draft.system.battleEscapeSeResourceId = emptyToUndefined(result.resourceId);
            }, "system:battle-escape-se");
          },
          rerender,
        }),
      ]),
      rm2k3Fieldset("선물과 전투 보상", [
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
    optin: section("optin", optInSystemFields(project, rerender)),
    time: section("time", [timeSystemFieldset(project.system.timeSystem, project.commonEvents, rerender)]),
    typechart: section("typechart", [typeChartFieldset(project.system.typeChart, rerender)]),
    title: section("title", [
      rm2k3Fieldset("게임 시작화면", [
        el("div", {
          class: "db-title-workbench",
          dataset: { testid: "db-title-workbench" },
          children: [
            titleScreenWorkbenchPreview(titleScreen),
            el("div", {
              class: "db-title-workbench-fields",
              children: [
                titleScreenDisplayFieldset(titleScreen, titleBackgroundResourceId, project.system.titleResourceId, rerender),
                titleScreenMenuFieldset(titleScreen, rerender),
                titleScreenAudioFieldset(titleScreen, rerender),
                titleScreenEffectsFieldset(titleScreen, rerender),
                titleScreenOpeningFieldset(titleScreen, rerender),
              ],
            }),
          ],
        }),
      ]),
      el("details", {
        class: "db-system-graphic-details",
        children: [el("summary", { text: "공유 그래픽 미리보기" }), el("div", {
          class: "db-system-graphic-grid",
          children: [
            systemPreviewWell("타이틀", project.system.titleResourceId),
            systemPreviewWell("시작화면", titleBackgroundResourceId),
            systemPreviewWell("시스템", project.system.systemResourceId),
            systemPreviewWell("전투", project.system.battleSystemResourceId),
          ],
        })],
      }),
    ]),
  };
}

/**
 * 글꼴 선택 — 값은 project.system.fonts 에만 쓴다. CSS 변수 적용은 app/fontTheme.ts 가
 * 스토어 변경마다 다시 하므로 여기서 documentElement 를 건드리지 않는다.
 * 기본값과 같은 선택은 저장하지 않는다 — normalizeSystemRecords 와 같은 규칙이라
 * 에디터 상태와 저장 상태가 어긋나지 않는다.
 */
function systemFontFieldset(project: Project, rerender: SystemRefresh): HTMLElement {
  const selection = resolveFontSelection(project.system.fonts);
  const preview = el("div", {
    class: "db-system-font-preview",
    dataset: { testid: "db-system-font-preview" },
    children: FONT_ROLES.map((role) =>
      el("div", {
        class: "db-system-font-preview-row",
        dataset: { fontRole: role },
        children: [
          fontRoleField(role, selection[role], rerender),
          fontSampleElement(role, selection[role]),
        ],
      }),
    ),
  });


  return rm2k3Fieldset("글꼴", [
    el("p", {
      class: "db-system-font-help",
      text: "에디터 UI · 런타임 픽셀 · 고정폭 글꼴을 각각 고릅니다. 고른 즉시 화면에 적용됩니다.",
    }),
    preview,
    el("div", {
      class: "db-system-font-actions",
      children: [
        el("button", {
          class: "btn small",
          text: "기본값으로",
          attrs: { type: "button" },
          dataset: { testid: "db-system-font-reset" },
          on: {
            click: () => {
              updateSystem((draft) => {
                delete draft.system.fonts;
              });
              rerender();
            },
          },
        }),
      ],
    }),
  ]);
}

function fontSampleElement(role: FontRole, id: FontFamilyId): HTMLElement {
  const sample = el("span", {
    class: "db-system-font-preview-sample",
    text: "새로운 모험을 시작합니다 · Adventure awaits · 0123456789",
    dataset: { testid: `db-system-font-sample-${role}`, fontId: id },
  });
  sample.style.fontFamily = resolveFontStack(id);
  return sample;
}

function fontRoleField(
  role: FontRole,
  current: FontFamilyId,
  rerender: SystemRefresh,
): HTMLElement {
  const select = el("select", { dataset: { testid: `db-field-system-font-${role}` } }) as HTMLSelectElement;
  for (const definition of fontOptionsForRole(role)) {
    select.append(el("option", { text: definition.label, attrs: { value: definition.id } }));
  }
  select.value = current;
  select.addEventListener("change", () => {
    const next = select.value;
    if (!isFontFamilyId(next)) return;
    updateSystem((draft) => {
      const fonts = { ...(draft.system.fonts ?? {}) };
      if (next === DEFAULT_FONT_SELECTION[role]) delete fonts[role];
      else fonts[role] = next;
      if (Object.keys(fonts).length > 0) draft.system.fonts = fonts;
      else delete draft.system.fonts;
    });
    rerender();
  });
  return field(FONT_ROLE_LABELS[role], select);
}

/** 스킨 미리보기 썸네일(320×240, 하네스 캡처 축소판). public/assets/ui/menu-skins/<id>.png */
export function menuSkinPreviewUrl(id: MenuSkinId): string {
  return `/assets/ui/menu-skins/${id}.png`;
}

/**
 * 「게임 메뉴 디자인」 — ESC(X) 메뉴 스킨. 레지스트리 순서대로 디자인을 내놓고, 기본(workbench)은 저장에서 지운다
 * (normalizeSystemRecords 와 같은 계약). 설명·미리보기는 다시 그리지 않고 제자리에서 바꾼다.
 */
function menuSkinFieldset(project: Project): HTMLElement {
  const saved = resolveMenuSkinId(project.system.menuUiStyle);
  let selected = saved;
  const cards = new Map<MenuSkinId, HTMLButtonElement>();
  const gallery = el("div", {
    class: "db-system-menu-skin-gallery",
    attrs: { role: "group", "aria-label": "게임 메뉴 디자인" },
    dataset: { testid: "db-field-system-menu-ui-style" },
  });
  const status = el("p", {
    class: "db-system-menu-skin-description",
    attrs: { role: "status" },
    text: `현재 디자인 · ${MENU_SKINS[saved].label}`,
    dataset: { testid: "db-system-menu-skin-description" },
  });
  for (const id of listMenuSkinIds()) {
    const skin = MENU_SKINS[id];
    const card = el("button", {
      class: "db-system-menu-skin-card",
      attrs: { type: "button", "aria-pressed": String(id === saved), "aria-label": skin.label },
      dataset: { testid: `db-system-menu-skin-${id}` },
      children: [
        el("img", {
          attrs: { src: menuSkinPreviewUrl(id), alt: "", width: "320", height: "240", loading: "lazy" },
        }),
        el("strong", { text: skin.label }),
        el("span", { class: "db-system-menu-skin-card-description", text: skin.description }),
        el("span", { class: "db-system-menu-skin-card-state", text: id === saved ? "✓ 선택됨" : "선택하기" }),
      ],
    });
    card.addEventListener("click", () => {
      if (selected === id) return;
      updateSystem((draft) => {
        if (id === DEFAULT_MENU_SKIN_ID) delete draft.system.menuUiStyle;
        else draft.system.menuUiStyle = id;
      });
      selected = id;
      for (const [key, button] of cards) {
        button.setAttribute("aria-pressed", String(key === id));
        const badge = button.querySelector(".db-system-menu-skin-card-state");
        if (badge) badge.textContent = key === id ? "✓ 선택됨" : "선택하기";
      }
      status.textContent = `현재 디자인 · ${skin.label}`;
    });
    cards.set(id, card);
    gallery.append(card);
  }
  return rm2k3Fieldset("게임 메뉴 디자인", [
    systemHelp("원하는 디자인을 눌러 선택하세요. ESC(X) 메뉴에 다음 테스트 플레이부터 적용됩니다."),
    status,
    gallery,
  ]);
}

function playResolutionFieldset(project: Project, rerender: SystemRefresh): HTMLElement {
  const { system } = project;
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
    rerender("values");
  });

  return rm2k3Fieldset("게임 화면 크기", [
    el("p", {
      class: "db-system-resolution-help",
      text: "플레이 화면이 보여 주는 논리 영역입니다. 값이 커질수록 한 화면에 더 넓은 맵이 보이며, 다음 테스트 플레이부터 적용됩니다.",
      dataset: { testid: "db-system-resolution-help" },
    }),
    field("빠른 선택", presetSelect),
    numberField("가로 (px)", "db-field-system-resolution-width", () => resolvePlayResolution(store.getCurrent().system).width, (value) => {
      updateSystem((draft) => {
        const current = resolvePlayResolution(draft.system);
        storePlayResolution(draft.system, { width: value, height: current.height });
      }, "system:play-resolution:width");
      rerender("values");
    }, { min: PLAY_RESOLUTION_LIMITS.minWidth, max: PLAY_RESOLUTION_LIMITS.maxWidth, step: 1 }),
    numberField("세로 (px)", "db-field-system-resolution-height", () => resolvePlayResolution(store.getCurrent().system).height, (value) => {
      updateSystem((draft) => {
        const current = resolvePlayResolution(draft.system);
        storePlayResolution(draft.system, { width: current.width, height: value });
      }, "system:play-resolution:height");
      rerender("values");
    }, { min: PLAY_RESOLUTION_LIMITS.minHeight, max: PLAY_RESOLUTION_LIMITS.maxHeight, step: 1 }),
    el("div", {
      class: "db-field db-field-readonly",
      children: [
        el("span", { text: "허용 범위" }),
        el("code", {
          text: `${PLAY_RESOLUTION_LIMITS.minWidth}–${PLAY_RESOLUTION_LIMITS.maxWidth} × ${PLAY_RESOLUTION_LIMITS.minHeight}–${PLAY_RESOLUTION_LIMITS.maxHeight}`,
        }),
      ],
    }),
    playResolutionDiagnostics(project, resolution),
    cameraZoomField(rerender),
  ]);
}


/**
 * 프로젝트 기본 카메라 배율. 해상도 바로 아래에 둔다 — 둘이 함께 시야를 결정하기 때문에 한 화면에서 보여야 한다.
 * 해상도만 올리고 배율을 그대로 두면 보이는 범위가 늘어나 타일이 작아보이고, 반대로 배율만 올리면 도트만 커진다.
 */
function cameraZoomField(rerender: SystemRefresh): HTMLElement {
  return rm2k3Fieldset("기본 카메라 배율", [
    el("p", {
      class: "db-system-resolution-help",
      text: "프로젝트 모든 맵에 적용되는 기본 배율입니다. 해상도를 올릴 때 함께 올려야 보이는 범위가 유지됩니다(1440x1080 이면 4.5). 이벤트 명령은 이 값을 일시적으로 덮어씁니다.",
      dataset: { testid: "db-system-camera-zoom-help" },
    }),
    numberField("배율", "db-field-system-camera-zoom", () => resolveCameraZoom(store.getCurrent().system), (next) => {
      updateSystem((draft) => storeCameraZoom(draft.system, next), "system:camera-zoom");
      rerender("values");
    }, { min: CAMERA_ZOOM_LIMITS.min, max: CAMERA_ZOOM_LIMITS.max, step: 0.25 }),
    el("div", {
      class: "db-field db-field-readonly",
      children: [
        el("span", { text: "허용 범위" }),
        el("code", { text: String(CAMERA_ZOOM_LIMITS.min) + "–" + String(CAMERA_ZOOM_LIMITS.max) + " (기본 1)" }),
      ],
    }),
  ]);
}

function playResolutionDiagnostics(project: Project, resolution: Readonly<PlayResolution>): HTMLElement {
  const analysis = analyzePlayResolution(resolution, project.maps);
  const viewport = estimatedTestPlayViewport();
  const fitScale = calculatePlaySurfaceScale(viewport.width, viewport.height, resolution.width, resolution.height);
  const incompatible = analysis.incompatibleMaps;
  const warnings: HTMLElement[] = [];
  if (analysis.partialTileX || analysis.partialTileY) {
    warnings.push(el("p", {
      class: "db-system-resolution-warning",
      text: `16px 타일 경계가 ${analysis.partialTileX && analysis.partialTileY ? "가로·세로" : analysis.partialTileX ? "가로" : "세로"}에서 일부 보일 수 있습니다.`,
    }));
  }
  if (incompatible.length > 0) {
    warnings.push(el("p", {
      class: "db-system-resolution-warning danger",
      text: `화면보다 작은 맵 ${incompatible.length}개: ${incompatible.slice(0, 4).map((map) => `${map.name} ${map.width}×${map.height}`).join(", ")}${incompatible.length > 4 ? " 외" : ""}`,
    }));
  }

  return el("section", {
    class: `db-system-resolution-diagnostics${warnings.length ? " has-warning" : ""}`,
    dataset: {
      testid: "db-system-resolution-diagnostics",
      minMapWidth: String(analysis.minMapWidth),
      minMapHeight: String(analysis.minMapHeight),
      partialTileX: String(analysis.partialTileX),
      partialTileY: String(analysis.partialTileY),
      incompatibleMapCount: String(incompatible.length),
      estimatedFitScale: fitScale.toFixed(3),
    },
    children: [
      el("strong", { text: "크기 영향" }),
      el("div", {
        class: "db-system-resolution-diagram",
        attrs: { role: "img", "aria-label": `${resolution.width} × ${resolution.height}, ${analysis.aspectWidth}:${analysis.aspectHeight}` },
        children: [el("div", {
          class: "db-system-resolution-frame",
          attrs: { style: `aspect-ratio:${resolution.width}/${resolution.height}` },
          children: [el("strong", { text: `${resolution.width} × ${resolution.height}` }), el("span", { text: `${analysis.aspectWidth}:${analysis.aspectHeight}` })],
        })],
      }),
      el("dl", {
        class: "db-system-resolution-facts",
        children: [
          resolutionFact("화면비", `${analysis.aspectWidth}:${analysis.aspectHeight}`),
          resolutionFact("보이는 타일", `${formatTileSpan(analysis.tileColumns)} × ${formatTileSpan(analysis.tileRows)}`),
          resolutionFact("권장 최소 맵", `${analysis.minMapWidth} × ${analysis.minMapHeight} 타일`),
          resolutionFact("현재 창 예상", `${formatScale(fitScale)}배 · 자동 맞춤`),
        ],
      }),
      ...warnings,
    ],
  });
}

function resolutionFact(label: string, value: string): HTMLElement {
  return el("div", {
    children: [el("dt", { text: label }), el("dd", { text: value })],
  });
}

function formatTileSpan(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatScale(value: number): string {
  return value >= 1 ? String(Math.trunc(value)) : value.toFixed(2);
}

function estimatedTestPlayViewport(): { readonly width: number; readonly height: number } {
  const windowWidth = typeof window !== "undefined" && window.innerWidth > 0 ? window.innerWidth : 1280;
  const windowHeight = typeof window !== "undefined" && window.innerHeight > 0 ? window.innerHeight : 800;
  return {
    width: Math.max(1, Math.min(1320, windowWidth - 64)),
    height: Math.max(1, Math.min(970, windowHeight - 78)),
  };
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

/**
 * 옵트인 시스템 토글 + 배열 개수 표시. 편집이 아닌 "켰는데 비어 있다"를 보이게 하는 것이 목적.
 * 배열 편집은 각자의 전용 DB 탭/도구가 담당한다.
 */
function optInSystemFields(project: Project, rerender: SystemRefresh): readonly HTMLElement[] {
  const { system } = project;
  const actionCombatField = checkboxField("2D 액션 전투", "db-field-system-action-combat", system.actionCombat?.enabled === true, (checked) => {
    updateSystem((draft) => {
      if (checked) {
        draft.system.actionCombat = {
          ...(draft.system.actionCombat ?? {}),
          enabled: true,
        };
      } else {
        if (draft.system.actionCombat) draft.system.actionCombat.enabled = false;
        else draft.system.actionCombat = { enabled: false };
      }
    });
    rerender();
  });
  actionCombatField.setAttribute("title", "타일 맵에서 실시간 공격·회피·가드를 사용합니다. 시스템과 해당 맵을 모두 켜야 적용됩니다.");
  const fields: HTMLElement[] = [
    checkboxField("생활 스킬 레벨링", "db-field-system-skill-system", system.skillSystem?.enabled === true, (checked) => {
      updateSystem((draft) => {
        draft.system.skillSystem = { enabled: checked };
      });
    }),
  ];
  const groups: HTMLElement[] = [rm2k3Fieldset("생활 기능", fields)];
  groups.push(rm2k3Fieldset("2D 액션 전투", [
    actionCombatField,
    systemHelp("맵 속성에서 액션 전투를 켠 맵에만 적용됩니다. 다른 맵은 기존 전투 방식을 유지하며, 시스템을 꺼도 세부 값은 삭제하지 않습니다."),
    ...(system.actionCombat?.enabled === true ? actionCombatDetailFields(system.actionCombat) : []),
  ]));
  const care: HTMLElement[] = [];

  // 몬스터 돌봄 number fields
  if (system.monsterCare) {
    care.push(
      numberField("돌봄 1회당 걸음 수", "db-field-system-monster-care-steps", () => store.getCurrent().system.monsterCare?.stepsPerTick ?? 50, (value) => {
        updateSystem((draft) => {
          draft.system.monsterCare = normalizeMonsterCare({ ...draft.system.monsterCare, stepsPerTick: value });
        }, "system:monster-care:stepsPerTick");
      }),
      numberField("산책 호감도", "db-field-system-monster-care-walk-friendship", () => store.getCurrent().system.monsterCare?.walkFriendship ?? 1, (value) => {
        updateSystem((draft) => {
          draft.system.monsterCare = normalizeMonsterCare({ ...draft.system.monsterCare, walkFriendship: value });
        }, "system:monster-care:walkFriendship");
      }, { min: 0, max: 1000 }),
      numberField("산책 경험치", "db-field-system-monster-care-walk-exp", () => store.getCurrent().system.monsterCare?.walkExp ?? 1, (value) => {
        updateSystem((draft) => {
          draft.system.monsterCare = normalizeMonsterCare({ ...draft.system.monsterCare, walkExp: value });
        }, "system:monster-care:walkExp");
      }, { min: 0, max: 999999 }),
      numberField("일일 돌봄 상한", "db-field-system-monster-care-daily-cap", () => store.getCurrent().system.monsterCare?.dailyCareCap ?? 30, (value) => {
        updateSystem((draft) => {
          draft.system.monsterCare = normalizeMonsterCare({ ...draft.system.monsterCare, dailyCareCap: value });
        }, "system:monster-care:dailyCareCap");
      }, { min: 0, max: 999999 }),
    );
  }

  groups.push(rm2k3Fieldset("몬스터 돌봄", care.length ? care : [systemHelp("저장된 돌봄 설정이 없습니다. 몬스터 수집 데이터에서 돌봄을 구성한 경우 여기에 세부 값이 표시됩니다.")]));

  // 배열 개수 읽기 전용 표시
  const toolActionsCount = (system.toolActions ?? []).length;
  const craftRecipesCount = (system.craftRecipes ?? []).length;
  const itemUpgradesCount = (system.itemUpgrades ?? []).length;
  const sellPricesCount = (system.sellPrices ?? []).length;
  const linked: HTMLElement[] = [
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
    el("button", {
      class: "btn", text: "생활 기술·제작에서 편집", attrs: { type: "button" },
      dataset: { databaseTarget: "life-crafting", testid: "db-system-open-life-crafting" },
    }),
  ];
  groups.push(rm2k3Fieldset("연결된 생활 데이터", linked));
  return groups;
}

/**
 * 액션 전투 상세 필드 — 숫자 경계는 project/actionCombat.ts 의 클램프와 1:1로 맞춘다.
 * 기본값과 같은 편집은 키를 지운다(normalizeActionCombatConfig 과 같은 "기본값은 저장하지 않는다" 계약).
 */
function actionCombatDetailFields(config: NonNullable<SystemRecords["actionCombat"]>): HTMLElement[] {
  const patchNumber = (
    key: "playerIframesMs" | "swingCooldownMs" | "swingDamageBonus" | "dodgeStaminaCost" | "dodgeIframesMs" | "guardDamageReductionPercent" | "guardStaminaDrainPerSec",
    fallback: number,
    value: number,
  ): void => {
    updateSystem((draft) => {
      const next = normalizeActionCombatConfig({ ...(draft.system.actionCombat ?? { enabled: true }), [key]: value })!;
      if (next[key] === fallback) delete next[key];
      draft.system.actionCombat = next;
    }, `system:action-combat-${key}`);
  };
  const patchHud = (mutate: (hud: ActionCombatHudConfig) => void): void => {
    updateSystem((draft) => {
      draft.system.actionCombat ??= { enabled: true };
      const hud: ActionCombatHudConfig = { ...(draft.system.actionCombat.hud ?? {}) };
      mutate(hud);
      if (hud.hearts === true) delete hud.hearts;
      if (hud.stamina === false) delete hud.stamina;
      if (hud.enemyHpBars === "damaged") delete hud.enemyHpBars;
      if (Object.keys(hud).length > 0) draft.system.actionCombat.hud = hud;
      else delete draft.system.actionCombat.hud;
    });
  };
  const numeric: readonly {
    readonly label: string;
    readonly testid: string;
    readonly key: "playerIframesMs" | "swingCooldownMs" | "swingDamageBonus" | "dodgeStaminaCost" | "dodgeIframesMs" | "guardDamageReductionPercent" | "guardStaminaDrainPerSec";
    readonly fallback: number;
    readonly min: number;
    readonly max: number;
  }[] = [
    { label: "피격 무적(ms)", testid: "db-field-system-action-combat-iframes", key: "playerIframesMs", fallback: DEFAULT_PLAYER_IFRAMES_MS, min: 0, max: 10000 },
    { label: "스윙 쿨다운(ms)", testid: "db-field-system-action-combat-swing-cooldown", key: "swingCooldownMs", fallback: DEFAULT_SWING_COOLDOWN_MS, min: 50, max: 5000 },
    { label: "스윙 데미지 가산", testid: "db-field-system-action-combat-swing-bonus", key: "swingDamageBonus", fallback: 0, min: 0, max: 9999 },
    { label: "회피 스태미나 비용", testid: "db-field-system-action-combat-dodge-stamina-cost", key: "dodgeStaminaCost", fallback: DEFAULT_DODGE_STAMINA_COST, min: 0, max: 100 },
    { label: "회피 무적(ms)", testid: "db-field-system-action-combat-dodge-iframes", key: "dodgeIframesMs", fallback: DEFAULT_DODGE_IFRAMES_MS, min: 0, max: 3000 },
    { label: "가드 피해 감소(%)", testid: "db-field-system-action-combat-guard-reduction", key: "guardDamageReductionPercent", fallback: DEFAULT_GUARD_DAMAGE_REDUCTION_PERCENT, min: 0, max: GUARD_MAX_DAMAGE_REDUCTION_PERCENT },
    { label: "가드 스태미나/초", testid: "db-field-system-action-combat-guard-drain", key: "guardStaminaDrainPerSec", fallback: DEFAULT_GUARD_STAMINA_DRAIN_PER_SEC, min: 0, max: 100 },
  ];
  const fields: HTMLElement[] = numeric.map((spec) =>
    numberField(spec.label, spec.testid, () => store.getCurrent().system.actionCombat?.[spec.key] ?? spec.fallback, (value) => patchNumber(spec.key, spec.fallback, value), {
      min: spec.min,
      max: spec.max,
    }),
  );
  fields.push(
    checkboxField("4방향 이동", "db-field-system-action-combat-four-way", config.fourWayMovement === true, (checked) => {
      updateSystem((draft) => {
        draft.system.actionCombat ??= { enabled: true };
        if (checked) draft.system.actionCombat.fourWayMovement = true;
        else delete draft.system.actionCombat.fourWayMovement;
      });
    }),
    checkboxField("HUD 하트 바", "db-field-system-action-combat-hud-hearts", config.hud?.hearts !== false, (checked) => {
      patchHud((hud) => {
        hud.hearts = checked;
      });
    }),
    checkboxField("HUD 스태미나 바", "db-field-system-action-combat-hud-stamina", config.hud?.stamina === true, (checked) => {
      patchHud((hud) => {
        hud.stamina = checked;
      });
    }),
    selectField(
      "몬스터 HP 바",
      "db-field-system-action-combat-hud-enemy-hp-bars",
      config.hud?.enemyHpBars ?? "damaged",
      ENEMY_HP_BAR_OPTIONS,
      (value) => {
        patchHud((hud) => {
          hud.enemyHpBars = value as NonNullable<ActionCombatHudConfig["enemyHpBars"]>;
        });
      },
    ),
  );
  return fields;
}

function startPartySlots(
  startActorIds: readonly string[], actors: readonly ActorRecord[], rerender: SystemRefresh,
): HTMLElement[] {
  return Array.from({ length: START_PARTY_SLOTS }, (_, index) => {
    const value = startActorIds[index] ?? "";
    const actor = actors.find((entry) => entry.id === value);
    const testid = index === 0 ? "db-picker-system-start-actor" : `db-picker-system-start-actor-${index + 1}`;
    const selector = selectField(`멤버 ${index + 1}`, testid, value, actors, (next) => {
      updateSystem((draft) => {
        const slots = Array.from({ length: START_PARTY_SLOTS }, (_, slot) => draft.system.startActorIds[slot] ?? "");
        slots[index] = next;
        const party = slots.filter(Boolean);
        draft.system.startActorIds = party;
        draft.session.partyActorIds = [...party];
      });
      rerender();
    });
    const empty = selector.querySelector('option[value=""]');
    if (empty) empty.textContent = "빈 슬롯";
    const face = actor ? recordListThumbnail("actors", actor, store.getCurrent(), START_PARTY_FACE_SIZE) : null;
    return el("div", {
      class: "db-system-party-row", dataset: { testid: `db-system-party-row-${index + 1}` },
      children: [
        el("span", { class: "db-system-party-number", text: String(index + 1), attrs: { "aria-hidden": "true" } }),
        face ?? el("span", { class: "db-system-party-empty", text: "비어 있음" }),
        selector,
        el("span", { class: "db-system-party-status", text: actor ? actor.name || "이름 없음" : value ? `없는 멤버: ${value}` : "멤버 없음" }),
      ],
    });
  });
}

function timeSystemFieldset(
  timeSystem: ReturnType<typeof normalizeTimeSystemConfig>,
  commonEvents: readonly { readonly id: string; readonly name: string }[],
  rerender: SystemRefresh,
): HTMLElement {
  const enabled = timeSystem?.enabled === true;
  const endHourBounds = { min: (timeSystem?.dayStartHour ?? DEFAULT_DAY_START_HOUR) + 1, max: 48 };
  const children: HTMLElement[] = [
    checkboxField("시간/달력 사용", "db-field-system-time-enabled", enabled, (checked) => {
      updateSystem((draft) => {
        if (!checked) {
          if (draft.system.timeSystem) draft.system.timeSystem = { ...draft.system.timeSystem, enabled: false };
          return;
        }
        draft.system.timeSystem = normalizeTimeSystemConfig({
          enabled: true,
          minutesPerRealSecond: draft.system.timeSystem?.minutesPerRealSecond ?? DEFAULT_TIME_MINUTES_PER_REAL_SECOND,
          dayStartHour: draft.system.timeSystem?.dayStartHour ?? DEFAULT_DAY_START_HOUR,
          dayEndHour: draft.system.timeSystem?.dayEndHour ?? DEFAULT_DAY_END_HOUR,
          daysPerSeason: draft.system.timeSystem?.daysPerSeason ?? DEFAULT_DAYS_PER_SEASON,
          forceSleep: draft.system.timeSystem?.forceSleep === true,
          onDayEnd: draft.system.timeSystem?.onDayEnd,
        });
      });
      rerender();
    }),
    systemHelp("끄면 시간 진행만 멈춥니다. 달력·시각·하루 종료 설정은 보존되며 다시 켜면 그대로 사용합니다."),
    timeSystemSummary(timeSystem),
  ];
  if (enabled && timeSystem) {
    children.push(
      numberField("분/초 배속", "db-field-system-time-minutes-per-second", () => store.getCurrent().system.timeSystem?.minutesPerRealSecond ?? DEFAULT_TIME_MINUTES_PER_REAL_SECOND, (value) => {
        updateSystem((draft) => {
          draft.system.timeSystem = normalizeTimeSystemConfig({
            ...draft.system.timeSystem,
            enabled: true,
            minutesPerRealSecond: Number.isFinite(value) && value > 0 ? value : DEFAULT_TIME_MINUTES_PER_REAL_SECOND,
          });
        }, "system:time:minutes-per-second");
      }, undefined, { fractional: true }),
      numberField("하루 시작 시", "db-field-system-time-day-start", () => store.getCurrent().system.timeSystem?.dayStartHour ?? DEFAULT_DAY_START_HOUR, (value) => {
        updateSystem((draft) => {
          draft.system.timeSystem = normalizeTimeSystemConfig({
            ...draft.system.timeSystem,
            enabled: true,
            dayStartHour: Number.isFinite(value) ? Math.trunc(value) : DEFAULT_DAY_START_HOUR,
          });
        }, "system:time:day-start");
      }, { min: 0, max: 23 }),
      numberField("하루 종료 시", "db-field-system-time-day-end", () => store.getCurrent().system.timeSystem?.dayEndHour ?? DEFAULT_DAY_END_HOUR, (value) => {
        updateSystem((draft) => {
          draft.system.timeSystem = normalizeTimeSystemConfig({
            ...draft.system.timeSystem,
            enabled: true,
            dayEndHour: Number.isFinite(value) ? Math.trunc(value) : DEFAULT_DAY_END_HOUR,
          });
        }, "system:time:day-end");
      }, endHourBounds),
      numberField("계절당 일수", "db-field-system-time-days-per-season", () => store.getCurrent().system.timeSystem?.daysPerSeason ?? DEFAULT_DAYS_PER_SEASON, (value) => {
        updateSystem((draft) => {
          draft.system.timeSystem = normalizeTimeSystemConfig({
            ...draft.system.timeSystem,
            enabled: true,
            daysPerSeason: Number.isFinite(value) ? Math.trunc(value) : DEFAULT_DAYS_PER_SEASON,
          });
        }, "system:time:days-per-season");
      }, { min: MIN_DAYS_PER_SEASON, max: MAX_DAYS_PER_SEASON }),
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
  const controls = children.splice(3);
  if (controls.length) {
    children.push(rm2k3Fieldset("달력과 시계", controls.slice(0, 4)), rm2k3Fieldset("하루 종료", controls.slice(4)));
  }
  const root = rm2k3Fieldset("시간 사용", children);
  const refreshClock = (): void => {
    const config = store.getCurrent().system.timeSystem;
    endHourBounds.min = (config?.dayStartHour ?? DEFAULT_DAY_START_HOUR) + 1;
    synchronizeSystemNumbers(root);
    refreshTimeSummary(root);
  };
  root.addEventListener("input", refreshClock);
  root.addEventListener("change", refreshClock);
  return root;
}

function timeSystemSummary(config: SystemRecords["timeSystem"]): HTMLElement {
  const start = config?.dayStartHour ?? DEFAULT_DAY_START_HOUR;
  const end = config?.dayEndHour ?? DEFAULT_DAY_END_HOUR;
  const rate = config?.minutesPerRealSecond ?? DEFAULT_TIME_MINUTES_PER_REAL_SECOND;
  return el("p", {
    class: "db-system-config-summary", dataset: { testid: "db-system-time-summary", daysPerSeason: String(config?.daysPerSeason ?? DEFAULT_DAYS_PER_SEASON) },
    text: `${config?.enabled ? "사용 중" : "사용 안 함"} · ${start}:00 → ${end}:00 · 하루 ${(end - start) * 60}분 / 실제 ${Number(((end - start) / rate).toFixed(1))}분 · 계절당 ${config?.daysPerSeason ?? DEFAULT_DAYS_PER_SEASON}일`,
  });
}

function refreshTimeSummary(root: HTMLElement): void {
  root.querySelector('[data-testid="db-system-time-summary"]')?.replaceWith(timeSystemSummary(store.getCurrent().system.timeSystem));
}

function typeChartFieldset(chart: TypeChartRecord | undefined, rerender: SystemRefresh): HTMLElement {
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
      text: "최대 32개 타입을 쉼표로 구분합니다. 클릭은 배율 순환, F2 또는 직접 입력은 0–4 사이 값을 설정합니다. 대각선은 읽기 전용입니다. 목록을 비우면 확인 후 표를 삭제합니다.",
      dataset: { testid: "db-type-chart-help" },
    }),
    el("label", { class: "db-field", children: [el("span", { text: "타입 목록" }), typeInput] }),
  ];
  if (types.length > 0) children.push(typeChartMatrix(chart));
  else children.push(systemHelp("상성표가 없습니다. 타입을 두 개 이상 입력하면 공격·방어 배율을 편집할 수 있습니다. 상성표가 없을 때는 타입 배율이 1배입니다."));
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
    attrs: { type: "number", min: "0", max: "4", step: "any", "aria-label": "선택한 타입 쌍의 배율" },
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
    attrs: { role: "group", "aria-label": "타입 배율 직접 입력" },
    children: [field("배율 (0–4)", popoverInput), popoverConfirm],
  });
  popover.hidden = true;

  type Pair = { readonly chip: HTMLButtonElement; readonly attacker: string; readonly defender: string };
  let selectedPair: Pair | null = null;
  let popoverTarget: Pair | null = null;
  let opener: HTMLElement | null = null;
  let returnScroll: { section: HTMLElement; top: number; matrix: HTMLElement; left: number } | undefined;
  const direct = el("button", {
    class: "btn", text: "선택한 배율 직접 입력", attrs: { type: "button" },
    dataset: { testid: "db-type-chart-direct-edit" },
  });
  direct.disabled = types.length < 2;
  const openPopover = (pair: Pair, source: HTMLElement): void => {
    popoverTarget = pair;
    opener = source;
    const section = source.closest<HTMLElement>(".db-system-sections");
    const matrix = pair.chip.closest<HTMLElement>(".db-type-chart-scroll");
    if (section && matrix) returnScroll = { section, top: section.scrollTop, matrix, left: matrix.scrollLeft };
    popoverInput.value = pair.chip.dataset.value ?? "1";
    popover.hidden = false;
    popoverInput.focus();
  };
  direct.addEventListener("click", () => { if (selectedPair) openPopover(selectedPair, direct); });
  const closePopover = (): void => {
    popover.hidden = true;
    if (returnScroll) {
      returnScroll.section.scrollTop = returnScroll.top;
      returnScroll.matrix.scrollLeft = returnScroll.left;
    }
    opener?.focus({ preventScroll: true });
    // Hiding the normal-flow editor changes layout: reveal the live opener after
    // restoring both scroll owners, without centering or resetting the matrix.
    if (opener && typeof opener.scrollIntoView === "function") {
      opener.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    returnScroll = undefined;
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
  popover.append(el("button", {
    class: "btn", text: "취소", attrs: { type: "button" }, dataset: { testid: "db-type-chart-popover-cancel" },
    on: { click: closePopover },
  }));
  popover.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePopover();
    } else if (event.key === "Enter" && event.target === popoverInput) {
      event.preventDefault();
      event.stopPropagation();
      popoverConfirm.click();
    }
  });

  const table = el("table", { class: "db-type-chart-matrix" });
  const head = el("tr", { children: [el("th", { text: "공격 / 방어" }), ...types.map((type) => el("th", { text: type, attrs: { scope: "col" } }))] });
  table.append(el("thead", { children: [head] }));
  const body = el("tbody");
  for (const attacker of types) {
    const row = el("tr", { children: [el("th", { text: attacker, attrs: { scope: "row" } })] });
    for (const defender of types) {
      const isDiagonal = attacker === defender;
      const value = multipliers[attacker]?.[defender] ?? 1;
      const chip = el("button", {
        class: "db-type-chip",
        attrs: { type: "button", "aria-label": `${attacker} → ${defender}: ${value}배`, title: isDiagonal ? "같은 타입 (읽기 전용)" : "클릭: 배율 순환 · F2: 직접 입력" },
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
        const pair = { chip, attacker, defender };
        if (!selectedPair) selectedPair = pair;
        chip.addEventListener("focus", () => {
          selectedPair = pair;
          showPreview(attacker, defender, parseFloat(chip.dataset.value ?? "1"));
        });
        chip.addEventListener("keydown", (event) => {
          if (event.key === "F2") {
            event.preventDefault();
            event.stopPropagation();
            openPopover(pair, chip);
          }
        });
        chip.addEventListener("click", () => {
          selectedPair = pair;
          const current = parseFloat(chip.dataset.value ?? "1");
          const next = nextTypeChartCycleValue(current);
          updateTypeChartCell(attacker, defender, next);
          applyChipValue(chip, next);
          showPreview(attacker, defender, next);
        });
        chip.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          selectedPair = pair;
          openPopover(pair, chip);
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
  if (selectedPair) showPreview(selectedPair.attacker, selectedPair.defender, Number(selectedPair.chip.dataset.value));

  return el("div", {
    class: "db-type-chart-wrap",
    dataset: { testid: "db-type-chart-matrix" },
    children: [preview, direct, popover, el("div", { class: "db-type-chart-scroll", attrs: { tabindex: "0", "aria-label": "타입 상성표 가로 스크롤" }, children: [table] })],
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
  chip.setAttribute("aria-label", `${chip.dataset.attacker} → ${chip.dataset.defender}: ${value}배`);
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
  store.update(mutator, { scope: "system", label: "시스템 설정 편집" });
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
  const card = sectionCard({ title, children });
  card.classList.add("db-system-settings-group");
  return card;
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
    : el("span", { class: "db-system-preview-empty", text: "(없음)" });
  const well = el("div", {
    class: "db-system-preview-well",
    children: [
      el("span", { class: "db-system-preview-label", text: label }),
      el("div", { class: "db-system-preview-frame", children: [preview] }),
      el("code", { text: resourceId ? systemResourceName(label === "시스템" ? "system" : label === "전투" ? "system2" : "title", resourceId) : "선택 없음" }),
    ],
  });
  if (url) preview.addEventListener("error", () => markDatabaseImageFailed(preview.parentElement!, label), { once: true });
  return well;
}

function titleScreenDisplayFieldset(
  titleScreen: TitleScreenSettings,
  titleBackgroundResourceId: string | undefined,
  systemTitleResourceId: string | undefined,
  rerender: SystemRefresh,
): HTMLElement {
  const presentationMode = titleScreen.titleGraphic?.mode ?? "text";
  const showLogoFields = presentationMode === "graphic" || presentationMode === "both";
  const children: HTMLElement[] = [
    systemHelp("좌표 범위: X 0–320, Y 0–240. 해상도를 바꿔도 좌표의 비례 위치는 유지됩니다."),
    textControl("게임 타이틀", titleScreen.title, (value) => {
      updateTitleScreen((settings) => {
        settings.title = value;
      }, "system:title-screen:title");
      rerender("values");
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
      numberField("로고 X", "db-field-title-screen-logo-x", () => { const title = store.getCurrent().system.titleScreen!; return title.titleGraphic?.x ?? title.layout.titleX; }, (value) => {
        updateTitleScreen((settings) => {
          patchTitleGraphic(settings, { x: clampStageCoordinate(value, 320) });
        }, "system:title-screen:logo-x");
        rerender("values");
      }, { min: 0, max: 320 }),
      numberField("로고 Y", "db-field-title-screen-logo-y", () => { const title = store.getCurrent().system.titleScreen!; return title.titleGraphic?.y ?? title.layout.titleY; }, (value) => {
        updateTitleScreen((settings) => {
          patchTitleGraphic(settings, { y: clampStageCoordinate(value, 240) });
        }, "system:title-screen:logo-y");
        rerender("values");
      }, { min: 0, max: 240 }),
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
      text: systemTitleResourceId ? `기본 배경 연결: ${systemResourceName("title", systemTitleResourceId)}` : "기본 배경 연결 없음",
      dataset: { testid: "db-title-workbench-system-title-id" },
    }),
    numberField("타이틀 X", "db-field-title-screen-title-x", () => store.getCurrent().system.titleScreen!.layout.titleX, (value) => {
      updateTitleScreen((settings) => {
        settings.layout.titleX = clampStageCoordinate(value, 320);
      }, "system:title-screen:title-x");
      rerender("values");
    }, { min: 0, max: 320 }),
    numberField("타이틀 Y", "db-field-title-screen-title-y", () => store.getCurrent().system.titleScreen!.layout.titleY, (value) => {
      updateTitleScreen((settings) => {
        settings.layout.titleY = clampStageCoordinate(value, 240);
      }, "system:title-screen:title-y");
      rerender("values");
    }, { min: 0, max: 240 }),
    numberField("선택지 X", "db-field-title-screen-menu-x", () => store.getCurrent().system.titleScreen!.layout.menuX, (value) => {
      updateTitleScreen((settings) => {
        settings.layout.menuX = clampStageCoordinate(value, 320);
      }, "system:title-screen:menu-x");
      rerender("values");
    }, { min: 0, max: 320 }),
    numberField("선택지 Y", "db-field-title-screen-menu-y", () => store.getCurrent().system.titleScreen!.layout.menuY, (value) => {
      updateTitleScreen((settings) => {
        settings.layout.menuY = clampStageCoordinate(value, 240);
      }, "system:title-screen:menu-y");
      rerender("values");
    }, { min: 0, max: 240 }),
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

function titleScreenAudioFieldset(titleScreen: TitleScreenSettings, rerender: SystemRefresh): HTMLElement {
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

function titleScreenMenuFieldset(titleScreen: TitleScreenSettings, rerender: SystemRefresh): HTMLElement {
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
      systemHelp("새 게임은 시작 경로이므로 항상 표시합니다. 이어하기는 자동 저장이 있을 때만 표시됩니다."),
      el("div", {
        class: "db-title-menu-option-row",
        dataset: { testid: "db-title-menu-option-new-game" },
        children: [
          textControl("새 게임", titleScreen.menuLabels.newGame, (value) => {
            updateTitleScreen((settings) => {
              settings.menuLabels.newGame = value;
            }, "system:title-screen:menu-new-game");
            rerender("values");
          }, "db-field-title-screen-new-game"),
          lockedCheckboxField("표시", "db-field-title-screen-visible-new-game", true),
        ],
      }),
      el("div", {
        class: "db-title-menu-option-row",
        dataset: { testid: "db-title-menu-option-continue" },
        children: [
          textControl("불러오기", titleScreen.menuLabels.continueGame, (value) => {
            updateTitleScreen((settings) => {
              settings.menuLabels.continueGame = value;
            }, "system:title-screen:menu-continue");
            rerender("values");
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
            rerender("values");
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
            rerender("values");
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
  const resourceId = "resourceId" in patch ? patch.resourceId : current?.resourceId;
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
  const next = { ...current, ...patch };
  const cleaned = {
    ...(next.cursorSeResourceId ? { cursorSeResourceId: next.cursorSeResourceId } : {}),
    ...(next.confirmSeResourceId ? { confirmSeResourceId: next.confirmSeResourceId } : {}),
    ...(next.cancelSeResourceId ? { cancelSeResourceId: next.cancelSeResourceId } : {}),
  };
  if (Object.keys(cleaned).length === 0) delete settings.sounds;
  else settings.sounds = cleaned;
}

/** 배경 레이어 · 파티클 · 등장 연출 — 데이터 구동 타이틀 연출 3필드셋. */
function titleScreenEffectsFieldset(titleScreen: TitleScreenSettings, rerender: SystemRefresh): HTMLElement {
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
        rerender("effects");
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
    numberField("등장 지연(ms)", "db-field-title-screen-intro-delay", () => store.getCurrent().system.titleScreen!.intro?.delayMs ?? 0, (value) => {
      updateTitleScreen((settings) => {
        patchTitleIntro(settings, { delayMs: value });
      }, "system:title-screen:intro-delay");
      rerender("effects");
    }, { min: 0, max: 10000 }),
    numberField("메뉴 시차(ms)", "db-field-title-screen-intro-stagger", () => store.getCurrent().system.titleScreen!.intro?.staggerMs ?? 90, (value) => {
      updateTitleScreen((settings) => {
        patchTitleIntro(settings, { staggerMs: value });
      }, "system:title-screen:intro-stagger");
      rerender("effects");
    }, { min: 0, max: 2000 }),
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

function titleStageBackgroundSize(fit: TitleScreenSettings["backgroundFit"]): string {
  if (fit === "cover" || fit === "contain") return fit;
  return "100% 100%";
}

const TITLE_LOGO_STYLE_OPTIONS = [
  { id: "plain", name: "기본" },
  { id: "metal", name: "금속(은빛 광택)" },
  { id: "gold", name: "황금" },
  { id: "stone", name: "석재" },
  { id: "glow", name: "빛남" },
] as const;
const TITLE_MENU_STYLE_OPTIONS = [
  { id: "window", name: "창(윈도 스킨)" },
  { id: "plain", name: "글자만(오프닝풍)" },
] as const;
const TITLE_BACKGROUND_FIT_OPTIONS = [
  { id: "stretch", name: "늘이기(기존)" },
  { id: "cover", name: "채우기(비율 유지·잘림)" },
  { id: "contain", name: "맞추기(비율 유지·여백)" },
] as const;
const TITLE_BACKGROUND_RENDERING_OPTIONS = [
  { id: "pixelated", name: "도트(선명)" },
  { id: "smooth", name: "부드럽게(일러스트)" },
] as const;

/**
 * 오프닝 연출 — 그림 위 영역 효과(빛내림·빛 먼지·칼날 반짝임·물결·안개…)와 로고/메뉴 스타일,
 * 그리고 생성형 이미지로 키아트를 만들어 프리셋 효과까지 한 번에 거는 버튼.
 * 편집은 모두 updateTitleScreen, AI 적용은 기존 쓰기 툴(upsert_resource → set_title_screen) 묶음 한 번.
 */
function titleScreenOpeningFieldset(titleScreen: TitleScreenSettings, rerender: SystemRefresh): HTMLElement {
  const presetSelect = el("select", {
    dataset: { testid: "db-title-opening-preset" },
    children: TITLE_OPENING_PRESETS.map((preset) => el("option", { text: preset.label, attrs: { value: preset.id } })),
  }) as HTMLSelectElement;
  const presetDescription = el("p", { class: "db-system-help", text: TITLE_OPENING_PRESETS[0]?.description ?? "" });
  presetSelect.addEventListener("change", () => {
    presetDescription.textContent = findTitleOpeningPreset(presetSelect.value)?.description ?? "";
  });
  const applyPreset = el("button", {
    class: "btn small",
    text: "효과 프리셋 적용",
    attrs: { type: "button" },
    dataset: { testid: "db-title-opening-preset-apply" },
    on: {
      click: () => {
        const preset = findTitleOpeningPreset(presetSelect.value);
        if (!preset) return;
        updateTitleScreen((settings) => {
          settings.effects = titleOpeningPresetEffects(preset);
          settings.logoStyle = preset.logoStyle;
          settings.menuStyle = preset.menuStyle;
          settings.backgroundFit = "cover";
          settings.backgroundRendering = "smooth";
        });
        rerender();
      },
    },
  });

  const styleControls = [
    koreanSelectField("로고 스타일", "db-field-title-screen-logo-style", titleScreen.logoStyle ?? "plain", TITLE_LOGO_STYLE_OPTIONS, (value) => {
      updateTitleScreen((settings) => {
        if (value === "plain") delete settings.logoStyle;
        else settings.logoStyle = value;
      });
      rerender();
    }),
    koreanSelectField("메뉴 스타일", "db-field-title-screen-menu-style", titleScreen.menuStyle ?? "window", TITLE_MENU_STYLE_OPTIONS, (value) => {
      updateTitleScreen((settings) => {
        if (value === "window") delete settings.menuStyle;
        else settings.menuStyle = value;
      });
      rerender();
    }),
    koreanSelectField("배경 맞춤", "db-field-title-screen-background-fit", titleScreen.backgroundFit ?? "stretch", TITLE_BACKGROUND_FIT_OPTIONS, (value) => {
      updateTitleScreen((settings) => {
        if (value === "stretch") delete settings.backgroundFit;
        else settings.backgroundFit = value;
      });
      rerender();
    }),
    koreanSelectField("배경 그리기", "db-field-title-screen-background-rendering", titleScreen.backgroundRendering ?? "pixelated", TITLE_BACKGROUND_RENDERING_OPTIONS, (value) => {
      updateTitleScreen((settings) => {
        if (value === "pixelated") delete settings.backgroundRendering;
        else settings.backgroundRendering = value;
      });
      rerender();
    }),
    textControl("로고 부제", titleScreen.logoSubtitle ?? "", (value) => {
      updateTitleScreen((settings) => {
        const trimmed = value.trim().slice(0, MAX_TITLE_LOGO_SUBTITLE_LENGTH);
        if (trimmed) settings.logoSubtitle = trimmed;
        else delete settings.logoSubtitle;
      }, "system:title-screen:logo-subtitle");
      rerender("effects");
    }, "db-field-title-screen-logo-subtitle"),
  ];

  const effects = titleScreen.effects ?? [];
  const effectRows = effects.map((effect, index) =>
    el("div", {
      class: "db-title-opening-effect-row",
      dataset: { testid: `db-title-opening-effect-${index}`, effectKind: effect.kind },
      children: [
        checkboxField(TITLE_EFFECT_LABELS[effect.kind], `db-title-opening-effect-${index}-enabled`, effect.enabled !== false, (checked) => {
          updateTitleScreen((settings) => {
            const target = settings.effects?.[index];
            if (!target) return;
            if (checked) delete target.enabled;
            else target.enabled = false;
          });
          rerender("effects");
        }),
        densitySliderField(
          "세기",
          `db-title-opening-effect-${index}-intensity`,
          Math.round(((effect.intensity ?? 1) / 2) * 100),
          effect.enabled === false,
          (value) => {
            updateTitleScreen((settings) => {
              const target = settings.effects?.[index];
              if (!target) return;
              target.intensity = Math.max(0, Math.min(2, (value / 100) * 2));
            }, `system:title-screen:effect-${index}-intensity`);
            rerender("effects");
          },
        ),
        el("button", {
          class: "btn small",
          text: "삭제",
          attrs: { type: "button" },
          dataset: { testid: `db-title-opening-effect-${index}-remove` },
          on: {
            click: () => {
              updateTitleScreen((settings) => {
                const next = (settings.effects ?? []).filter((_, i) => i !== index);
                if (next.length) settings.effects = next;
                else delete settings.effects;
              });
              rerender();
            },
          },
        }),
      ],
    }),
  );
  const clearEffects = effects.length
    ? el("button", {
        class: "btn small",
        text: "효과 모두 끄기",
        attrs: { type: "button" },
        dataset: { testid: "db-title-opening-effects-clear" },
        on: {
          click: () => {
            updateTitleScreen((settings) => {
              delete settings.effects;
            });
            rerender();
          },
        },
      })
    : null;

  const promptInput = el("textarea", {
    class: "db-title-opening-prompt",
    attrs: { rows: "3", placeholder: "예: 칼 두 자루가 기대 선 큰 나무, 강 건너 성 마을, 안개 낀 산맥" },
    dataset: { testid: "db-title-opening-ai-prompt" },
  }) as HTMLTextAreaElement;
  const aiStatus = el("p", { class: "db-system-help", dataset: { testid: "db-title-opening-ai-status" } });
  const aiButton = el("button", {
    class: "btn small primary",
    text: "AI로 오프닝 만들기",
    attrs: { type: "button" },
    dataset: { testid: "db-title-opening-ai-generate" },
  }) as HTMLButtonElement;
  aiButton.addEventListener("click", () => {
    void runTitleArtGeneration(presetSelect.value, promptInput.value, aiButton, aiStatus, rerender);
  });

  return el("fieldset", {
    class: "oprn-db-fieldset db-title-workbench-group",
    dataset: { testid: "db-title-opening" },
    children: [
      el("legend", { text: "오프닝 연출" }),
      systemHelp("그림 위에 빛내림·빛 먼지·칼날 반짝임·물결·안개를 얹습니다. 프리셋은 구도가 비슷한 그림을 기준으로 좌표가 잡혀 있습니다."),
      field("효과 프리셋", presetSelect),
      presetDescription,
      applyPreset,
      el("div", {
        class: "db-title-opening-effects",
        dataset: { testid: "db-title-opening-effects" },
        children: effectRows.length ? [...effectRows, ...(clearEffects ? [clearEffects] : [])] : [systemHelp("켜진 효과가 없습니다.")],
      }),
      ...styleControls,
      el("div", {
        class: "db-title-opening-ai",
        children: [
          systemHelp("선택한 프리셋 구도로 키아트를 생성해 배경에 걸고 효과·로고 스타일을 함께 적용합니다. 되돌리기 한 번으로 취소됩니다."),
          field("장면 설명(선택)", promptInput),
          aiButton,
          aiStatus,
        ],
      }),
    ],
  });
}

async function runTitleArtGeneration(
  presetId: string,
  prompt: string,
  button: HTMLButtonElement,
  status: HTMLElement,
  rerender: SystemRefresh,
): Promise<void> {
  button.disabled = true;
  status.dataset.state = "running";
  status.textContent = "키아트를 생성하는 중입니다… (수십 초 걸릴 수 있습니다)";
  try {
    const { generateTitleArt, titleArtToolCalls } = await import("@/editor/titleArtGeneration");
    const title = store.getCurrent().system.titleScreen?.title;
    const art = await generateTitleArt({ preset: presetId, ...(prompt.trim() ? { prompt: prompt.trim() } : {}), ...(title ? { title } : {}) });
    if (!art.ok) {
      status.dataset.state = "error";
      status.textContent = art.summary;
      return;
    }
    const results = applyToolSequenceToStore(titleArtToolCalls(art), { summary: "AI 타이틀 키아트", source: "agent" });
    const failed = results.find((result) => !result.ok);
    if (failed) {
      status.dataset.state = "error";
      status.textContent = failed.summary;
      return;
    }
    status.dataset.state = "done";
    status.textContent = "키아트를 배경에 걸고 효과를 적용했습니다.";
    rerender();
  } catch (error) {
    status.dataset.state = "error";
    status.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    button.disabled = false;
  }
}

function koreanSelectField<T extends string>(
  label: string,
  testid: string,
  value: string,
  options: readonly { readonly id: T; readonly name: string }[],
  onChange: (value: T) => void,
): HTMLElement {
  return selectField(label, testid, value, options, (next) => {
    const match = options.find((option) => option.id === next);
    if (match) onChange(match.id);
  });
}

function titleLayerRow(layer: TitleBackgroundLayer, index: number, rerender: SystemRefresh): HTMLElement {
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
      numberField("스크롤X(px/s)", `db-field-title-screen-layer-${index}-scroll-x`, () => store.getCurrent().system.titleScreen!.backgroundLayers![index]!.scrollXPerSec ?? 0, (value) => {
        updateTitleScreen((settings) => {
          patchTitleLayer(settings, index, { scrollXPerSec: value });
        }, `system:title-screen:layer-${index}-scroll-x`);
        rerender("effects");
      }, { min: -480, max: 480 }, { fractional: true }),
      numberField("스크롤Y(px/s)", `db-field-title-screen-layer-${index}-scroll-y`, () => store.getCurrent().system.titleScreen!.backgroundLayers![index]!.scrollYPerSec ?? 0, (value) => {
        updateTitleScreen((settings) => {
          patchTitleLayer(settings, index, { scrollYPerSec: value });
        }, `system:title-screen:layer-${index}-scroll-y`);
        rerender("effects");
      }, { min: -480, max: 480 }, { fractional: true }),
      numberField("불투명도(%)", `db-field-title-screen-layer-${index}-opacity`, () => (store.getCurrent().system.titleScreen!.backgroundLayers![index]!.opacity ?? 1) * 100, (value) => {
        updateTitleScreen((settings) => {
          patchTitleLayer(settings, index, { opacityPercent: value });
        }, `system:title-screen:layer-${index}-opacity`);
        rerender("effects");
      }, { min: 0, max: 100 }, { fractional: true }),
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
  titleScreen: TitleScreenSettings,
): HTMLElement {
  // Every replay reads one current store snapshot. Text-only edits do not rebuild
  // this workbench, so the render-time project/settings must not drive the stage.
  const buildStage = (project: Project): HTMLElement => {
    const titleScreen = project.system.titleScreen ?? defaultTitleScreenSettings();
    const backgroundResourceId = titleScreen.backgroundResourceId ?? project.system.titleResourceId;
    const introLogoClass = titleIntroClass("logo", titleScreen.intro);
    const introMenuClass = titleIntroClass("menu", titleScreen.intro);
    const introDelayMs = titleScreen.intro?.delayMs ?? 0;
    const introStaggerMs = titleScreen.intro?.staggerMs ?? 90;
    const resolution = resolvePlayResolution(project.system);
    const resolutionAnalysis = analyzePlayResolution(resolution, project.maps);
    const bgUrl = resolveAssetResourceUrl(backgroundResourceId, { project });
    const stage = el("div", {
      class: "db-title-workbench-stage",
      dataset: { testid: "db-title-workbench-stage", playResolution: `${resolution.width}x${resolution.height}` },
      attrs: bgUrl
        ? {
            style: [
              `background-image:url("${bgUrl}")`,
              `background-size:${titleStageBackgroundSize(titleScreen.backgroundFit)}`,
              "background-repeat:no-repeat",
              "background-position:center",
              `image-rendering:${titleScreen.backgroundRendering === "smooth" ? "auto" : "pixelated"}`,
            ].join(";"),
          }
        : {},
    });
    stage.style.aspectRatio = `${resolutionAnalysis.aspectWidth} / ${resolutionAnalysis.aspectHeight}`;

    // 영역 효과(빛내림·물결·안개…)도 런타임과 같은 WebGL 레이어. 켜진 효과가 없으면 null.
    const effectsLayer = renderTitleEffectsLayer(titleScreen, backgroundResourceId, project, null);
    if (effectsLayer) stage.append(effectsLayer);

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
        dataset: { testid: "db-title-workbench-title-text", logoStyle: titleScreen.logoStyle ?? "plain" },
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

    const visibleOptions = listTitleMenuOptions(titleScreen, { autosaveAvailable: true });
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

  let stage = buildStage(store.getCurrent());
  const refreshStage = (kind: "values" | "effects"): void => {
    const current = store.getCurrent();
    if (kind === "values") {
      refreshTitleStageValues(stage, current);
      return;
    }
    const next = buildStage(current);
    stage.replaceWith(next);
    stage = next;
  };
  const replay = el("button", {
    class: "btn small",
    text: "연출 다시 재생",
    attrs: { type: "button" },
    dataset: { testid: "db-title-fx-replay" },
    on: {
      click: () => {
        refreshStage("effects");
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
        const current = store.getCurrent();
        const resourceId = current.system.titleScreen?.musicResourceId;
        if (resourceId) playAudioCommand({ resourceId, loop: true }, current);
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
  const preview = el("div", {
    class: "db-title-workbench-preview",
    dataset: { testid: "db-title-workbench-preview" },
    children: [
      el("span", { class: "db-title-workbench-preview-label", text: "타이틀 구성 미리보기" }),
      systemHelp("320×240 기준 좌표를 화면에 비례해 표시합니다. 이어하기는 자동 저장이 있을 때의 모습입니다."),
      stage,
      el("div", {
        class: "db-title-workbench-audio",
        children: [
          play,
          stop,
          replay,
          el("code", {
            class: "db-title-workbench-music-id",
            text: musicId ? systemResourceName("music", musicId) : "BGM 없음",
            dataset: { testid: "db-title-workbench-music-id" },
          }),
        ],
      }),
    ],
  });
  titleStageRefreshers.set(preview, refreshStage);
  return preview;
}


const SYSTEM_SECTION_HELP: Record<Exclude<SystemSectionSlug, "overview">, string> = {
  party: "게임을 시작할 멤버와 순서를 정합니다.",
  display: "게임 화면의 크기와 맵에 미치는 영향을 확인합니다.",
  hud: "게임 화면에 표시할 정보와 디자인을 구성합니다.",
  menu: "플레이 중 ESC 또는 X로 여는 메뉴의 디자인을 선택하고 미리 확인합니다.",
  dialogue: "NPC 대사창의 모양·글꼴·글자 소리를 고르고, 대사 종류별 모양을 확인합니다.",
  font: "화면 역할마다 글꼴을 고르고 실제 문장으로 비교합니다.",
  resources: "프로젝트에서 공유하는 그래픽을 선택합니다.",
  startup: "전투 방식, 기본 소리와 보상 규칙을 정합니다.",
  optin: "선택 기능과 기존 프로젝트의 세부 설정을 관리합니다.",
  time: "시간 진행, 계절 길이와 하루 종료 동작을 정합니다.",
  typechart: "공격 타입과 방어 타입 사이의 배율을 편집합니다.",
  title: "시작 화면을 구성하고 표시·메뉴·소리·연출을 조정합니다.",
};

function systemHelp(text: string): HTMLElement {
  return el("p", { class: "db-system-help", text });
}

function systemSectionLink(text: string, target: SystemSectionSlug, testid: string): HTMLElement {
  return el("button", { class: "btn", text, attrs: { type: "button" }, dataset: { systemTarget: target, testid } });
}

function systemResourceName(kind: Parameters<typeof baseResourcePickerControl>[0]["kind"], id: string): string {
  return listDatabaseResourceOptions(kind, store.getCurrent()).find((entry) => entry.id === id)?.name ?? id;
}

/** System-only presentation, preserving the shared picker and historical ID input. */
function resourcePickerControl(options: Parameters<typeof baseResourcePickerControl>[0]): HTMLElement {
  const restorePickerFocus = (): void => {
    document.querySelector<HTMLElement>(`[data-testid="${options.testid}-set"]`)?.focus({ preventScroll: true });
  };
  const control = baseResourcePickerControl({
    ...options,
    rerender: () => { options.rerender(); restorePickerFocus(); },
  });
  const name = control.querySelector<HTMLElement>(".db-resource-picker-inline-name");
  if (name) name.textContent = options.resourceId ? systemResourceName(options.kind, options.resourceId) : "선택한 리소스 없음";
  const pick = control.querySelector<HTMLElement>(`[data-testid="${options.testid}-set"]`);
  if (pick) pick.textContent = options.resourceId ? "변경" : "선택";
  const meta = control.querySelector<HTMLElement>(".db-resource-picker-control-meta");
  if (options.allowClear) {
    const clear = el("button", {
      class: "btn", text: "비우기", attrs: { type: "button", "aria-label": `${options.label} 비우기` },
      dataset: { testid: `${options.testid}-clear` },
      on: { click: () => { options.onChange({ resourceId: "" }); options.rerender(); restorePickerFocus(); } },
    });
    clear.disabled = !options.resourceId;
    meta?.append(clear);
  }
  // File paths remain available in the picker, not as primary settings content.
  control.querySelector(".db-resource-picker-audio-id")?.remove();
  control.querySelector(".db-resource-picker-audio-url")?.remove();
  return control;
}

/** Canonical domain readers keep every committed number and stepper in sync. */
function numberField(
  label: string,
  testid: string,
  readValue: () => number,
  onInput: (value: number) => void,
  bounds?: Parameters<typeof baseNumberField>[4],
  options?: Parameters<typeof baseNumberField>[5] & { readonly fractional?: boolean },
): HTMLElement {
  const row = baseNumberField(label, testid, readValue(), (value) => {
    onInput(value);
    synchronize();
  }, bounds, options);
  const input = row.querySelector<HTMLInputElement>("input")!;
  const decrement = row.querySelector<HTMLButtonElement>(".db-number-stepper-dec")!;
  const increment = row.querySelector<HTMLButtonElement>(".db-number-stepper-inc")!;
  const synchronize = (): void => {
    const committed = readValue();
    input.value = String(committed);
    if (bounds) {
      input.min = String(bounds.min);
      input.max = String(bounds.max);
    }
    decrement.disabled = options?.disabled === true || (bounds !== undefined && committed <= bounds.min);
    increment.disabled = options?.disabled === true || (bounds !== undefined && committed >= bounds.max);
  };
  if (options?.fractional) input.step = "any";
  systemNumberBindings.set(input, synchronize);
  input.addEventListener("input", (event) => {
    // Native digits remain untouched until change. Shared steppers dispatch an
    // ordinary input Event and commit immediately through the same binding.
    if (typeof InputEvent !== "undefined" && event instanceof InputEvent) event.stopImmediatePropagation();
  }, true);
  return row;
}

function synchronizeSystemNumbers(root: HTMLElement): void {
  for (const input of root.querySelectorAll<HTMLInputElement>("input")) {
    systemNumberBindings.get(input)?.();
  }
}

/** Values and Replay share the live stage; transport controls never reparent. */
function refreshTitleStageValues(stage: HTMLElement, project: Project): void {
  const resolution = resolvePlayResolution(project.system);
  const analysis = analyzePlayResolution(resolution, project.maps);
  stage.dataset.playResolution = `${resolution.width}x${resolution.height}`;
  stage.style.aspectRatio = `${analysis.aspectWidth} / ${analysis.aspectHeight}`;
  const title = project.system.titleScreen ?? defaultTitleScreenSettings();
  const text = stage.querySelector<HTMLElement>('[data-testid="db-title-workbench-title-text"]');
  if (text) {
    text.textContent = title.title || "(제목 없음)";
    text.style.left = `${title.layout.titleX / 320 * 100}%`;
    text.style.top = `${title.layout.titleY / 240 * 100}%`;
  }
  const logo = stage.querySelector<HTMLElement>('[data-testid="db-title-workbench-logo"]');
  if (logo && title.titleGraphic) {
    logo.style.left = `${title.titleGraphic.x / 320 * 100}%`;
    logo.style.top = `${title.titleGraphic.y / 240 * 100}%`;
  }
  const menu = stage.querySelector<HTMLElement>('[data-testid="db-title-workbench-menu-preview"]');
  if (menu) {
    menu.style.left = `${title.layout.menuX / 320 * 100}%`;
    menu.style.top = `${title.layout.menuY / 240 * 100}%`;
    for (const option of listTitleMenuOptions(title, { autosaveAvailable: true })) {
      const item = menu.querySelector<HTMLElement>(`[data-title-menu-option="${option.id}"]`);
      if (item) item.textContent = option.label;
    }
  }
}

function refreshSystemDerived(form: HTMLElement, kind: "values" | "effects"): void {
  const project = store.getCurrent();
  synchronizeSystemNumbers(form);
  const preview = form.querySelector<HTMLElement>('[data-testid="db-title-workbench-preview"]');
  if (preview) titleStageRefreshers.get(preview)!(kind);
  const diagnostics = form.querySelector<HTMLElement>('[data-testid="db-system-resolution-diagnostics"]');
  diagnostics?.replaceWith(playResolutionDiagnostics(project, resolvePlayResolution(project.system)));
  const preset = form.querySelector<HTMLSelectElement>('[data-testid="db-field-system-resolution-preset"]');
  if (preset) preset.value = playResolutionPreset(resolvePlayResolution(project.system));
  refreshTimeSummary(form);
}
