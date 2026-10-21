// src/editor/workshop/genWorkspace.ts
/**
 * 공방 생성기 화면(내 컴퓨터에서 만들어 가져오는 길). 공방 큰 화면과 같은 오버레이 틀을 쓴다.
 * - char-gen: ① 무엇을·몇 개 → 내 AI 에이전트에게 붙여 넣을 부탁 글 ② 다 만든 묶음 폴더 가져오기 → 미리 보기 → 이 프로젝트에 넣기
 * - tile-gen: ① 무엇을·크기 + 지금 맵 칩셋 그림 받기(tile-gen 이 색을 잠글 타일셋 파일) → 부탁 글 ② 묶음 가져오기
 * - object-gen(가져오기만): ② 단계만. 편집기 안에서 그리기는 workshopWorkspace(공방 실행기)가 한다.
 * 그림 생성은 전부 사용자 컴퓨터의 자기 로그인으로 돈다 — 우리 키·유료 대체 경로는 없다.
 */
import "@/styles/database/workshop/index.css";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";
import { CHAR_GEN_REPO_URL, charGenRequest, tileGenRequest, type GeneratorId } from "./generators";
import { browserWorkshopEnv } from "./pixels";
import { addLocalPackToProject, localPackPreviews, readLocalPack, revokeLocalPackPreviews, type LocalPack, type LocalPackPreview } from "./genPackImport";

let host: HTMLElement | null = null;
let previews: LocalPackPreview[] = [];

export function isGenWorkspaceOpen(): boolean {
  return host !== null;
}

export function closeGenWorkspace(): void {
  document.removeEventListener("keydown", onKeydown);
  revokeLocalPackPreviews(previews);
  previews = [];
  host?.remove();
  host = null;
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && host) {
    event.preventDefault();
    closeGenWorkspace();
  }
}

type LocalGenerator = Extract<GeneratorId, "char-gen" | "tile-gen" | "object-gen">;
const TITLES: Readonly<Record<LocalGenerator, string>> = {
  "char-gen": "공방 · 캐릭터",
  "tile-gen": "공방 · 타일 조각",
  "object-gen": "공방 · 물건 묶음 가져오기",
};
const LEADS: Readonly<Record<LocalGenerator, string>> = {
  "char-gen": "캐릭터는 내 컴퓨터의 AI 에이전트가 내 계정으로 만들어요. 만든 캐릭터를 여기서 가져와 이 게임에 넣어요.",
  "tile-gen": "타일 조각은 내 컴퓨터의 AI 에이전트가 내 계정으로 그려요. 후보는 내가 직접 고르고, 다 만든 묶음을 여기서 가져와 이 게임에 넣어요.",
  "object-gen": "내 컴퓨터에서 object-gen 으로 만든 묶음 폴더를 가져와 이 게임에 넣어요.",
};

export function openGenWorkspace(generator: LocalGenerator): void {
  closeGenWorkspace();
  host = el("div", {
    class: "workshop-host", dataset: { testid: "workshop-gen-host" },
    on: { click: (event) => { if (event.target === host) closeGenWorkspace(); } },
  });
  if (document.querySelector('[data-testid="left-activity-bar"]')) host.style.left = "48px";
  if (document.querySelector('[data-testid="oprn-menu-bar"]')) host.style.top = "48px";

  const steps: HTMLElement[] = [];
  if (generator === "char-gen") steps.push(requestStep());
  if (generator === "tile-gen") steps.push(tileRequestStep());
  steps.push(importStep(generator, steps.length + 1));

  host.append(el("section", {
    class: "workshop workshop-gen",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": TITLES[generator] },
    dataset: { testid: "workshop-gen", generator },
    children: [
      el("header", {
        class: "workshop-head",
        children: [
          el("h2", { text: TITLES[generator] }),
          el("button", { class: "workshop-close", text: "닫기", attrs: { type: "button", "aria-label": "공방 닫기" }, on: { click: closeGenWorkspace } }),
        ],
      }),
      el("div", {
        class: "workshop-gen-body",
        children: [
          el("p", { class: "workshop-gen-lead", text: LEADS[generator] }),
          ...steps,
        ],
      }),
    ],
  }));
  document.body.append(host);
  document.addEventListener("keydown", onKeydown);
}

function stepBox(n: number, title: string, children: HTMLElement[], testid: string): HTMLElement {
  return el("section", {
    class: "workshop-gen-step", dataset: { testid },
    children: [el("h3", { children: [el("span", { class: "workshop-gen-step-no", text: String(n) }), el("span", { text: title })] }), ...children],
  });
}

function requestStep(): HTMLElement {
  const what = el("input", { attrs: { type: "text", placeholder: "예: 파란 외투를 입은 항구 선원", "aria-label": "무엇을 만들까요" }, dataset: { testid: "workshop-gen-what" } }) as HTMLInputElement;
  const count = el("select", {
    attrs: { "aria-label": "몇 명" }, dataset: { testid: "workshop-gen-count" },
    children: [1, 2, 3, 4].map((n) => el("option", { value: n, text: `${n}명`, attrs: n === 3 ? { selected: "" } : {} })),
  }) as HTMLSelectElement;
  // 언어는 generators.charGenRequest 가 고른다.
  const { request, copied, row } = requestBox();
  const update = (): void => { request.value = charGenRequest(what.value, Number(count.value)); copied.textContent = ""; };
  what.addEventListener("input", update);
  count.addEventListener("change", update);
  update();
  return stepBox(1, "무엇을 만들까요?", [
    el("div", { class: "workshop-form-row", children: [el("label", { class: "workshop-gen-grow", children: ["어떤 캐릭터", what] }), el("label", { children: ["몇 명", count] })] }),
    request,
    row,
    el("p", {
      class: "workshop-item-meta",
      children: [
        el("span", { text: "처음이면 char-gen 을 내 컴퓨터에 설치하고 내 AI 에이전트에 연결하세요. 그림은 내 계정으로만 만들고, 마지막에 사람이 직접 골라요." }),
        " ",
        el("a", { text: "char-gen 설치 안내", attrs: { href: CHAR_GEN_REPO_URL, target: "_blank", rel: "noopener noreferrer" } }),
      ],
    }),
  ], "workshop-gen-step-request");
}

/** 부탁 글 칸 + 복사 단추 — 에이전트에게 가는 글이라 화면 번역기가 건드리지 않게 한다(data-i18n-skip). */
function requestBox(): { request: HTMLTextAreaElement; copied: HTMLElement; row: HTMLElement } {
  const request = el("textarea", {
    class: "workshop-gen-request", attrs: { readonly: "", rows: "3", "aria-label": "부탁 글", "data-i18n-skip": "" }, dataset: { testid: "workshop-gen-request" },
  }) as HTMLTextAreaElement;
  const copied = el("span", { class: "workshop-item-meta", attrs: { role: "status" } });
  const copy = el("button", {
    text: "부탁 글 복사", attrs: { type: "button" }, dataset: { testid: "workshop-gen-copy" },
    on: {
      click: () => {
        void navigator.clipboard?.writeText(request.value).then(
          () => { copied.textContent = "복사했어요. 내 AI 에이전트(터미널)에 붙여 넣으세요."; },
          () => { request.select(); copied.textContent = "복사하지 못했어요. 글을 직접 골라 복사해 주세요."; },
        );
      },
    },
  });
  return { request, copied, row: el("div", { class: "workshop-form-actions", children: [copy, copied] }) };
}

/** 지금 맵의 칩셋(바탕 시트) — tile-gen 이 색을 잠글 타일셋 파일. 맵이 없거나 그림을 못 읽으면 null. */
function currentMapTileset(): { id: string; name: string; fileName: string } | null {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId;
  const tilesetId = mapId ? project.maps[mapId]?.tilesetId : undefined;
  const tileset = tilesetId ? project.tilesets[tilesetId] : undefined;
  if (!tilesetId || !tileset) return null;
  const safe = tilesetId.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 60) || "tileset";
  return { id: tilesetId, name: tileset.name, fileName: `${safe}.png` };
}

function tileRequestStep(): HTMLElement {
  const target = currentMapTileset();
  const what = el("input", { attrs: { type: "text", placeholder: "예: 이끼 낀 돌 우물", "aria-label": "무엇을 만들까요" }, dataset: { testid: "workshop-gen-what" } }) as HTMLInputElement;
  const tilesW = el("input", { value: 1, attrs: { type: "number", min: "1", max: "4" } }) as HTMLInputElement;
  const tilesH = el("input", { value: 1, attrs: { type: "number", min: "1", max: "4" } }) as HTMLInputElement;
  const { request, copied, row } = requestBox();
  const update = (): void => { request.value = tileGenRequest(what.value, Number(tilesW.value), Number(tilesH.value), target?.fileName ?? "tileset.png"); copied.textContent = ""; };
  for (const input of [what, tilesW, tilesH]) input.addEventListener("input", update);
  update();
  const status = el("span", { class: "workshop-item-meta", attrs: { role: "status" } });
  const download = target
    ? el("button", {
      text: "지금 맵 칩셋 그림 받기", attrs: { type: "button" }, dataset: { testid: "workshop-gen-tileset-download" },
      on: {
        click: () => {
          status.textContent = "칩셋 그림을 만드는 중…";
          const env = browserWorkshopEnv();
          void env.tilesetSource?.(target.id).then((source) => {
            if (!source) { status.textContent = "칩셋 그림을 읽지 못했어요. 맵 칩셋이 다 불러와졌는지 확인하고 다시 눌러 주세요."; return; }
            const link = el("a", { attrs: { href: env.encodePng(source.image), download: target.fileName } });
            link.click();
            status.textContent = `「${target.fileName}」을(를) 받았어요. 부탁 글의 파일 이름과 같아요.`;
          }, () => { status.textContent = "칩셋 그림을 읽지 못했어요. 맵 칩셋이 다 불러와졌는지 확인하고 다시 눌러 주세요."; });
        },
      },
    })
    : null;
  return stepBox(1, "무엇을 만들까요?", [
    el("div", { class: "workshop-form-row", children: [el("label", { class: "workshop-gen-grow", children: ["무엇", what] }), el("label", { children: ["가로 칸", tilesW] }), el("label", { children: ["세로 칸", tilesH] })] }),
    el("p", {
      class: "workshop-item-meta", dataset: { testid: "workshop-gen-tileset" },
      text: target ? `색은 지금 맵 칩셋 「${target.name}」에서 가져와요. 아래 단추로 그 그림을 받아 두세요.` : "열린 맵이 없어요. 칩셋 그림을 받으려면 그릴 맵을 먼저 열어 주세요.",
    }),
    ...(download ? [el("div", { class: "workshop-form-actions", children: [download, status] })] : []),
    request,
    row,
    el("p", { class: "workshop-item-meta", text: "처음이면 tile-gen 을 내 컴퓨터에 설치하고 내 AI 에이전트에 연결하세요. 그림은 내 계정으로만 만들고, 후보는 내가 직접 골라요." }),
  ], "workshop-gen-step-request");
}

function importStep(generator: LocalGenerator, n: number): HTMLElement {
  const status = el("p", { class: "workshop-item-meta", attrs: { role: "status" }, dataset: { testid: "workshop-gen-status" } });
  const result = el("div", { class: "workshop-gen-result", dataset: { testid: "workshop-gen-result" } });
  const picker = el("input", { attrs: { type: "file", multiple: "", webkitdirectory: "", hidden: "" }, dataset: { testid: "workshop-gen-folder" } }) as HTMLInputElement;
  let current: LocalPack | null = null;

  const show = (pack: LocalPack): void => {
    revokeLocalPackPreviews(previews);
    previews = localPackPreviews(pack);
    current = pack;
    clearChildren(result);
    const add = el("button", {
      class: "workshop-gen-primary", text: "이 프로젝트에 넣기", attrs: { type: "button" }, dataset: { testid: "workshop-gen-add" },
      on: {
        click: () => {
          if (!current) return;
          add.disabled = true;
          status.textContent = "넣는 중…";
          addLocalPackToProject(current, generator).then(
            (added) => {
              status.textContent = generator === "char-gen"
                ? `「${added.title}」을(를) 넣었어요. 자료집의 캐릭터 그림 고르기에서 쓸 수 있어요. 되돌리기로 뺄 수 있어요.`
                : `「${added.title}」을(를) 넣었어요. 타일셋 목록에 새 칩셋으로 들어갔고 조수도 쓸 수 있어요. 되돌리기로 뺄 수 있어요.`;
            },
            (error: unknown) => { add.disabled = false; status.textContent = `넣지 못했어요: ${error instanceof Error ? error.message : String(error)}`; },
          );
        },
      },
    }) as HTMLButtonElement;
    result.append(
      el("div", {
        class: "workshop-gen-pack-head",
        children: [
          el("strong", { text: pack.manifest.title, attrs: { translate: "no" } }),
          el("span", { class: "workshop-chip", text: pack.manifest.license }),
          ...(pack.manifest.aiGenerated ? [el("span", { class: "workshop-chip", text: "AI 생성" })] : []),
        ],
      }),
      ...(pack.manifest.credits ? [el("p", { class: "workshop-item-meta", attrs: { translate: "no" }, text: pack.manifest.credits })] : []),
      el("div", {
        class: "workshop-gen-previews",
        children: previews.length
          ? previews.map((preview) => el("figure", {
            children: [el("img", {
              attrs: { src: preview.url, alt: preview.name },
              // 도트 그림은 정수 배율로만 키운다(최대 360px 폭, 6배까지)
              on: { load: (event) => { const img = event.target as HTMLImageElement; const k = Math.max(1, Math.min(6, Math.floor(360 / Math.max(1, img.naturalWidth)))); img.style.width = `${img.naturalWidth * k}px`; } },
            }), el("figcaption", { attrs: { translate: "no" }, text: preview.name })],
          }))
          : [el("p", { class: "workshop-item-meta", text: "미리 볼 그림이 없어요." })],
      }),
      el("div", { class: "workshop-form-actions", children: [add] }),
      el("p", { class: "workshop-item-meta", text: "이 게임에만 들어가요. 공용(스토어)에 올리려면 생성기에서 검사를 거쳐 올려 주세요." }),
    );
  };

  picker.addEventListener("change", () => {
    const files = [...(picker.files ?? [])];
    picker.value = "";
    if (!files.length) return;
    status.textContent = "묶음을 읽는 중…";
    readLocalPack(files).then(
      (pack) => { status.textContent = ""; show(pack); },
      (error: unknown) => { current = null; clearChildren(result); status.textContent = error instanceof Error ? error.message : String(error); },
    );
  });

  return stepBox(n, "다 만든 묶음 가져오기", [
    el("p", {
      class: "workshop-item-meta",
      text: `${generator} pack 이 만든 폴더(안에 manifest.json 과 blobs 폴더가 있어요)를 통째로 골라 주세요.`,
    }),
    el("div", {
      class: "workshop-form-actions",
      children: [el("button", { text: "묶음 폴더 고르기", attrs: { type: "button" }, dataset: { testid: "workshop-gen-pick-folder" }, on: { click: () => picker.click() } }), picker],
    }),
    status,
    result,
  ], "workshop-gen-step-import");
}
