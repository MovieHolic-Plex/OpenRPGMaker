import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { listAppearanceUsages } from "@/project/characterAppearances";
import { store } from "@/project/store";
import type { CharacterAppearanceRecord } from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { field, textField } from "./databaseControls";
import { detailHero, detailPane, listPane, listRow, listToolbar, sectionCard, workspaceShell } from "./databaseWorkspace";
import { appearanceDialoguePreview, appearanceSlotCard, disposeAppearanceSlots } from "./databaseAppearanceSlots";

let selectedId: string | undefined;
let projectId: string | undefined;
let query = "";

export function selectCharacterAppearance(id: string): void {
  changeSelection(id);
  query = "";
  projectId = JSON.stringify(store.getProjectIdentity());
}

function changeSelection(id: string | undefined): void {
  if (id !== selectedId) disposeAppearanceSlots();
  selectedId = id;
}

export function updateAppearance(id: string, patch: Partial<CharacterAppearanceRecord>, coalesce = false): void {
  if (!store.getCurrent().database.characterAppearances?.some((record) => record.id === id)) return;
  if (coalesce) recordCoalescedSnapshot(`appearance:${id}:${Object.keys(patch).join(",")}`, "캐릭터 외형 편집");
  else recordProjectSnapshot("캐릭터 외형 편집");
  store.update((project) => {
    const record = project.database.characterAppearances?.find((entry) => entry.id === id);
    if (record) Object.assign(record, patch);
  }, { scope: "project", label: "캐릭터 외형 편집" });
}

export function renderCharacterAppearancesTab(host: HTMLElement): void {
  const identity = JSON.stringify(store.getProjectIdentity());
  if (projectId !== identity) {
    disposeAppearanceSlots();
    projectId = identity;
    selectedId = undefined;
    query = "";
  }
  const records = (): readonly CharacterAppearanceRecord[] => store.getCurrent().database.characterAppearances ?? [];
  if (!records().some((record) => record.id === selectedId)) changeSelection(records()[0]?.id);
  const detailHost = el("div", { class: "appearance-detail-host" });
  const search = el("input", {
    value: query,
    attrs: { type: "search", "aria-label": "캐릭터 외형 검색", placeholder: "이름·설명 검색" },
    dataset: { testid: "appearance-search" },
  });
  const list = listPane({
    title: "캐릭터 외형", count: records().length,
    search: el("div", { class: "db-ws-search", children: [search] }), rows: [],
    toolbar: listToolbar([{ label: "외형 추가", testid: "appearance-add", kind: "primary", onClick: () => {
      const record: CharacterAppearanceRecord = { id: genId("appearance"), name: "새 외형", description: "" };
      recordProjectSnapshot("캐릭터 외형 추가");
      store.update((draft) => { (draft.database.characterAppearances ??= []).push(record); }, { scope: "project", label: "캐릭터 외형 추가" });
      changeSelection(record.id);
      query = ""; search.value = "";
      refresh();
      detailHost.querySelector<HTMLInputElement>("[data-testid='appearance-name']")?.focus();
    } }]),
  });
  const rows = list.querySelector(".db-ws-list");
  const refreshList = (): void => {
    const needle = query.trim().toLocaleLowerCase();
    const visible = records().filter((record) => `${record.name} ${record.description} ${record.id}`.toLocaleLowerCase().includes(needle));
    rows?.classList.toggle("db-ws-list-empty", visible.length === 0);
    rows?.replaceChildren(...visible.map((record) => listRow({
      name: record.name, sub: record.charset ? "걷기 연결" : "부분 외형", active: record.id === selectedId,
      testid: `appearance-row-${record.id}`,
      onSelect: () => { changeSelection(record.id); refresh(); },
    })));
    if (!visible.length) rows?.append(el("p", { class: "appearance-help", text: needle ? "검색 결과가 없습니다. 검색어를 지워 다시 찾아보세요." : "외형을 추가하고 필요한 그림만 연결하세요." }));
    const count = list.querySelector("[data-testid='db-ws-count']");
    if (count) count.textContent = `${records().length}개`;
  };
  const refreshDetail = (): void => {
    const record = records().find((entry) => entry.id === selectedId);
    detailHost.replaceChildren();
    if (!record) {
      disposeAppearanceSlots();
      detailHost.append(detailPane({ body: el("p", { class: "appearance-help", text: "왼쪽에서 외형을 추가하세요. 걷기·얼굴·흉상은 모두 선택 사항입니다." }) }));
      return;
    }
    const usages = listAppearanceUsages(store.getCurrent(), record.id);
    const hero = detailHero({ title: record.name || "이름 없는 외형", subtitle: "공유 외형 · 연결된 주인공과 이벤트에 함께 반영됩니다." });
    const specimen = el("div");
    const refreshSpecimen = (): void => {
      const current = records().find((entry) => entry.id === record.id);
      if (current) specimen.replaceChildren(appearanceDialoguePreview(current));
    };
    const description = el("textarea", {
      value: record.description, attrs: { rows: "3", placeholder: "생김새·의상·색감 등 그림 제작에 필요한 설명" },
      dataset: { testid: "appearance-description" },
    });
    description.addEventListener("input", () => {
      updateAppearance(record.id, { description: description.value }, true);
      refreshList();
    });
    const metadata = sectionCard({ title: "외형 정보", children: [
      textField("이름", "appearance-name", record.name, (name) => {
        updateAppearance(record.id, { name }, true);
        const title = hero.querySelector(".db-ws-hero-title");
        if (title) title.textContent = name || "이름 없는 외형";
        refreshList(); refreshSpecimen();
      }),
      field("외형 설명", description),
    ] });
    const actions = listToolbar([
      { label: "복제", testid: "appearance-duplicate", onClick: () => {
        const source = records().find((entry) => entry.id === record.id);
        if (!source) return;
        const copy = { ...structuredClone(source), id: genId("appearance"), name: `${source.name} 복사` };
        recordProjectSnapshot("캐릭터 외형 복제");
        store.update((draft) => { (draft.database.characterAppearances ??= []).push(copy); }, { scope: "project", label: "캐릭터 외형 복제" });
        changeSelection(copy.id); query = ""; search.value = ""; refresh();
      } },
      { label: "삭제", testid: "appearance-delete", kind: "danger", disabled: usages.length > 0,
        title: usages.length ? "연결된 사용처를 먼저 해제하세요." : "외형 삭제",
        onClick: () => {
          if (listAppearanceUsages(store.getCurrent(), record.id).length) return;
          recordProjectSnapshot("캐릭터 외형 삭제");
          store.update((draft) => {
            draft.database.characterAppearances = draft.database.characterAppearances?.filter((entry) => entry.id !== record.id);
          }, { scope: "project", label: "캐릭터 외형 삭제" });
          changeSelection(records()[0]?.id); refresh();
        } },
    ]);
    const slots = el("div", { class: "appearance-slots", children: [
      appearanceSlotCard(record, "charset", refresh),
      appearanceSlotCard(record, "face", refresh),
      appearanceSlotCard(record, "bust", refresh),
      appearanceSlotCard(record, "full", refresh),
    ] });
    refreshSpecimen();
    detailHost.append(detailPane({
      hero, testid: "appearance-detail",
      body: [metadata, slots, specimen, sectionCard({ title: "사용처", children: [
        el("p", { class: "appearance-help", text: usages.length ? "사용 중인 외형은 삭제할 수 없습니다. 아래 연결을 먼저 해제하세요." : "아직 연결된 주인공·이벤트·대사 명령이 없습니다." }),
        el("ul", { dataset: { testid: "appearance-usages" }, children: usages.map((usage) => el("li", { text: usage.label })) }),
        actions,
      ] })],
    }));
  };
  function refresh(): void { refreshList(); refreshDetail(); }
  search.addEventListener("input", () => { query = search.value; refreshList(); });
  refresh();
  host.append(workspaceShell({ list, detail: detailHost, legacyClass: "appearance-workspace", testid: "appearance-workspace" }));
}
