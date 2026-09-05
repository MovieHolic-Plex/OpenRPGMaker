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
import { store } from "@/project/store";
import type { ActorParameterKey, ActorRecord } from "@/project/types";
import { el } from "@/util/dom";

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
      class: `actor-section-tab${index === 0 ? " active" : ""}`,
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
    class: "actor-section-tabs",
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
function actorHeroHeader(actor: ActorRecord, onRename?: (name: string) => void): HTMLElement {
  const className = store.getCurrent().database.classes.find((entry) => entry.id === actor.classId)?.name;
  const face = graphicPreview(
    "얼굴",
    actor.faceResourceId ?? actor.characterResourceId ?? "(없음)",
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
              el("span", {
                class: "db-record-hero-tag party",
                text: store.getCurrent().system.startActorIds.includes(actor.id) ? "시작 파티" : "대기 멤버",
              }),
            ],
          }),
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
  ]);
}

function criticalPanel(actor: ActorRecord): HTMLElement {
  return actorPanel("크리티컬 공격", "actor-critical", [
    checkboxControl("크리티컬 사용", "db-field-actor-critical-enabled", actor.critical.enabled, (enabled) =>
      updateDatabaseRecord("actors", actor.id, { critical: { ...actor.critical, enabled } })
    ),
    numberControl("발생 확률 (1/N)", "db-field-actor-critical-rate", actor.critical.chanceDenominator, (chanceDenominator) =>
      updateDatabaseRecord("actors", actor.id, { critical: { ...actor.critical, chanceDenominator } })
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
  return actorPanel("현재 시작 능력치", "actor-basic-stats", [
    el("div", {
      class: "actor-basic-stat-grid",
      children: ACTOR_PARAMETER_KEYS.map((key) =>
        el("div", {
          class: "actor-basic-stat-row",
          children: [
            el("span", { text: `${labels[key]}:` }),
            el("strong", { text: String(parameterValueAtLevel(actor.parameterCurves[key], actor.initialLevel)) }),
          ],
        })
      ),
    }),
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
  return actorPanel("화면에 보이는 모습", "actor-graphic", [
    graphicPreview("얼굴", actor.faceResourceId ?? actor.characterResourceId ?? "(없음)", "faceset"),
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
    graphicPreview("캐릭터셋", actor.characterResourceId ?? "(없음)", "charset", actor.characterIndex ?? 0),
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
}

function curvesPanel(actor: ActorRecord): HTMLElement {
  return actorPanel("레벨별 능력치", "actor-parameter-curves", [
    el("div", { class: "actor-curves-grid", children: actorCurveCards(actor) }),
  ]);
}

function experiencePanel(actor: ActorRecord): HTMLElement {
  return actorPanel("레벨업 속도", "actor-experience", actorExperiencePanel(actor));
}
