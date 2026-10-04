import { listAudioResources, type AudioResource } from "@/assets/audioResourceCatalog";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import {
  getAudioDescriptionOverride, resetAudioDescriptionOverride, setAudioDescriptionOverride,
} from "@/project/audioDescriptions";
import { ProjectFormatError } from "@/project/io";
import { store } from "@/project/store";
import type { AudioResourceKind, ResourceKind, UploadedAsset } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { createAudioDescriptionDetail, type AudioDescriptionDetail } from "./audioDescriptionDetail";
import { createVirtualList, type VirtualList } from "./databaseListVirtualizer";
import { openAudioDescriptionDirtyDialog } from "./audioDescriptionDirtyDialog";

/** Ephemeral manager-owned draft. Authored data remains exclusively in Project. */
export class AudioDescriptionEditor {
  kind: ResourceKind = "backdrop";
  private selected: AudioResource | undefined;
  private selectedId: string | undefined;
  private detail: AudioDescriptionDetail | undefined;
  private clean = "";
  private disposed = false;
  private closePrompt: (() => void) | undefined;
  private readonly rows = el("div", { class: "rm-audio-rows" });
  private readonly notice = el("div", { class: "rm-audio-meta", attrs: { role: "status" } });
  private readonly search = el("input", {
    class: "rm-audio-search",
    attrs: { type: "search", "aria-label": "음원 검색", placeholder: "이름·설명 검색" },
    dataset: { testid: "audio-description-search" },
  });
  private readonly missing = el("input", {
    attrs: { type: "checkbox" }, dataset: { testid: "audio-description-missing-filter" },
  });
  private readonly entries = el("div", {
    class: "rm-entry-list", dataset: { testid: "resource-entry-list" },
  });

  private readonly virtualRows: VirtualList<AudioResource>;
  private visibleRows: readonly AudioResource[] = [];
  private appliedRows: readonly AudioResource[] | undefined;
  private rowUpdate = 0;
  private readonly empty = el("div", { class: "rm-entry-empty", text: "해당 음원이 없습니다." });
  private readonly resize: ResizeObserver | undefined;

  constructor(private readonly refresh: () => void) {
    this.entries.append(
      this.search,
      el("label", { class: "rm-audio-filter", children: [this.missing, "설명 없음만"] }),
      this.notice, this.rows,
    );
    Object.assign(this.entries.style, { display: "flex", flexDirection: "column", minHeight: "0", overflow: "hidden" });
    Object.assign(this.rows.style, { display: "block", overflowY: "auto", flex: "1 1 auto", minHeight: "0" });
    this.virtualRows = createVirtualList({ container: this.rows, items: [] as AudioResource[], rowHeight: 32, overscan: 6,
      renderRow: item => this.renderRow(item) });
    // A zero-height/detached initial host must not trigger the virtualizer's
    // full-list fallback. Feed a bounded slice until the real viewport exists.
    this.resize = typeof ResizeObserver === "function" ? new ResizeObserver(() => this.applyRows()) : undefined;
    this.resize?.observe(this.rows);
    const filter = () => { this.rows.scrollTop = 0; refresh(); };
    this.missing.addEventListener("change", filter);
    this.search.addEventListener("input", filter);
  }

  private dirty(): boolean {
    return this.detail !== undefined && this.detail.input.value !== this.clean;
  }

  request(action: () => void): void {
    if (this.disposed || this.closePrompt) return;
    if (!this.dirty()) {
      action();
      return;
    }
    this.closePrompt = openAudioDescriptionDirtyDialog(decision => {
      this.closePrompt = undefined;
      if (this.disposed) return;
      switch (decision) {
        case "save":
          if (this.commit(false)) action();
          return;
        case "discard":
          if (this.detail) this.detail.input.value = this.clean;
          action();
          return;
        case "cancel":
          this.detail?.input.focus();
          return;
        default: {
          const unreachable: never = decision;
          throw new Error(String(unreachable));
        }
      }
    });
  }

  selectKind(kind: ResourceKind): void {
    if (kind === this.kind) return;
    this.request(() => {
      this.releaseDetail();
      this.kind = kind;
      this.selectedId = undefined;
      this.refresh();
    });
  }

  imported(asset: UploadedAsset): void {
    if (this.disposed) return;
    if (asset.kind !== "music" && asset.kind !== "sound") {
      this.refresh();
      return;
    }
    const kind = asset.kind;
    this.request(() => {
      this.releaseDetail();
      this.kind = kind;
      this.selectedId = asset.id;
      this.missing.checked = false;
      this.refresh();
      this.detail?.input.focus();
    });
  }

  render(kind: AudioResourceKind, actions: {
    readonly import: () => void;
    readonly delete: (asset: UploadedAsset) => void;
  }): { readonly entries: HTMLElement; readonly commands: HTMLElement } {
    const resources = listAudioResources(kind, store.getCurrent());
    const current = resources.find(item => item.id === this.selectedId) ?? resources[0];
    if (current?.id !== this.selected?.id || current?.kind !== this.selected?.kind) this.releaseDetail();
    this.selected = current;
    this.selectedId = current?.id;
    if (current && !this.detail) {
      this.detail = createAudioDescriptionDetail(current, {
        import: actions.import,
        save: () => { this.commit(false); },
        reset: () => this.request(() => { this.commit(true); }),
        delete: () => this.request(() => {
          const id = this.selected?.id;
          const asset = id ? store.getCurrent().assets.uploaded[id] : undefined;
          if (asset) actions.delete(asset);
        }),
      });
      this.clean = current.description;
      this.detail.input.value = this.clean;
      this.detail.input.addEventListener("input", () => {
        if (this.detail) this.detail.status.textContent = this.dirty() ? "저장 전 변경 있음" : "";
      });
    } else if (current && this.detail) {
      if (!this.dirty()) {
        this.clean = current.description;
        this.detail.input.value = this.clean;
      }
      this.detail.update(current);
    }
    const query = this.search.value.trim().toLowerCase();
    const visible = resources.filter(item =>
      (!this.missing.checked || item.description.trim().length === 0)
      && (!query || [item.id, item.name, item.description, ...item.tags]
        .some(value => value.toLowerCase().includes(query))));
    this.notice.textContent = current && !visible.some(item => item.id === current.id)
      ? "선택한 음원은 필터 결과 밖에 있습니다."
      : `${visible.length}개`;
    this.visibleRows = visible;
    const update = ++this.rowUpdate;
    this.applyRows();
    if (!this.rows.isConnected) queueMicrotask(() => { if (!this.disposed && update === this.rowUpdate) this.applyRows(); });
    this.patchSelection();
    return {
      entries: this.entries,
      commands: this.detail?.element ?? el("aside", { class: "rm-command-panel", text: "음원을 선택하세요." }),
    };
  }

  private renderRow(item: AudioResource): HTMLElement {
    const row = el("button", {
      class: `rm-profile-row rm-audio-row${item.id === this.selectedId ? " active" : ""}`, text: item.name,
      attrs: { type: "button", "aria-pressed": String(item.id === this.selectedId), title: item.name },
      dataset: { testid: "audio-resource-row", resourceId: item.id, resourceKind: item.kind, descriptionSource: item.descriptionSource },
      on: { click: () => {
        if (item.id === this.selectedId) return;
        this.request(() => { this.releaseDetail(); this.selectedId = item.id; this.refresh(); this.detail?.input.focus(); });
      } },
    });
    Object.assign(row.style, { height: "32px", minHeight: "32px", boxSizing: "border-box", width: "100%", margin: "0" });
    return row;
  }

  private applyRows(): void {
    if (this.disposed) return;
    const next = this.rows.clientHeight > 0 ? this.visibleRows : this.visibleRows.slice(0, 80);
    const old = this.appliedRows;
    if (!old || old.length !== next.length || next.some((item, i) => item.id !== old[i]?.id
      || item.kind !== old[i]?.kind || item.name !== old[i]?.name || item.descriptionSource !== old[i]?.descriptionSource)) {
      this.virtualRows.setItems(next);
      this.appliedRows = next;
    } else this.virtualRows.render();
    if (!this.visibleRows.length) this.rows.append(this.empty);
    else this.empty.remove();
    this.patchSelection();
  }

  private patchSelection(): void {
    for (const row of this.rows.querySelectorAll<HTMLElement>('[data-testid="audio-resource-row"]')) {
      const active = row.dataset.resourceId === this.selectedId;
      row.classList.toggle("active", active); row.setAttribute("aria-pressed", String(active));
    }
  }

  private commit(reset: boolean): boolean {
    const resource = this.selected;
    const detail = this.detail;
    if (!resource || !detail || this.disposed) return false;
    const project = store.getCurrent();
    if (!listAudioResources(resource.kind, project).some(item => item.id === resource.id)) {
      toast("선택한 음원이 더 이상 존재하지 않습니다.", "error");
      return false;
    }
    const ref = { kind: resource.kind, resourceId: resource.id };
    try {
      const next = reset
        ? resetAudioDescriptionOverride(project.audioDescriptions, ref)
        : setAudioDescriptionOverride(project.audioDescriptions, ref, detail.input.value);
      const changed = getAudioDescriptionOverride(project.audioDescriptions, ref)
        !== getAudioDescriptionOverride(next, ref);
      // Make the store subscriber's synchronous refresh adopt the committed value.
      this.clean = detail.input.value;
      if (changed) {
        const label = reset ? "음원 기본 설명 복원" : "음원 설명 저장";
        recordProjectSnapshot(label);
        store.update(draft => {
          if (next === undefined) delete draft.audioDescriptions;
          else draft.audioDescriptions = next;
        }, { scope: "project", origin: "human", label });
      }
      this.refresh();
      if (this.detail) this.detail.status.textContent = "프로젝트에 반영됨";
      return true;
    } catch (error) {
      if (!(error instanceof ProjectFormatError)) throw error;
      detail.status.textContent = error.message;
      toast(error.message, "error");
      return false;
    }
  }

  private releaseDetail(): void {
    this.detail?.dispose();
    this.detail = undefined;
    this.selected = undefined;
  }

  dispose(): void {
    this.disposed = true;
    ++this.rowUpdate;
    this.resize?.disconnect();
    this.virtualRows.setItems([]);
    this.closePrompt?.();
    this.closePrompt = undefined;
    this.releaseDetail();
  }
}
