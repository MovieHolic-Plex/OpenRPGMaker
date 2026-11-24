import { battleCommandKindLabel, battleCommandMenuPreview } from "@/player/battleCommandDom";
import { battleScenePreviewFrame } from "./battleScenePreviewFrame";
import { resolveTerms } from "@/project/terms";
import { createActorRecord } from "@/project/actorModel";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { insertCatalogClassCommand, reorderEditableClassCommand } from "@/editor/databaseClassCommandOrder";
import { recordProjectSnapshot, undoMapEdit, pendingHistoryLabels } from "@/editor/mapEditHistory";
import { listToolbar, sectionCard, restoreFocusAfterRerender } from "./databaseWorkspace";
import { store } from "@/project/store";
import type { ClassBattleCommand, ClassRecord, DatabaseBattleCommandRecord, Project } from "@/project/types";
import { el } from "@/util/dom";
import { battleCommandCssEditor } from "./databaseBattleCommandCss";

let selectedClassId = "";
let includeSwitch = false;
let status = "명령을 빈 위치로 끌거나 메뉴에 추가를 누르세요.";
const MIME = "application/x-oprn-battle-command";
type RowOccurrence = { readonly classId: string; readonly menu: string; readonly index: number };
type Drag = { readonly source: "catalog" | "menu"; readonly id: string; readonly classId: string; readonly menu: string; readonly catalog: string; readonly token: string; readonly occurrence?: RowOccurrence };
let drag: Drag | undefined;
let sequence = 0;

function selectedClass(rerender?: () => void): ClassRecord | undefined {
  const klass = store.getCurrent().database.classes.find((entry) => entry.id === selectedClassId);
  if (!klass && rerender) {
    announce("편집하지 않았습니다. 선택한 직업이 없어져 목록을 새로 표시합니다. 직업을 확인해 주세요.");
    refresh(rerender, "db-command-class-select");
  }
  return klass;
}
function editable(klass: ClassRecord): ClassBattleCommand[] {
  return klass.battleCommands.filter((row) => row.id !== "cmd_change");
}
function occurrenceClass(occurrence: RowOccurrence, rerender?: () => void): ClassRecord | undefined {
  const klass = selectedClass(rerender);
  if (!klass) return undefined;
  if (klass?.id === occurrence.classId && JSON.stringify(klass.battleCommands) === occurrence.menu) return klass;
  announce("편집하지 않았습니다. 직업 메뉴가 바뀌었습니다. 다시 선택해 주세요.");
  return undefined;
}
function rowTestId(action: string, rows: readonly ClassBattleCommand[], index: number): string {
  const id = rows[index]!.id;
  return rows.filter((row) => row.id === id).length > 1 ? `db-command-occurrence-${index}-${action}` : `db-command-${action}-${id}`;
}
function announce(message: string): void {
  status = message;
  const region = document.querySelector<HTMLElement>('[data-testid="db-command-status"]');
  if (region) region.textContent = message;
}
function refresh(rerender: () => void, focus: string): void {
  drag = undefined;
  rerender();
  restoreFocusAfterRerender(focus);
}
function commit(klass: ClassRecord, commands: ClassBattleCommand[], label: string, rerender: () => void, focus: string): void {
  recordProjectSnapshot(label);
  store.update((project) => {
    const target = project.database.classes.find((entry) => entry.id === klass.id);
    if (target) target.battleCommands = commands;
  }, { scope: "database", collection: "classes", label });
  announce(label);
  refresh(rerender, focus);
}
function place(id: string, index: number, rerender: () => void): void {
  const klass = selectedClass(rerender);
  if (!klass) return;
  const result = insertCatalogClassCommand(klass.battleCommands, store.getCurrent().database.battleCommands?.find((row) => row.id === id), index);
  if (!result.ok) return announce("추가하지 않았습니다. 중복 명령, 고정 교체 또는 6개 제한을 확인하세요.");
  commit(klass, result.commands, "직업 메뉴에 명령 추가", rerender, `db-command-remove-${id}`);
}
function move(occurrence: RowOccurrence, index: number, rerender: () => void): void {
  const klass = occurrenceClass(occurrence, rerender);
  if (!klass) return;
  const result = reorderEditableClassCommand(klass.battleCommands, occurrence.index, index);
  if (!result.ok) return announce("순서를 바꾸지 않았습니다. 현재 위치와 6개 제한을 확인하세요.");
  commit(klass, result.commands, "직업 메뉴 순서 변경", rerender, rowTestId("remove", result.commands.filter((row) => row.id !== "cmd_change"), index));
}
function remove(occurrence: RowOccurrence, rerender: () => void): void {
  const klass = occurrenceClass(occurrence, rerender);
  if (!klass) return;
  // Preserve every remaining authored row, including over-cap legacy arrays and footer overrides.
  let index = 0;
  commit(klass, klass.battleCommands.filter((row) => row.id === "cmd_change" || index++ !== occurrence.index).map((row) => ({ ...row })), "직업 메뉴에서 명령 제거", rerender, "db-command-class-select");
}

function draggable(node: HTMLElement, source: Drag["source"], id: string, occurrence?: RowOccurrence): void {
  node.setAttribute("draggable", "true");
  node.addEventListener("dragstart", (event) => {
    drag = undefined;
    const klass = occurrence ? occurrenceClass(occurrence) : selectedClass();
    if (!klass || !event.dataTransfer) { event.preventDefault(); return; }
    drag = { source, id, occurrence, classId: klass.id, menu: JSON.stringify(klass.battleCommands), catalog: JSON.stringify(store.getCurrent().database.battleCommands), token: String(++sequence) };
    event.dataTransfer.setData(MIME, drag.token);
    event.dataTransfer.effectAllowed = source === "catalog" ? "copy" : "move";
    node.classList.add("is-dragging");
  });
  node.addEventListener("dragend", () => {
    drag = undefined;
    node.classList.remove("is-dragging");
    document.querySelectorAll(".db-command-slot.is-target").forEach((slot) => slot.classList.remove("is-target"));
  });
}
export function attachCatalogPlacement(card: HTMLElement, command: DatabaseBattleCommandRecord, rerender: () => void): void {
  const klass = selectedClass() ?? store.getCurrent().database.classes[0];
  const reason = !klass ? "직업 없음" : command.id === "cmd_change" ? "마지막 교체는 고정" : klass.battleCommands.some((row) => row.id === command.id) ? "이미 배치됨" : editable(klass).length >= 6 ? "6개 모두 사용 중" : "";
  draggable(card, "catalog", command.id);
  card.append(listToolbar([{ label: reason || "메뉴에 추가", ariaLabel: `${command.name} 메뉴에 추가${reason ? `: ${reason}` : ""}`, disabled: Boolean(reason), testid: `db-command-place-${command.id}`, onClick: () => { const current = selectedClass(); place(command.id, current ? editable(current).length : 0, rerender); } }]));
}
function slot(index: number, rerender: () => void): HTMLElement {
  // 끌어 놓을 자리는 얇은 선이다 — 행마다 「N번 위치에 놓기」 글자가 반복돼 메뉴가 흐려졌다(qa1124 항목 7). 이름은 읽기 도구용으로 남긴다.
  const node = el("div", { class: "db-command-slot", attrs: { "aria-label": `${index + 1}번 위치에 놓기` }, dataset: { testid: `db-command-slot-${index}` } });
  node.addEventListener("dragover", (event) => {
    if (!drag) return;
    event.preventDefault();
    node.classList.add("is-target");
  });
  node.addEventListener("dragleave", () => node.classList.remove("is-target"));
  node.addEventListener("drop", (event) => {
    event.preventDefault();
    node.classList.remove("is-target");
    const active = drag;
    drag = undefined;
    const klass = selectedClass();
    if (!active || !klass || event.dataTransfer?.getData(MIME) !== active.token || active.classId !== klass.id || active.menu !== JSON.stringify(klass.battleCommands) || active.catalog !== JSON.stringify(store.getCurrent().database.battleCommands)) {
      announce("배치하지 않았습니다. 데이터가 바뀌었거나 올바른 명령 드래그가 아닙니다. 다시 끌어 주세요.");
      return;
    }
    if (active.source === "catalog") place(active.id, index, rerender);
    else if (active.occurrence) {
      const from = active.occurrence.index;
      move(active.occurrence, index > from ? index - 1 : index, rerender);
    }
  });
  return node;
}
function menuRow(row: ClassBattleCommand, index: number, klass: ClassRecord, rerender: () => void): HTMLElement {
  const rows = editable(klass);
  const occurrence: RowOccurrence = { classId: klass.id, menu: JSON.stringify(klass.battleCommands), index };
  const node = el("article", { class: "db-command-menu-row", dataset: { testid: "db-command-menu-row", commandId: row.id }, children: [
    el("strong", { text: `${index + 1}. ${battleCommandDisplayName(row, resolveTerms(store.getCurrent()))}` }),
    listToolbar([
      { label: "위", ariaLabel: `${row.name} 위로`, disabled: index === 0, testid: rowTestId("up", rows, index), onClick: () => move(occurrence, index - 1, rerender) },
      { label: "아래", ariaLabel: `${row.name} 아래로`, disabled: index === rows.length - 1, testid: rowTestId("down", rows, index), onClick: () => move(occurrence, index + 1, rerender) },
      { label: "제거", ariaLabel: `${row.name} 메뉴에서 제거`, kind: "danger", testid: rowTestId("remove", rows, index), onClick: () => remove(occurrence, rerender) },
    ]),
  ] });
  draggable(node, "menu", row.id, occurrence);
  return node;
}

/**
 * 명령의 표시 이름 — 카탈로그·직업 메뉴·미리보기가 같은 이름을 쓴다(전투의 명령 창과 같은 battleCommandKindLabel).
 * 예전에는 같은 명령이 카탈로그에서 「스킬」, 직업 메뉴에서 「기술」로 달리 보였다(qa1124 항목 7).
 */
export function battleCommandDisplayName(row: Pick<ClassBattleCommand, "id" | "name" | "kind">, terms: ReturnType<typeof resolveTerms>): string {
  const kind = row.kind === "guard" ? "defend" : row.kind === "skillSubset" ? "skill" : row.kind === "event" ? "commonEvent" : row.kind;
  return battleCommandKindLabel({ id: row.id, name: row.name || row.id, kind }, terms);
}

/** Uses the runtime resolver even for a class with no assigned actor; the virtual actor never enters the store. */
export function resolvedStudioCommands(project: Project, classId: string, switchAvailable: boolean) {
  const actor = project.database.actors[0];
  const previewProject = actor ? project : { ...project, database: { ...project.database, actors: [createActorRecord("studio_preview", classId)] } };
  return battleCommandsForActor(previewProject, actor?.id ?? "studio_preview", { classId, includeSwitch: switchAvailable });
}
function preview(klass: ClassRecord, rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  const terms = resolveTerms(project);
  const toggle = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "db-command-preview-switch" } });
  toggle.checked = includeSwitch;
  toggle.addEventListener("change", () => { includeSwitch = toggle.checked; refresh(rerender, "db-command-preview-switch"); });
  // 전투에서 쓰는 명령 창(battleCommandDom 의 같은 패널·버튼)을 이 직업의 실제 명령 목록으로 그린다(qa1124 항목 7).
  const commands = resolvedStudioCommands(project, klass.id, includeSwitch);
  return sectionCard({ title: "전투에서 보이는 메뉴", hint: `${klass.name} · 미리보기 전용`, testid: "db-battle-command-preview", children: [
    battleScenePreviewFrame(project, { command: battleCommandMenuPreview(commands, terms) }, "db-command-menu-preview"),
    el("label", { children: [toggle, el("span", { text: "교체할 동료가 있을 때" })] }),
    el("p", { class: "db-ws-usage", text: "포획은 몬스터 수집 설정, 교체는 전투 상황에 따라 나타납니다." }),
  ] });
}
export function battleCommandPlacement(palette: HTMLElement, rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  // Only a newly rendered view may select a replacement for a deleted class.
  const klass = selectedClass() ?? project.database.classes[0];
  selectedClassId = klass?.id ?? "";
  const select = el("select", { dataset: { testid: "db-command-class-select" }, attrs: { "aria-label": "메뉴를 편집할 직업" }, children: project.database.classes.map((row) => el("option", { value: row.id, text: row.name })) });
  select.value = selectedClassId;
  select.addEventListener("change", () => { selectedClassId = select.value; status = "선택한 직업의 메뉴를 표시합니다."; refresh(rerender, "db-command-class-select"); });
  const rows = klass ? editable(klass) : [];
  const board = sectionCard({ title: "직업의 전투 메뉴", hint: `${rows.length} / 6개 · 이 순서가 선택한 직업에 저장됩니다`, testid: "db-command-menu-board", children: [
    el("label", { class: "db-field", children: [el("span", { text: "직업" }), select] }),
    // 결과(전투에서 보이는 메뉴)를 먼저 보이고 그 아래에서 순서를 바꾼다(qa1124 항목 7: 「어떻게 쓰라는 건지 감이 안 잡힘」).
    ...(klass ? [preview(klass, rerender)] : []),
    ...(!klass ? [el("p", { text: "직업 탭에서 직업을 먼저 만드세요." })] : [
      ...(rows.length === 0 ? [el("p", { class: "db-ws-usage", text: "아직 배치한 명령이 없습니다. 아래 미리보기는 기본 행동입니다." })] : []),
      ...rows.flatMap((row, index) => [slot(index, rerender), menuRow(row, index, klass, rerender)]), slot(rows.length, rerender),
      el("p", { class: "db-command-fixed", text: "교체 · 마지막 고정 — 직업 편집 규칙이며 6개 제한에 포함되지 않습니다." }),
      ...(rows.length >= 6 ? [el("p", { class: "db-ws-usage", text: "6개를 모두 사용했습니다. 새 명령을 넣으려면 하나를 제거하세요." })] : []),
    ]),
    listToolbar([{ label: "되돌리기", disabled: !pendingHistoryLabels().undo, testid: "db-command-undo", onClick: () => { if (undoMapEdit()) { status = "편집을 되돌렸습니다."; refresh(rerender, pendingHistoryLabels().undo ? "db-command-undo" : "db-command-class-select"); } } }]),
    el("p", { class: "db-ws-usage", text: status, attrs: { role: "status", "aria-live": "polite" }, dataset: { testid: "db-command-status" } }),
  ] });
  const labels = klass ? resolvedStudioCommands(project, klass.id, includeSwitch).map((row) => battleCommandKindLabel(row, resolveTerms(project))) : [];
  return el("div", { class: "db-command-placement", children: [palette, board, battleCommandCssEditor(labels, rerender)] });
}
