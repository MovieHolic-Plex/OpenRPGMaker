import { store } from "@/project/store";
import type { Project, VillageInfoDocument } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";
import { openWorldPanel } from "./worldPanel";

let selectedDocumentId = "";

export function openVillageInfoModal(): void {
  openWorldPanel();
}

export function openLegacyVillageInfoModal(): void {
  document.querySelector("[data-testid='village-info-modal']")?.remove();
  ensureVillageInfoDocuments();

  const body = el("div", { class: "village-info-body" });
  const status = el("div", {
    class: "village-info-status",
    attrs: { "aria-live": "polite" },
    dataset: { testid: "village-info-status" },
    text: "마을 정보 문서는 프로젝트와 함께 저장됩니다.",
  });
  const closeButton = el("button", {
    class: "database-modal-close",
    text: "x",
    attrs: { type: "button", title: "닫기", "aria-label": "마을 정보 닫기" },
    dataset: { testid: "village-info-close" },
  });
  const backdrop = el("div", {
    class: "database-modal-backdrop village-info-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "village-info-modal" },
    children: [
      el("section", {
        class: "database-modal-window village-info-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "마을 정보" },
        children: [
          el("header", {
            class: "database-modal-header",
            children: [el("h2", { text: "마을 정보" }), el("div", { class: "database-modal-controls", children: [closeButton] })],
          }),
          body,
          el("footer", {
            class: "database-modal-footer village-info-footer",
            children: [
              status,
              el("button", {
                class: "database-footer-button",
                text: "온라인 저장",
                attrs: { type: "button" },
                dataset: { testid: "village-info-save-remote" },
                on: { click: () => void flushVillageInfo(status) },
              }),
              el("button", {
                class: "database-footer-button primary",
                text: "닫기",
                attrs: { type: "button" },
                on: { click: () => close() },
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const close = (): void => {
    backdrop.remove();
    document.removeEventListener("keydown", onKeyDown);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };

  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", onKeyDown);
  document.body.append(backdrop);
  renderVillageInfoBody(body, status);
  closeButton.focus();
}

function ensureVillageInfoDocuments(): void {
  const project = store.getCurrent();
  const existing = project.villageInfoDocuments ?? [];
  const missingMaps = Object.values(project.maps).filter((map) => !existing.some((document) => document.mapId === map.id));
  if (existing.length > 0 && missingMaps.length === 0) {
    selectedDocumentId = existing.some((document) => document.id === selectedDocumentId) ? selectedDocumentId : existing[0]?.id ?? "";
    return;
  }
  store.update((draft) => {
    const documents = [...(draft.villageInfoDocuments ?? [])];
    for (const map of missingMaps) {
      documents.push(createVillageInfoDocument(draft, map.id));
    }
    draft.villageInfoDocuments = documents;
  });
  selectedDocumentId = store.getCurrent().villageInfoDocuments?.[0]?.id ?? "";
}

function renderVillageInfoBody(body: HTMLElement, status: HTMLElement): void {
  clearChildren(body);
  const project = store.getCurrent();
  const documents = project.villageInfoDocuments ?? [];
  if (documents.length === 0) {
    body.append(el("p", { class: "village-info-empty", text: "편집할 마을 정보 문서가 없습니다." }));
    return;
  }
  selectedDocumentId = documents.some((document) => document.id === selectedDocumentId) ? selectedDocumentId : documents[0]?.id ?? "";
  const activeDocument = documents.find((document) => document.id === selectedDocumentId) ?? documents[0];
  if (!activeDocument) return;

  const list = el("nav", { class: "village-info-list", attrs: { "aria-label": "마을 정보 문서" } });
  for (const document of documents) {
    const mapName = project.maps[document.mapId]?.name ?? document.mapId;
    list.append(
      el("button", {
        class: `village-info-row${document.id === activeDocument.id ? " active" : ""}`,
        text: `${document.title || mapName}`,
        attrs: { type: "button", title: mapName, "aria-pressed": String(document.id === activeDocument.id) },
        dataset: { testid: `village-info-doc-${document.id}` },
        on: {
          click: () => {
            selectedDocumentId = document.id;
            renderVillageInfoBody(body, status);
          },
        },
      }),
    );
  }

  const titleInput = el("input", {
    class: "village-info-title-input",
    value: activeDocument.title,
    attrs: { type: "text", "aria-label": "문서 제목" },
    dataset: { testid: "village-info-title-input" },
  }) as HTMLInputElement;
  const mapSelect = el("select", {
    class: "village-info-map-select",
    attrs: { "aria-label": "대상 맵" },
    dataset: { testid: "village-info-map-select" },
  }) as HTMLSelectElement;
  for (const map of Object.values(project.maps)) {
    const option = el("option", { text: map.name, attrs: { value: map.id } }) as HTMLOptionElement;
    option.selected = map.id === activeDocument.mapId;
    mapSelect.append(option);
  }
  const markdownInput = el("div", {
    class: "village-info-markdown-input",
    text: activeDocument.markdown,
    attrs: {
      "aria-label": "마크다운 내용",
      "aria-multiline": "true",
      contenteditable: "plaintext-only",
      role: "textbox",
      spellcheck: "false",
    },
    dataset: { testid: "village-info-markdown-input" },
  });
  const preview = el("pre", {
    class: "village-info-preview",
    text: activeDocument.markdown,
    dataset: { testid: "village-info-preview" },
  });
  markdownInput.addEventListener("input", () => {
    preview.textContent = markdownInput.textContent ?? "";
  });

  const editor = el("section", {
    class: "village-info-editor",
    children: [
      el("div", {
        class: "village-info-field-row",
        children: [
          el("label", { text: "제목", children: [titleInput] }),
          el("label", { text: "맵", children: [mapSelect] }),
        ],
      }),
      el("div", {
        class: "village-info-edit-grid",
        children: [
          el("label", { class: "village-info-pane", text: "수정", children: [markdownInput] }),
          el("section", { class: "village-info-pane", children: [el("h3", { text: "보기" }), preview] }),
        ],
      }),
      el("div", {
        class: "village-info-actions",
        children: [
          el("button", {
            class: "btn small primary",
            text: "적용",
            attrs: { type: "button" },
            dataset: { testid: "village-info-apply" },
            on: {
              click: () => {
                applyVillageInfoDocument(activeDocument.id, {
                  id: activeDocument.id,
                  mapId: mapSelect.value,
                  title: titleInput.value.trim() || `${project.maps[mapSelect.value]?.name ?? "마을 정보"}.md`,
                  markdown: markdownInput.textContent ?? "",
                });
                status.textContent = "문서 변경을 적용했습니다. 저장하면 프로젝트와 함께 남습니다.";
                toast("마을 정보 문서를 적용했습니다.", "ok");
                renderVillageInfoBody(body, status);
              },
            },
          }),
        ],
      }),
    ],
  });
  body.append(list, editor);
}

function applyVillageInfoDocument(documentId: string, nextDocument: VillageInfoDocument): void {
  store.update((draft) => {
    const documents = draft.villageInfoDocuments ?? [];
    const index = documents.findIndex((document) => document.id === documentId);
    if (index === -1) {
      draft.villageInfoDocuments = [...documents, nextDocument];
      return;
    }
    draft.villageInfoDocuments = documents.map((document, currentIndex) => (currentIndex === index ? nextDocument : document));
  });
}

async function flushVillageInfo(status: HTMLElement): Promise<void> {
  status.textContent = "마을 정보 문서를 저장하는 중입니다.";
  const result = await store.flush();
  switch (result.kind) {
    case "saved":
      status.textContent = "DB에 저장했습니다.";
      toast("DB에 저장했습니다.", "ok");
      return;
    case "saved-local":
      status.textContent = "브라우저에 저장했습니다.";
      toast("브라우저에 저장했습니다.", "ok");
      return;
    case "not-loaded":
      status.textContent = "프로젝트를 아직 불러오는 중입니다.";
      return;
    case "conflict":
      status.textContent = "저장 충돌이 있습니다.";
      toast("저장 충돌이 있습니다.", "error");
      return;
    case "not-configured":
      status.textContent = "온라인 저장 연결이 필요합니다.";
      return;
    case "disabled":
      status.textContent = "이 화면에서는 온라인 저장을 사용할 수 없습니다.";
      return;
  }
}

function createVillageInfoDocument(project: Project, mapId: string): VillageInfoDocument {
  const map = project.maps[mapId];
  const title = `${map?.name ?? mapId}.md`;
  return {
    id: `village_info_${mapId}`,
    mapId,
    title,
    markdown: [
      `# ${map?.name ?? mapId}`,
      "",
      "## 역할",
      "- 이 맵이 맡는 플레이 목적과 분위기를 적습니다.",
      "",
      "## 주요 인물",
      "- NPC 이름, 서로 아는 관계, 플레이어에게 주는 정보를 적습니다.",
      "",
      "## 퀘스트 단서",
      "- 선택지, 조건 분기, 스위치/변수와 연결될 정보를 적습니다.",
    ].join("\n"),
  };
}
