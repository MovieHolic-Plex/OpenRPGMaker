// 속성(elements) 탭 — 워크스페이스 프리미티브 기반 단일 레코드 편집기.
//
// 그림 목록 + 기본 정보 → 배율 예시와 A–E 편집 → 명시적 참조의 단일 열 워크시트.
// 예시는 속성 배율만 계산하며 그림·기준 피해·선택 등급은 저작 데이터에 저장하지 않는다.
// 검색과 필드 편집은 입력 노드를 유지하고, 레코드 선택/개수 변경만 구조를 다시 만든다.
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
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import { elementArtwork, elementDefenseContext, elementDefenseNote, elementOutcome } from "@/editor/panels/databaseElementPresentation";
import { store } from "@/project/store";
import type { ActorRateGrade, DatabaseElementRecord } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import "@/styles/database/modern/utility-records.css";

const ELEMENT_DAMAGE_GRADES: readonly ActorRateGrade[] = ["A", "B", "C", "D", "E"] as const;
const DEFAULT_MULTIPLIERS: Record<ActorRateGrade, number> = { A: 200, B: 150, C: 100, D: 50, E: 0 };

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
      detail: elementDetailPane(elements[selectedElementIndex], selectedElementIndex, elements.length),
      testid: "db-elements-classic",
    }),
  );
  host.append(form);
}

function elementListPane(elements: readonly DatabaseElementRecord[], rerender: () => void): HTMLElement {
  const rows: HTMLElement[] = [];
  for (const [index, element] of elements.entries()) {
    const label = element.name?.trim() ? element.name : "(이름 없음)";
    const row = listRow({
      name: label,
      number: index + 1,
      thumb: elementArtwork(element, store.getCurrent(), 32),
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

  const noMatch = emptyState({
    title: "검색 결과가 없습니다",
    body: elements.length ? "다른 이름이나 ID로 찾아보세요." : "속성을 추가해 보세요.",
    compact: true,
    action: { label: "검색 지우기", testid: "db-elements-search-clear", onClick: () => {
      elementQuery = "";
      const search = pane.querySelector<HTMLInputElement>("input[type=search]")!;
      search.value = "";
      refreshRows();
      search.focus();
    } },
  });
  const refreshRows = (): void => {
    const current = store.getCurrent().database.elements ?? [];
    const visible = rows.filter((row, index) => {
      const element = current[index];
      const name = element.name.trim() ? element.name : "(이름 없음)";
      row.querySelector<HTMLElement>(".db-list-name")!.textContent = name;
      row.title = `${name} #${index + 1} · ${element.id}`;
      return matchesNameOrId(name, element.id, elementQuery);
    });
    const list = pane.querySelector<HTMLElement>(".db-ws-list")!;
    list.classList.toggle("db-ws-list-empty", !visible.length);
    list.replaceChildren(...(visible.length ? visible : [noMatch]));
  };
  const pane = listPane({
    title: "속성",
    count: elements.length,
    search: listSearch({
      placeholder: "속성 검색",
      value: elementQuery,
      testid: "db-elements-search",
      onInput: (value) => {
        elementQuery = value;
        refreshRows();
      },
    }),
    rows,
    empty: noMatch,
    toolbar: listToolbar([
      {
        label: "+ 추가",
        kind: "primary",
        testid: "db-elements-add",
        disabled: elements.length >= 99,
        title: elements.length >= 99 ? "속성은 최대 99개까지 만들 수 있습니다" : "속성 목록 끝에 새 속성을 추가합니다",
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
  refreshRows();
  pane.addEventListener("element-identity-change", refreshRows);
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
  }, { scope: "database", collection: "elements", label: "속성 개수 변경" });
  after();
  toast(`속성 개수를 ${clampElementListCount(count)}개로 맞췄습니다.`, "ok");
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
      eyebrow: "속성",
      title: element.name?.trim() ? element.name : "(이름 없음)",
      subtitle: element.id,
      media: elementArtwork(element, store.getCurrent(), 52),
      tags: [
        `#${index + 1} / ${total}`,
        element.kind === "magical" ? "마법 계열" : "물리 계열",
      ],
      testid: "db-elements-hero",
    }),
    body: el("div", {
      class: "db-ws-stack db-el-worksheet",
      children: [
        elementIdentityCard(element, index),
        elementDamageCard(element, index),
        elementUsageCard(element),
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
  const attack = database.equipment.filter((entry) => entry.attackElementIds?.[0] === element.id).length;
  const defense = database.equipment.filter((entry) => entry.elementalDefenseIds?.includes(element.id)).length;

  return sectionCard({
    title: "사용처",
    hint: "저작 데이터의 명시적 참조",
    children: [
      el("p", {
        class: "db-ws-usage",
        dataset: { testid: "db-elements-usage-stats", skills: String(skills.length), actors: String(actors), enemies: String(enemies), classes: String(classes), attack: String(attack), defense: String(defense) },
        text: `스킬 ${skills.length} · 장비 공격 ${attack} · 장비 방어 ${defense} · 배우 등급 ${actors} · 몬스터 등급 ${enemies} · 직업 참조 ${classes}`,
      }),
      el("p", {
        class: "db-ws-usage",
        dataset: { testid: "db-elements-usage-skills" },
        text: skills.length > 0
          ? `스킬: ${skills.slice(0, 6).map((skill) => skill.name).join(", ")}${skills.length > 6 ? ` 외 ${skills.length - 6}` : ""}`
          : "이 속성을 참조하는 스킬이 없습니다. 등급이 없는 대상에 C를 자동 지정하지 않습니다.",
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
    }, { scope: "database", collection: "elements", label: "속성 이름 변경" });
    refreshIdentity(input, index);
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
        dataset: { testid: "db-elements-defense-context", context: elementDefenseContext(store.getCurrent(), element.id) },
        text: elementDefenseNote(store.getCurrent(), element.id),
      }),
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
    }, { scope: "database", collection: "elements", label: "속성 유형 변경" });
    refreshIdentity(input, index);
  });
  return input;
}

/**
 * 대미지 배율 카드. 감사 F 축 P0 의 답 — 배율 숫자 옆에 "기준 피해 N 일 때 실제로 몇" 을
 * 막대와 숫자로 같이 보여준다. 기준값과 배율 입력은 재렌더 없이 막대를 직접 갱신하므로
 * 타이핑 중 포커스가 튀지 않는다.
 */
function elementDamageCard(element: DatabaseElementRecord, index: number): HTMLElement {
  const refresh: ((reference: number, scale: number) => void)[] = [];
  const gradeSelect = el("select", {
    attrs: { "aria-label": "예시 내성 등급" },
    dataset: { testid: "db-elements-preview-grade" },
    children: ELEMENT_DAMAGE_GRADES.map((grade) => el("option", { attrs: { value: grade }, text: grade })),
  });
  gradeSelect.value = "C";
  const result = el("output", { dataset: { testid: "db-elements-example-result" }, attrs: { "aria-live": "polite" } });
  const artwork = elementArtwork(element, store.getCurrent(), 96, false);
  const example = el("div", { class: "db-el-example", children: [
    artwork,
    el("div", { class: "db-el-example-copy", children: [
      el("strong", { text: element.name || "(이름 없음)", dataset: { testid: "db-elements-example-name" } }),
      el("span", { class: "db-ws-usage", text: artwork.title }),
      result,
    ] }),
  ] });
  const paintAll = (): void => {
    const current = store.getCurrent().database.elements![index];
    const scale = Math.max(100, ...ELEMENT_DAMAGE_GRADES.map((grade) => Math.abs(current.damageMultipliers[grade])));
    for (const update of refresh) update(referenceDamage, scale);
    const percentage = current.damageMultipliers[gradeSelect.value as ActorRateGrade];
    const outcome = elementOutcome(referenceDamage, percentage);
    result.dataset.value = String(outcome.value);
    result.dataset.outcome = outcome.outcome;
    result.textContent = `${referenceDamage} × ${percentage}% = ${outcome.text}`;
  };
  gradeSelect.addEventListener("change", paintAll);
  const reference = el("input", {
    class: "db-el-reference",
    attrs: { type: "number", min: "1", max: "9999", "aria-label": "기준 피해" },
    value: referenceDamage,
    dataset: { testid: "db-elements-reference-damage" },
  }) as HTMLInputElement;
  const applyReference = (): void => {
    const next = Number(reference.value);
    referenceDamage = Number.isFinite(next) && next > 0 ? Math.min(9999, Math.trunc(next)) : 100;
    paintAll();
  };
  reference.addEventListener("input", applyReference);
  reference.addEventListener("change", () => {
    applyReference();
    reference.value = String(referenceDamage);
  });

  const rows = ELEMENT_DAMAGE_GRADES.map((grade) => {
    const row = elementDamageRow(element, index, grade, () => {
      gradeSelect.value = grade;
      paintAll();
    }, paintAll);
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
    }, { scope: "database", collection: "elements", label: "속성 배율 초기화" });
    for (const grade of ELEMENT_DAMAGE_GRADES) {
      card.querySelector<HTMLInputElement>(`[data-testid="db-field-element-damage-${grade}"]`)!.value = String(DEFAULT_MULTIPLIERS[grade]);
    }
    paintAll();
  });

  const card = sectionCard({
    title: "대미지 배율",
    hint: "속성 배율 예시 · 다른 전투 보정 전의 피해를 기준으로 계산",
    children: [
      el("div", {
        class: "db-el-scale-head",
        children: [
          field("기준 피해", reference),
          field("예시 등급", gradeSelect),
        ],
      }),
      example,
      el("p", { class: "db-ws-usage", text: "공통 척도 · 가운데 0% / 오른쪽 기준선 100% · 왼쪽 회복 / 오른쪽 피해" }),
      ...rows,
      resetButton,
      el("p", { class: "db-ws-usage", text: "방어·스킬 위력·타입 상성/STAB·장비·치명타·난수·HP 상한은 계산하지 않습니다." }),
    ],
    testid: "db-elements-damage-card",
  });
  // 다섯 등급 막대는 상세 창 폭을 다 쓸 때 비로소 눈금 구실을 한다.
  card.classList.add("db-ws-span");
  paintAll();
  return card;
}

type DamageRow = { readonly node: HTMLElement; readonly update: (reference: number, scale: number) => void };

function elementDamageRow(element: DatabaseElementRecord, index: number, grade: ActorRateGrade, selectGrade: () => void, refresh: () => void): DamageRow {
  const input = el("input", {
    class: "db-elements-damage-input",
    attrs: { type: "number", step: "1", min: "-9999", max: "99999", "aria-label": `${grade} 등급 대미지 배율 (%)` },
    dataset: { testid: `db-field-element-damage-${grade}` },
    value: element.damageMultipliers[grade],
  });
  const fill = el("span", { class: "db-el-bar-fill" });
  const bar = el("span", {
    class: "db-el-bar",
    dataset: { testid: `db-elements-damage-bar-${grade}` },
    attrs: { "aria-hidden": "true" },
    children: [fill, el("span", { class: "db-el-baseline" })],
  });
  const result = el("span", { class: "db-el-result", dataset: { testid: `db-elements-damage-result-${grade}` } });

  const paint = (multiplier: number, reference: number, scale: number): void => {
    const outcome = elementOutcome(reference, multiplier);
    bar.dataset.scale = String(scale);
    bar.dataset.outcome = outcome.outcome;
    fill.style.width = `${Math.abs(multiplier) / scale * 50}%`;
    fill.style.left = multiplier < 0 ? `${50 - Math.abs(multiplier) / scale * 50}%` : "50%";
    bar.style.setProperty("--element-baseline", `${50 + 100 / scale * 50}%`);
    result.dataset.value = String(outcome.value);
    result.dataset.outcome = outcome.outcome;
    result.textContent = outcome.text;
  };

  input.addEventListener("focus", () => { selectUtilityRecord("elements", index); selectGrade(); });
  input.addEventListener("input", () => {
    const value = clampDamageMultiplier(Number(input.value));
    recordCoalescedSnapshot(`db-utility:elements:${index}:damage:${grade}`);
    store.update((project) => {
      const target = project.database.elements?.[index];
      if (target) target.damageMultipliers = { ...target.damageMultipliers, [grade]: value };
    }, { scope: "database", collection: "elements", label: `${grade} 속성 배율 변경` });
    refresh();
  });
  // blur 시 클램프된 저장값을 입력창에 되써서 표시-저장 불일치를 없앤다(P4 계열).
  input.addEventListener("change", () => {
    input.value = String(clampDamageMultiplier(Number(input.value)));
  });

  const node = el("label", {
    class: "db-el-damage-row",
    children: [
      el("span", {
        class: "db-el-grade",
        text: grade,
        attrs: { title: `내성 등급 ${grade}` },
      }),
      input,
      el("span", { class: "db-elements-percent", text: "%" }),
      bar,
      result,
    ],
  });
  return { node, update: (nextReference, scale) => paint(clampDamageMultiplier(Number(input.value)), nextReference, scale) };
}

function refreshIdentity(source: HTMLElement, index: number): void {
  const root = source.closest<HTMLElement>(".db-elements-classic")!;
  const project = store.getCurrent();
  const element = project.database.elements![index];
  const name = element.name.trim() ? element.name : "(이름 없음)";
  for (const selector of [".db-ws-hero-title", `[data-testid="db-elements-row-${index}"] .db-list-name`, '[data-testid="db-elements-example-name"]']) {
    const target = root.querySelector<HTMLElement>(selector);
    if (target) { target.textContent = name; target.title = name; }
  }
  const tags = root.querySelectorAll(".db-ws-hero-tags .db-ws-tag");
  tags[1].textContent = element.kind === "magical" ? "마법 계열" : "물리 계열";
  const note = root.querySelector<HTMLElement>('[data-testid="db-elements-defense-context"]')!;
  note.textContent = elementDefenseNote(project, element.id);
  note.dataset.context = elementDefenseContext(project, element.id);
  const art = root.querySelector<HTMLElement>(".db-el-example [data-art-source]")!;
  art.setAttribute("aria-label", `${name} · ${art.title}`);
  root.querySelector<HTMLElement>('[data-testid="db-elements-list-pane"]')!.dispatchEvent(new Event("element-identity-change"));
}

function clampIndex(index: number, elements: readonly DatabaseElementRecord[]): number {
  if (elements.length === 0) return 0;
  return Math.min(Math.max(index, 0), elements.length - 1);
}

function clampDamageMultiplier(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(99999, Math.max(-9999, Math.trunc(value)));
}
