// editor/panels/databaseEnemyResistSummary.ts
//
// 전투 몬스터 「약점·저항」 카드. 상태 ~20줄 + 속성 ~15줄의 등급 표는 거의 전부 기본값이라
// 한눈에 무엇이 특별한지 보이지 않았다(전투 탭 1776px 실측). 기본과 다른 항목만 칩으로 보여 주고,
// 전체 표(기존 상태/속성 유효도 카드 — testid 그대로)는 접힌 「전체 표 보기」 안에 둔다.
//
// 칩의 뜻은 표의 옵션 라벨과 같은 계산에서 나온다: 상태는 stateRatePercentage(등급),
// 속성은 elements[].damageMultipliers[등급] (기본은 C 등급 배율).
import { ACTOR_RATE_GRADES, stateRatePercentage } from "@/project/actorModel";
import { store } from "@/project/store";
import type { ActorRateGrade, EnemyRecord, Project } from "@/project/types";
import { el } from "@/util/dom";
import { sectionCard } from "@/editor/panels/databaseWorkspace";
import { currentEnemy } from "@/editor/panels/databaseEnemyRecordSupport";

export type EnemyResistTone = "weak" | "resist" | "immune" | "absorb" | "warn";

export interface EnemyResistHighlight {
  readonly kind: "state" | "element" | "dangling";
  readonly id: string;
  readonly text: string;
  readonly tone: EnemyResistTone;
  /** 전체 표 안의 해당 행 컨트롤 testid(칩을 누르면 그 행으로 간다). */
  readonly testid: string;
  readonly title: string;
}

export interface EnemyResistSummary {
  readonly highlights: readonly EnemyResistHighlight[];
  /** 전체 표의 행 수(상태 + 속성, 목록에 없는 등급 제외). */
  readonly total: number;
  readonly stateCount: number;
  readonly elementCount: number;
}

const openTables = new Set<string>();

function formatMultiplier(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function enemyResistSummary(project: Project, enemy: EnemyRecord): EnemyResistSummary {
  const database = project.database;
  const states = [{ id: "state_death", name: "전투불능" }, ...database.states.filter((state) => state.id !== "state_death")];
  const elements = database.elements ?? [];
  const highlights: EnemyResistHighlight[] = [];
  for (const element of elements) {
    const grade = enemy.elementRates[element.id];
    if (!grade) continue;
    const multiplier = (element.damageMultipliers?.[grade] ?? 100) / 100;
    const base = (element.damageMultipliers?.C ?? 100) / 100;
    if (multiplier === base) continue;
    const tone: EnemyResistTone = multiplier < 0 ? "absorb" : multiplier === 0 ? "immune" : multiplier > base ? "weak" : "resist";
    const text = tone === "absorb" ? `${element.name} 흡수`
      : tone === "immune" ? `${element.name} 무효`
        : tone === "weak" ? `${element.name} ×${formatMultiplier(multiplier)} 약점`
          : `${element.name} ×${formatMultiplier(multiplier)}`;
    highlights.push({
      kind: "element",
      id: element.id,
      text,
      tone,
      testid: `db-picker-enemy-element-rate-${element.id}`,
      title: `${element.name} 속성 공격을 받으면 피해 ${formatMultiplier(multiplier)}배 (등급 ${grade})`,
    });
  }
  for (const state of states) {
    const grade: ActorRateGrade | undefined = enemy.stateRates[state.id];
    if (!grade || !ACTOR_RATE_GRADES.includes(grade)) continue;
    const percent = stateRatePercentage(grade);
    if (percent === 100) continue;
    highlights.push({
      kind: "state",
      id: state.id,
      text: percent === 0 ? `${state.name} 무효` : `${state.name} ${percent}%만 걸림`,
      tone: percent === 0 ? "immune" : "resist",
      testid: `db-picker-enemy-state-rate-${state.id}`,
      title: `${state.name}에 걸리는 확률 ${percent}% (등급 ${grade})`,
    });
  }
  const known = new Set(elements.map((element) => element.id));
  const dangling = Object.keys(enemy.elementRates).filter((id) => !known.has(id));
  if (dangling.length > 0) {
    highlights.push({
      kind: "dangling",
      id: dangling[0]!,
      text: `목록에 없는 속성 ${dangling.length}개`,
      tone: "warn",
      testid: `db-enemy-element-rate-dangling-delete-${dangling[0]}`,
      title: `속성 목록에서 사라진 등급이 남아 있습니다: ${dangling.join(", ")}. 게임은 무시합니다.`,
    });
  }
  return { highlights, total: states.length + elements.length, stateCount: states.length, elementCount: elements.length };
}

/**
 * 약점·저항 카드. `stateCard`·`elementCard` 는 기존 「상태 유효도」·「속성 유효도」 카드 그대로이며
 * 접힌 표 안에 들어간다(패널 11개 계약·행 testid 유지). 표에서 등급을 바꾸면 칩이 제자리에서 갱신된다.
 */
export function enemyResistCard(record: EnemyRecord, stateCard: HTMLElement, elementCard: HTMLElement): HTMLElement {
  const chips = el("div", { class: "db-enemy-resist-chips", dataset: { testid: "db-enemy-resist-chips" } });
  const note = el("p", { class: "db-enemy-resist-note", dataset: { testid: "db-enemy-resist-note" } });
  const summaryLabel = el("span", { text: "전체 표 보기" });
  const summaryCount = el("small", { class: "db-enemy-resist-table-count" });
  const table = el("details", {
    class: "db-enemy-resist-table",
    dataset: { testid: "db-enemy-resist-table" },
    children: [el("summary", { dataset: { testid: "db-enemy-resist-table-toggle" }, children: [summaryLabel, summaryCount] }), stateCard, elementCard],
  }) as HTMLDetailsElement;
  table.open = openTables.has(record.id);
  table.addEventListener("toggle", () => {
    if (table.open) openTables.add(record.id);
    else openTables.delete(record.id);
  });

  const focusRow = (testid: string): void => {
    table.open = true;
    openTables.add(record.id);
    const target = Array.from(table.querySelectorAll<HTMLElement>("[data-testid]")).find((node) => node.dataset.testid === testid);
    if (!target) return;
    target.scrollIntoView?.({ block: "center" });
    target.focus();
  };

  const refresh = (): void => {
    const summary = enemyResistSummary(store.getCurrent(), currentEnemy(record));
    const counted = summary.highlights.filter((entry) => entry.kind !== "dangling").length;
    chips.replaceChildren(...summary.highlights.map((entry) => el("button", {
      class: `db-enemy-resist-chip is-${entry.tone}`,
      text: entry.text,
      attrs: { type: "button", title: `${entry.title} — 누르면 표에서 이 줄로 갑니다` },
      dataset: { testid: `db-enemy-resist-chip-${entry.kind}-${entry.id}`, tone: entry.tone },
      on: { click: () => focusRow(entry.testid) },
    })));
    chips.hidden = summary.highlights.length === 0;
    note.textContent = summary.total === 0
      ? "상태·속성이 아직 없습니다. 표를 열어 확인하세요."
      : counted === 0
        ? `상태·속성 ${summary.total}개 모두 기본값입니다(피해·확률 그대로).`
        : `나머지 ${summary.total - counted}개는 기본값입니다.`;
    summaryCount.textContent = ` 상태 ${summary.stateCount} · 속성 ${summary.elementCount}`;
  };
  refresh();

  const card = sectionCard({
    title: "약점·저항",
    hint: "기본과 다른 것만 보여 줍니다.",
    children: [chips, note, table],
    testid: "db-enemy-card-resist",
  });
  card.addEventListener("change", refresh);
  // 목록에 없는 등급 「삭제」는 change 가 아니라 click 이다.
  card.addEventListener("click", (event) => {
    if ((event.target as HTMLElement | null)?.closest?.(".db-enemy-rate-row.is-dangling button")) refresh();
  });
  return card;
}
