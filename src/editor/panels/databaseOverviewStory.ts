// 자료집 개요의 「이야기 구조」 — 퀘스트·엔딩 목록(읽기 전용).
//
// 개요의 「이야기」 카드는 퀘스트·엔딩 개수만 보여 주고, 편집기 어디에도 그 목록을 읽을 곳이 없었다.
// 이 절은 project.quests 의 단계와 그 단계를 채우는 진행 값(스위치), project.endings 의 조건과 그 엔딩을
// 부르는 이벤트 위치를 나란히 보인다. 쓰기 경로는 없다.
//
// 다국어: 편집기 글자는 한국어로 쓰고 DOM 번역 계층이 바꾼다(openwiki/i18n.md). 그래서 문장은 한 템플릿으로만
// 만들고, 저자가 쓴 글(퀘스트 제목·단계 설명·진행 값 이름·맵/이벤트 이름)은 data-i18n-skip 요소에 따로 담는다 —
// 사용자 글이 우연히 카탈로그 키와 같아도 번역되지 않게.
import { isQuestGraphDef, isStepQuestDef, questFlagIds, type AnyQuestDef, type QuestStep } from "@/project/quest/questDef";
import type { EndingCondition, Project } from "@/project/types";
import { el } from "@/util/dom";

type Rec = Record<string, unknown>;

interface StoryStepRow {
  readonly label: string;
  /** label 이 저자가 쓴 글이면 true(번역하지 않는다). 단계 종류 기본 이름이면 false. */
  readonly authored: boolean;
  readonly switchIds: readonly string[];
}

/** 엔딩을 부르는 곳. 공용 이벤트는 scope 가 없고 화면에 「공용 이벤트」라는 편집기 글자를 붙인다. */
interface CallSite {
  readonly scope: string | null;
  readonly name: string;
}

const STEP_KIND_LABEL: Record<QuestStep["kind"], string> = {
  talk: "대화", collect: "수집", kill: "전투", reach: "목적지 도달", inspect: "조사",
  deliver: "납품", choice: "해결 방법 선택", escort: "동행", craft: "제작",
};

/** 저자가 쓴 글 — 번역 계층이 건드리지 않는다. */
function authoredText(tag: "span" | "strong" | "p" | "code", text: string, className?: string): HTMLElement {
  return el(tag, { ...(className ? { class: className } : {}), attrs: { "data-i18n-skip": "" }, text });
}

function questRows(quest: AnyQuestDef): StoryStepRow[] {
  if (isQuestGraphDef(quest)) {
    return quest.nodes.map((node) => {
      const switchIds: string[] = [];
      const visit = (value: unknown): void => {
        if (Array.isArray(value)) { value.forEach(visit); return; }
        if (!value || typeof value !== "object") return;
        const rec = value as Rec;
        if (rec.kind === "switch" && typeof rec.switchId === "string") switchIds.push(rec.switchId);
        if (Array.isArray(rec.all)) visit(rec.all);
      };
      visit(node.completesWhen);
      return { label: node.description, authored: true, switchIds };
    });
  }
  if (isStepQuestDef(quest)) {
    const flags = questFlagIds(quest.key, quest.steps.length);
    return quest.steps.map((step, index) => ({
      label: step.label ?? STEP_KIND_LABEL[step.kind],
      authored: step.label !== undefined,
      switchIds: [flags.stepSwitches[index]!],
    }));
  }
  return [];
}

function questId(quest: AnyQuestDef): string {
  return isQuestGraphDef(quest) ? quest.id : quest.key;
}

/** 엔딩을 부르는 triggerEnding 의 위치(맵 · 이벤트, 또는 공용 이벤트). */
function endingCallSites(project: Project): Map<string, CallSite[]> {
  const sites = new Map<string, CallSite[]>();
  const add = (endingId: string, site: CallSite): void => {
    const list = sites.get(endingId) ?? [];
    if (!list.some((s) => s.scope === site.scope && s.name === site.name)) list.push(site);
    sites.set(endingId, list);
  };
  const scan = (value: unknown, site: CallSite): void => {
    if (Array.isArray(value)) { for (const item of value) scan(item, site); return; }
    if (!value || typeof value !== "object") return;
    const rec = value as Rec;
    if (rec.kind === "triggerEnding" && typeof rec.endingId === "string") add(rec.endingId, site);
    for (const child of Object.values(rec)) scan(child, site);
  };
  for (const map of Object.values(project.maps)) {
    for (const event of map.events ?? []) scan(event.pages, { scope: map.name || map.id, name: event.name || event.id });
  }
  for (const common of project.commonEvents ?? []) scan(common, { scope: null, name: common.name || common.id });
  return sites;
}

function switchChip(id: string, names: ReadonlyMap<string, string>, value = true): HTMLElement {
  const name = names.get(id);
  const known = name !== undefined;
  const shown = known && name ? name : id;
  return el("span", {
    class: `db-overview-story-switch${known ? "" : " is-missing"}${value ? "" : " is-off"}`,
    attrs: { title: known ? `진행 값 ${id}` : `프로젝트에 없는 진행 값: ${id}` },
    children: [
      ...(value ? [] : [el("span", { class: "db-overview-story-switch-off", text: "꺼짐" })]),
      authoredText("span", shown),
    ],
  });
}

function conditionChip(condition: EndingCondition, switchNames: ReadonlyMap<string, string>, variableNames: ReadonlyMap<string, string>): HTMLElement {
  switch (condition.kind) {
    case "switch":
      return switchChip(condition.switchId, switchNames, condition.value);
    case "variable":
      return el("span", {
        class: "db-overview-story-switch",
        attrs: { title: `변수 ${condition.variableId}` },
        children: [authoredText("span", `${variableNames.get(condition.variableId) || condition.variableId} ${condition.op} ${condition.value}`)],
      });
    case "friendshipAtLeast":
      return el("span", {
        class: "db-overview-story-switch",
        children: [
          el("span", { text: "호감" }),
          authoredText("span", ` ${condition.npcKey ?? "?"} ≥ ${condition.value}`),
        ],
      });
    case "newGamePlus":
      return el("span", { class: "db-overview-story-switch", text: condition.value ? "다시 하기 회차" : "첫 회차" });
  }
}

function callSiteChip(site: CallSite): HTMLElement {
  return el("span", {
    class: "db-overview-story-site",
    children: [
      site.scope === null ? el("span", { text: "공용 이벤트" }) : authoredText("span", site.scope),
      el("span", { class: "db-overview-story-site-sep", attrs: { "aria-hidden": "true" }, text: "·" }),
      authoredText("span", site.name),
    ],
  });
}

function labelledRow(label: string, children: HTMLElement[]): HTMLElement {
  return el("div", {
    class: "db-overview-story-row",
    children: [
      el("span", { class: "db-overview-story-row-label", text: label }),
      el("span", { class: "db-overview-story-switches", children }),
    ],
  });
}

export function renderStoryStructure(project: Project): HTMLElement {
  const quests = project.quests ?? [];
  const endings = project.endings ?? [];
  const switchNames = new Map((project.switches ?? []).map((s) => [s.id, s.name]));
  const variableNames = new Map((project.variables ?? []).map((v) => [v.id, v.name]));
  const maps = project.maps;
  const callSites = endingCallSites(project);

  const questBlocks = quests.map((quest, index) => {
    const rows = questRows(quest);
    return el("details", {
      class: "db-overview-story-quest",
      attrs: index < 2 || isQuestGraphDef(quest) ? { open: "" } : {},
      dataset: { testid: "db-overview-story-quest", questId: questId(quest) },
      children: [
        el("summary", {
          children: [
            authoredText("strong", quest.title),
            el("span", { class: "db-overview-story-meta", text: `${rows.length}단계` }),
            authoredText("code", questId(quest), "db-overview-story-id"),
          ],
        }),
        ...(quest.summary ? [authoredText("p", quest.summary, "db-overview-story-summary")] : []),
        el("ol", {
          class: "db-overview-story-steps",
          children: rows.map((row) => el("li", {
            children: [
              row.authored
                ? authoredText("span", row.label)
                : el("span", { text: row.label }),
              el("span", { class: "db-overview-story-switches", children: row.switchIds.map((id) => switchChip(id, switchNames)) }),
            ],
          })),
        }),
      ],
    });
  });

  const endingBlocks = endings.map((ending) => {
    const sites = callSites.get(ending.id) ?? [];
    const continueTo = ending.continueTo;
    return el("div", {
      class: "db-overview-story-ending",
      dataset: { testid: "db-overview-story-ending", endingId: ending.id },
      children: [
        authoredText("strong", ending.name),
        labelledRow("조건", ending.conditions.length > 0
          ? ending.conditions.map((c) => conditionChip(c, switchNames, variableNames))
          : [el("span", { class: "db-overview-story-meta", text: "없음 — 부르면 바로" })]),
        labelledRow("불리는 곳", sites.length > 0
          ? sites.map(callSiteChip)
          : [el("span", { class: "db-overview-story-meta is-warning", text: "부르는 이벤트 없음" })]),
        ...(continueTo
          ? [labelledRow("이어 하기", [
            authoredText("span", `${continueTo.label ? `${continueTo.label} → ` : ""}${maps[continueTo.mapId]?.name ?? continueTo.mapId}`, "db-overview-story-site"),
          ])]
          : []),
      ],
    });
  });

  return el("section", {
    class: "db-overview-story-structure",
    attrs: { id: "db-overview-story-structure", "aria-labelledby": "db-overview-story-structure-title" },
    dataset: { testid: "db-overview-story-structure" },
    children: [
      el("header", {
        children: [
          el("h3", { attrs: { id: "db-overview-story-structure-title" }, text: "이야기 구조" }),
          el("p", { text: `퀘스트 ${quests.length}개 · 엔딩 ${endings.length}개` }),
          ...(quests.length > 0 ? [el("p", { class: "db-overview-story-hint", text: "단계 옆 칩은 그 단계를 채우는 진행 값입니다." })] : []),
        ],
      }),
      quests.length > 0
        ? el("div", { class: "db-overview-story-quests", children: questBlocks })
        : el("p", { class: "db-overview-story-empty", text: "아직 퀘스트가 없습니다." }),
      el("h4", { text: "엔딩" }),
      endings.length > 0
        ? el("div", { class: "db-overview-story-endings", children: endingBlocks })
        : el("p", { class: "db-overview-story-empty", text: "아직 엔딩이 없습니다." }),
    ],
  });
}
