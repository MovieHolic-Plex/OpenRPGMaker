// src/editor/workshop/genWorkspace.ts
/**
 * 공방 생성기 화면(내 컴퓨터에서 만들어 가져오는 길). 공방 큰 화면과 같은 오버레이 틀을 쓴다.
 * - char-gen: ① 무엇을·몇 개 → 내 AI 에이전트에게 붙여 넣을 부탁 글 ② 다 만든 묶음 폴더 가져오기 → 미리 보기 → 이 프로젝트에 넣기
 * - object-gen(가져오기만): ② 단계만. 편집기 안에서 그리기는 workshopWorkspace(공방 실행기)가 한다.
 * 그림 생성은 전부 사용자 컴퓨터의 자기 로그인으로 돈다 — 우리 키·유료 대체 경로는 없다.
 * - tile-gen(지형): ① 종류·무엇·참고 칸 + 지금 맵 칩셋 그림 받기(tile-gen 이 색을 잠글 타일셋 파일) → 부탁 글 ② 묶음 가져오기.
 * 가져오기는 폴더를 끌어 놓거나(하위 폴더까지 읽는다) 눌러서 고른다.
 */
import "@/styles/database/workshop/index.css";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";
import { t } from "@/i18n";
import { charGenText, generatorPinLine, TERRAIN_MODES, TERRAIN_PRESETS, tileGenText, type GeneratorId } from "./generators";
import { browserWorkshopEnv } from "./pixels";
import { localPackPreviews, readLocalPack, revokeLocalPackPreviews, type LocalPack, type LocalPackPreview } from "./genPackImport";
import { workshopQueue } from "./queue/workshopQueue";
import { castLineup, packCast } from "./castPreview";
import { generatorStage, workshopEmblem } from "./workshopArt";
import { WORKSHOP_GENERATORS } from "./generators";

let host: HTMLElement | null = null;
let previews: LocalPackPreview[] = [];
let stopCast: (() => void) | null = null;

export function isGenWorkspaceOpen(): boolean {
  return host !== null;
}

export function closeGenWorkspace(): void {
  document.removeEventListener("keydown", onKeydown);
  revokeLocalPackPreviews(previews);
  previews = [];
  stopCast?.();
  stopCast = null;
  // 공방 큰 화면처럼, 닫히면 작업 줄 알약을 다시 보인다.
  if (host) void import("./queue/queueDock").then(({ collapseWorkshopQueue }) => collapseWorkshopQueue(false));
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
  "tile-gen": "공방 · 지형·바닥",
  "object-gen": "공방 · 물건 묶음 가져오기",
};
const LEADS: Readonly<Record<LocalGenerator, string>> = {
  "char-gen": "캐릭터는 내 컴퓨터의 AI 에이전트가 내 계정으로 만들어요. 만든 캐릭터를 여기서 가져와 이 게임에 넣어요.",
  "tile-gen": "지형은 내 컴퓨터의 AI 에이전트가 내 계정으로 그려요. 후보는 내가 직접 고르고, 다 만든 묶음을 여기서 가져와 이 게임에 넣어요. 물건·건물은 「물건·가구」에서 만들어요.",
  "object-gen": "내 컴퓨터에서 object-gen 으로 만든 묶음 폴더를 가져와 이 게임에 넣어요.",
};

export function openGenWorkspace(generator: LocalGenerator): void {
  closeGenWorkspace();
  host = el("div", {
    class: "workshop-host is-gen", dataset: { testid: "workshop-gen-host" },
    on: { click: (event) => { if (event.target === host) closeGenWorkspace(); } },
  });
  if (document.querySelector('[data-testid="left-activity-bar"]')) host.style.left = "48px";
  if (document.querySelector('[data-testid="oprn-menu-bar"]')) host.style.top = "48px";

  const steps: HTMLElement[] = [];
  if (generator === "char-gen") steps.push(requestStep());
  if (generator === "tile-gen") steps.push(terrainRequestStep());
  // 단계가 하나뿐이면 번호를 달지 않는다(순서가 없으니까)
  const importer = importStep(generator, steps.length ? steps.length + 1 : 0);
  steps.push(importer.box);
  // 사진으로 만들기는 부탁 글 길과 다른 길이라 번호 없이 맨 위에 둔다 — 고른 후보의 묶음은 가져오기 칸에 선다.
  if (generator === "char-gen") steps.unshift(photoStep(importer.show));

  host.append(el("section", {
    class: "workshop workshop-gen",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": TITLES[generator] },
    dataset: { testid: "workshop-gen", generator },
    children: [
      el("header", {
        class: "workshop-head",
        children: [
          el("h2", { children: [workshopEmblem(32), el("span", { text: TITLES[generator] })] }),
          el("button", { class: "workshop-close", text: "닫기", attrs: { type: "button", "aria-label": "공방 닫기" }, on: { click: closeGenWorkspace } }),
        ],
      }),
      el("div", {
        class: "workshop-gen-body",
        children: [
          // 머리 무대 — 왼쪽 카드와 같은 그림(이 생성기가 만든 도트). 견본이 없는 생성기는 모눈 빈 작업대.
          el("div", {
            class: "workshop-intro",
            children: [...WORKSHOP_GENERATORS.filter((g) => g.id === generator).map((g) => generatorStage(g, "hero")), el("p", { class: "workshop-gen-lead", text: LEADS[generator] })],
          }),
          ...steps,
        ],
      }),
    ],
  }));
  document.body.append(host);
  document.addEventListener("keydown", onKeydown);
  // 떠 있는 작업 줄 알약이 이 창 오른쪽 아래(사람 줄·넣기 단추)를 덮었다(2026-10-22 적대 검수) — 열려 있는 동안 숨긴다.
  // 가져온 묶음은 작업 줄에 「넣을 차례」로 서고, 창을 닫으면 알약이 다시 보인다.
  void import("./queue/queueDock").then(({ collapseWorkshopQueue }) => collapseWorkshopQueue(true));
}

function stepBox(n: number, title: string, children: HTMLElement[], testid: string): HTMLElement {
  return el("section", {
    class: "workshop-gen-step", dataset: { testid },
    children: [el("h3", { children: [...(n > 0 ? [el("span", { class: "workshop-gen-step-no", text: String(n) })] : []), el("span", { text: title })] }), ...children],
  });
}

function requestStep(): HTMLElement {
  const what = el("input", { attrs: { type: "text", placeholder: "예: 파란 외투를 입은 항구 선원", "aria-label": "무엇을 만들까요" }, dataset: { testid: "workshop-gen-what" } }) as HTMLInputElement;
  const count = el("select", {
    attrs: { "aria-label": "몇 명" }, dataset: { testid: "workshop-gen-count" },
    children: [1, 2, 3, 4].map((n) => el("option", { value: n, text: `${n}명`, attrs: n === 3 ? { selected: "" } : {} })),
  }) as HTMLSelectElement;
  // 언어는 generators.charGenText 가 고른다. 판 고정 줄은 복사할 때 붙는다(requestBox).
  const { request, copied, row } = requestBox("char-gen");
  const update = (): void => { request.value = charGenText(what.value, Number(count.value)); copied.textContent = ""; };
  what.addEventListener("input", update);
  count.addEventListener("change", update);
  update();
  return stepBox(1, "무엇을 만들까요?", [
    el("div", { class: "workshop-form-row", children: [el("label", { class: "workshop-gen-grow", children: ["어떤 캐릭터", what] }), el("label", { children: ["몇 명", count] })] }),
    el("label", { class: "workshop-gen-request-label", children: ["내 AI 에이전트에게 보낼 부탁", request] }),
    row,
    // char-gen 저장소는 비공개가 됐다(2026-10-21, tiledata/gen-kits.lock.json) — 설치 링크는 받은 사람 말고는 404 라 내지 않는다.
    el("p", { class: "workshop-item-meta", text: "char-gen 을 설치한 내 AI 에이전트가 내 계정으로 그리고, 마지막 선택은 내가 해요. char-gen 은 아직 초대받은 사람만 설치할 수 있어요." }),
  ], "workshop-gen-step-request");
}

/**
 * 부탁 글 칸 + 복사 단추 — 에이전트에게 가는 글이라 화면 번역기가 건드리지 않게 한다(data-i18n-skip).
 * 글칸에는 사람이 읽는 부탁만 보이고, 「이 편집기가 맞춘 생성기 판」 줄(git 명령·커밋)은 복사할 때 붙는다 —
 * 사람에게 git 지시문을 들이밀지 않는다(2026-10-22, 공방 캐릭터 적대 검수). 복사한 글은 전과 같다.
 */
function requestBox(kit: "char-gen" | "tile-gen"): { request: HTMLTextAreaElement; copied: HTMLElement; row: HTMLElement; fullText(): string } {
  const request = el("textarea", {
    class: "workshop-gen-request", attrs: { readonly: "", rows: "3", "aria-label": "부탁 글", "data-i18n-skip": "" }, dataset: { testid: "workshop-gen-request" },
  }) as HTMLTextAreaElement;
  const pin = generatorPinLine(kit);
  const fullText = (): string => request.value + pin;
  const copied = el("span", { class: "workshop-item-meta", attrs: { role: "status" } });
  const copy = el("button", {
    text: "부탁 글 복사", attrs: { type: "button" }, dataset: { testid: "workshop-gen-copy" },
    on: {
      click: () => {
        void navigator.clipboard?.writeText(fullText()).then(
          () => { copied.textContent = "복사했어요. 내 AI 에이전트(터미널)에 붙여 넣으세요."; },
          () => { request.value = fullText(); request.select(); copied.textContent = "복사하지 못했어요. 글을 직접 골라 복사해 주세요."; },
        );
      },
    },
  });
  // 판 고정 줄은 단추 풀이말(title)로만 알린다 — 커밋 번호를 화면 글로 내지 않는다.
  if (pin) copy.title = `복사하면 끝에 이 편집기가 맞춘 생성기 판이 붙어요:${pin}`;
  return { request, copied, fullText, row: el("div", { class: "workshop-form-actions", children: [copy, copied] }) };
}

/** 지금 맵의 칩셋(바탕 시트) — tile-gen 이 색을 잠글 타일셋 파일. 맵이 없으면 null. */
function currentMapTileset(): { id: string; name: string; fileName: string } | null {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId;
  const tilesetId = mapId ? project.maps[mapId]?.tilesetId : undefined;
  const tileset = tilesetId ? project.tilesets[tilesetId] : undefined;
  if (!tilesetId || !tileset) return null;
  const safe = tilesetId.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 60) || "tileset";
  return { id: tilesetId, name: tileset.name, fileName: `${safe}.png` };
}

/** tile-gen ① — 지형 종류·무엇·참고 칸 + 지금 맵 칩셋 그림 받기 → 부탁 글. */
function terrainRequestStep(): HTMLElement {
  const target = currentMapTileset();
  const mode = el("select", {
    attrs: { "aria-label": "지형 종류" }, dataset: { testid: "workshop-gen-terrain-mode" },
    // optgroup label 은 DOM 번역기가 보지 않는 속성이라 t() 로 직접 옮긴다.
    // 종류 다섯 + 그 종류에 재질 지시가 붙은 프리셋(용암·눈·돌길 …). 값은 그대로 `--mode` 로 간다.
    children: [
      el("optgroup", { attrs: { label: t("종류") }, children: TERRAIN_MODES.map((m) => el("option", { value: m.mode, text: m.label })) }),
      el("optgroup", { attrs: { label: t("재질 프리셋") }, children: TERRAIN_PRESETS.map((m) => el("option", { value: m.mode, text: m.label })) }),
    ],
  }) as HTMLSelectElement;
  const what = el("input", { attrs: { type: "text", placeholder: TERRAIN_MODES[0]!.example, "aria-label": "어떤 지형" }, dataset: { testid: "workshop-gen-what" } }) as HTMLInputElement;
  const ref = el("input", { attrs: { type: "text", placeholder: "예: 0,3", inputmode: "numeric", "aria-label": "참고 칸" }, dataset: { testid: "workshop-gen-ref" } }) as HTMLInputElement;
  const { request, copied, row } = requestBox("tile-gen");
  const update = (): void => {
    const chosen = [...TERRAIN_MODES, ...TERRAIN_PRESETS].find((m) => m.mode === mode.value) ?? TERRAIN_MODES[0]!;
    what.placeholder = chosen.example;
    request.value = tileGenText(chosen.mode, what.value, target?.fileName ?? "tileset.png", ref.value);
    copied.textContent = "";
  };
  mode.addEventListener("change", update);
  for (const input of [what, ref]) input.addEventListener("input", update);
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
  return stepBox(1, "어떤 지형을 만들까요?", [
    el("div", {
      class: "workshop-form-row",
      children: [
        el("label", { children: ["종류", mode] }),
        el("label", { class: "workshop-gen-grow", children: ["어떤 지형", what] }),
        el("label", { class: "workshop-gen-ref", children: ["참고 칸(선택)", ref] }),
      ],
    }),
    el("p", {
      class: "workshop-item-meta", dataset: { testid: "workshop-gen-tileset" },
      text: target ? `색은 지금 맵 칩셋 「${target.name}」에서 가져와요. 아래 단추로 그 그림을 받아 두세요. 참고 칸은 그 그림에서 비슷한 땅 칸의 위치(가로,세로)예요.` : "열린 맵이 없어요. 칩셋 그림을 받으려면 그릴 맵을 먼저 열어 주세요.",
    }),
    ...(download ? [el("div", { class: "workshop-form-actions", children: [download, status] })] : []),
    request,
    row,
    el("p", { class: "workshop-item-meta", text: "처음이면 tile-gen 을 내 컴퓨터에 설치하고 내 AI 에이전트에 연결하세요. 그림은 내 계정으로만 만들고, 후보는 내가 직접 골라요." }),
  ], "workshop-gen-step-request");
}

/** 미리 보기 크기: 작은 도트는 정수 배율(최대 4배, 상자 안), 상자보다 큰 그림은 상자에 맞게 줄인다. 잘라 보이지 않는다. */
function fitPreview(img: HTMLImageElement, boxW = 360, boxH = 220): void {
  const w = Math.max(1, img.naturalWidth), h = Math.max(1, img.naturalHeight);
  const fit = Math.min(boxW / w, boxH / h);
  if (fit >= 1) {
    const k = Math.min(4, Math.floor(fit));
    img.style.width = `${w * k}px`;
  } else {
    img.style.width = `${Math.round(w * fit)}px`;
    img.style.imageRendering = "auto";
  }
}

/** 끌어 놓은 항목에서 파일을 모은다 — 폴더면 하위 폴더까지(묶음은 blobs/ 안에 그림이 있다). 너무 큰 폴더는 자른다. */
async function filesFromDrop(transfer: DataTransfer): Promise<File[]> {
  const entries = [...transfer.items].map((item) => item.webkitGetAsEntry?.() ?? null).filter((entry): entry is FileSystemEntry => entry !== null);
  if (entries.length === 0) return [...transfer.files];
  const out: File[] = [];
  const walk = async (entry: FileSystemEntry, depth: number): Promise<void> => {
    if (out.length >= 4000) return;
    if (entry.isFile) {
      out.push(await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject)));
    } else if (entry.isDirectory && depth < 4) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (batch.length === 0) break;
        for (const child of batch) await walk(child, depth + 1);
      }
    }
  };
  for (const entry of entries) await walk(entry, 0);
  return out;
}

/** 넣은 지형 칩셋의 자동 타일 묶음 수(가져오기가 autotileGroups 를 보존했는지 사람에게도 보인다). */
function autotileCount(tilesetIds: readonly string[]): number {
  const tilesets = store.getCurrent().tilesets;
  return tilesetIds.reduce((sum, id) => sum + (tilesets[id]?.autotileGroups?.length ?? 0), 0);
}

/**
 * char-gen 사진으로 만들기 — 사진 한 장 → 호스트가 고정판 char-gen `photo` 를 사용자 CLI 로 돌려 후보(걷기 GIF·검사)를 낸다 →
 * 사람이 하나 고른다 → 호스트가 그 칩만 묶는다 → 가져오기 칸의 「이 게임에 넣기」. 새로 그리지 않고 RTP 머리·몸을 다시 칠한
 * 종이 인형이다. 사진은 호스트 작업 폴더에만 있고 게임에는 들어가지 않는다.
 */
function photoStep(showPack: (pack: LocalPack) => void): HTMLElement {
  const status = el("p", { class: "workshop-gen-status", attrs: { role: "status", "aria-live": "polite" }, dataset: { testid: "workshop-gen-photo-status" } });
  const picks = el("div", { class: "workshop-photo-picks", dataset: { testid: "workshop-gen-photo-picks" } });
  const thumb = el("img", { class: "workshop-photo-thumb", attrs: { alt: "고른 사진", hidden: "" } }) as HTMLImageElement;
  const file = el("input", { attrs: { type: "file", accept: "image/jpeg,image/png,image/webp", hidden: "" }, dataset: { testid: "workshop-gen-photo-file" } }) as HTMLInputElement;
  const name = el("input", { attrs: { type: "text", placeholder: "예: 빨간 가디건의 소녀", "aria-label": "캐릭터 이름" }, dataset: { testid: "workshop-gen-photo-name" } }) as HTMLInputElement;
  let photo = "";
  let jobId = "";
  let polling = false;
  const choose = el("button", { text: "사진 고르기", attrs: { type: "button" }, dataset: { testid: "workshop-gen-photo-choose" }, on: { click: () => file.click() } });
  const start = el("button", { class: "workshop-primary", text: "후보 만들기", attrs: { type: "button", disabled: "" }, dataset: { testid: "workshop-gen-photo-start" } }) as HTMLButtonElement;
  const setStatus = (text: string, kind: "" | "is-error" | "is-done" = ""): void => {
    status.classList.remove("is-error", "is-done");
    if (kind) status.classList.add(kind);
    status.textContent = text;
  };
  file.addEventListener("change", () => {
    const chosen = file.files?.[0];
    file.value = "";
    if (!chosen) return;
    if (chosen.size > 12 * 1024 * 1024) { setStatus("사진이 너무 커요(12MB 까지).", "is-error"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      photo = String(reader.result ?? "");
      thumb.src = photo;
      thumb.hidden = false;
      start.disabled = false;
      clearChildren(picks);
      setStatus("");
    };
    reader.onerror = () => setStatus("사진을 읽지 못했어요.", "is-error");
    reader.readAsDataURL(chosen);
  });

  /** 호스트 작업을 기다린다 — 후보가 나오면(picking) 고르기, 묶음이 나오면(done) 가져오기 칸으로. */
  const poll = async (): Promise<void> => {
    if (polling) return;
    polling = true;
    const { hostGenStatus, packFromHost } = await import("./oneClick/hostGen");
    try {
      for (let wait = 2000; jobId; wait = Math.min(5000, wait + 500)) {
        await new Promise((done) => setTimeout(done, wait));
        if (!host || !jobId) return;
        const st = await hostGenStatus(jobId);
        if (st.state === "running") {
          const left = st.expectMs && st.elapsedMs !== undefined ? Math.max(1, Math.round((st.expectMs - st.elapsedMs) / 60000)) : 0;
          setStatus(st.stage === "packing" ? "고른 캐릭터를 묶는 중…" : left ? `사진에 맞는 머리·몸을 고르고 색을 칠하는 중… (약 ${left}분 남음)` : "사진에 맞는 머리·몸을 고르고 색을 칠하는 중…");
          continue;
        }
        if (st.state === "picking" && st.photoCandidates) { showCandidates(st.photoCandidates); start.disabled = !photo; return; }
        if (st.state === "done" && st.pack) {
          const pack = await packFromHost(st.pack, "사진으로 만들기");
          setStatus("묶었어요. 아래 「이 게임에 넣기」를 눌러 넣어요.", "is-done");
          showPack(pack);
          return;
        }
        setStatus(st.error ?? "만들지 못했어요. 다시 해 주세요.", "is-error");
        start.disabled = !photo;
        return;
      }
    } catch (error) {
      setStatus(`만들지 못했어요: ${error instanceof Error ? error.message : String(error)}`, "is-error");
      start.disabled = !photo;
    } finally {
      polling = false;
    }
  };

  const showCandidates = (list: readonly import("./oneClick/hostGen").HostPhotoCandidate[]): void => {
    clearChildren(picks);
    setStatus(`후보 ${list.length}명이에요. 마음에 드는 하나를 골라 주세요. 눈이 자연스럽고 오류 없는 것이 앞에 있어요.`);
    for (const c of list) {
      const pick = el("button", {
        class: "workshop-primary", text: "이 캐릭터로", attrs: { type: "button" }, dataset: { testid: "workshop-gen-photo-pick", rank: String(c.rank) },
        on: {
          click: () => {
            for (const b of picks.querySelectorAll("button")) (b as HTMLButtonElement).disabled = true;
            card.classList.add("is-picked");
            setStatus("고른 캐릭터를 묶는 중…");
            void import("./oneClick/hostGen").then(({ pickHostGen }) => pickHostGen(jobId, c.rank, name.value.trim() || t("사진 속 사람")))
              .then(() => poll(), (error: unknown) => {
                for (const b of picks.querySelectorAll("button")) (b as HTMLButtonElement).disabled = false;
                card.classList.remove("is-picked");
                setStatus(`고르지 못했어요: ${error instanceof Error ? error.message : String(error)}`, "is-error");
              });
          },
        },
      });
      const badge = c.passed === null ? null
        : el("span", { class: "workshop-chip" + (c.passed ? " is-ok" : " is-warn"), text: c.passed ? "검사 통과" : `오류 ${c.errors ?? 0}건` });
      const card = el("figure", {
        class: "workshop-photo-card", dataset: { testid: "workshop-gen-photo-card" },
        children: [
          el("span", { class: "workshop-photo-rank", text: String(c.rank) }),
          el("img", { attrs: { src: c.gif, alt: `후보 ${c.rank}` } }),
          el("figcaption", {
            children: [
              ...(badge ? [badge] : []),
              ...(c.eyes !== null ? [el("span", { class: "workshop-item-meta", text: `눈 ${Math.round(c.eyes * 10) / 10}위` })] : []),
              pick,
            ],
          }),
        ],
      });
      picks.append(card);
    }
  };

  start.addEventListener("click", () => {
    if (!photo) return;
    start.disabled = true;
    clearChildren(picks);
    setStatus("호스트에 보내는 중…");
    void import("./oneClick/hostGen").then(({ startHostGen }) => startHostGen({ generator: "char-gen", mode: "photo", photo, text: name.value.trim() || t("사진 속 사람") }))
      .then((id) => { jobId = id; return poll(); }, (error: unknown) => {
        start.disabled = false;
        setStatus(`시작하지 못했어요: ${error instanceof Error ? error.message : String(error)}`, "is-error");
      });
  });

  return stepBox(0, "사진으로 만들기", [
    el("p", { class: "workshop-item-meta", text: "사람 사진 한 장을 고르면, 내 컴퓨터의 AI 에이전트가 사진 속 사람에 맞는 머리·몸을 골라 색을 칠한 후보를 몇 명 만들어요. 그중 하나를 내가 골라요. 사진은 내 컴퓨터에만 있고 게임에는 들어가지 않아요." }),
    el("div", { class: "workshop-form-row", children: [el("div", { class: "workshop-photo-pick-file", children: [choose, file, thumb] }), el("label", { class: "workshop-gen-grow", children: ["이름(선택)", name] })] }),
    el("div", { class: "workshop-form-actions", children: [start] }),
    status,
    picks,
  ], "workshop-gen-step-photo");
}

function importStep(generator: LocalGenerator, n: number): { box: HTMLElement; show: (pack: LocalPack) => void } {
  const status = el("p", { class: "workshop-gen-status", attrs: { role: "status", "aria-live": "polite" }, dataset: { testid: "workshop-gen-status" } });
  const result = el("div", { class: "workshop-gen-result", dataset: { testid: "workshop-gen-result" } });
  const picker = el("input", { attrs: { type: "file", multiple: "", webkitdirectory: "", hidden: "" }, dataset: { testid: "workshop-gen-folder" } }) as HTMLInputElement;
  let current: LocalPack | null = null;
  /** 읽은 묶음은 공방 작업 줄에 「넣을 차례」로 선다 — 창을 닫거나 새로 고쳐도 작업 줄에서 넣을 수 있다. */
  let currentJob: Promise<string> | null = null;

  const show = (pack: LocalPack): void => {
    currentJob = workshopQueue().enqueuePack(pack, generator).then((job) => job.id);
    revokeLocalPackPreviews(previews);
    previews = localPackPreviews(pack);
    current = pack;
    stopCast?.();
    stopCast = null;
    const members = packCast(pack.manifest, pack.blobs);
    const cast = members.length ? castLineup(members) : null;
    stopCast = cast?.dispose ?? null;
    const castCount = members.length;
    const portraitCount = members.reduce((sum, member) => sum + member.portraits, 0);
    clearChildren(result);
    const add = el("button", {
      class: "workshop-primary", text: "이 게임에 넣기", attrs: { type: "button" }, dataset: { testid: "workshop-gen-add" },
      on: {
        click: () => {
          if (!current) return;
          add.disabled = true;
          status.classList.remove("is-error");
          status.textContent = "넣는 중…";
          (currentJob ?? Promise.reject(new Error("묶음을 다시 골라 주세요.")))
            .then(async (jobId) => {
              const outcome = await workshopQueue().install(jobId, null);
              if (outcome === "waiting") {
                status.textContent = "조수가 일하는 중이라, 끝나면 작업 줄이 바로 넣어요.";
                return null;
              }
              const installed = workshopQueue().snapshot().jobs.find((view) => view.job.id === jobId)?.job.installed;
              return installed?.kind === "pack" ? { title: installed.title, tilesetIds: installed.tilesetIds } : null;
            })
            .then(
            (added) => {
              if (!added) return;
              add.textContent = "넣었어요 ✓";
              add.classList.add("is-done");
              status.classList.add("is-done");
              status.textContent = generator === "char-gen"
                ? `「${added.title}」을(를) 넣었어요. 자료집의 캐릭터 그림 고르기에서 쓸 수 있어요. 되돌리기로 뺄 수 있어요.`
                : generator === "tile-gen"
                  ? `「${added.title}」을(를) 넣었어요. 타일셋 목록에 새 지형 칩셋으로 들어갔어요(자동 타일 ${autotileCount(added.tilesetIds)}벌). 그 칩셋을 쓰는 맵에서 칠할 수 있어요. 되돌리기로 뺄 수 있어요.`
                  : `「${added.title}」을(를) 넣었어요. 타일셋 목록에 새 칩셋으로 들어갔고 조수도 쓸 수 있어요. 되돌리기로 뺄 수 있어요.`;
              // 미리 보기 아래라 화면 밖일 수 있다 — 결과 글이 보이게 내린다.
              status.scrollIntoView({ block: "nearest" });
            },
            (error: unknown) => { add.disabled = false; status.classList.add("is-error"); status.textContent = `넣지 못했어요: ${error instanceof Error ? error.message : String(error)}`; },
          );
        },
      },
    }) as HTMLButtonElement;
    result.append(
      el("div", {
        class: "workshop-gen-pack-head",
        children: [
          el("strong", { text: pack.manifest.title, attrs: { translate: "no" } }),
          ...(pack.manifest.aiGenerated ? [el("span", { class: "workshop-chip", text: "AI 생성" })] : []),
          el("span", { class: "workshop-chip", text: cast ? `${castCount}명` : `그림 ${previews.length}장` }),
        ],
      }),
      // 라이선스·출처(생성기·바탕 그림 저작자)는 접어 둔다 — 넣으면 프로젝트 출처 기록에 그대로 남는다.
      el("details", {
        class: "workshop-gen-source", dataset: { testid: "workshop-gen-source" },
        children: [
          el("summary", { text: "출처·라이선스" }),
          el("p", { class: "workshop-gen-credits", attrs: { translate: "no" }, text: [pack.manifest.license, pack.manifest.credits].filter(Boolean).join(" · ") }),
        ],
      }),
      // 사람 묶음(content.characters)은 사람 하나에 한 칸 — 걷는 앞모습(정수 배율) + 짝 얼굴. 시트를 통째로 흐리게 줄여 보이지 않는다.
      ...(cast ? [cast.root, el("p", { class: "workshop-item-meta workshop-cast-files", text: `사람 ${castCount}명 · 그림 파일 ${previews.length}장(걷는 칩 시트${portraitCount ? `, 얼굴·초상 ${portraitCount}장` : ""})이 함께 들어가요.` })] : [
        // 그림이 많으면(물건·지형 묶음) 같은 크기 칸 11개 + 「나머지 N장」 — 칸 안에 통째로 보이고 잘리지 않는다.
        // 한두 장이면 크게 한 장씩.
        el("div", {
          class: "workshop-gen-previews" + (previews.length > 2 ? " is-grid" : ""),
          children: previews.length
            ? [
              ...(previews.length > 12 ? previews.slice(0, 11) : previews).map((preview) => el("figure", {
                children: [el("div", {
                  class: "workshop-gen-preview-art",
                  children: [el("img", {
                    attrs: { src: preview.url, alt: preview.name },
                    on: { load: (event) => (previews.length > 2 ? fitPreview(event.target as HTMLImageElement, 128, 104) : fitPreview(event.target as HTMLImageElement)) },
                  })],
                }), el("figcaption", { attrs: { translate: "no", title: preview.name }, text: preview.name })],
              })),
              ...(previews.length > 12 ? [el("figure", { class: "is-more", children: [el("div", { class: "workshop-gen-preview-art", text: `+${previews.length - 11}` }), el("figcaption", { text: `나머지 ${previews.length - 11}장도 같이 들어가요` })] })] : []),
            ]
            : [el("p", { class: "workshop-item-meta", text: "미리 볼 그림이 없어요." })],
        }),
      ]),
      el("div", { class: "workshop-gen-add-row", children: [add, el("span", { class: "workshop-item-meta", text: "이 게임에만 들어가요. 공용(스토어)에 올리려면 생성기에서 검사를 거쳐 올려 주세요." })] }),
      status,
    );
    drop.classList.add("is-compact");
  };

  const load = (files: File[]): void => {
    if (!files.length) return;
    status.classList.remove("is-error", "is-done");
    status.textContent = "묶음을 읽는 중…";
    readLocalPack(files).then(
      (pack) => { status.textContent = ""; show(pack); },
      (error: unknown) => { current = null; clearChildren(result); drop.classList.remove("is-compact"); drop.after(status); status.classList.add("is-error"); status.textContent = error instanceof Error ? error.message : String(error); },
    );
  };

  picker.addEventListener("change", () => {
    const files = [...(picker.files ?? [])];
    picker.value = "";
    load(files);
  });

  const drop = el("button", {
    class: "workshop-drop", attrs: { type: "button" }, dataset: { testid: "workshop-gen-pick-folder" },
    children: [
      el("strong", { text: "묶음 폴더를 여기에 끌어 놓으세요" }),
      el("span", { class: "workshop-drop-or", text: "또는 눌러서 폴더 고르기" }),
      el("span", { class: "workshop-drop-hint", text: `${generator} 가 마지막에 만든 묶음 폴더를 통째로 넣어요.` }),
      el("span", { class: "workshop-drop-again", text: "다른 묶음 폴더를 끌어 놓거나 눌러서 고르기" }),
    ],
    on: {
      click: () => picker.click(),
      dragover: (event) => { event.preventDefault(); (event as DragEvent).dataTransfer!.dropEffect = "copy"; drop.classList.add("is-over"); },
      dragleave: () => drop.classList.remove("is-over"),
      drop: (event) => {
        event.preventDefault();
        drop.classList.remove("is-over");
        const transfer = (event as DragEvent).dataTransfer;
        if (!transfer) return;
        status.textContent = "묶음을 읽는 중…";
        filesFromDrop(transfer).then(load, (error: unknown) => { status.classList.add("is-error"); status.textContent = `폴더를 읽지 못했어요: ${error instanceof Error ? error.message : String(error)}`; });
      },
    },
  });

  const box = stepBox(n, "다 만든 묶음 가져오기", [drop, picker, status, result], "workshop-gen-step-import");
  return { box, show: (pack) => { status.classList.remove("is-error", "is-done"); status.textContent = ""; show(pack); box.scrollIntoView({ block: "nearest" }); } };
}
