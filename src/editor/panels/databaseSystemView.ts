import { normalizeGallerySettings } from "@/project/gallery";
import { fieldHudEditor } from "./databaseFieldHud";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { genId } from "@/util/id";
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
import {
  listTitleMenuOptions,
  playTitleTransition,
  renderTitleEffectsLayer,
  renderTitleFxStack,
  renderTitleScreen,
  titleIntroClass,
  titleMenuTop,
} from "@/player/titleScreen";
import { preloadRuntimeStyles } from "@/app/runtimeStyles";
import {
  TITLE_OPENING_FREE_PRESET,
  mountTitleEffectOverlay,
  titleOpeningEffectsEditor,
  titleOpeningPresetChips,
  type TitleOpeningHost,
} from "./titleOpeningEditor";
import {
  MAX_TITLE_LOGO_SUBTITLE_LENGTH,
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
          // 2026-09-25: 12종 전부 활성이다(정면·측면 유리 뼈대의 색·HUD 변형 + 몬스터 대치). deprecated 표식이 다시
          // 생기면 저장된 그 스킨 항목만 「(지원 종료)」로 남겨 선택을 보존한다(암묵 remap 금지).
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
        checkboxField("선제·기습 개시 굴림 (심볼 접촉 방향 포함)", "db-field-system-battle-formation-roll", project.system.battleFormationRoll === true, (checked) => {
          updateSystem((draft) => {
            if (checked) draft.system.battleFormationRoll = true;
            else delete draft.system.battleFormationRoll;
          });
        }),
        numberField("도주 실패마다 확률 가산 (%p)", "db-field-system-escape-bonus", () => store.getCurrent().system.escapeBonusPercent ?? 10, (value) => {
          updateSystem((draft) => {
            const next = Math.max(0, Math.min(100, Math.round(value)));
            if (!Number.isFinite(value) || next === 10) delete draft.system.escapeBonusPercent;
            else draft.system.escapeBonusPercent = next;
          }, "system:escape-bonus");
        }, { min: 0, max: 100 }),
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
        checkboxField("클릭(탭)으로 걷기", "db-field-system-pointer-movement", project.system.pointerMovement === true, (checked) => {
          updateSystem((draft) => {
            if (checked) draft.system.pointerMovement = true;
            else delete draft.system.pointerMovement;
          });
        }),
      ]),
      battleResourcesFieldset(project),
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
      rm2k3Fieldset("갤러리", [
        checkboxField("갤러리 사용", "db-field-system-gallery-enabled", project.system.gallery?.enabled === true, (checked) => {
          updateSystem((draft) => {
            const next = normalizeGallerySettings({ enabled: checked, label: draft.system.gallery?.label });
            if (next) draft.system.gallery = next;
            else delete draft.system.gallery;
          });
        }),
        galleryLabelField(project.system.gallery?.label ?? ""),
        systemHelp("켜면 플레이 중 메뉴의 기록에 이 이름으로 들어갑니다. 이름은 갤러리 대신 원하는 낱말을 적어도 됩니다. 그림 표시에서 「남기기」를 켠 그림만 모입니다."),
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
            titleScreenWorkbenchPreview(titleScreen, rerender),
            el("div", {
              class: "db-title-workbench-fields",
              children: [
                titleWorkbenchJumpNav(),
                titleScreenOpeningFieldset(titleScreen, rerender),
                titleScreenDisplayFieldset(titleScreen, titleBackgroundResourceId, project.system.titleResourceId, rerender),
                titleScreenMenuFieldset(titleScreen, rerender),
                titleScreenEffectsFieldset(titleScreen, rerender),
                titleScreenAudioFieldset(titleScreen, rerender),
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
    checkboxField("동료도 싸움(V 키로 조작 교대)", "db-field-system-action-combat-allies", config.allies === true, (checked) => {
      updateSystem((draft) => {
        draft.system.actionCombat ??= { enabled: true };
        if (checked) draft.system.actionCombat.allies = true;
        else delete draft.system.actionCombat.allies;
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

/**
 * 전투 자원 — 리미트·기력·파티 게이지·약점 추가 행동·감정 상성(battleGauges/battleEmotion).
 * 모두 기본 꺼짐이고 끄면 설정을 지워 옛 JSON 바이트를 지킨다(normalizeSystemRecords 와 같은 계약).
 */
function battleResourcesFieldset(project: ReturnType<typeof store.getCurrent>): HTMLElement {
  const system = project.system;
  const toggle = (
    label: string,
    testid: string,
    key: "limitGauge" | "resource2" | "partyGauge",
  ): HTMLElement => checkboxField(label, testid, system[key]?.enabled === true, (checked) => {
    updateSystem((draft) => {
      if (checked) draft.system[key] = { ...(draft.system[key] ?? {}), enabled: true };
      else delete draft.system[key];
    });
  });
  return rm2k3Fieldset("전투 자원", [
    systemHelp("리미트는 맞을수록 차고 가득 차면 리미트 기술을 씁니다. 기력은 주고받는 피해로 차는 제2 기술 자원입니다(기술 습득 TP 와 별개). 연계 게이지는 파티가 함께 채우고 추격 연계기가 씁니다. 스킬 탭 「전투 자원」에서 소모량을 정합니다."),
    toggle("리미트 게이지", "db-field-system-limit-gauge", "limitGauge"),
    numberField("리미트: 받은 피해 충전율(%)", "db-field-system-limit-taken-rate", () => store.getCurrent().system.limitGauge?.takenRate ?? 100, (value) => {
      updateSystem((draft) => {
        if (draft.system.limitGauge) draft.system.limitGauge.takenRate = value;
      }, "system:limit-taken-rate");
    }, { min: 0, max: 1000 }, system.limitGauge?.enabled ? undefined : { disabled: true, disabledReason: "리미트 게이지를 먼저 켜세요." }),
    toggle("기력(제2 자원)", "db-field-system-resource2", "resource2"),
    numberField("기력 최대치", "db-field-system-resource2-max", () => store.getCurrent().system.resource2?.max ?? 100, (value) => {
      updateSystem((draft) => {
        if (draft.system.resource2) draft.system.resource2.max = value;
      }, "system:resource2-max");
    }, { min: 1, max: 999 }, system.resource2?.enabled ? undefined : { disabled: true, disabledReason: "기력을 먼저 켜세요." }),
    toggle("연계 게이지(파티 공용)", "db-field-system-party-gauge", "partyGauge"),
    numberField("연계 게이지: 명중당 충전", "db-field-system-party-gauge-gain", () => store.getCurrent().system.partyGauge?.gainPerHit ?? 10, (value) => {
      updateSystem((draft) => {
        if (draft.system.partyGauge) draft.system.partyGauge.gainPerHit = value;
      }, "system:party-gauge-gain");
    }, { min: 0, max: 999 }, system.partyGauge?.enabled ? undefined : { disabled: true, disabledReason: "연계 게이지를 먼저 켜세요." }),
    checkboxField("약점을 찌르면 한 번 더 행동", "db-field-system-weakness-extra-action", system.weaknessExtraAction === true, (checked) => {
      updateSystem((draft) => {
        if (checked) draft.system.weaknessExtraAction = true;
        else delete draft.system.weaknessExtraAction;
      });
    }),
    field("감정 상성", (() => {
      // 한 줄에 하나: 「공격 계열>대상 계열=배율」. 상태 탭의 감정 계열 이름과 같게 적는다.
      const textarea = el("textarea", {
        attrs: { rows: "3", placeholder: "기쁨>분노=1.5\n분노>슬픔=1.5\n슬픔>기쁨=1.5", spellcheck: "false" },
        dataset: { testid: "db-field-system-emotion-cycle" },
      }) as HTMLTextAreaElement;
      textarea.value = formatEmotionCycle(system.emotionCycle);
      textarea.addEventListener("change", () => {
        const rules = parseEmotionCycle(textarea.value);
        updateSystem((draft) => {
          if (rules.length > 0) draft.system.emotionCycle = rules;
          else delete draft.system.emotionCycle;
        });
        textarea.value = formatEmotionCycle(rules);
      });
      return textarea;
    })()),
  ]);
}

export function formatEmotionCycle(rules: readonly { attackerFamily: string; targetFamily: string; multiplier: number }[] | undefined): string {
  return (rules ?? []).map((rule) => `${rule.attackerFamily}>${rule.targetFamily}=${rule.multiplier}`).join("\n");
}

/** 「공격>대상=배율」 줄들을 규칙으로. 형식이 틀린 줄은 버린다. */
export function parseEmotionCycle(text: string): { attackerFamily: string; targetFamily: string; multiplier: number }[] {
  return text.split(/\r?\n/).flatMap((line) => {
    const match = line.trim().match(/^(.+?)\s*>\s*(.+?)\s*=\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) return [];
    const multiplier = Number(match[3]);
    if (!Number.isFinite(multiplier) || multiplier < 0) return [];
    return [{ attackerFamily: match[1].trim(), targetFamily: match[2].trim(), multiplier }];
  });
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

function galleryLabelField(value: string): HTMLElement {
  const input = el("input", {
    attrs: { type: "text", maxlength: "24", placeholder: "갤러리", spellcheck: "false" },
    value,
    dataset: { testid: "db-field-system-gallery-label" },
  }) as HTMLInputElement;
  input.addEventListener("change", () => {
    updateSystem((draft) => {
      const next = normalizeGallerySettings({
        enabled: draft.system.gallery?.enabled === true,
        label: input.value,
      });
      if (next) draft.system.gallery = next;
      else delete draft.system.gallery;
    }, "system:gallery-label");
  });
  return field("메뉴 이름", input);
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
        const previous = store.getCurrent().system.titleScreen;
        const changed = (previous?.backgroundResourceId ?? "") !== (result.resourceId ?? "");
        // 효과 좌표는 그림 UV 기준이라 그림이 바뀌면 빛내림·칼날 위치가 엉뚱한 곳에 남는다.
        const dropEffects = changed && (previous?.effects?.length ?? 0) > 0 && globalThis.confirm(
          "오프닝 효과 좌표는 이전 그림에 맞춰져 있습니다. 새 그림에서는 엉뚱한 곳에 보일 수 있습니다.\n효과를 지울까요? (취소하면 그대로 둡니다)",
        );
        updateTitleScreen((settings) => {
          settings.backgroundResourceId = emptyToUndefined(result.resourceId);
          if (dropEffects) delete settings.effects;
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
  );

  children.push(...titleLogoStyleControls(titleScreen, rerender), ...titleBackgroundStyleControls(titleScreen, rerender));

  return el("fieldset", {
    class: "oprn-db-fieldset db-title-workbench-group",
    dataset: { testid: "db-title-workbench-display" },
    children: [el("legend", { text: "글자·배경" }), ...children],
  });
}

function titleScreenAudioFieldset(titleScreen: TitleScreenSettings, rerender: SystemRefresh): HTMLElement {
  return el("fieldset", {
    class: "oprn-db-fieldset db-title-workbench-group",
    dataset: { testid: "db-title-workbench-audio" },
    children: [
      el("legend", { text: "소리" }),
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
      titleMenuStyleControl(titleScreen, rerender),
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
        dataset: { testid: "db-title-menu-option-credits" },
        children: [
          textControl("크레딧", titleScreen.menuLabels.credits ?? "크레딧", (value) => {
            updateTitleScreen((settings) => {
              settings.menuLabels.credits = value;
            }, "system:title-screen:menu-credits");
            rerender("values");
          }, "db-field-title-screen-credits"),
          el("span", { class: "db-title-menu-option-note", text: "저작자 표기 창 · 항상 표시" }),
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

// ─────────────────────────────────────────────────────────────────────────────
// 오프닝 효과 편집기 연결 — 무대 손잡이·효과 목록이 부르는 host.
// 끌기·슬라이더는 효과 canvas 만 갈아 끼우고(liveEffects), 추가·삭제만 전체를 다시 그린다.
// ─────────────────────────────────────────────────────────────────────────────

/** 고른 프리셋 칩 — 패널을 다시 그려도 유지된다. */
let titleOpeningPresetId: string = TITLE_OPENING_PRESETS[0]?.id ?? TITLE_OPENING_FREE_PRESET;

function titleOpeningHost(rerender: SystemRefresh): TitleOpeningHost {
  return {
    update: (mutator, key) => updateTitleScreen(mutator, key),
    current: () => store.getCurrent().system.titleScreen ?? defaultTitleScreenSettings(),
    rerender: () => rerender(),
    liveEffects: () => refreshTitleEffectsLayer(),
    generateDepth: (index, status) => runTitleDepthGeneration(index, status, rerender),
  };
}

/** 배경 키아트를 dataURL 로 읽는다. 번들 경로·blob 이면 받아서 바꾼다. */
async function titleBackgroundDataUrl(): Promise<string | undefined> {
  const project = store.getCurrent();
  const resourceId = project.system.titleScreen?.backgroundResourceId ?? project.system.titleResourceId;
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;
  const blob = await (await fetch(url)).blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("키아트 그림을 읽지 못했습니다."));
    reader.readAsDataURL(blob);
  });
}

/** 키아트에서 깊이 지도를 만들어 리소스로 등록하고, 켜진 깊이 시차 효과(index 가 없으면 전부)에 연결한다. */
async function attachTitleDepthMap(index?: number, signal?: AbortSignal): Promise<void> {
  const art = await titleBackgroundDataUrl();
  if (!art) throw new Error("배경 키아트가 없습니다. 먼저 배경 그림을 고르거나 생성하세요.");
  const { generateTitleDepthMap } = await import("@/editor/titleDepthGeneration");
  const depth = await generateTitleDepthMap(art, signal ? { signal } : {});
  signal?.throwIfAborted();
  const resourceId = genId("title_depth");
  const results = applyToolSequenceToStore(
    [{ name: "upsert_resource", args: { resource: { id: resourceId, name: "타이틀 깊이 지도", kind: "title", dataUrl: depth.dataUrl } } }],
    { summary: "AI 타이틀 깊이 지도", source: "agent" },
  );
  const failed = results.find((result) => !result.ok);
  if (failed) throw new Error(failed.summary);
  updateTitleScreen((settings) => {
    settings.effects?.forEach((effect, at) => {
      if (effect.kind === "parallax" && (index === undefined || index === at)) effect.depthResourceId = resourceId;
    });
  });
}

/** 깊이 시차 효과의 「깊이 지도 만들기」 버튼. */
async function runTitleDepthGeneration(index: number, status: HTMLElement, rerender: SystemRefresh): Promise<void> {
  status.dataset.state = "running";
  status.textContent = "키아트를 보고 깊이 지도를 만드는 중입니다… (수십 초 걸릴 수 있습니다)";
  try {
    await attachTitleDepthMap(index);
    status.dataset.state = "done";
    rerender();
  } catch (error) {
    status.dataset.state = "error";
    status.textContent = error instanceof Error ? error.message : String(error);
  }
}

function refreshTitleEffectsLayer(): void {
  const stage = document.querySelector<HTMLElement>('[data-testid="db-title-workbench-stage"]');
  if (!stage) return;
  const project = store.getCurrent();
  const settings = project.system.titleScreen ?? defaultTitleScreenSettings();
  const backgroundResourceId = settings.backgroundResourceId ?? project.system.titleResourceId;
  const existing = stage.querySelector<HTMLElement>("[data-title-effects-signature]");
  const next = renderTitleEffectsLayer(settings, backgroundResourceId, project, existing);
  if (next === existing) return;
  if (!next) {
    existing?.remove();
    return;
  }
  if (existing) existing.replaceWith(next);
  else stage.prepend(next);
}

/** 오른쪽 칸 맨 위의 바로가기 — 칸이 길어서 원하는 묶음으로 바로 뛴다. */
function titleWorkbenchJumpNav(): HTMLElement {
  const targets = [
    ["오프닝 효과", "db-title-opening"],
    ["글자·배경", "db-title-workbench-display"],
    ["메뉴", "db-title-workbench-menu"],
    ["연출", "db-title-workbench-effects"],
    ["소리", "db-title-workbench-audio"],
  ] as const;
  return el("nav", {
    class: "db-title-workbench-jump",
    attrs: { "aria-label": "타이틀 설정 바로가기" },
    dataset: { testid: "db-title-workbench-jump" },
    children: targets.map(([label, testid]) =>
      el("button", {
        class: "db-title-workbench-jump-link",
        text: label,
        attrs: { type: "button" },
        on: {
          click: (event: Event) => {
            const root = (event.currentTarget as HTMLElement).closest(".db-title-workbench-fields");
            root?.querySelector<HTMLElement>(`[data-testid="${testid}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
          },
        },
      }),
    ),
  });
}

function titleLogoStyleControls(titleScreen: TitleScreenSettings, rerender: SystemRefresh): HTMLElement[] {
  return [
    koreanSelectField("로고 스타일", "db-field-title-screen-logo-style", titleScreen.logoStyle ?? "plain", TITLE_LOGO_STYLE_OPTIONS, (value) => {
      updateTitleScreen((settings) => {
        if (value === "plain") delete settings.logoStyle;
        else settings.logoStyle = value;
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
}

function titleBackgroundStyleControls(titleScreen: TitleScreenSettings, rerender: SystemRefresh): HTMLElement[] {
  return [
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
  ];
}

function titleMenuStyleControl(titleScreen: TitleScreenSettings, rerender: SystemRefresh): HTMLElement {
  return koreanSelectField("메뉴 스타일", "db-field-title-screen-menu-style", titleScreen.menuStyle ?? "window", TITLE_MENU_STYLE_OPTIONS, (value) => {
    updateTitleScreen((settings) => {
      if (value === "window") delete settings.menuStyle;
      else settings.menuStyle = value;
    });
    rerender();
  });
}

/**
 * 오프닝 효과 — 한 칸에 세 단계만 둔다.
 * 1) 분위기 칩(프리셋 10종 + 「자유」) → 그림 만들기 또는 지금 그림에 효과만 입히기.
 * 2) 켜진 효과 목록 + 고른 효과의 값 조절(무대 위 손잡이로도 끈다).
 * 생성은 기존 쓰기 툴(upsert_resource → set_title_screen) 묶음 한 번이라 되돌리기 한 번으로 취소된다.
 */
function titleScreenOpeningFieldset(titleScreen: TitleScreenSettings, rerender: SystemRefresh): HTMLElement {
  if (titleOpeningPresetId !== TITLE_OPENING_FREE_PRESET && !findTitleOpeningPreset(titleOpeningPresetId)) {
    titleOpeningPresetId = TITLE_OPENING_PRESETS[0]?.id ?? TITLE_OPENING_FREE_PRESET;
  }
  const isFree = () => titleOpeningPresetId === TITLE_OPENING_FREE_PRESET;
  const presetDescription = el("p", { class: "db-system-help db-title-preset-description", dataset: { testid: "db-title-opening-preset-description" } });
  const promptInput = el("textarea", {
    class: "db-title-opening-prompt",
    attrs: { rows: "3" },
    dataset: { testid: "db-title-opening-ai-prompt" },
  }) as HTMLTextAreaElement;
  const applyPreset = el("button", {
    class: "btn small",
    text: "지금 그림에 효과만 입히기",
    attrs: { type: "button" },
    dataset: { testid: "db-title-opening-preset-apply" },
  }) as HTMLButtonElement;
  const aiStatus = el("p", { class: "db-system-help", dataset: { testid: "db-title-opening-ai-status" } });
  const aiButton = el("button", {
    class: "btn small primary",
    attrs: { type: "button" },
    dataset: { testid: "db-title-opening-ai-generate" },
  }) as HTMLButtonElement;
  let aiAbort: AbortController | null = null;

  const aiIdleLabel = () => (isFree() ? "설명대로 키아트 만들기" : "이 분위기로 키아트 만들기");
  const syncMode = () => {
    const preset = findTitleOpeningPreset(titleOpeningPresetId);
    presetDescription.textContent = preset
      ? preset.description
      : "프리셋 없이 장면 설명만으로 그림을 만들고, 그림을 보고 어울리는 효과를 골라 위치까지 맞춥니다.";
    promptInput.placeholder = isFree()
      ? "필수 — 예: 폭풍우 치는 밤바다 위 등대, 부서진 배의 돛"
      : "선택 — 예: 칼 두 자루가 기대 선 큰 나무, 강 건너 성 마을";
    applyPreset.hidden = isFree();
    if (!aiAbort) aiButton.textContent = aiIdleLabel();
  };

  applyPreset.addEventListener("click", () => {
    const preset = findTitleOpeningPreset(titleOpeningPresetId);
    if (!preset) return;
    const current = store.getCurrent().system.titleScreen;
    if ((current?.effects?.length ?? 0) > 0 && !globalThis.confirm(
      "지금 효과·로고·메뉴 스타일·입장 시퀀스·전환·배경 맞춤을 프리셋 값으로 바꿉니다. 계속할까요? (되돌리기로 복구할 수 있습니다)",
    )) return;
    updateTitleScreen((settings) => {
      settings.effects = titleOpeningPresetEffects(preset);
      settings.logoStyle = preset.logoStyle;
      settings.menuStyle = preset.menuStyle;
      settings.sequence = { ...preset.sequence };
      if (preset.logoShine === "none") delete settings.logoShine;
      else settings.logoShine = preset.logoShine;
      settings.transition = { ...preset.transition };
      settings.backgroundFit = "cover";
      settings.backgroundRendering = "smooth";
    });
    rerender();
  });

  aiButton.addEventListener("click", () => {
    if (aiAbort) {
      aiAbort.abort();
      return;
    }
    if (isFree() && promptInput.value.trim().length < 4) {
      aiStatus.dataset.state = "error";
      aiStatus.textContent = "「자유」는 장면 설명이 있어야 그릴 수 있습니다. 한 줄이면 됩니다.";
      promptInput.focus();
      return;
    }
    const current = store.getCurrent().system.titleScreen;
    if ((current?.backgroundResourceId || (current?.effects?.length ?? 0) > 0) && !globalThis.confirm(
      "지금 타이틀 배경과 효과·스타일을 새 키아트로 바꿉니다. 계속할까요? (되돌리기로 복구할 수 있습니다)",
    )) return;
    aiAbort = new AbortController();
    aiButton.textContent = "생성 취소";
    const presetId = isFree() ? undefined : titleOpeningPresetId;
    void runTitleArtGeneration(presetId, promptInput.value, aiStatus, rerender, aiAbort.signal).finally(() => {
      aiAbort = null;
      aiButton.textContent = aiIdleLabel();
    });
  });

  const logoStatus = el("p", { class: "db-system-help", dataset: { testid: "db-title-opening-logo-status" } });
  const logoButton = el("button", {
    class: "btn small",
    text: "로고 그림 만들기",
    attrs: { type: "button", title: "게임 타이틀 글자를 투명 배경 로고 그림으로 그려 타이틀에 겁니다" },
    dataset: { testid: "db-title-opening-logo-generate" },
  }) as HTMLButtonElement;
  let logoAbort: AbortController | null = null;
  logoButton.addEventListener("click", () => {
    if (logoAbort) {
      logoAbort.abort();
      return;
    }
    const current = store.getCurrent().system.titleScreen;
    if (current?.titleGraphic?.mode === "graphic" && current.titleGraphic.resourceId && !globalThis.confirm(
      "지금 로고 그림을 새 그림으로 바꿉니다. 계속할까요? (되돌리기로 복구할 수 있습니다)",
    )) return;
    logoAbort = new AbortController();
    logoButton.textContent = "로고 생성 취소";
    void runTitleLogoGeneration(promptInput.value, logoStatus, rerender, logoAbort.signal).finally(() => {
      logoAbort = null;
      logoButton.textContent = "로고 그림 만들기";
    });
  });

  const chips = titleOpeningPresetChips(titleOpeningPresetId, (presetId) => {
    titleOpeningPresetId = presetId;
    syncMode();
  });
  syncMode();

  return el("fieldset", {
    class: "oprn-db-fieldset db-title-workbench-group db-title-opening",
    dataset: { testid: "db-title-opening" },
    children: [
      el("legend", { text: "오프닝 효과" }),
      el("div", {
        class: "db-title-opening-ai",
        children: [
          el("h4", { class: "db-title-opening-step", text: "① 분위기 고르고 그림 만들기" }),
          chips,
          presetDescription,
          field("장면 설명", promptInput),
          el("div", { class: "db-title-opening-actions", children: [aiButton, applyPreset, logoButton] }),
          aiStatus,
          logoStatus,
        ],
      }),
      el("h4", { class: "db-title-opening-step", text: "② 효과 다듬기 — 무대 위 손잡이를 끌어 위치를 옮깁니다" }),
      titleOpeningEffectsEditor(titleScreen, titleOpeningHost(rerender)),
      el("h4", { class: "db-title-opening-step", text: "③ 입장·전환 — 처음 켤 때와 「새 게임」을 누를 때" }),
      titleOpeningEntranceControls(titleScreen, rerender),
    ],
  });
}

async function runTitleArtGeneration(
  presetId: string | undefined,
  prompt: string,
  status: HTMLElement,
  rerender: SystemRefresh,
  signal: AbortSignal,
): Promise<void> {
  status.dataset.state = "running";
  status.textContent = "키아트를 생성하는 중입니다… (수십 초 걸릴 수 있습니다)";
  try {
    const { generateTitleArt, titleArtToolCalls } = await import("@/editor/titleArtGeneration");
    const title = store.getCurrent().system.titleScreen?.title;
    const art = await generateTitleArt(
      { ...(presetId ? { preset: presetId } : {}), ...(prompt.trim() ? { prompt: prompt.trim() } : {}), ...(title ? { title } : {}) },
      { signal },
    );
    signal.throwIfAborted();
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
    // 깊이 시차가 켜졌으면 새 그림에 맞는 깊이 지도도 이어서 만든다. 실패해도 키아트는 그대로 둔다(기본 기울기로 움직인다).
    let depthNote = "";
    if (store.getCurrent().system.titleScreen?.effects?.some((effect) => effect.kind === "parallax")) {
      status.textContent = "키아트를 걸었습니다. 입체 움직임용 깊이 지도를 만드는 중입니다…";
      try {
        await attachTitleDepthMap(undefined, signal);
      } catch (error) {
        if (signal.aborted) throw error;
        depthNote = " 깊이 지도는 만들지 못해 기본 기울기로 움직입니다.";
      }
    }
    status.dataset.state = "done";
    // 맞춤이 실패하면 프리셋 좌표가 그대로 들어간다 — 그림과 어긋날 수 있다는 사실을 숨기지 않는다.
    const freeFitFailed = !presetId && art.effects?.length === 1 && art.effects[0]?.kind === "camera";
    status.textContent = freeFitFailed
      ? "키아트를 배경에 걸었습니다. 효과 위치 맞춤은 실패해 화면 흔들림만 넣었습니다. 아래 목록에서 효과를 더하세요."
      : art.effects
        ? "키아트를 배경에 걸고, 그림을 보고 위치를 맞춘 효과를 적용했습니다."
        : "키아트를 배경에 걸었습니다. 효과 위치 맞춤은 실패해 프리셋 좌표를 그대로 썼으니 그림과 어긋날 수 있습니다.";
    status.textContent += depthNote;
    rerender();
  } catch (error) {
    if (signal.aborted) {
      status.dataset.state = "idle";
      status.textContent = "생성을 취소했습니다. 바뀐 것은 없습니다.";
      return;
    }
    status.dataset.state = "error";
    status.textContent = error instanceof Error ? error.message : String(error);
  }
}

async function runTitleLogoGeneration(
  mood: string,
  status: HTMLElement,
  rerender: SystemRefresh,
  signal: AbortSignal,
): Promise<void> {
  const title = store.getCurrent().system.titleScreen?.title?.trim() ?? "";
  if (!title) {
    status.dataset.state = "error";
    status.textContent = "게임 타이틀이 비어 있습니다. 위 「타이틀」 칸을 먼저 채우세요.";
    return;
  }
  status.dataset.state = "running";
  status.textContent = `「${title}」 로고를 그리는 중입니다… (수십 초 걸릴 수 있습니다)`;
  try {
    const { generateTitleLogo, titleLogoToolCalls } = await import("@/editor/titleLogoGeneration");
    const logo = await generateTitleLogo({ title, mood: mood.trim() || undefined }, { signal });
    signal.throwIfAborted();
    if (!logo.ok) {
      status.dataset.state = "error";
      status.textContent = logo.summary;
      return;
    }
    const results = applyToolSequenceToStore(titleLogoToolCalls(logo), { summary: "AI 타이틀 로고", source: "agent" });
    const failed = results.find((result) => !result.ok);
    if (failed) {
      status.dataset.state = "error";
      status.textContent = failed.summary;
      return;
    }
    status.dataset.state = "done";
    status.textContent = "로고 그림을 만들어 타이틀에 걸었습니다. 글자가 틀렸으면 다시 누르세요.";
    rerender();
  } catch (error) {
    if (signal.aborted) {
      status.dataset.state = "idle";
      status.textContent = "생성을 취소했습니다. 바뀐 것은 없습니다.";
      return;
    }
    status.dataset.state = "error";
    status.textContent = error instanceof Error ? error.message : String(error);
  }
}

const TITLE_LOGO_REVEAL_OPTIONS = [
  { id: "bloom", name: "피어남" },
  { id: "rise", name: "떠오름" },
  { id: "fade", name: "서서히" },
  { id: "wipe", name: "걷힘" },
] as const;
const TITLE_LOGO_SHINE_OPTIONS = [
  { id: "none", name: "없음" },
  { id: "once", name: "한 번" },
  { id: "loop", name: "반복" },
] as const;
const TITLE_TRANSITION_OPTIONS = [
  { id: "none", name: "없음" },
  { id: "flash", name: "섬광" },
  { id: "fade", name: "암전" },
  { id: "zoom", name: "빨려 듦" },
  { id: "mist", name: "안개" },
] as const;

/** 입장 시퀀스·로고 반짝임·새 게임 전환. 값은 런타임과 같은 필드를 쓰고, 미리보기는 실제 런타임 렌더를 띄운다. */
function titleOpeningEntranceControls(titleScreen: TitleScreenSettings, rerender: SystemRefresh): HTMLElement {
  const sequenceOn = Boolean(titleScreen.sequence);
  const sequence = koreanSelectField(
    "입장 연출",
    "db-title-opening-sequence",
    sequenceOn ? "on" : "off",
    [{ id: "on", name: "켜기 — 암전에서 밀고 들어온다" }, { id: "off", name: "끄기 — 바로 메뉴" }] as const,
    (next) => {
      updateTitleScreen((settings) => {
        if (next === "off") delete settings.sequence;
        else settings.sequence ??= {};
      });
      rerender();
    },
  );
  const reveal = koreanSelectField(
    "로고 등장",
    "db-title-opening-logo-reveal",
    titleScreen.sequence?.logoReveal ?? "bloom",
    TITLE_LOGO_REVEAL_OPTIONS,
    (next) => {
      updateTitleScreen((settings) => {
        settings.sequence = { ...(settings.sequence ?? {}), logoReveal: next };
      });
      rerender();
    },
  );
  const shine = koreanSelectField(
    "로고 반짝임",
    "db-title-opening-logo-shine",
    titleScreen.logoShine ?? "none",
    TITLE_LOGO_SHINE_OPTIONS,
    (next) => {
      updateTitleScreen((settings) => {
        if (next === "none") delete settings.logoShine;
        else settings.logoShine = next;
      });
      rerender();
    },
  );
  const transition = koreanSelectField(
    "새 게임 전환",
    "db-title-opening-transition",
    titleScreen.transition?.kind ?? "none",
    TITLE_TRANSITION_OPTIONS,
    (next) => {
      updateTitleScreen((settings) => {
        if (next === "none") delete settings.transition;
        else settings.transition = { kind: next };
      });
      rerender();
    },
  );
  const preview = el("button", {
    class: "btn small primary",
    text: "오프닝 다시 보기",
    attrs: { type: "button", title: "게임과 같은 렌더로 입장부터 재생합니다. 「새 게임」을 누르면 전환도 봅니다." },
    dataset: { testid: "db-title-opening-preview" },
  }) as HTMLButtonElement;
  preview.addEventListener("click", () => void openTitleOpeningPreview());
  return el("div", {
    class: "db-title-opening-entrance",
    dataset: { testid: "db-title-opening-entrance" },
    children: [
      el("div", { class: "db-title-opening-entrance-grid", children: [sequence, reveal, shine, transition] }),
      el("p", {
        class: "db-system-help",
        text: "무대 미리보기는 효과만 보여 줍니다. 입장 순서와 전환은 「오프닝 다시 보기」로 게임 화면 그대로 확인하세요.",
      }),
      el("div", { class: "db-title-opening-actions", children: [preview] }),
    ],
  });
}

/** 런타임 타이틀을 그대로 렌더해 띄운다. 편집기 무대와 달리 입장 시퀀스·전환까지 재생된다. */
async function openTitleOpeningPreview(): Promise<void> {
  document.querySelector(".db-title-opening-preview-backdrop")?.remove();
  await preloadRuntimeStyles();
  const project = store.getCurrent();
  const backdrop = el("div", {
    class: "db-title-opening-preview-backdrop",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": "오프닝 미리보기" },
    dataset: { testid: "db-title-opening-preview-dialog" },
  });
  const frame = el("div", { class: "db-title-opening-preview-frame" });
  const fitScale = () => {
    const scale = Math.max(1, Math.min(3, (window.innerWidth - 48) / 320, (window.innerHeight - 120) / 240));
    frame.style.setProperty("--preview-scale", scale.toFixed(3));
  };
  fitScale();
  const shell = el("div", { class: "player-layout system-shell db-title-opening-preview-shell" });
  // 런타임 레이어의 system-shell grid 규칙이 database 레이어보다 뒤라 CSS 로는 못 이긴다. 인라인으로 무대를 못 박는다.
  shell.style.display = "block";
  frame.append(shell);
  let transitionTimer: number | null = null;
  const close = () => {
    if (transitionTimer !== null) clearTimeout(transitionTimer);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", fitScale);
    backdrop.remove();
  };
  const mount = () => {
    if (transitionTimer !== null) clearTimeout(transitionTimer);
    transitionTimer = null;
    const noop = () => {};
    const title = renderTitleScreen(project, {
      onNewGame: () => {
        const ms = playTitleTransition(shell.querySelector<HTMLElement>(".title-screen"), project.system.titleScreen);
        // 전환 끝을 조금 보여 준 뒤 처음으로 되감는다 — 게임이면 여기서 맵으로 넘어간다.
        transitionTimer = window.setTimeout(mount, (ms ?? 0) + 700);
      },
      onResume: noop,
      onContinue: noop,
      onCredits: noop,
      onQuit: close,
    }, 0, { playIntro: true });
    title.style.width = "320px";
    title.style.height = "240px";
    shell.replaceChildren(title);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };
  const replay = el("button", {
    class: "btn small",
    text: "처음부터",
    attrs: { type: "button" },
    dataset: { testid: "db-title-opening-preview-replay" },
  });
  replay.addEventListener("click", mount);
  const closeButton = el("button", {
    class: "btn small",
    text: "닫기",
    attrs: { type: "button" },
    dataset: { testid: "db-title-opening-preview-close" },
  });
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.append(
    frame,
    el("div", {
      class: "db-title-opening-preview-bar",
      children: [
        el("span", { text: "클릭하면 입장을 건너뜁니다 · 「새 게임」을 누르면 전환 · Esc 닫기" }),
        replay,
        closeButton,
      ],
    }),
  );
  document.body.append(backdrop);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", fitScale);
  mount();
}

function koreanSelectField<T extends string>(
  label: string,
  testid: string,
  value: string,
  options: readonly { readonly id: T; readonly name: string }[],
  onChange: (value: T) => void,
): HTMLElement {
  const field = selectField(label, testid, value, options, (next) => {
    const match = options.find((option) => option.id === next);
    if (match) onChange(match.id);
  });
  // 타이틀 선택지는 모두 기본값이 있어 「(없음)」을 골라도 아무 일이 없다. 헷갈리지 않게 뺀다.
  field.querySelector<HTMLSelectElement>("select")?.querySelector('option[value=""]')?.remove();
  return field;
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
  rerender: SystemRefresh,
): HTMLElement {
  const host = titleOpeningHost(rerender);
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
    // 런타임과 같은 조건: 로고 질감을 고른 경우에만 무대에 표시한다(없으면 기본 제목 글꼴).
    if (titleScreen.logoStyle) stage.dataset.logoStyle = titleScreen.logoStyle;

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
      if (titleScreen.logoStyle && titleScreen.logoSubtitle) {
        const subtitle = el("div", {
          class: "db-title-workbench-subtitle",
          text: titleScreen.logoSubtitle,
          dataset: { testid: "db-title-workbench-subtitle", logoStyle: titleScreen.logoStyle },
        });
        placeTitleSubtitle(subtitle, titleScreen);
        stage.append(subtitle);
      }
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
          // 런타임은 첫 항목에 커서가 놓인 채로 열린다 — 미리보기도 같은 모습으로.
          class: index === 0 ? "db-title-workbench-menu-item selected" : "db-title-workbench-menu-item",
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
    if (titleScreen.menuStyle) menu.dataset.menuStyle = titleScreen.menuStyle;
    placeTitleMenu(menu, titleScreen, visibleOptions.length);
    stage.append(menu);
    // 효과 위치 손잡이 — 켜진 효과가 있을 때만. 끌기는 효과 canvas 만 갈아 끼운다(무대 재생성 없음).
    if (titleScreen.effects?.length) mountTitleEffectOverlay(stage, host, bgUrl ?? undefined);
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
  startup: "전투 방식, 기본 소리, 보상, 갤러리를 정합니다.",
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
// 런타임 renderTitleLogoSubtitle 과 같은 자리: 제목 기준점 아래 3.4em.
function placeTitleSubtitle(node: HTMLElement, title: TitleScreenSettings): void {
  node.style.left = `${title.layout.titleX / 320 * 100}%`;
  node.style.top = `calc(${title.layout.titleY / 240 * 100}% + 3.4em)`;
}

// 런타임 renderMenu 와 같은 위치 계산 — 항목이 많으면 무대 아래로 넘치지 않게 끌어올린다.
function placeTitleMenu(node: HTMLElement, title: TitleScreenSettings, optionCount: number): void {
  node.style.left = `${title.layout.menuX / 320 * 100}%`;
  node.style.top = `${titleMenuTop(title.layout.menuY, optionCount, false) / 240 * 100}%`;
}

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
  const subtitle = stage.querySelector<HTMLElement>('[data-testid="db-title-workbench-subtitle"]');
  if (subtitle) {
    subtitle.textContent = title.logoSubtitle ?? "";
    placeTitleSubtitle(subtitle, title);
  }
  const menu = stage.querySelector<HTMLElement>('[data-testid="db-title-workbench-menu-preview"]');
  if (menu) {
    const options = listTitleMenuOptions(title, { autosaveAvailable: true });
    placeTitleMenu(menu, title, options.length);
    for (const option of options) {
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
