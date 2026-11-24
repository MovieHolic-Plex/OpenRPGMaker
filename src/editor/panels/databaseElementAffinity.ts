// 속성 탭 「상성표」 — 속성(가로) × 적(세로) 표와 「X 는 Y 에게 N배」 문장 카드(qa1124 항목 8-2·8-3).
//
// 오너 2026-11-24 «속성은 이해하기가 어렵다. 망치로는 골렘 같은 몬스터를 쉽게 잡는다 이런 설정을 위해서 있는 거 같긴 한데».
// 예전에는 「누구에게 몇 배」가 적 편집기 → 전투 → 「전체 표 보기」 안 등급 문자로만 있었다. 데이터는 그대로 적의 elementRates(A~E)다.
// 칸을 한 번 누르면 보통 → 2배 → 1.5배 → 절반 → 무효 → 보통 으로 돈다. 저장은 적 편집기와 같은 updateDatabaseRecord 다.
import { elementDisplayName } from "@/battle/skillHelp";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { elementGradeWord } from "@/editor/panels/databaseElementPresentation";
import { sectionCard } from "@/editor/panels/databaseWorkspace";
import { store } from "@/project/store";
import type { ActorRateGrade, DatabaseElementRecord, EnemyRecord, Project } from "@/project/types";
import { el } from "@/util/dom";

/** 공격 속성이 아닌 기본 칸(능력치 변화·흡수 계열)은 표에서 뺀다. */
const NON_ATTACK_ELEMENT_IDS: ReadonlySet<string> = new Set(["atk", "def", "int", "agi", "absorb"]);
const CYCLE: readonly ActorRateGrade[] = ["C", "A", "B", "D", "E"];

export function affinityElements(project: Pick<Project, "database">): DatabaseElementRecord[] {
  return (project.database.elements ?? []).filter((element) => !NON_ATTACK_ELEMENT_IDS.has(element.id));
}

/** 다음 등급(한 번 누름). */
export function nextAffinityGrade(grade: ActorRateGrade | undefined): ActorRateGrade {
  return CYCLE[(CYCLE.indexOf(grade ?? "C") + 1) % CYCLE.length]!;
}

function gradeOf(enemy: EnemyRecord, elementId: string): ActorRateGrade {
  return (enemy.elementRates?.[elementId] as ActorRateGrade | undefined) ?? "C";
}

function percentOf(element: DatabaseElementRecord, grade: ActorRateGrade): number {
  return element.damageMultipliers[grade] ?? 100;
}

/** 속성마다 대표 무기를 이름 낱말로 먼저 찾는다(타격 → 망치, 「수습 지팡이」보다 알아보기 쉽다). */
const WEAPON_WORD: Readonly<Record<string, RegExp>> = { hit: /망치|해머|철퇴/u, sword: /검|칼/u, spear: /창/u, bow: /활/u };

/** 그 속성으로 때리는 대표 무기 이름(장비 공격 속성 첫 칸) — 「타격(전쟁 망치)」처럼 문장에 붙인다. */
function weaponFor(project: Pick<Project, "database">, elementId: string): string | undefined {
  const weapons = project.database.equipment.filter((entry) => entry.attackElementIds?.[0] === elementId);
  const word = WEAPON_WORD[elementId];
  return (word ? weapons.find((entry) => word.test(entry.name)) : undefined)?.name ?? weapons[0]?.name;
}

export type AffinitySentence = { readonly elementId: string; readonly enemyId: string; readonly text: string; readonly percent: number };

/** 「타격(전쟁 망치)은 돌 골렘에게 2배」 — 배율이 100% 를 넘는 칸만, 선택한 속성 먼저, 큰 배율 먼저. */
export function affinitySentences(project: Pick<Project, "database">, firstElementId?: string, limit = 4): AffinitySentence[] {
  const out: AffinitySentence[] = [];
  for (const element of affinityElements(project)) {
    const name = elementDisplayName(project, element.id);
    const weapon = weaponFor(project, element.id);
    for (const enemy of project.database.enemies) {
      const percent = percentOf(element, gradeOf(enemy, element.id));
      if (percent <= 100) continue;
      out.push({ elementId: element.id, enemyId: enemy.id, percent, text: `${name}${weapon ? `(${weapon})` : ""}은 ${enemy.name}에게 ${elementGradeWord(percent)}` });
    }
  }
  out.sort((a, b) => Number(b.elementId === firstElementId) - Number(a.elementId === firstElementId) || b.percent - a.percent);
  const seen = new Set<string>();
  return out.filter((entry) => (seen.has(entry.text) ? false : (seen.add(entry.text), true))).slice(0, limit);
}

let affinityQuery = "";

export function elementAffinityCard(selectedElementId: string | undefined): HTMLElement {
  const project = store.getCurrent();
  const elements = affinityElements(project);
  const sentences = el("div", { class: "db-el-affinity-sentences", dataset: { testid: "db-elements-affinity-sentences" } });
  const paintSentences = (): void => {
    const list = affinitySentences(store.getCurrent(), selectedElementId);
    sentences.replaceChildren(...(list.length
      ? list.map((entry) => el("p", { class: "db-el-affinity-sentence", text: entry.text, dataset: { testid: "db-elements-affinity-sentence", elementId: entry.elementId, enemyId: entry.enemyId } }))
      : [el("p", { class: "db-ws-usage", text: "아직 약점이 있는 적이 없습니다. 아래 표에서 칸을 누르면 「2배」가 됩니다." })]));
  };
  paintSentences();

  const head = el("tr", { children: [el("th", { text: "적", attrs: { scope: "col" } }), ...elements.map((element) => el("th", {
    text: elementDisplayName(project, element.id),
    attrs: { scope: "col" },
    class: element.id === selectedElementId ? "is-selected" : "",
  }))] });
  const body = el("tbody");
  const rows = project.database.enemies.map((enemy) => {
    const cells = elements.map((element) => {
      const button = el("button", { class: "db-el-affinity-cell", attrs: { type: "button" }, dataset: { testid: `db-elements-affinity-${enemy.id}-${element.id}` } }) as HTMLButtonElement;
      const paint = (grade: ActorRateGrade): void => {
        const percent = percentOf(element, grade);
        button.textContent = elementGradeWord(percent);
        button.dataset.grade = grade;
        button.dataset.tone = percent > 100 ? "weak" : percent < 100 ? "resist" : "normal";
        button.setAttribute("aria-label", `${elementDisplayName(project, element.id)} → ${enemy.name}: ${elementGradeWord(percent)}`);
      };
      paint(gradeOf(enemy, element.id));
      button.addEventListener("click", () => {
        const current = store.getCurrent().database.enemies.find((entry) => entry.id === enemy.id);
        if (!current) return;
        const next = nextAffinityGrade(gradeOf(current, element.id));
        const rates = { ...current.elementRates };
        if (next === "C") delete rates[element.id];
        else rates[element.id] = next;
        updateDatabaseRecord("enemies", enemy.id, { elementRates: rates });
        paint(next);
        paintSentences();
      });
      return el("td", { class: element.id === selectedElementId ? "is-selected" : "", children: [button] });
    });
    const row = el("tr", { dataset: { enemyId: enemy.id }, children: [el("th", { text: enemy.name, attrs: { scope: "row", title: enemy.id } }), ...cells] });
    return { row, enemy };
  });
  const search = el("input", { attrs: { type: "search", placeholder: "적 이름 찾기", "aria-label": "상성표 적 찾기" }, value: affinityQuery, dataset: { testid: "db-elements-affinity-search" } }) as HTMLInputElement;
  const filter = (): void => {
    const query = affinityQuery.trim();
    body.replaceChildren(...rows.filter(({ enemy }) => !query || enemy.name.includes(query) || enemy.id.includes(query)).map(({ row }) => row));
  };
  search.addEventListener("input", () => { affinityQuery = search.value; filter(); });
  filter();
  const card = sectionCard({
    title: "상성표",
    hint: "칸을 누르면 보통 → 2배 → 1.5배 → 절반 → 무효",
    testid: "db-elements-affinity-card",
    children: [
      sentences,
      search,
      el("div", { class: "db-el-affinity-scroll", children: [el("table", { class: "db-el-affinity-table", dataset: { testid: "db-elements-affinity-table" }, children: [el("thead", { children: [head] }), body] })] }),
    ],
  });
  card.classList.add("db-ws-span");
  return card;
}
