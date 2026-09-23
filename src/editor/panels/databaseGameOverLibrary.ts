import { store } from "@/project/store";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { field } from "@/editor/panels/databaseControls";
import { cinematicButton as button, cinematicNote as note } from "@/editor/panels/databaseCinematicControls";
import { readGameOverSettings, type CinematicTarget } from "@/editor/panels/databaseCinematicActionModel";
import { GAME_OVER_DEFINITION_LIMIT, type GameOverSettings } from "@/project/cinematicSettings";
import { gameOverReferenceCounts } from "@/project/gameOverLibrary";
import type { Project } from "@/project/types";
import { genId } from "@/util/id";
import { el } from "@/util/dom";

export function renderDatabaseGameOverLibrary(host: HTMLElement, isActive: () => boolean,
  renderDetail: (host: HTMLElement, target: CinematicTarget, active: () => boolean) => () => void) {
  const root = el("div", { class: "db-game-over-library", dataset: { testid: "db-game-over-library" } });
  const toolbar = el("div", { class: "db-game-over-library-controls" });
  const detail = el("div", { class: "db-game-over-library-detail" });
  root.append(toolbar, detail); host.append(root);
  let selected = store.getCurrent().system.defaultGameOverId ?? "", disposed = false, writing = false, revision = 0;
  let cleanDetail = (): void => undefined;
  const active = (): boolean => !disposed && root.isConnected && isActive();
  const signature = (): string => JSON.stringify([store.getCurrent().system.defaultGameOverId,
    store.getCurrent().system.gameOvers?.map(row => [row.id, row.name])]);
  let lastSignature = signature();
  const target = (): CinematicTarget => selected ? { gameOverId: selected } : "gameOver";
  const commit = (label: string, mutate: (project: Project) => void): void => {
    if (!active()) return;
    writing = true;
    try { recordProjectSnapshot(label, null); store.update(mutate, { scope: "system", label }); }
    finally { writing = false; }
    draw();
  };
  const add = (settings: GameOverSettings, name: string): void => {
    if ((store.getCurrent().system.gameOvers?.length ?? 0) >= GAME_OVER_DEFINITION_LIMIT) return;
    const id = genId("game-over");
    commit("게임 오버 추가", project => { (project.system.gameOvers ??= []).push({ id, name, settings: structuredClone(settings) }); selected = id; });
  };
  function draw(): void {
    if (disposed) return;
    cleanDetail(); detail.replaceChildren(); revision += 1;
    const ownRevision = revision, usable = (): boolean => active() && ownRevision === revision;
    const project = store.getCurrent(), rows = project.system.gameOvers ?? [];
    if (selected && !rows.some(row => row.id === selected)) selected = "";
    const select = el("select", { dataset: { testid: "db-game-over-select" } });
    const options: [string, string][] = [["", "공통 게임 오버"], ...rows.map(row => [row.id, row.name] as [string, string])];
    for (const [value, text] of options) select.append(el("option", { attrs: { value }, text }));
    select.value = selected;
    select.addEventListener("change", () => { if (usable()) { selected = select.value; draw(); } });
    const name = el("input", { attrs: { type: "text", "aria-label": "게임 오버 이름" }, dataset: { testid: "db-game-over-name" } });
    name.value = rows.find(row => row.id === selected)?.name ?? "공통 게임 오버"; name.disabled = !selected;
    name.addEventListener("change", () => {
      if (!usable() || !name.value.trim()) { name.value = rows.find(row => row.id === selected)?.name ?? ""; return; }
      const id = selected;
      commit("게임 오버 이름 변경", draft => { const row = draft.system.gameOvers?.find(row => row.id === id); if (row) row.name = name.value.trim(); });
    });
    const defaultSelect = el("select", { dataset: { testid: "db-game-over-default" } });
    for (const [value, text] of options) defaultSelect.append(el("option", { attrs: { value }, text }));
    defaultSelect.value = project.system.defaultGameOverId ?? "";
    defaultSelect.addEventListener("change", () => { if (usable()) commit("기본 게임 오버 선택", draft => {
      if (defaultSelect.value) draft.system.defaultGameOverId = defaultSelect.value; else delete draft.system.defaultGameOverId;
    }); });
    const template = el("select", { attrs: { "aria-label": "새 게임 오버 시작점" }, dataset: { testid: "db-game-over-template" } });
    for (const [value, text] of [["classic", "클래식 · 선택 메뉴"], ["horror", "공포 · 정적과 재시도"], ["blackout", "암전 · 회복 귀환"]]) template.append(el("option", { attrs: { value }, text }));
    const create = button("game-over-add", "새 게임 오버", () => { if (usable()) add({ presentation: template.value as "classic" | "horror" | "blackout", outcome: template.value === "blackout" ? "recover" : "menu" }, "새 게임 오버"); });
    const duplicate = button("game-over-duplicate", "복제", () => { if (usable()) add(readGameOverSettings(store.getCurrent(), target()) ?? {}, `${name.value} 사본`); });
    create.disabled = duplicate.disabled = rows.length >= GAME_OVER_DEFINITION_LIMIT;
    const usage = selected ? gameOverReferenceCounts(project).get(selected) ?? 0 : 0;
    const remove = button("game-over-delete", "삭제", () => {
      if (!usable() || !selected) return;
      const id = selected;
      if (gameOverReferenceCounts(store.getCurrent()).has(id) || store.getCurrent().system.defaultGameOverId === id) return;
      commit("게임 오버 삭제", draft => { draft.system.gameOvers = draft.system.gameOvers?.filter(row => row.id !== id); selected = ""; });
    });
    remove.disabled = !selected || usage > 0 || project.system.defaultGameOverId === selected;
    const actions = el("div", { class: "db-game-over-library-actions", children: [template, create, duplicate, remove] });
    toolbar.replaceChildren(field("편집할 게임 오버", select), field("이름", name), field("전투 전멸 등 기본 호출", defaultSelect), actions,
      note(usage ? `${usage}개 명령에서 사용 중입니다. 연결을 바꾼 뒤 삭제할 수 있습니다.` : "이벤트의 ‘게임 오버’ 또는 ‘주인공 사망’ 명령에서 항목을 선택하세요. 조건 분기로 서로 다른 게임 오버를 실행할 수 있습니다."));
    lastSignature = signature();
    cleanDetail = renderDetail(detail, target(), active);
  }
  const unsubscribe = store.subscribe((_project, change) => {
    if (!disposed && !writing && (signature() !== lastSignature || change.scope === "project" || change.projectSwitch)) draw();
  });
  draw();
  return { root, dispose(): void { if (disposed) return; disposed = true; cleanDetail(); unsubscribe(); root.remove(); } };
}
