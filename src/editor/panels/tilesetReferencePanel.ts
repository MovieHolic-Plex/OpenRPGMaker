import { openDialog } from "@/editor/panels/databaseEnemyRecordSupport";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { referenceOwner, validateTilesetReferences, REFERENCE_LIMITS, type TilesetReferenceCategory } from "@/project/tilesetReferences";
import { el } from "@/util/dom";
import { renderMarkdown } from "@/util/markdown";

const selections = new Map<string, { category?: string; document?: string; image?: string; view?: "documents" | "images"; editing?: boolean; managing?: boolean }>();
const uid = () => crypto.randomUUID();
function button(text: string, action: () => void, testid?: string): HTMLButtonElement {
  return el("button", { class: "tileset-reference-button", text, attrs: { type: "button" }, dataset: testid ? { testid } : {}, on: { click: action } });
}

/** Resolve only attachments stored in this purpose; never auto-load arbitrary Markdown URLs. */
export function renderReferenceMarkdown(markdown: string, category: TilesetReferenceCategory): HTMLElement {
  const root = el("div", { class: "tileset-reference-markdown" });
  const images = /!\[([^\]]*)\]\(([^)]+)\)/gu;
  let offset = 0;
  for (const match of markdown.matchAll(images)) {
    root.append(renderMarkdown(markdown.slice(offset, match.index)));
    const path = match[2]!.replace(/^image:/u, "");
    const exact = category.images.find(img => img.id === path || img.name === path);
    const basename = path.split("/").pop();
    const matches = category.images.filter(img => img.name === basename);
    const attachment = exact ?? (matches.length === 1 ? matches[0] : undefined);
    if (attachment) root.append(el("figure", { children: [
      el("img", { attrs: { src: attachment.dataUrl, alt: match[1] || attachment.caption || attachment.name, loading: "lazy" } }),
      el("figcaption", { text: attachment.caption || match[1] || attachment.name }),
    ] }));
    else root.append(el("p", { class: "tileset-reference-missing", text: `첨부 이미지 없음: ${match[2]}` }));
    offset = match.index! + match[0].length;
  }
  root.append(renderMarkdown(markdown.slice(offset)));
  return root;
}

export function renderTilesetReferences(selected: TilesetDef, rerender: () => void): HTMLElement {
  const project = store.getCurrent();
  const identity = JSON.stringify(store.getProjectIdentity());
  const stateKey = `${identity}:${selected.id}`;
  const state = selections.get(stateKey) ?? {};
  selections.set(stateKey, state);
  const status = el("p", { class: "tileset-reference-status", attrs: { role: "status", "aria-live": "polite" } });
  let owner: TilesetDef;
  try { owner = referenceOwner(project, selected); }
  catch (error) { return el("div", { text: String(error) }); }
  const groups = owner.referenceDocuments ?? [];
  const category = groups.find(group => group.id === state.category) ?? groups[0];
  state.category = category?.id;
  const current = () => {
    if (JSON.stringify(store.getProjectIdentity()) !== identity) throw new Error("프로젝트가 바뀌었습니다. 자료를 다시 선택하세요.");
    const tileset = store.getCurrent().tilesets[owner.id];
    if (!tileset) throw new Error("타일셋이 삭제되었습니다.");
    return tileset;
  };
  const edit = (mutate: (categories: TilesetReferenceCategory[]) => void, redraw = true, key?: string) => {
    try {
      const next = structuredClone(current().referenceDocuments ?? []);
      mutate(next); validateTilesetReferences(next);
      if (key) recordCoalescedSnapshot(`tileset-reference:${owner.id}:${key}`); else recordProjectSnapshot();
      store.update(draft => { draft.tilesets[owner.id]!.referenceDocuments = next; });
      status.textContent = "프로젝트에 반영됨";
      if (redraw) rerender();
    } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
  };
  const changeCategory = (mutate: (group: TilesetReferenceCategory) => void, redraw = true, key?: string) => edit(next => {
    const group = next.find(entry => entry.id === category?.id);
    if (!group) throw new Error("용도가 삭제되었습니다.");
    mutate(group);
  }, redraw, key);
  const field = (label: string, value: string, update: (text: string) => void, multiline = false) => {
    const input = multiline ? el("textarea", { value, attrs: { rows: "3", "aria-label": label } }) : el("input", { value, attrs: { "aria-label": label } });
    input.addEventListener("change", () => update(input.value));
    return el("label", { class: "tileset-reference-field", children: [el("span", { text: label }), input] });
  };
  const sourceSelect = el("select", { attrs: { "aria-label": "참고문서 원본" }, children: [
    el("option", { text: "이 타일셋에 직접 작성", attrs: { value: "" } }),
    ...Object.values(project.tilesets).filter(t => t.id !== selected.id && !t.referenceSourceTilesetId)
      .map(t => el("option", { text: t.name, attrs: { value: t.id } })),
  ] });
  sourceSelect.value = selected.referenceSourceTilesetId ?? "";
  // Switching ownership must not silently discard authored material or break existing dependents.
  sourceSelect.disabled = !!selected.referenceDocuments?.length || Object.values(project.tilesets).some(t => t.referenceSourceTilesetId === selected.id);
  sourceSelect.addEventListener("change", () => {
    recordProjectSnapshot();
    store.update(draft => {
      const target = draft.tilesets[selected.id]!;
      if (sourceSelect.value) target.referenceSourceTilesetId = sourceSelect.value;
      else delete target.referenceSourceTilesetId;
    });
    state.category = undefined; state.document = undefined; rerender();
  });
  const clearSelection = () => { state.document = undefined; state.image = undefined; state.editing = false; };
  const purposeSelect = el("select", { attrs: { "aria-label": "참고문서 용도" }, children: groups.map(group =>
    el("option", { text: `${group.name} · ${group.documents.length} MD / ${group.images.length} 이미지`, attrs: { value: group.id } })) });
  purposeSelect.value = category?.id ?? "";
  purposeSelect.addEventListener("change", () => { state.category = purposeSelect.value; clearSelection(); state.managing = false; rerender(); });
  const addPurpose = button("+ 용도", () => edit(next => {
    const entry = { id: uid(), name: `새 용도 ${next.length + 1}`, description: "", documents: [], images: [] };
    next.push(entry); state.category = entry.id; clearSelection(); state.managing = true;
  }), "tileset-reference-add-purpose");
  const sourceDetails = el("details", { class: "tileset-reference-source", children: [
    el("summary", { text: owner.id === selected.id ? "문서 원본 설정" : `공유 원본 · ${owner.name}` }),
    el("p", { text: "원본 자료를 수정하면 이를 공유하는 타일셋에도 반영됩니다." }),
    el("label", { class: "tileset-reference-field", children: [el("span", { text: "참고문서 원본" }), sourceSelect] }),
  ] });
  const library = el("aside", { class: "tileset-reference-library", children: [
    el("div", { class: "tileset-reference-library-title", children: [el("strong", { text: "참고문서" }), addPurpose] }),
    purposeSelect,
  ] });
  const reader = el("section", { class: "tileset-reference-reader", attrs: { "aria-label": "참고자료 읽기" } });
  if (!category) {
    reader.append(el("div", { class: "tileset-reference-empty", children: [
      el("span", { class: "tileset-reference-empty-icon", text: "▤" }),
      el("h3", { text: "이 타일셋의 조립 지침을 모으세요" }),
      el("p", { text: "‘마을’, ‘성’, ‘실내’처럼 용도를 만들고 MD와 이미지를 함께 넣으세요. AI가 타일을 배치하기 전에 읽는 자료입니다." }),
      button("첫 용도 만들기", () => addPurpose.click()),
    ] }));
  } else {
    const doc = category.documents.find(entry => entry.id === state.document) ?? category.documents[0];
    state.document = doc?.id;
    const image = category.images.find(entry => entry.id === state.image) ?? category.images[0];
    state.image = image?.id;
    const imageView = state.view === "images";
    const upload = el("input", { attrs: { type: "file", multiple: "", accept: ".md,.markdown,image/png,image/jpeg,image/webp", "aria-label": "MD와 이미지 가져오기" }, dataset: { testid: "tileset-reference-upload" } });
    upload.hidden = true;
    upload.addEventListener("change", () => { void (async () => {
      try {
        const files = Array.from(upload.files ?? []);
        const docs: TilesetReferenceCategory["documents"] = []; const images: TilesetReferenceCategory["images"] = [];
        for (const file of files) {
          if (/\.(md|markdown)$/iu.test(file.name)) {
            if (file.size > REFERENCE_LIMITS.markdown * 4) throw new Error(`${file.name}: MD가 너무 큽니다.`);
            docs.push({ id: uid(), name: file.name, markdown: await file.text() });
          } else {
            if (!/^(image\/png|image\/jpeg|image\/webp)$/u.test(file.type) || file.size > REFERENCE_LIMITS.imageBytes) throw new Error(`${file.name}: PNG/JPEG/WebP, 최대 4MB입니다.`);
            const bitmap = await createImageBitmap(file); bitmap.close();
            const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("이미지 읽기 실패")); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); });
            images.push({ id: uid(), name: file.name, caption: "", dataUrl });
          }
        }
        changeCategory(group => { group.documents.push(...docs); group.images.push(...images); });
      } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
      finally { upload.value = ""; }
    })(); });

    const documentsButton = button(`문서 ${category.documents.length}`, () => { state.view = "documents"; state.editing = false; rerender(); });
    const imagesButton = button(`이미지 ${category.images.length}`, () => { state.view = "images"; state.editing = false; rerender(); });
    documentsButton.classList.toggle("active", !imageView); imagesButton.classList.toggle("active", imageView);
    documentsButton.setAttribute("aria-pressed", String(!imageView)); imagesButton.setAttribute("aria-pressed", String(imageView));
    library.append(el("div", { class: "tileset-reference-switch", children: [documentsButton, imagesButton] }));
    const files = el("nav", { class: `tileset-reference-files${imageView ? " image-files" : ""}`, attrs: { "aria-label": imageView ? "참고 이미지" : "MD 문서" } });
    if (imageView) for (const item of category.images) {
      const row = button(item.name, () => { state.image = item.id; state.editing = false; state.managing = false; rerender(); });
      row.replaceChildren(el("img", { attrs: { src: item.dataUrl, alt: "", loading: "lazy" } }), el("span", { text: item.caption || item.name }));
      row.setAttribute("aria-label", item.name); row.classList.toggle("active", item.id === image?.id);
      row.setAttribute("aria-current", String(item.id === image?.id)); files.append(row);
    } else for (const item of category.documents) {
      const title = item.markdown.match(/^#\s+(.+)$/mu)?.[1] ?? item.name;
      const row = button(title, () => { state.document = item.id; state.editing = false; state.managing = false; rerender(); });
      row.setAttribute("aria-label", item.name); row.title = item.name;
      row.prepend(el("small", { text: "MD" })); row.classList.toggle("active", item.id === doc?.id);
      row.setAttribute("aria-current", String(item.id === doc?.id)); files.append(row);
    }
    if (!files.childElementCount) files.append(el("p", { text: imageView ? "첨부 이미지가 없습니다." : "아직 문서가 없습니다." }));
    library.append(files, el("div", { class: "tileset-reference-library-actions", children: [
      button("+ MD 문서", () => changeCategory(g => { const entry = { id: uid(), name: "새 문서.md", markdown: "# 조립 지침\n\n" }; g.documents.push(entry); state.document = entry.id; state.view = "documents"; state.editing = true; state.managing = false; }), "tileset-reference-add-document"),
      button("파일 가져오기", () => upload.click()), upload,
      button("용도 관리", () => { state.managing = !state.managing; rerender(); }, "tileset-reference-manage-purpose"),
    ] }));
    const toolbar = el("div", { class: "tileset-reference-toolbar" });
    const heading = el("header", { class: "tileset-reference-reader-heading", children: [
      el("div", { children: [el("small", { text: `AI 참고문서 / ${category.name} / ${imageView ? "이미지" : "MD 문서"}` }), el("h3", { text: imageView ? image?.name ?? "참고 이미지" : doc?.name ?? category.name })] }), toolbar,
    ] });
    const body = el("div", { class: "tileset-reference-body" });
    reader.append(heading, body);
    if (state.managing) {
      body.append(el("h3", { text: "용도 이름·설명 편집" }),
        field("용도 이름", category.name, value => changeCategory(g => { g.name = value; })),
        field("이 자료를 사용할 때", category.description, value => changeCategory(g => { g.description = value; }, false, "description"), true),
        el("p", { text: "MD와 PNG·JPEG·WebP를 함께 가져올 수 있습니다. MD의 ![설명](파일명.png)은 같은 용도에 첨부된 이미지로 표시됩니다. 이미지당 최대 4MB." }),
        button("용도 삭제", () => { if (window.confirm(`‘${category.name}’의 문서와 이미지를 삭제할까요?`)) edit(next => { next.splice(next.findIndex(g => g.id === category.id), 1); state.managing = false; clearSelection(); }); }),
      );
      toolbar.append(button("읽기로 돌아가기", () => { state.managing = false; rerender(); }));
    } else if (imageView && image) {
      toolbar.append(button(state.editing ? "미리보기" : "설명 편집", () => { state.editing = !state.editing; rerender(); }));
      body.append(el("figure", { class: "tileset-reference-image-preview", children: [
        el("img", { attrs: { src: image.dataUrl, alt: image.caption || image.name } }), el("figcaption", { text: image.caption || image.name }),
      ] }));
      if (state.editing) body.append(
        field("이미지 설명", image.caption, value => changeCategory(g => { g.images.find(i => i.id === image.id)!.caption = value; }, false, `image:${image.id}`)),
        el("code", { text: `![${image.caption || image.name}](image:${image.id})` }),
        button("이미지 삭제", () => { if (window.confirm(`‘${image.name}’을 삭제할까요? MD에서 사용 중인 링크도 확인하세요.`)) changeCategory(g => { g.images = g.images.filter(i => i.id !== image.id); }); }),
      );
    } else if (!imageView && doc) {
      toolbar.append(button(state.editing ? "미리보기" : "MD 편집", () => { state.editing = !state.editing; rerender(); }, "tileset-reference-toggle-edit"));
      if (state.editing) {
        body.append(field("문서 이름", doc.name, value => changeCategory(g => { g.documents.find(d => d.id === doc.id)!.name = value; })));
        const area = el("textarea", { class: "tileset-reference-editor", value: doc.markdown, attrs: { "aria-label": "Markdown 본문", spellcheck: "false" }, dataset: { testid: "tileset-reference-markdown" } });
        area.addEventListener("change", () => changeCategory(g => { g.documents.find(d => d.id === doc.id)!.markdown = area.value; }, false, `document:${doc.id}`));
        body.append(area, button("문서 삭제", () => { if (window.confirm(`‘${doc.name}’을 삭제할까요?`)) changeCategory(g => { g.documents = g.documents.filter(d => d.id !== doc.id); }); }));
      } else body.append(renderReferenceMarkdown(doc.markdown, category));
    } else body.append(el("p", { text: imageView ? "파일 가져오기로 참고 이미지를 추가하세요." : "MD 문서를 추가하거나 파일을 가져오세요." }));
    // Enlarge inline diagrams without navigating away or exposing arbitrary Markdown URLs.
    for (const img of body.querySelectorAll("img")) {
      const opener = button("이미지 크게 보기", () => { openDialog("tileset-reference-image-dialog", img.alt || "참고 이미지", [el("img", { class: "tileset-reference-lightbox", attrs: { src: img.src, alt: img.alt } })], [{ label: "닫기", testid: "tileset-reference-image-close" }]); });
      opener.classList.add("tileset-reference-enlarge");
      img.replaceWith(opener); opener.replaceChildren(img); opener.setAttribute("aria-label", "이미지 크게 보기");
    }
  }
  library.append(sourceDetails);
  return el("div", { class: "tileset-references", dataset: { testid: "tileset-references" }, children: [
    el("div", { class: "tileset-reference-layout", children: [library, reader] }),
    el("footer", { class: "tileset-reference-footer", children: [el("span", { text: "AI는 선택한 용도의 문서와 이미지를 읽고 타일을 배치합니다." }), status] }),
  ] });
}
