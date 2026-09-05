import { battleCommandKindLabel } from "@/player/battleCommandDom";
import { resolveTerms } from "@/project/terms";
import { createActorRecord } from "@/project/actorModel";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { insertCatalogClassCommand, reorderEditableClassCommand } from "@/editor/databaseClassCommandOrder";
import { recordProjectSnapshot, undoMapEdit, pendingHistoryLabels } from "@/editor/mapEditHistory";
import { listToolbar, sectionCard, restoreFocusAfterRerender } from "./databaseWorkspace";
import { store } from "@/project/store";
import type { ClassBattleCommand, ClassRecord, DatabaseBattleCommandRecord, Project } from "@/project/types";
import { el } from "@/util/dom";

let selectedClassId = "";
let includeSwitch = false;
let status = "명령을 빈 위치로 끌거나 메뉴에 추가를 누르세요.";
const MIME = "application/x-rpg-zzu-battle-command";
type Drag = { readonly source: "catalog" | "menu"; readonly id: string; readonly classId: string; readonly menu: string; readonly catalog: string; readonly token: string };
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
function move(id: string, index: number, rerender: () => void): void {
  const klass = selectedClass(rerender);
  if (!klass) return;
  const result = reorderEditableClassCommand(klass.battleCommands, id, index);
  if (!result.ok) return announce("순서를 바꾸지 않았습니다. 현재 위치와 6개 제한을 확인하세요.");
  commit(klass, result.commands, "직업 메뉴 순서 변경", rerender, `db-command-remove-${id}`);
}
function remove(id: string, rerender: () => void): void {
  const klass = selectedClass(rerender);
  if (!klass || id === "cmd_change" || !klass.battleCommands.some((row) => row.id === id)) return;
  // Preserve every remaining authored row, including over-cap legacy arrays and footer overrides.
  commit(klass, klass.battleCommands.filter((row) => row.id !== id).map((row) => ({ ...row })), "직업 메뉴에서 명령 제거", rerender, "db-command-class-select");
}

function draggable(node: HTMLElement, source: Drag["source"], id: string): void {
  node.setAttribute("draggable", "true");
  node.addEventListener("dragstart", (event) => {
    const klass = selectedClass();
    if (!klass || !event.dataTransfer) { event.preventDefault(); return; }
    drag = { source, id, classId: klass.id, menu: JSON.stringify(klass.battleCommands), catalog: JSON.stringify(store.getCurrent().database.battleCommands), token: String(++sequence) };
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
  const node = el("div", { class: "db-command-slot", text: `${index + 1}번 위치에 놓기`, dataset: { testid: `db-command-slot-${index}` } });
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
    else {
      const from = editable(klass).findIndex((row) => row.id === active.id);
      move(active.id, index > from ? index - 1 : index, rerender);
    }
  });
  return node;
}
function menuRow(row: ClassBattleCommand, index: number, count: number, rerender: () => void): HTMLElement {
  const node = el("article", { class: "db-command-menu-row", dataset: { testid: "db-command-menu-row", commandId: row.id }, children: [
    el("span", { class: "db-command-drag-label", text: "끌기", attrs: { "aria-hidden": "true" } }),
    el("strong", { text: `${index + 1}. ${row.name || row.id}` }),
    listToolbar([
      { label: "위", ariaLabel: `${row.name} 위로`, disabled: index === 0, testid: `db-command-up-${row.id}`, onClick: () => move(row.id, index - 1, rerender) },
      { label: "아래", ariaLabel: `${row.name} 아래로`, disabled: index === count - 1, testid: `db-command-down-${row.id}`, onClick: () => move(row.id, index + 1, rerender) },
      { label: "제거", ariaLabel: `${row.name} 메뉴에서 제거`, kind: "danger", testid: `db-command-remove-${row.id}`, onClick: () => remove(row.id, rerender) },
    ]),
  ] });
  draggable(node, "menu", row.id);
  return node;
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
  return sectionCard({ title: "실제 메뉴 해석", hint: "미리보기 전용 · 여기서 전투를 실행하지 않습니다", testid: "db-battle-command-preview", children: [
    el("label", { children: [toggle, el("span", { text: "교체 가능한 동료가 있는 상황" })] }),
    el("ol", { class: "db-command-runtime-list", children: resolvedStudioCommands(project, klass.id, includeSwitch).map((row) => el("li", { text: battleCommandKindLabel(row, terms), dataset: { commandId: row.id, kind: row.kind } })) }),
    el("p", { class: "db-ws-usage", text: "빈 메뉴는 기본 행동으로 대체됩니다. 포획은 몬스터 수집 설정에 따라 추가·제외됩니다. 교체는 전투 상황에 따라 숨겨집니다. 포켓몬 화면의 보유 몬스터는 직업 메뉴 대신 고정 4개 메뉴를 사용합니다. 강제 교체 때는 교체만 표시되며 전투 이벤트의 메뉴 덮어쓰기는 여기 반영하지 않습니다." }),
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
    ...(!klass ? [el("p", { text: "직업 탭에서 직업을 먼저 만드세요." })] : [
      ...(rows.length === 0 ? [el("p", { class: "db-ws-usage", text: "아직 배치한 명령이 없습니다. 아래 미리보기는 기본 행동입니다." })] : []),
      ...rows.flatMap((row, index) => [slot(index, rerender), menuRow(row, index, rows.length, rerender)]), slot(rows.length, rerender),
      el("p", { class: "db-command-fixed", text: "교체 · 마지막 고정 — 직업 편집 규칙이며 6개 제한에 포함되지 않습니다." }),
      ...(rows.length >= 6 ? [el("p", { class: "db-ws-usage", text: "6개를 모두 사용했습니다. 새 명령을 넣으려면 하나를 제거하세요." })] : []),
    ]),
    listToolbar([{ label: "되돌리기", disabled: !pendingHistoryLabels().undo, testid: "db-command-undo", onClick: () => { if (undoMapEdit()) { status = "편집을 되돌렸습니다."; refresh(rerender, pendingHistoryLabels().undo ? "db-command-undo" : "db-command-class-select"); } } }]),
    el("p", { class: "db-ws-usage", text: status, attrs: { role: "status", "aria-live": "polite" }, dataset: { testid: "db-command-status" } }),
    ...(klass ? [preview(klass, rerender)] : []),
  ] });
  return el("div", { class: "db-command-placement", children: [palette, board] });
}
