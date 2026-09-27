import { updateDatabaseRecord } from "@/editor/databaseActions";
import { ACTOR_PARAMETER_KEYS, parameterValueAtLevel } from "@/project/actorModel";
import { actorCurveCards, actorExperiencePanel } from "@/editor/panels/actorRecordCurveEditors";
import { battlePanel, ratesPanel } from "@/editor/panels/actorRecordBattlePanels";
import {
  actorPanel,
  checkboxControl,
  emptyToUndefined,
  graphicPreview,
  numberControl,
  resourceControl,
  selectRecord,
  textControl,
} from "@/editor/panels/actorRecordControls";
import { aiImageGenerateField } from "@/editor/panels/aiImageGenerateField";
import { openActorResourceDialog } from "@/editor/panels/databaseActorResourceDialog";
import { switchDatabaseActiveTab, type DatabaseTab } from "@/editor/panels/database";
import {
  actorBuildPreview,
  type ActorBuildPreview,
  type ActorBuildReferenceWarning,
} from "@/editor/panels/databasePartyBuildSummary";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { ActorParameterKey, ActorRecord, Project } from "@/project/types";
import { el } from "@/util/dom";
import { getCharacterAppearance, resolveActorAppearance } from "@/project/characterAppearances";
import { appearanceBindingControl } from "./appearanceBindingControl";

export function renderActorRecordForm(
  actor: ActorRecord,
  rerender: () => void,
  onRename?: (name: string) => void,
  layout: "default" | "studio" = "default"
): HTMLElement {
  const form = el("section", {
    class: "db-detail-form actor-detail-form",
    dataset: { testid: "db-detail-form" },
  });
  const buildPreview = actorBuildPreviewPanel(actor);
  const identity = identityPanel(actor, buildPreview.refresh);
  const actorClass = classPanel(actor, buildPreview.refresh);
  const graphics = graphicsPanel(actor, rerender);
  const baseStats = baseStatsPanel(actor);
  const curves = curvesPanel(actor);
  const experience = experiencePanel(actor);
  const battle = battlePanel(actor, rerender, buildPreview.refresh);
  const critical = criticalPanel(actor);
  const rates = ratesPanel(actor);
  const classicSheet = el("div", {
    class: "actor-classic-sheet",
    dataset: { testid: "actor-classic-sheet" },
    children: [
      el("div", {
        class: "actor-editor-grid",
        children: [
          el("div", { class: "actor-column actor-left-stack", children: [identity, actorClass, graphics, baseStats] }),
          el("div", { class: "actor-column actor-center-stack", children: [curves, experience] }),
          el("div", { class: "actor-column actor-right-stack", children: [inspectorTabs(() => form), battle, rates] }),
        ],
      }),
    ],
  });
  const hero = actorHeroHeader(actor, onRename);
  if (layout === "studio") {
    const sections = [
      // '현재 시작 능력치'는 성장 곡선에서 파생된 읽기 전용 요약이라 성장 탭에 있었는데,
      // 그 탭은 곡선 + 경험치까지 지고 있어 과밀했고 반대로 기본 탭은 컨트롤 네 개만
      // 놓인 채 아래 절반이 비어 있었다(감사 H 축). 요약을 기본으로 올리면 처음 보는
      // 화면이 "이 주인공이 어떤 수치로 시작하는가" 에 답하게 되고 성장도 숨통이 트인다.
      actorSection("identity", [identity, actorClass, baseStats]),
      actorSection("appearance", [graphics]),
      actorSection("growth", [curves, experience]),
      actorSection("battle", [battle, critical, rates]),
      actorSection("preview", [buildPreview.element]),
    ];
    form.append(hero, actorSectionTabs(sections), el("div", { class: "actor-section-body", children: sections }));
  } else {
    form.append(hero, buildPreview.element, classicSheet);
  }
  return form;
}

const ACTOR_SECTIONS = [
  { key: "identity", label: "기본" },
  { key: "appearance", label: "외형" },
  { key: "growth", label: "성장" },
  { key: "battle", label: "전투" },
  { key: "preview", label: "결과" },
] as const;

type ActorSectionKey = (typeof ACTOR_SECTIONS)[number]["key"];

function actorSection(key: ActorSectionKey, content: HTMLElement[]): HTMLElement {
  const section = el("section", {
    class: `actor-section-panel actor-section-${key}`,
    attrs: { role: "tabpanel" },
    dataset: { testid: `db-actor-panel-${key}` },
    children: content,
  });
  section.hidden = key !== "identity";
  return section;
}

// `role="tablist"` 는 화살표 이동과 단일 탭 스톱을 **약속하는** 역할이다. 예전에는 역할만
// 붙고 구현이 없어서 ArrowRight 가 무반응이고 `tabindex` 관리도 `aria-controls` 도 없었다
// (실측). 역할을 지우는 대신 약속한 패턴을 구현한다 — 이 탭 줄은 주인공 편집의 주 내비다.
function actorSectionTabs(sections: HTMLElement[]): HTMLElement {
  const tabs: HTMLElement[] = [];
  const activate = (index: number, moveFocus = false): void => {
    tabs.forEach((tab, candidate) => {
      const selected = candidate === index;
      tab.setAttribute("aria-selected", String(selected));
      // 탭 줄 전체가 하나의 탭 스톱이다 — 비활성 탭은 Tab 순회에서 빠지고 화살표로만 이동한다.
      tab.setAttribute("tabindex", selected ? "0" : "-1");
      tab.classList.toggle("active", selected);
      sections[candidate]!.hidden = !selected;
    });
    if (moveFocus) tabs[index]?.focus();
    sections[index]?.parentElement?.scrollTo?.({ top: 0 });
  };
  const step = (from: number, delta: number): void => {
    const next = (from + delta + tabs.length) % tabs.length;
    activate(next, true);
  };
  tabs.push(...ACTOR_SECTIONS.map((section, index) => {
    const panelId = `db-actor-panel-${section.key}`;
    sections[index]?.setAttribute("id", panelId);
    return el("button", {
      class: `db-ws-section-tab${index === 0 ? " active" : ""}`,
      text: section.label,
      attrs: {
        "aria-controls": panelId,
        "aria-selected": String(index === 0),
        role: "tab",
        tabindex: index === 0 ? "0" : "-1",
        type: "button",
      },
      dataset: { testid: `db-actor-tab-${section.key}` },
      on: {
        click: () => activate(index),
        keydown: (event: Event) => {
          const key = (event as KeyboardEvent).key;
          if (key === "ArrowRight" || key === "ArrowDown") step(index, 1);
          else if (key === "ArrowLeft" || key === "ArrowUp") step(index, -1);
          else if (key === "Home") activate(0, true);
          else if (key === "End") activate(tabs.length - 1, true);
          else return;
          event.preventDefault();
        },
      },
    });
  }));
  return el("nav", {
    class: "actor-section-tabs db-ws-section-tabs",
    attrs: { "aria-label": "캐릭터 편집 영역", role: "tablist" },
    dataset: { testid: "db-actor-section-tabs" },
    children: tabs,
  });
}

const BUILD_STAT_LABELS: Readonly<Record<ActorParameterKey, string>> = {
  maxHp: "최대 HP",
  maxMp: "최대 MP",
  attack: "공격력",
  defense: "방어력",
  mind: "마력",
  agility: "민첩성",
};

function actorBuildPreviewPanel(actor: ActorRecord): { readonly element: HTMLElement; readonly refresh: () => void } {
  const resultId = `db-actor-build-result-${actor.id}`;
  const result = el("div", {
    class: "actor-build-preview-result",
    attrs: { id: resultId, "aria-atomic": "true", "aria-live": "polite" },
    dataset: { testid: "db-actor-build-result" },
  });
  const naturalMax = el("small", {
    class: "actor-build-natural-max",
    dataset: { maxLevel: String(actor.maxLevel), testid: "db-actor-build-natural-max" },
  });
  const level = el("input", {
    value: actor.initialLevel,
    attrs: {
      type: "number",
      min: "1",
      max: "99",
      inputmode: "numeric",
      "aria-label": "빌드 미리보기 레벨",
      "aria-controls": resultId,
    },
    dataset: { testid: "db-actor-build-level" },
  }) as HTMLInputElement;
  const refresh = (): void => {
    const current = store.getCurrent().database.actors.find((entry) => entry.id === actor.id) ?? actor;
    const parsed = Number.parseInt(level.value, 10);
    const preview = actorBuildPreview(store.getCurrent(), actor.id, Number.isFinite(parsed) ? parsed : current.initialLevel);
    result.replaceChildren(...(preview ? actorBuildPreviewContents(preview) : []));
    if (preview) {
      naturalMax.dataset.maxLevel = String(preview.naturalMaxLevel);
      naturalMax.textContent = `자연 성장 상한 Lv ${preview.naturalMaxLevel}`;
    }
  };
  level.addEventListener("input", refresh);
  level.addEventListener("change", () => {
    const preview = actorBuildPreview(store.getCurrent(), actor.id, Number.parseInt(level.value, 10));
    if (preview) level.value = String(preview.level);
  });
  refresh();
  const element = el("section", {
    class: "actor-build-preview",
    dataset: { testid: "db-actor-build-preview" },
    children: [
      el("div", {
        class: "actor-build-preview-heading",
        children: [
          el("div", {
            children: [
              el("span", { class: "actor-build-preview-eyebrow", text: "플레이 결과" }),
              el("h3", { text: "결과 미리보기" }),
              el("p", { text: "실제 전투 계산 기준으로 성장·장비·스킬을 함께 확인합니다." }),
            ],
          }),
          el("label", {
            class: "actor-build-level-control",
            children: [el("span", { text: "레벨" }), level, naturalMax],
          }),
        ],
      }),
      result,
    ],
  });
  return { element, refresh };
}

function actorBuildPreviewContents(preview: ActorBuildPreview): HTMLElement[] {
  return [
    el("div", {
      class: "actor-build-growth-line",
      children: [
        el("div", {
          class: "actor-build-growth-source",
          dataset: { source: preview.growth.source, testid: "db-actor-build-growth-source" },
          children: [
            el("span", { text: "성장 출처" }),
            el("strong", { text: preview.growth.source === "actor-base" ? `${preview.growth.name} 기본 곡선` : `${preview.growth.name} 직업 곡선` }),
          ],
        }),
        ...(preview.assignedClass ? [linkedRecordButton({
          collection: "classes",
          id: preview.assignedClass.id,
          label: `${preview.assignedClass.name} 열기`,
          tab: "classes",
          testid: "db-actor-build-open-class",
        })] : []),
      ],
    }),
    el("p", {
      class: "actor-build-semantics-note",
      text: preview.growth.source === "actor-base"
        ? "현재 시작 직업은 스킬·명령·장비 허용에 연결됩니다. 런타임 전직·승급 뒤에는 새 직업 곡선으로 전환됩니다."
        : "런타임 직업 오버라이드가 적용되어 해당 직업의 성장 곡선을 사용합니다.",
    }),
    el("div", {
      class: "actor-build-preview-grid",
      children: [
        el("div", {
          class: "actor-build-stat-card",
          children: [
            el("h4", { text: `Lv ${preview.level} 유효 능력치` }),
            el("div", {
              class: "actor-build-stat-grid",
              children: ACTOR_PARAMETER_KEYS.map((key) => {
                const stat = preview.stats[key];
                return el("div", {
                  class: "actor-build-stat",
                  children: [
                    el("span", { text: BUILD_STAT_LABELS[key] }),
                    el("strong", { text: String(stat.value), dataset: { testid: `db-actor-build-stat-${key}` } }),
                    ...(stat.equipmentBonus !== 0
                      ? [el("small", { text: `장비 ${stat.equipmentBonus > 0 ? "+" : ""}${stat.equipmentBonus}` })]
                      : []),
                  ],
                });
              }),
            }),
          ],
        }),
        buildLinkCollection(
          "시작 장비",
          preview.equipment.map((equipment) => linkedRecordButton({
            collection: "equipment",
            id: equipment.id,
            label: equipment.name,
            tab: "equipment",
            testid: `db-actor-build-open-equipment-${equipment.id}`,
          })),
          "설정된 시작 장비가 없습니다.",
          preview.referenceWarnings.filter((warning) => warning.kind === "equipment"),
        ),
        buildLinkCollection(
          `Lv ${preview.level} DB 성장 스킬`,
          preview.skills.map((skill) => linkedRecordButton({
            collection: "skills",
            id: skill.id,
            label: skill.name,
            tab: "skills",
            testid: `db-actor-build-open-skill-${skill.id}`,
          })),
          "DB의 주인공·시작 직업 성장 설정에 등록된 스킬이 없습니다.",
          preview.referenceWarnings.filter((warning) => warning.kind === "skill"),
          { testid: "db-actor-build-skills", scope: "database-growth" },
        ),
      ],
    }),
  ];
}

function buildLinkCollection(
  title: string,
  links: HTMLElement[],
  emptyMessage: string,
  warnings: readonly ActorBuildReferenceWarning[] = [],
  dataset?: Readonly<Record<string, string>>,
): HTMLElement {
  return el("div", {
    class: "actor-build-link-card",
    dataset,
    children: [
      el("h4", { text: title }),
      links.length > 0
        ? el("div", { class: "actor-build-link-list", children: links })
        : el("p", { class: "actor-build-empty", text: emptyMessage }),
      ...(warnings.length > 0
        ? [el("div", {
            class: "actor-build-reference-warnings",
            children: warnings.map(referenceWarning),
          })]
        : []),
    ],
  });
}

function referenceWarning(warning: ActorBuildReferenceWarning): HTMLElement {
  const detail = warning.kind === "skill"
    ? "누락된 스킬 참조"
    : warning.reason === "missing"
      ? "누락된 장비 참조"
      : warning.reason === "invalid-slot"
        ? "슬롯과 맞지 않는 장비 참조"
        : "현재 빌드에 적용되지 않는 장비 참조";
  return el("span", {
    class: "actor-build-reference-warning",
    text: `${detail}: ${warning.id}`,
    attrs: { "aria-disabled": "true" },
    dataset: { testid: `db-actor-build-warning-${warning.kind}-${warning.id}` },
  });
}

function linkedRecordButton(options: {
  readonly collection: "classes" | "equipment" | "skills";
  readonly id: string;
  readonly label: string;
  readonly tab: DatabaseTab;
  readonly testid: string;
}): HTMLElement {
  return el("button", {
    class: "actor-build-record-link",
    text: options.label,
    attrs: { type: "button" },
    dataset: { testid: options.testid },
    on: {
      click: (event) => {
        setSelectedRecordId(options.collection, options.id);
        const panelRoot = databasePanelRootFrom(event.currentTarget as HTMLElement | null);
        if (panelRoot) switchDatabaseActiveTab(options.tab, panelRoot);
      },
    },
  });
}

function databasePanelRootFrom(node: HTMLElement | null): HTMLElement | null {
  if (!node) return null;
  const modalBody = node.closest(".database-modal-body");
  if (modalBody instanceof HTMLElement) return modalBody;
  let current: HTMLElement | null = node;
  while (current) {
    if (current.querySelector(".db-body") && !current.classList.contains("db-body")) return current;
    current = current.parentElement;
  }
  return null;
}

// 히어로 헤더 — 얼굴 + 이름 인라인 편집 + 직업/레벨 태그. 이름 편집은 identityPanel 에서
// 여기로 승격됐다(아이템/장비 인스펙터 헤더와 같은 비주얼 언어, db-field-name 계약 유지).
/** 시작 파티 칸 수 — 시스템 탭의 멤버 슬롯(START_PARTY_SLOTS)과 같다. */
const START_PARTY_LIMIT = 4;

/**
 * 머리 한 문장 — 「이 주인공은 무엇인가」를 폼을 훑지 않고 읽게 한다. 값은 폼과 같은 저장값에서
 * 바로 계산한다(따로 저장하지 않는다).
 */
export function actorSummarySentence(project: Project, actor: ActorRecord): string {
  const className = project.database.classes.find((entry) => entry.id === actor.classId)?.name;
  const start = className ? `${className} 직업으로 Lv ${actor.initialLevel}에 시작` : `직업 없이 Lv ${actor.initialLevel}에 시작`;
  const party = project.system.startActorIds.includes(actor.id)
    ? "처음부터 파티에 있습니다"
    : "이벤트로 합류할 때까지 대기합니다";
  return `${start}하고, ${party}.`;
}

function setStartParty(actorId: string, member: boolean): void {
  const current = store.getCurrent().system.startActorIds;
  if (member === current.includes(actorId)) return;
  if (member && current.length >= START_PARTY_LIMIT) return;
  recordProjectSnapshot();
  store.update((draft) => {
    const party = member
      ? [...draft.system.startActorIds, actorId]
      : draft.system.startActorIds.filter((id) => id !== actorId);
    draft.system.startActorIds = party;
    draft.session.partyActorIds = [...party];
  }, { scope: "system", label: member ? "시작 파티에 넣기" : "시작 파티에서 빼기" });
}

function startPartySwitch(actor: ActorRecord, summary: HTMLElement): HTMLElement {
  const project = store.getCurrent();
  const member = project.system.startActorIds.includes(actor.id);
  const full = !member && project.system.startActorIds.length >= START_PARTY_LIMIT;
  // `field()` 래퍼를 쓰지 않는다 — 히어로 제목 영역은 `.db-field > span:first-child` 를 시각적으로
  // 숨긴다(이름 칸의 「이름」 캡션용). 스위치 대신 체크 상자인 이유: 폼 공통 체크 상자 규칙이
  // 스위치 치수·색을 덮어 켜짐이 안 보였다. 체크 상자는 그 공통 규칙 그대로 그려진다.
  const input = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "db-actor-start-party" },
  }) as HTMLInputElement;
  input.checked = member;
  input.addEventListener("change", () => {
    setStartParty(actor.id, input.checked);
    const latest = store.getCurrent();
    const current = latest.database.actors.find((entry) => entry.id === actor.id) ?? actor;
    input.checked = latest.system.startActorIds.includes(actor.id);
    summary.textContent = actorSummarySentence(latest, current);
  });
  const control = el("label", {
    class: "db-record-hero-party",
    children: [input, el("span", { class: "db-record-hero-party-text", text: "시작 파티" })],
  });
  if (full) {
    input.disabled = true;
    // 잠금에는 이유를 같이 준다(databaseControls 의 disabledReason 규약).
    control.title = `시작 파티는 최대 ${START_PARTY_LIMIT}명입니다. 시스템 탭에서 다른 멤버를 먼저 빼세요.`;
  }
  return control;
}

function actorHeroHeader(actor: ActorRecord, onRename?: (name: string) => void): HTMLElement {
  const effective = resolveActorAppearance(store.getCurrent(), actor);
  const className = store.getCurrent().database.classes.find((entry) => entry.id === actor.classId)?.name;
  const summary = el("p", {
    class: "db-record-hero-summary",
    text: actorSummarySentence(store.getCurrent(), actor),
    dataset: { testid: "db-actor-summary" },
  });
  const face = graphicPreview(
    "얼굴",
    effective.faceResourceId ?? effective.characterResourceId ?? "(없음)",
    "faceset",
    0,
    4 / 3
  );
  face.classList.add("db-record-hero-face");
  return el("header", {
    class: "db-record-hero",
    dataset: { testid: "db-record-hero" },
    children: [
      face,
      el("div", {
        class: "db-record-hero-title",
        children: [
          textControl("이름", "db-field-name", actor.name, (name) => {
            updateDatabaseRecord("actors", actor.id, { name });
            onRename?.(name);
          }),
          el("div", {
            class: "db-record-hero-tags",
            children: [
              ...(className ? [el("span", { class: "db-record-hero-tag", text: className })] : []),
              el("span", { class: "db-record-hero-tag muted", text: `Lv ${actor.initialLevel}–${actor.maxLevel}` }),
              startPartySwitch(actor, summary),
            ],
          }),
          summary,
        ],
      }),
    ],
  });
}

function identityPanel(actor: ActorRecord, refreshBuildPreview: () => void): HTMLElement {
  return actorPanel("이름과 시작 레벨", "actor-identity", [
    textControl("칭호", "db-field-actor-nickname", actor.nickname, (nickname) =>
      updateDatabaseRecord("actors", actor.id, { nickname })
    ),
    el("div", {
      class: "actor-level-row",
      children: [
        numberControl("초기 레벨", "db-field-initial-level", actor.initialLevel, (initialLevel) => {
          updateDatabaseRecord("actors", actor.id, { initialLevel });
          refreshBuildPreview();
        }),
        numberControl("최대 레벨", "db-field-max-level", actor.maxLevel, (maxLevel) => {
          updateDatabaseRecord("actors", actor.id, { maxLevel });
          refreshBuildPreview();
        }),
      ],
    }),
    // 스킬 장착 칸 — 0 이면 장착 개념 없이 배운 스킬 전부를 전투에서 쓴다(기존 동작).
    numberControl("스킬 장착 칸(0 = 제한 없음)", "db-field-actor-loadout-slots", actor.loadoutSlots ?? 0, (value) => {
      updateDatabaseRecord("actors", actor.id, { loadoutSlots: value > 0 ? value : undefined });
    }),
  ]);
}

/**
 * 합성 patch(`{ ...이전값, 바뀐필드 }`)의 베이스는 **항상 store 에서 다시 읽는다.**
 * 렌더 클로저가 잡은 actor 는 편집 중 재렌더 보류(400ms grace) 창에서 낡을 수 있고,
 * 그 사이 AI 적용·undo 가 store 를 갈아치우면 낡은 베이스가 그 변경을 조용히 되돌린다.
 * 같은 규약이 actorRecordBattlePanels.ts 의 currentActor 에도 있다.
 */
function currentActorCritical(actorId: string, fallback: ActorRecord["critical"]): ActorRecord["critical"] {
  return store.getCurrent().database.actors.find((record) => record.id === actorId)?.critical ?? fallback;
}

function criticalPanel(actor: ActorRecord): HTMLElement {
  return actorPanel("크리티컬 공격", "actor-critical", [
    checkboxControl("크리티컬 사용", "db-field-actor-critical-enabled", actor.critical.enabled, (enabled) =>
      updateDatabaseRecord("actors", actor.id, { critical: { ...currentActorCritical(actor.id, actor.critical), enabled } })
    ),
    numberControl("발생 확률 (1/N)", "db-field-actor-critical-rate", actor.critical.chanceDenominator, (chanceDenominator) =>
      updateDatabaseRecord("actors", actor.id, { critical: { ...currentActorCritical(actor.id, actor.critical), chanceDenominator } })
    ),
    el("p", { class: "actor-field-help", text: "예: N이 30이면 공격할 때 평균 30번 중 1번 발생합니다." }),
  ]);
}

function classPanel(actor: ActorRecord, refreshBuildPreview: () => void): HTMLElement {
  return actorPanel("시작 직업", "actor-class", [
    selectRecord("직업", "db-picker-class", actor.classId, store.getCurrent().database.classes, (classId) => {
      updateDatabaseRecord("actors", actor.id, { classId });
      refreshBuildPreview();
    }),
    el("p", { class: "actor-field-help", text: "직업은 사용할 수 있는 장비·명령과 성장 방식에 영향을 줍니다." }),
  ]);
}

function baseStatsPanel(actor: ActorRecord): HTMLElement {
  const labels: Record<(typeof ACTOR_PARAMETER_KEYS)[number], string> = {
    maxHp: "최대 HP",
    maxMp: "최대 MP",
    attack: "공격력",
    defense: "방어력",
    mind: "마법력",
    agility: "민첩성",
  };
  // 읽기 전용 요약이다 — 고칠 수 있는 칸처럼 보이지 않게 라벨 옆에 숫자를 붙이고, 고치는 곳을 알려 준다.
  return actorPanel(`Lv ${actor.initialLevel} 시작 능력치`, "actor-basic-stats", [
    el("div", {
      class: "actor-basic-stat-grid",
      children: ACTOR_PARAMETER_KEYS.map((key) =>
        el("div", {
          class: "actor-basic-stat-row",
          children: [
            el("span", { text: labels[key] }),
            el("strong", { text: String(parameterValueAtLevel(actor.parameterCurves[key], actor.initialLevel)) }),
          ],
        })
      ),
    }),
    el("p", { class: "actor-field-help", text: "레벨별 능력치 곡선에서 계산됩니다. 「성장」 탭에서 고칩니다." }),
  ]);
}

function inspectorTabs(root: () => HTMLElement): HTMLElement {
  const tabs = [
    { label: "특성", target: "[data-testid='actor-panel-actor-options']" },
    { label: "장비", target: "[data-testid='actor-panel-actor-starting-equipment']" },
    { label: "성장 곡선", target: "[data-testid='actor-panel-actor-parameter-curves']" },
    { label: "능력치 보정", target: "[data-testid='actor-panel-actor-basic-stats']" },
    { label: "공격 속성", target: "[data-testid='actor-panel-actor-rates']" },
  ];
  return el("div", {
    class: "actor-inspector-tabs",
    dataset: { testid: "db-actor-inspector-tabs" },
    children: tabs.map((tab, index) => {
      const button = el("button", {
        class: `actor-inspector-tab${index === 0 ? " active" : ""}`,
        text: tab.label,
        attrs: { type: "button", "aria-pressed": String(index === 0) },
      });
      button.addEventListener("click", () => activateInspectorTab(button, root(), tab.target));
      return button;
    }),
  });
}

function activateInspectorTab(button: HTMLElement, root: HTMLElement, selector: string): void {
  for (const tab of root.querySelectorAll(".actor-inspector-tab")) {
    if (!(tab instanceof HTMLElement)) continue;
    const active = tab === button;
    if (active) tab.classList.add("active");
    else tab.classList.remove("active");
    tab.setAttribute("aria-pressed", String(active));
  }
  const panel = root.querySelector(selector);
  if (panel instanceof HTMLElement) panel.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}

function graphicsPanel(actor: ActorRecord, rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  const linked = getCharacterAppearance(project, actor.appearanceId);
  const effective = resolveActorAppearance(project, actor);
  const panel = actorPanel("화면에 보이는 모습", "actor-graphic", [
    appearanceBindingControl(actor.appearanceId, "actor-appearance-select", (appearanceId) => {
      updateDatabaseRecord("actors", actor.id, { appearanceId });
      const current = store.getCurrent().database.actors.find((entry) => entry.id === actor.id);
      if (current) {
        const resolved = resolveActorAppearance(store.getCurrent(), current);
        const heroFace = graphicPreview("얼굴", resolved.faceResourceId ?? resolved.characterResourceId ?? "(없음)", "faceset", 0, 4 / 3);
        heroFace.classList.add("db-record-hero-face");
        panel.closest(".actor-detail-form")?.querySelector(".db-record-hero-face")?.replaceWith(heroFace);
        const replacement = graphicsPanel(current, rerender);
        panel.replaceWith(replacement);
        replacement.querySelector<HTMLSelectElement>("[data-testid='actor-appearance-select']")?.focus();
      }
    }),
    el("button", {
      class: "actor-appearance-manage",
      text: "공유 외형 관리 →",
      attrs: { type: "button", title: "여러 주인공이 함께 쓰는 외형 세트를 만들고 고칩니다" },
      dataset: { testid: "actor-appearance-manage" },
      on: {
        click: (event) => {
          const panelRoot = databasePanelRootFrom(event.currentTarget as HTMLElement | null);
          if (panelRoot) switchDatabaseActiveTab("characterAppearances", panelRoot);
        },
      },
    }),
    ...(linked ? [el("p", { class: "actor-field-help", dataset: { testid: "actor-appearance-linked" },
      text: `${linked.name}에서 그림을 공유합니다. 아래 직접 지정 값은 보관되며 연결을 해제하면 복원됩니다. 비어 있는 슬롯은 직접 지정 값을 사용합니다.` })] : []),
    graphicPreview("얼굴", effective.faceResourceId ?? effective.characterResourceId ?? "(없음)", "faceset"),
    resourceControl("얼굴", "db-field-face-resource", actor.faceResourceId ?? "", (faceResourceId) =>
      updateDatabaseRecord("actors", actor.id, { faceResourceId: emptyToUndefined(faceResourceId) }),
      () => openActorResourceDialog(actor, "faceResourceId", rerender)
    ),
    aiImageGenerateField({
      kind: "faceset",
      testidPrefix: "db-actor-face-ai",
      queueKey: `actor-face:${actor.id}`,
      onInserted: (resourceId) => {
        updateDatabaseRecord("actors", actor.id, { faceResourceId: resourceId });
        rerender();
      },
    }),
    graphicPreview("캐릭터셋", effective.characterResourceId ?? "(없음)", "charset", effective.characterIndex ?? 0),
    resourceControl("캐릭터셋", "db-field-character-resource", actor.characterResourceId ?? "", (characterResourceId) =>
      updateDatabaseRecord("actors", actor.id, { characterResourceId: emptyToUndefined(characterResourceId) }),
      () => openActorResourceDialog(actor, "characterResourceId", rerender)
    ),
    checkboxControl("투명", "db-field-character-transparent", actor.characterTransparent, (characterTransparent) =>
      updateDatabaseRecord("actors", actor.id, { characterTransparent })
    ),
    graphicPreview("애니메이션", actor.battleCharacterResourceId ?? "(없음)", "battleCharset"),
    resourceControl("애니메이션", "db-field-battle-character-resource", actor.battleCharacterResourceId ?? "", (battleCharacterResourceId) =>
      updateDatabaseRecord("actors", actor.id, { battleCharacterResourceId: emptyToUndefined(battleCharacterResourceId) }),
      () => openActorResourceDialog(actor, "battleCharacterResourceId", rerender)
    ),
  ]);
  for (const [testid, supplied] of [["db-field-face-resource", Boolean(linked?.face)], ["db-field-character-resource", Boolean(linked?.charset)]] as const) {
    if (!supplied) continue;
    const input = panel.querySelector<HTMLInputElement>(`[data-testid='${testid}']`);
    if (input) {
      input.disabled = true;
      input.title = "공유 외형의 그림을 사용 중입니다. 연결을 해제하면 직접 지정할 수 있습니다.";
      const button = input.parentElement?.querySelector("button");
      if (button instanceof HTMLButtonElement) button.disabled = true;
    }
  }
  if (linked?.face) {
    for (const control of panel.querySelectorAll<HTMLElement>("[data-testid^='db-actor-face-ai']")) control.hidden = true;
  }
  return panel;
}

function curvesPanel(actor: ActorRecord): HTMLElement {
  return actorPanel("레벨별 능력치", "actor-parameter-curves", [
    el("div", { class: "actor-curves-grid", children: actorCurveCards(actor) }),
  ]);
}

function experiencePanel(actor: ActorRecord): HTMLElement {
  return actorPanel("레벨업 속도", "actor-experience", actorExperiencePanel(actor));
}
