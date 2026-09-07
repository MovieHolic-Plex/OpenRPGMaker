import { getMonsterResource, listMonsterResources } from "@/assets/monsterResourceCatalog";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { field } from "@/editor/panels/databaseControls";
import { applyRovingTabindex } from "@/editor/panels/sidebarFocus";
import { detailPane, listPane, listRow, sectionCard, workspaceShell } from "@/editor/panels/databaseWorkspace";
import { MONSTER_METADATA_SOURCE_LABELS, monsterResourcePreview, monsterResourceStatus, type MonsterResource } from "./monsterResourcePresentation";
import { showConfirm } from "@/editor/ui/modal";
import { isTopModal, registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { resetMonsterMetadataOverride, setMonsterMetadataOverride } from "@/project/monsterMetadata";
import { ProjectFormatError } from "@/project/io";
import { store } from "@/project/store";
import { el } from "@/util/dom";

export function openMonsterResourceEditor(): void {
  new MonsterResourceEditor().open();
}

/** One modal owns its draft and subscription; a project switch permanently revokes writes. */
class MonsterResourceEditor {
  private readonly opener = document.activeElement;
  private readonly overlay = el("div", { class: "db-enemy-dialog-backdrop database-modal-backdrop", dataset: { testid: "db-monster-resources" } });
  private readonly search = el("input", { attrs: { type: "search", "aria-label": "몬스터 소재 검색", placeholder: "이름·ID·태그·설명 검색" }, dataset: { testid: "db-monster-resource-search" } });
  private readonly name = el("input", { attrs: { type: "text", maxlength: "120" }, dataset: { testid: "db-monster-resource-name" } });
  private readonly tags = el("textarea", { attrs: { rows: "2" }, dataset: { testid: "db-monster-resource-tags" } });
  private readonly description = el("textarea", { attrs: { rows: "5", maxlength: "4000" }, dataset: { testid: "db-monster-resource-description" } });
  private readonly status = el("p", { attrs: { id: "db-monster-resource-status", role: "status", "aria-live": "polite" }, dataset: { testid: "db-monster-resource-status" } });
  private readonly identity = el("div", { class: "db-monster-resource-identity" });
  private readonly rows: HTMLElement;
  private readonly count: HTMLElement;
  private readonly apply = el("button", { class: "btn primary", text: "적용", attrs: { type: "button" }, dataset: { testid: "db-monster-resource-apply" } });
  private readonly reset = el("button", { class: "btn", text: "기본값 복원", attrs: { type: "button" }, dataset: { testid: "db-monster-resource-reset" } });
  private selected: MonsterResource | undefined;
  private clean = "";
  private active = true;
  private disposed = false;
  private prompting = false;
  private unsubscribe: () => void = () => undefined;
  private readonly unload = (event: BeforeUnloadEvent): void => {
    if (this.dirty()) { event.preventDefault(); event.returnValue = ""; }
  };

  constructor() {
    const list = listPane({ title: "몬스터 소재", count: 0, search: el("div", { class: "db-ws-search", children: [this.search] }), rows: [] });
    const rows = list.querySelector<HTMLElement>(".db-ws-list");
    const count = list.querySelector<HTMLElement>(".db-ws-count");
    if (!rows || !count) throw new Error("Database list primitive is missing its slots");
    this.rows = rows; this.count = count;
    this.rows.dataset.roving = "true";
    this.rows.setAttribute("role", "group");
    this.rows.setAttribute("aria-label", "몬스터 소재 목록 · 방향키로 이동, Enter로 선택");
    for (const input of [this.name, this.tags, this.description]) input.setAttribute("aria-describedby", "db-monster-resource-status");
    const detail = detailPane({ body: [this.identity, sectionCard({ title: "소재 정보", children: [
      field("이름", this.name), field("태그 (한 줄에 하나)", this.tags), field("설명", this.description),
      el("div", { class: "db-monster-resource-actions", children: [this.apply, this.reset] }), this.status,
    ] })] });
    const close = el("button", { class: "btn", text: "닫기", attrs: { type: "button" }, dataset: { testid: "db-monster-resource-close" }, on: { click: () => { void this.request(() => this.dispose()); } } });
    const dialog = el("section", {
      class: "database-modal-window db-monster-resource-dialog", attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "db-monster-resource-title" },
      children: [el("header", { children: [el("h2", { text: "몬스터 소재", attrs: { id: "db-monster-resource-title" } }), close] }),
        el("div", { class: "database-modal-body", children: [workspaceShell({ list, detail })] })],
    });
    this.overlay.append(dialog);
    this.search.addEventListener("input", () => this.refreshList());
    for (const input of [this.name, this.tags, this.description]) input.addEventListener("input", () => {
      this.apply.disabled = !this.active || !this.dirty();
      this.status.textContent = this.active ? this.dirty() ? "적용 전 변경 있음" : "" : "프로젝트가 바뀌었습니다. 초안을 복사한 뒤 닫으세요.";
    });
    this.apply.addEventListener("click", () => this.commit(false));
    this.reset.addEventListener("click", () => { void this.request(() => this.commit(true)); });
    this.overlay.addEventListener("click", event => { if (event.target === this.overlay) void this.request(() => this.dispose()); });
    dialog.addEventListener("keydown", event => {
      if (event.key !== "Tab" || !isTopModal(this.overlay)) return;
      const stops = Array.from(dialog.querySelectorAll<HTMLElement>("button,input,textarea")).filter(node => node.tabIndex >= 0 && !node.hasAttribute("disabled"));
      const first = stops[0]; const last = stops[stops.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
  }

  open(): void {
    document.body.append(this.overlay);
    this.register();
    this.select(listMonsterResources(store.getCurrent())[0]);
    this.unsubscribe = store.subscribe((_project, change) => {
      if (change.projectSwitch) {
        this.active = false;
        this.apply.disabled = true; this.reset.disabled = true; this.search.disabled = true;
        for (const row of this.rows.querySelectorAll("button")) row.disabled = true;
        this.status.setAttribute("role", "alert");
        this.status.textContent = "프로젝트가 바뀌었습니다. 이 초안은 새 프로젝트에 적용되지 않습니다. 필요한 내용을 복사한 뒤 닫으세요.";
        return;
      }
      if (!this.active) return;
      if (!this.dirty()) this.select(this.selected ? getMonsterResource(store.getCurrent(), this.selected.resourceId) : listMonsterResources(store.getCurrent())[0]);
      else this.refreshList();
    });
    window.addEventListener("beforeunload", this.unload);
    this.search.focus();
  }

  private register(): void {
    unregisterModal(this.overlay);
    registerModal(this.overlay, () => {
      // modalStack removes Escape's layer before calling us; restore ownership while prompting.
      this.register();
      void this.request(() => this.dispose());
    });
  }

  private value(): string { return JSON.stringify([this.name.value, this.tags.value, this.description.value]); }
  private dirty(): boolean { return this.selected !== undefined && this.value() !== this.clean; }

  private async request(action: () => void): Promise<void> {
    if (this.disposed || this.prompting) return;
    if (!this.dirty()) { action(); return; }
    this.prompting = true;
    const allowed = await showConfirm({ title: "적용하지 않은 소재 정보", message: "작성 중인 변경을 버릴까요? 유지하려면 취소한 뒤 적용하세요.", confirmLabel: "변경 버리기", cancelLabel: "계속 편집", danger: true });
    this.prompting = false;
    if (this.disposed) return;
    if (allowed) action();
  }

  private select(resource: MonsterResource | undefined): void {
    this.selected = resource;
    this.name.value = resource?.name ?? "";
    this.tags.value = resource?.tags.join("\n") ?? "";
    this.description.value = resource?.description ?? "";
    this.clean = this.value();
    this.apply.disabled = true;
    this.reset.disabled = !resource || !store.getCurrent().monsterMetadata?.[resource.resourceId];
    for (const input of [this.name, this.tags, this.description]) input.disabled = !resource;
    this.status.setAttribute("role", "status");
    this.status.textContent = resource ? "게임 속 몬스터 이름·능력치는 바뀌지 않습니다." : "등록된 소재가 없습니다.";
    this.identity.replaceChildren();
    if (resource) this.identity.append(
      monsterResourcePreview(resource, store.getCurrent()),
      el("code", { text: resource.resourceId, dataset: { testid: "db-monster-resource-id" } }),
      el("p", { text: monsterResourceStatus(resource), dataset: { testid: "db-monster-resource-origin", origin: resource.origin, reviewStatus: resource.reviewStatus } }),
      el("p", { text: `이름: ${MONSTER_METADATA_SOURCE_LABELS[resource.sources.name]} · 태그: ${MONSTER_METADATA_SOURCE_LABELS[resource.sources.tags]} · 설명: ${MONSTER_METADATA_SOURCE_LABELS[resource.sources.description]}`, dataset: { testid: "db-monster-resource-sources", ...resource.sources } }),
    );
    this.refreshList();
  }

  private refreshList(): void {
    if (!this.active) return;
    const all = listMonsterResources(store.getCurrent());
    const query = this.search.value.trim().toLocaleLowerCase();
    const visible = all.filter(resource => [resource.resourceId, resource.name, resource.description, ...resource.tags].some(value => value.toLocaleLowerCase().includes(query)));
    this.count.textContent = `${visible.length}/${all.length}`;
    this.rows.classList.toggle("db-ws-list-empty", visible.length === 0);
    this.rows.replaceChildren(...visible.map(resource => listRow({
      name: resource.name, title: `${resource.name} (${resource.resourceId})`,
      thumb: monsterResourcePreview(resource, store.getCurrent()), active: resource.resourceId === this.selected?.resourceId,
      dataset: { resourceId: resource.resourceId }, testid: "db-monster-resource-row",
      onSelect: () => {
        if (resource.resourceId === this.selected?.resourceId) return;
        void this.request(() => { if (this.active) { this.select(getMonsterResource(store.getCurrent(), resource.resourceId)); this.name.focus(); } });
      },
    })));
    if (visible.length === 0) this.rows.append(el("p", { text: "검색 결과가 없습니다. 검색어를 지워 다시 찾아보세요." }));
    applyRovingTabindex(this.rows);
  }

  private commit(reset: boolean): void {
    if (!this.active || this.disposed || !this.selected) return;
    const project = store.getCurrent();
    const id = this.selected.resourceId;
    if (!getMonsterResource(project, id)) { this.status.textContent = "소재가 삭제되었습니다. 다른 소재를 선택하세요."; return; }
    try {
      const patch = {
        ...(this.name.value !== this.selected.name ? { name: this.name.value } : {}),
        ...(this.tags.value !== this.selected.tags.join("\n") ? { tags: this.tags.value.split("\n").filter(tag => tag.trim()) } : {}),
        ...(this.description.value !== this.selected.description ? { description: this.description.value } : {}),
      };
      const next = reset ? resetMonsterMetadataOverride(project.monsterMetadata, id) : setMonsterMetadataOverride(project.monsterMetadata, id, patch);
      if (JSON.stringify(next) !== JSON.stringify(project.monsterMetadata)) {
        const label = reset ? "몬스터 소재 기본값 복원" : "몬스터 소재 정보 적용";
        recordProjectSnapshot(label);
        store.update(draft => { if (next === undefined) delete draft.monsterMetadata; else draft.monsterMetadata = next; }, { scope: "assets", origin: "human", label });
      }
      this.select(getMonsterResource(store.getCurrent(), id));
      this.status.textContent = "프로젝트에 적용됨 · 실행 취소 가능";
    } catch (error) {
      if (!(error instanceof ProjectFormatError)) throw error;
      this.status.setAttribute("role", "alert");
      this.status.textContent = error.message;
    }
  }

  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.active = false;
    this.unsubscribe();
    window.removeEventListener("beforeunload", this.unload);
    unregisterModal(this.overlay); this.overlay.remove();
    if (this.opener instanceof HTMLElement && this.opener.isConnected) this.opener.focus();
    else document.querySelector<HTMLElement>('[data-testid="db-monster-resources-open"]')?.focus();
  }
}
