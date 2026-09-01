// 속성(elements) 탭 — 워크스페이스 프리미티브 기반 단일 레코드 편집기.
//
// 개편 이유(2026-08 DB 감사):
//   - H 축 P0: 상세 카드의 65% 가 영구적으로 빈 흰색이었다. `.db-elements-editor` 가
//     `grid-template-columns: minmax(320px,.9fr) minmax(360px,1.1fr)` +
//     `grid-template-rows: 88px 160px minmax(0,1fr)` 로 못박혀 있고 대미지 상자만
//     `grid-column:2; grid-row:1/4` 로 붙어 있어, 1열 3행에는 아무것도 놓이지 않았다.
//     1680x1050 에서 대략 500x1050px 의 공백. → 하드코딩 그리드를 버리고 `db-ws-stack`
//     (auto-fit minmax(400px,1fr)) 으로 폭이 되는 만큼 열을 채운다.
//   - F 축 P0: 전부 숫자 배율뿐인 탭에 미리보기가 하나도 없었다. 200%/150%/100%/50%/0%
//     가 실제로 얼마의 피해인지 알 수 없었다. → 기준 피해 대비 막대 + 결과값을 붙인다.
//   - D 축: 검색이 없고, 레코드를 만드는 유일한 경로가 "최대 개수" 라는 모호한 버튼뿐.
//     → 검색 + "+ 추가" 를 붙이고 "최대 개수" 는 보조 액션으로 남긴다.
//
// 테스트 계약(바꾸지 말 것): db-elements-classic / db-elements-list /
// db-elements-list-title("속성") / db-elements-row-<i> + is-selected /
// db-elements-maximum-number("최대 개수") / db-field-element-name-selected /
// db-field-element-kind-<kind> / db-field-element-damage-<A~E> 및
// "이름" · "속성 유형" · "대미지 배율" · "물리" · "마법" 정확 일치 텍스트가 각각 1 개.
import { clampElementListCount, resizeElementRecords } from "@/editor/databaseElementList";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { pruneDanglingElementRates } from "@/project/io/references";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { field, matchesNameOrId } from "@/editor/panels/databaseControls";
import { isElementKind, selectUtilityRecord } from "@/editor/panels/databaseUtilityRecordControls";
import {
  detailHero,
  detailPane,
  emptyState,
  listPane,
  listRow,
  listSearch,
  listToolbar,
  sectionCard,
  statStrip,
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import { store } from "@/project/store";
import type { ActorRateGrade, DatabaseElementRecord } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import "@/styles/database/modern/utility-records.css";

const ELEMENT_DAMAGE_GRADES: readonly ActorRateGrade[] = ["A", "B", "C", "D", "E"] as const;
const GRADE_DISPLAY_LABEL: Record<ActorRateGrade, string> = {
  A: "약함",
  B: "조금 약함",
  C: "보통",
  D: "강함",
  E: "무효",
};
const DEFAULT_MULTIPLIERS: Record<ActorRateGrade, number> = { A: 200, B: 150, C: 100, D: 50, E: 0 };
/** 막대가 가득 차는 배율. 기본값 최대치(200%) 를 기준으로 잡는다. */
const BAR_FULL_PERCENT = 200;

let selectedElementIndex = 5;
let elementQuery = "";
/** 배율이 실제 피해로 얼마인지 보여주기 위한 기준값. 편집 전용 표시값이라 저장하지 않는다. */
let referenceDamage = 100;

export function renderElementsTab(host: HTMLElement): void {
  const elements = store.getCurrent().database.elements ?? [];
  selectedElementIndex = clampIndex(selectedElementIndex, elements);
  selectUtilityRecord("elements", selectedElementIndex);
  const rerender = (): void => {
    host.replaceChildren();
    renderElementsTab(host);
  };

  const form = el("section", {
    class: "db-detail-form db-elements-classic",
    dataset: { testid: "db-detail-form" },
  });
  form.append(
    workspaceShell({
      list: elementListPane(elements, rerender),
      detail: elementDetailPane(elements[selectedElementIndex], selectedElementIndex, elements.length, rerender),
      testid: "db-elements-classic",
    }),
  );
  host.append(form);
}

function elementListPane(elements: readonly DatabaseElementRecord[], rerender: () => void): HTMLElement {
  const rows: HTMLElement[] = [];
  for (const [index, element] of elements.entries()) {
    const label = element.name?.trim() ? element.name : "(이름 없음)";
    if (elementQuery && !matchesNameOrId(label, element.id, elementQuery)) continue;
    const row = listRow({
      name: label,
      number: index + 1,
      thumb: kindThumb(element.kind),
      active: index === selectedElementIndex,
      title: `${label} #${index + 1} · ${element.id}`,
      testid: `db-elements-row-${index}`,
      onSelect: () => {
        selectedElementIndex = index;
        selectUtilityRecord("elements", index);
        rerender();
      },
    });
    // 기존 e2e 가 `is-selected` 로 선택 상태를 읽는다 — 워크스페이스의 `active` 와 함께 단다.
    if (index === selectedElementIndex) row.classList.add("is-selected");
    rows.push(row);
  }

  const pane = listPane({
    title: "속성",
    count: elements.length,
    search: listSearch({
      placeholder: "속성 검색",
      value: elementQuery,
      testid: "db-elements-search",
      onInput: (value) => {
        elementQuery = value;
        rerender();
      },
    }),
    rows,
    empty: emptyState({
      icon: "⌕",
      title: "검색 결과가 없습니다",
      body: elementQuery ? `"${elementQuery}" 와 일치하는 속성이 없습니다.` : "속성을 추가해 보세요.",
      compact: true,
    }),
    toolbar: listToolbar([
      {
        label: "+ 추가",
        kind: "primary",
        testid: "db-elements-add",
        title: "속성 목록 끝에 새 속성을 추가합니다",
        onClick: () => {
          const next = elements.length + 1;
          applyElementCount(next, () => {
            selectedElementIndex = clampIndex(next - 1, store.getCurrent().database.elements ?? []);
            elementQuery = "";
            rerender();
          });
        },
      },
      {
        label: "최대 개수",
        kind: "ghost",
        testid: "db-elements-maximum-number",
        title: "속성 목록 개수 변경",
        onClick: () => openElementMaxCountDialog(elements.length, (count) => {
          applyElementCount(count, () => {
            selectedElementIndex = clampIndex(selectedElementIndex, store.getCurrent().database.elements ?? []);
            rerender();
          });
        }),
      },
    ]),
    testid: "db-elements-list-pane",
  });

  // 예전 마크업의 훅을 새 요소에 옮겨 붙인다(테스트 계약 유지).
  tagChild(pane, ".db-ws-list-title", "db-elements-list-title");
  tagChild(pane, ".db-ws-list", "db-elements-list");
  return pane;
}

/** 개수 변경은 최대 개수 대화상자와 "+ 추가" 가 같은 경로를 쓴다. */
function applyElementCount(count: number, after: () => void): void {
  recordProjectSnapshot();
  store.update((project) => {
    project.database.elements = resizeElementRecords(project.database.elements ?? [], count);
    // B4: 축소로 잘린 속성 id 에 대한 actor/enemy/class elementRates 잔재를 즉시 제거.
    // 같은 ordinal 로 재생성 시 stale 등급이 소생하는 위험을 에디터 세션 내에서 차단.
    pruneDanglingElementRates(project);
  }, { scope: "database", collection: "elements" });
  after();
  toast(`속성 개수를 ${clampElementListCount(count)}개로 맞췄습니다.`, "ok");
}

function kindThumb(kind: DatabaseElementRecord["kind"]): HTMLElement {
  return el("span", {
    class: `db-el-kind-thumb db-el-kind-${kind}`,
    // 글리프(⚔/✦)는 한글 UI 폰트에서 두부로 떨어진다 — 한 글자 한글로 쓴다.
    attrs: { "aria-hidden": "true", title: kind === "magical" ? "마법 계열" : "물리 계열" },
    text: kind === "magical" ? "마" : "물",
  });
}

function tagChild(root: HTMLElement, selector: string, testid: string): void {
  const node = root.querySelector(selector) as HTMLElement | null;
  if (node) node.dataset.testid = testid;
}

function openElementMaxCountDialog(current: number, onApply: (count: number) => void): void {
  document.querySelector("[data-testid='db-elements-max-dialog']")?.remove();
  const input = el("input", {
    attrs: { type: "number", min: "1", max: "99" },
    value: current,
    dataset: { testid: "db-elements-max-count-input" },
  }) as HTMLInputElement;
  const backdrop = el("div", {
    class: "db-enemy-dialog-backdrop",
    dataset: { testid: "db-elements-max-dialog" },
  });
  const close = (): void => {
    unregisterModal(backdrop);
    backdrop.remove();
  };
  backdrop.append(
    el("div", {
      class: "db-enemy-dialog",
      children: [
        el("header", { text: "속성 최대 개수" }),
        el("main", {
          children: [
            el("label", {
              class: "db-field",
              children: [el("span", { text: "개수 (1~99)" }), input],
            }),
          ],
        }),
        el("footer", {
          children: [
            el("button", {
              class: "btn small",
              text: "OK",
              dataset: { testid: "db-elements-max-ok" },
              attrs: { type: "button" },
              on: {
                click: () => {
                  onApply(Number(input.value));
                  close();
                },
              },
            }),
            el("button", {
              class: "btn small",
              text: "Cancel",
              dataset: { testid: "db-elements-max-cancel" },
              attrs: { type: "button" },
              on: { click: close },
            }),
          ],
        }),
      ],
    }),
  );
  document.body.append(backdrop);
  registerModal(backdrop, close);
  input.focus();
  input.select();
}

function elementDetailPane(
  element: DatabaseElementRecord | undefined,
  index: number,
  total: number,
  rerender: () => void,
): HTMLElement {
  if (!element) {
    return detailPane({
      body: emptyState({
        icon: "✦",
        title: "속성이 없습니다",
        body: "왼쪽 아래 \"+ 추가\" 로 첫 속성을 만드세요. 속성은 스킬·무기의 피해 계열과 배우/몬스터의 내성 등급을 잇습니다.",
      }),
      testid: "db-elements-editor",
    });
  }
  return detailPane({
    hero: detailHero({
      eyebrow: "ELEMENT",
      title: element.name?.trim() ? element.name : "(이름 없음)",
      subtitle: element.id,
      tags: [
        `#${index + 1} / ${total}`,
        element.kind === "magical" ? "마법 계열" : "물리 계열",
        element.kind === "magical" ? "정신력으로 경감" : "물리 방어력으로 경감",
      ],
      testid: "db-elements-hero",
    }),
    body: el("div", {
      class: "db-ws-stack",
      children: [
        elementIdentityCard(element, index),
        elementUsageCard(element),
        elementDamageCard(element, index, rerender),
      ],
    }),
    testid: "db-elements-editor",
  });
}

/**
 * 이 속성이 실제로 어디에 걸려 있는지. 감사 F 축(미리보기 없음)의 나머지 절반 —
 * 배율만 고쳐서는 "이 속성을 아무도 안 쓴다" 는 사실을 알 수 없었다.
 */
function elementUsageCard(element: DatabaseElementRecord): HTMLElement {
  const database = store.getCurrent().database;
  const skills = database.skills.filter((skill) => skill.elementId === element.id);
  const hasRate = (rates: Record<string, ActorRateGrade> | undefined): boolean =>
    Boolean(rates && rates[element.id] !== undefined);
  const actors = database.actors.filter((actor) => hasRate(actor.elementRates)).length;
  const enemies = database.enemies.filter((enemy) => hasRate(enemy.elementRates)).length;
  const classes = database.classes.filter((klass) => hasRate(klass.elementRates)).length;
  const unused = skills.length === 0 && actors + enemies + classes === 0;

  return sectionCard({
    title: "사용처",
    hint: unused ? "아직 아무 데도 연결되지 않았습니다" : "이 속성을 참조하는 레코드",
    children: [
      statStrip([
        { label: "스킬", value: `${skills.length}`, tone: skills.length > 0 ? "good" : "warn" },
        { label: "배우 내성", value: `${actors}`, tone: actors > 0 ? "good" : "neutral" },
        { label: "몬스터 내성", value: `${enemies}`, tone: enemies > 0 ? "good" : "neutral" },
        { label: "직업 내성", value: `${classes}`, tone: classes > 0 ? "good" : "neutral" },
      ], { testid: "db-elements-usage-stats" }),
      el("p", {
        class: "db-ws-usage",
        dataset: { testid: "db-elements-usage-skills" },
        text: skills.length > 0
          ? `스킬: ${skills.slice(0, 6).map((skill) => skill.name).join(", ")}${skills.length > 6 ? ` 외 ${skills.length - 6}` : ""}`
          : "이 속성을 쓰는 스킬이 없습니다. 스킬 탭에서 속성을 지정하면 위 배율이 적용됩니다.",
      }),
    ],
    testid: "db-elements-usage-card",
  });
}

/**
 * 이름 + 유형을 한 카드로 묶는다. 예전처럼 카드를 하나씩 쪼개면 auto-fit 2 열 스택에
 * 빈 칸이 하나 남아, 없앤 하드코딩 그리드와 똑같은 공백이 다시 생긴다.
 *
 * "이름" / "속성 유형" / "물리" / "마법" 은 e2e 가 정확 일치로 집는 텍스트라 **문서 전체에
 * 각각 하나만** 있어야 한다 — 카드 제목으로 쓰지 않고 필드 라벨로만 쓴다.
 */
function elementIdentityCard(element: DatabaseElementRecord, index: number): HTMLElement {
  const input = el("input", {
    class: "db-elements-name-input",
    attrs: { type: "text" },
    dataset: { testid: "db-field-element-name-selected" },
    value: element.name,
  });
  input.addEventListener("focus", () => selectUtilityRecord("elements", index));
  input.addEventListener("input", () => {
    const value = input.value;
    recordCoalescedSnapshot(`db-utility:elements:${index}:name`);
    store.update((project) => {
      const target = project.database.elements?.[index];
      if (target) target.name = value;
    });
  });

  // 라디오 두 개를 감싸는 라벨은 클릭이 첫 라디오로 새기 때문에 div 로 만든다.
  const kindGroup = el("div", {
    class: "db-field",
    attrs: { role: "radiogroup", "aria-label": "속성 유형" },
    children: [
      el("span", { text: "속성 유형" }),
      el("div", {
        class: "db-el-kind-choices",
        children: [
          el("label", {
            class: "db-elements-radio-row",
            children: [elementKindRadio("physical", element.kind === "physical", index), el("span", { text: "물리" })],
          }),
          el("label", {
            class: "db-elements-radio-row",
            children: [elementKindRadio("magical", element.kind === "magical", index), el("span", { text: "마법" })],
          }),
        ],
      }),
    ],
  });

  return sectionCard({
    title: "기본",
    hint: "스킬·무기 목록과 내성 표에 이 이름으로 나옵니다",
    children: [
      field("이름", input),
      kindGroup,
      el("p", {
        class: "db-ws-usage",
        text: element.kind === "magical"
          ? "마법 계열: 대상의 정신력이 높을수록 피해가 줄어듭니다."
          : "물리 계열: 대상의 물리 방어력이 높을수록 피해가 줄어듭니다.",
      }),
      el("p", { class: "db-ws-usage", text: `속성 ID ${element.id}` }),
    ],
    testid: "db-elements-name-card",
  });
}

function elementKindRadio(kind: DatabaseElementRecord["kind"], checked: boolean, index: number): HTMLInputElement {
  const input = el("input", {
    attrs: { type: "radio", name: "db-elements-attribute-type", value: kind },
    dataset: { testid: `db-field-element-kind-${kind}` },
  });
  input.checked = checked;
  input.addEventListener("focus", () => selectUtilityRecord("elements", index));
  input.addEventListener("change", () => {
    if (!input.checked) return;
    recordProjectSnapshot();
    store.update((project) => {
      const target = project.database.elements?.[index];
      if (target) target.kind = isElementKind(input.value) ? input.value : "physical";
    });
  });
  return input;
}

/**
 * 대미지 배율 카드. 감사 F 축 P0 의 답 — 배율 숫자 옆에 "기준 피해 N 일 때 실제로 몇" 을
 * 막대와 숫자로 같이 보여준다. 기준값과 배율 입력은 재렌더 없이 막대를 직접 갱신하므로
 * 타이핑 중 포커스가 튀지 않는다.
 */
function elementDamageCard(element: DatabaseElementRecord, index: number, rerender: () => void): HTMLElement {
  const refresh: ((reference: number) => void)[] = [];
  const reference = el("input", {
    class: "db-el-reference",
    attrs: { type: "number", min: "1", max: "9999", "aria-label": "기준 피해" },
    value: referenceDamage,
    dataset: { testid: "db-elements-reference-damage" },
  }) as HTMLInputElement;
  const applyReference = (): void => {
    const next = Number(reference.value);
    referenceDamage = Number.isFinite(next) && next > 0 ? Math.min(9999, Math.trunc(next)) : 100;
    for (const update of refresh) update(referenceDamage);
  };
  reference.addEventListener("input", applyReference);
  reference.addEventListener("change", () => {
    applyReference();
    reference.value = String(referenceDamage);
  });

  const rows = ELEMENT_DAMAGE_GRADES.map((grade) => {
    const row = elementDamageRow(element, index, grade);
    refresh.push(row.update);
    return row.node;
  });

  const resetButton = el("button", {
    class: "db-ws-btn db-ws-btn-ghost",
    text: "기본값 200/150/100/50/0",
    attrs: { type: "button", title: "이 속성의 다섯 등급을 기본 배율로 되돌립니다" },
    dataset: { testid: "db-elements-damage-reset" },
  });
  resetButton.addEventListener("click", () => {
    recordProjectSnapshot();
    store.update((project) => {
      const target = project.database.elements?.[index];
      if (target) target.damageMultipliers = { ...DEFAULT_MULTIPLIERS };
    });
    rerender();
  });

  const card = sectionCard({
    title: "대미지 배율",
    hint: "대상의 내성 등급별로 이 속성 피해가 몇 %로 들어가는지",
    children: [
      el("div", {
        class: "db-el-scale-head",
        children: [
          el("span", { text: "기준 피해" }),
          reference,
        ],
      }),
      ...rows,
      resetButton,
    ],
    testid: "db-elements-damage-card",
  });
  // 다섯 등급 막대는 상세 창 폭을 다 쓸 때 비로소 눈금 구실을 한다.
  card.classList.add("db-ws-span");
  return card;
}

type DamageRow = { readonly node: HTMLElement; readonly update: (reference: number) => void };

function elementDamageRow(element: DatabaseElementRecord, index: number, grade: ActorRateGrade): DamageRow {
  const input = el("input", {
    class: "db-elements-damage-input",
    attrs: { type: "number", step: "1" },
    dataset: { testid: `db-field-element-damage-${grade}` },
    value: element.damageMultipliers[grade],
  });
  const fill = el("span", { class: "db-el-bar-fill" });
  const bar = el("span", {
    class: "db-el-bar",
    attrs: { "aria-hidden": "true" },
    children: [fill],
  });
  const result = el("span", { class: "db-el-result", dataset: { testid: `db-elements-damage-result-${grade}` } });

  const paint = (multiplier: number, reference: number): void => {
    const tone = damageTone(multiplier);
    bar.className = `db-el-bar db-el-bar-${tone}`;
    fill.style.width = `${Math.min(100, Math.abs(multiplier) / BAR_FULL_PERCENT * 100).toFixed(1)}%`;
    const dealt = Math.round(reference * multiplier / 100);
    result.className = `db-el-result db-el-result-${tone}`;
    result.textContent = multiplier === 0 ? "피해 없음" : multiplier < 0 ? `${Math.abs(dealt)} 회복` : `${dealt} 피해`;
  };
  paint(element.damageMultipliers[grade], referenceDamage);

  input.addEventListener("focus", () => selectUtilityRecord("elements", index));
  input.addEventListener("input", () => {
    const value = clampDamageMultiplier(Number(input.value));
    paint(value, referenceDamage);
    recordCoalescedSnapshot(`db-utility:elements:${index}:damage:${grade}`);
    store.update((project) => {
      const target = project.database.elements?.[index];
      if (target) target.damageMultipliers = { ...target.damageMultipliers, [grade]: value };
    });
  });
  // blur 시 클램프된 저장값을 입력창에 되써서 표시-저장 불일치를 없앤다(P4 계열).
  input.addEventListener("change", () => {
    input.value = String(clampDamageMultiplier(Number(input.value)));
  });

  const node = el("label", {
    class: "db-el-damage-row",
    children: [
      el("span", {
        class: `db-elements-grade grade-${grade.toLowerCase()}`,
        text: GRADE_DISPLAY_LABEL[grade],
        attrs: { title: `내성 등급 ${grade}` },
      }),
      input,
      el("span", { class: "db-elements-percent", text: "%" }),
      bar,
      result,
    ],
  });
  return { node, update: (nextReference) => paint(clampDamageMultiplier(Number(input.value)), nextReference) };
}

function damageTone(multiplier: number): "bad" | "neutral" | "good" | "none" {
  if (multiplier <= 0) return "none";
  if (multiplier > 100) return "bad";
  if (multiplier === 100) return "neutral";
  return "good";
}

function clampIndex(index: number, elements: readonly DatabaseElementRecord[]): number {
  if (elements.length === 0) return 0;
  return Math.min(Math.max(index, 0), elements.length - 1);
}

function clampDamageMultiplier(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(99999, Math.max(-9999, Math.trunc(value)));
}
