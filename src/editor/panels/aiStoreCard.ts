// editor/panels/aiStoreCard.ts
// 조수의 스토어 도구(storeTools.ts)가 돌려준 질문·제안을 턴이 끝난 뒤 카드로 보여 준다. 위키: openwiki/asset-store.md 「조수와 스토어」.
// - ask_missing_tiles: 무엇이 없는지 + 스토어 검색 결과(넣기) + 직접 그려 줘 / 있는 타일로 해 줘
//   「직접 그려 줘」는 지금 맵이 손 도트 실내 칩셋이면 공방(실내 기물)을 새 기물 폼을 채워 연다 — 사용자가 고르고
//   「프로젝트 칩셋에 넣기」를 누르면(WORKSHOP_BAKED_EVENT) 조수에게 물체 id 와 함께 원래 요청을 잇게 한다.
// - store_publish: 무엇을 어떤 조건으로 올리는지 + 권리 동의 + 올리기
// - store_set_visibility: 숨기기·다시 보이기
// 스토어에 쓰는 동작(넣기·올리기·숨기기)은 전부 사용자가 이 카드의 버튼을 눌렀을 때만 일어난다. 조수는 제안만 한다.

import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { STORE_KIND_LABELS, STORE_LICENSE_LABELS, type StoreItemKind, type StoreItemSummary } from "@/assetStore/format";
import { addStoreItemToProject } from "@/editor/assetStore/storeApply";
import { fillStoreImage, storeBridge, storeFailure } from "@/editor/assetStore/storeBridge";
import { buildUploadPack, uploadCandidates } from "@/editor/assetStore/storeUpload";
import { editorState } from "@/editor/editorState";
import { WORKSHOP_BAKED_EVENT, type WorkshopBakedDetail } from "@/editor/workshop/workshopEvents";
import { ATLAS_BIOME_INTERIOR_ID } from "@/project/defaults/atlasBiomeInterior";
import { isStoreCardRequest, type MissingTilesQuestion, type StoreCardRequest, type StorePublishProposal, type StoreVisibilityProposal } from "@/editor/tools/storeTools";
import { getLocale } from "@/i18n";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";

const STORE_CARD_TOOLS: ReadonlySet<string> = new Set(["ask_missing_tiles", "store_publish", "store_set_visibility"]);

/** Pi 이벤트(팀 모드의 agent_event 포장 포함)에서 스토어 카드 요청을 꺼낸다. */
export function storeCardFromEvent(raw: PiAgentEvent): StoreCardRequest | null {
  let event = raw;
  while (event.type === "agent_event") event = event.event;
  if (event.type !== "tool_end" || !STORE_CARD_TOOLS.has(event.name) || !event.ok) return null;
  const data = (event.result as { data?: unknown } | undefined)?.data;
  return isStoreCardRequest(data) ? data : null;
}

/** 카드가 끝났을 때 조수에게 보낼 후속 요청(없으면 보내지 않는다). */
export type StoreCardFollowUp = (text: string) => void;

const locale = () => {
  const value = getLocale();
  return value === "en" || value === "ja" || value === "zh" ? value : "ko";
};

function shell(eyebrow: string, title: string, testid: string, body: (HTMLElement | null)[], footer: HTMLElement[]): { root: HTMLElement; status: HTMLElement } {
  const status = el("p", { class: "ai-tileset-change-status", attrs: { role: "status" } });
  const root = el("section", {
    class: "ai-tileset-change-card ai-store-card",
    dataset: { testid },
    attrs: { "aria-label": title },
    children: [
      el("span", { class: "ai-tileset-change-eyebrow", text: eyebrow }),
      el("h3", { text: title }),
      ...body.filter((node): node is HTMLElement => node !== null),
      status,
      el("footer", { children: footer }),
    ],
  });
  return { root, status };
}

function button(text: string, testid: string, onClick: () => void, primary = false): HTMLButtonElement {
  return el("button", { text, class: primary ? "is-primary" : "", attrs: { type: "button" }, dataset: { testid }, on: { click: onClick } });
}

/** 지금 맵이 손 도트 실내 칩셋이면 공방(실내 기물)에서 그려 칩셋에 넣을 수 있다. */
function drawsInWorkshop(): boolean {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId;
  return (mapId ? project.maps[mapId]?.tilesetId : undefined) === ATLAS_BIOME_INTERIOR_ID;
}

/** 공방을 새 기물 폼을 채워 열고, 사용자가 칩셋에 넣으면 한 번 조수에게 잇게 한다. */
function openWorkshopFor(question: MissingTilesQuestion, status: HTMLElement, followUp: StoreCardFollowUp): void {
  status.textContent = "공방을 열었어요. 후보를 뽑아 하나 고르고 「프로젝트 칩셋에 넣기」를 누르면 조수가 이어서 놓아요.";
  const onBaked = (event: Event): void => {
    window.removeEventListener(WORKSHOP_BAKED_EVENT, onBaked);
    const baked = (event as CustomEvent<WorkshopBakedDetail>).detail;
    status.textContent = `「${baked.title}」을(를) 칩셋에 넣었어요. 조수가 이어서 놓을게요.`;
    followUp(`[사용자가 공방에서 그려 넣음] 「${baked.title}」 물체 id ${baked.objectId} (${baked.columns}×${baked.rows}칸, 칩셋 ${baked.tilesetId}). `
      + `원래 요청을 이어서 하라: ${question.need} 실내를 새로 짓거나 다시 지으면 build_hand_interior_room 의 objects[].id 에, 이미 있는 맵에 더하면 stamp_tileset_object 의 objectId 에 이 id 를 넣어라.`);
  };
  window.addEventListener(WORKSHOP_BAKED_EVENT, onBaked);
  void import("@/editor/workshop/workshopWorkspace")
    .then(({ openWorkshop }) => openWorkshop("interior-props", { newItem: { title: question.query, description: question.need } }))
    .catch((error: unknown) => {
      window.removeEventListener(WORKSHOP_BAKED_EVENT, onBaked);
      status.textContent = `공방을 열지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
    });
}

function missingTilesCard(question: MissingTilesQuestion, followUp: StoreCardFollowUp): HTMLElement {
  const results = el("div", { class: "ai-store-results", dataset: { testid: "ai-store-results" } });
  const all: HTMLButtonElement[] = [];
  let settled = false;
  const lock = (locked: boolean): void => { for (const node of all) node.disabled = locked; };
  const settle = (text: string): void => {
    settled = true;
    lock(true);
    view.status.textContent = text;
  };
  const draw = button("직접 그려 줘", "ai-store-draw", () => {
    if (settled) return;
    if (drawsInWorkshop()) {
      openWorkshopFor(question, view.status, followUp);
      settled = true;
      lock(true);
      return;
    }
    settle("직접 그리는 쪽으로 이어 갈게요.");
    followUp(`[사용자 선택] 스토어 것 말고 직접 그리기: ${question.need} 직접 그릴 수 있는 길이 있으면 그 길로 가고, 없으면 그렇다고 솔직히 말한 뒤 있는 타일로 가장 가까운 대안을 만들어라.`);
  });
  const existing = button("있는 타일로 해 줘", "ai-store-existing", () => {
    if (settled) return;
    settle("지금 프로젝트에 있는 타일로 만들게요.");
    followUp(`[사용자 선택] 있는 타일로 대신: ${question.need} 프로젝트에 있는 타일로 가장 가까운 모습을 만들고, 무엇이 빠졌는지 짧게 말하라.`);
  });
  all.push(draw, existing);
  const view = shell("답변 필요", "필요한 타일이 없어요", "ai-store-missing-card", [
    el("p", { class: "ai-tileset-change-reason", text: question.need }),
    el("p", { class: "ai-tileset-change-detail", text: `스토어에서 ${question.query ? `「${question.query}」을(를) ` : ""}찾아봤어요. 마음에 드는 게 있으면 넣고, 없으면 아래에서 골라 주세요.` }),
    results,
  ], [draw, existing]);

  const install = async (item: StoreItemSummary): Promise<void> => {
    if (settled) return;
    lock(true);
    view.status.textContent = `「${item.title}」을(를) 넣는 중…`;
    try {
      const added = await addStoreItemToProject(item.slug);
      settle(`「${added.title}」을(를) 프로젝트에 넣었어요.`);
      const tilesets = added.tilesetIds.length ? ` 타일셋 id: ${added.tilesetIds.join(", ")}.` : "";
      followUp(`[사용자가 스토어에서 넣음] 「${added.title}」.${tilesets} 원래 요청을 이어서 하라: ${question.need} 타일셋은 쓰기 전에 참고문서부터 읽어라.`);
    } catch (error) {
      lock(false);
      view.status.textContent = `넣지 못했어요: ${storeFailure(error).message}`;
    }
  };

  const bridge = storeBridge();
  if (!bridge) {
    results.append(el("p", { class: "ai-store-empty", text: "스토어는 데스크톱 앱에서만 찾을 수 있어요." }));
    return view.root;
  }
  results.append(el("p", { class: "ai-store-empty", text: "스토어에서 찾는 중…" }));
  void bridge.catalog({ q: question.query, kind: question.itemKind, lang: locale() })
    .then((page) => {
      clearChildren(results);
      const items = page.items.slice(0, 4);
      if (!items.length) {
        results.append(el("p", { class: "ai-store-empty", dataset: { testid: "ai-store-none" }, text: "스토어에도 맞는 게 없어요. 직접 그리거나 있는 타일로 만들 수 있어요." }));
        return;
      }
      for (const item of items) {
        const add = button("넣기", "ai-store-add", () => void install(item), true);
        all.push(add);
        if (settled) add.disabled = true;
        results.append(el("article", {
          class: "ai-store-result",
          dataset: { slug: item.slug },
          children: [
            fillStoreImage(el("img", { attrs: { alt: "", loading: "lazy" } }), item.cover),
            el("div", { class: "ai-store-result-text", children: [
              el("strong", { text: item.title }),
              el("span", { text: [STORE_KIND_LABELS[item.kind as StoreItemKind] ?? item.kind, item.author, item.grade === "pack" ? "조수 사용 가능" : ""].filter(Boolean).join(" · ") }),
              item.summary ? el("small", { text: item.summary }) : null,
            ].filter((node): node is HTMLElement => node !== null) }),
            add,
          ],
        }));
      }
    })
    .catch((error: unknown) => {
      clearChildren(results);
      results.append(el("p", { class: "ai-store-empty", text: `스토어를 찾지 못했어요: ${storeFailure(error).message}` }));
    });
  return view.root;
}

/** 로그인이 안 됐으면 로그인 버튼을 보여 주고, 로그인되면 onReady 를 부른다. */
async function ensureLogin(status: HTMLElement, holder: HTMLElement, onReady: () => void): Promise<void> {
  const bridge = storeBridge()!;
  if ((await bridge.status()).loggedIn) return onReady();
  status.textContent = "스토어에 로그인해야 해요. 브라우저에서 허락하면 이어서 할 수 있어요.";
  const login = button("스토어 로그인", "ai-store-login", () => {
    login.disabled = true;
    void bridge.login().catch((error: unknown) => { status.textContent = storeFailure(error).message; login.disabled = false; });
  });
  holder.prepend(login);
  const off = bridge.onChanged(async (event) => {
    if (event.kind !== "auth" || !(await bridge.status()).loggedIn) return;
    off();
    login.remove();
    status.textContent = "";
    onReady();
  });
}

function publishCard(proposal: StorePublishProposal): HTMLElement {
  const project = store.getCurrent();
  const candidates = new Map(uploadCandidates(project).map((candidate) => [candidate.id, candidate]));
  const picked = [...proposal.tilesetIds, ...proposal.assetIds];
  const blocked = picked.map((id) => ({ id, reason: candidates.get(id)?.blocked ?? (candidates.has(id) ? null : "올릴 수 있는 목록에 없습니다.") })).filter((row) => row.reason);
  const ok = picked.filter((id) => !blocked.some((row) => row.id === id));
  const tilesetIds = proposal.tilesetIds.filter((id) => ok.includes(id));
  const assetIds = proposal.assetIds.filter((id) => ok.includes(id));
  const agree = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "ai-store-agree" } });
  const upload = button(proposal.targetSlug ? "새 판본으로 올리기" : "스토어에 올리기", "ai-store-upload", () => void run(), true);
  const cancel = button("올리지 않기", "ai-store-cancel", () => { done("올리지 않았어요."); });
  upload.disabled = true;
  agree.addEventListener("change", () => { upload.disabled = !agree.checked || ok.length === 0; });
  const nameOf = (id: string) => project.tilesets[id]?.name ?? project.assets.uploaded[id]?.name ?? id;
  const view = shell("확인 필요", proposal.targetSlug ? "새 판본을 올릴까요?" : "스토어에 올릴까요?", "ai-store-publish-card", [
    el("dl", { class: "ai-store-facts", children: [
      ["제목", proposal.title], ["소개", proposal.summary], ["종류", STORE_KIND_LABELS[proposal.itemKind as StoreItemKind] ?? proposal.itemKind],
      ["라이선스", STORE_LICENSE_LABELS[proposal.license]], ["AI 생성", proposal.aiGenerated ? "AI 도구로 만든 부분이 있음" : "전부 직접 만듦"],
      ["올릴 것", ok.map(nameOf).join(", ") || "없음"], ...(proposal.tags.length ? [["태그", proposal.tags.join(", ")]] : []),
    ].flatMap(([term, value]) => [el("dt", { text: term! }), el("dd", { text: value! })]) }),
    blocked.length ? el("p", { class: "ai-tileset-change-detail", text: `빼는 것: ${blocked.map((row) => `${nameOf(row.id)} — ${row.reason}`).join(" / ")}` }) : null,
    el("p", { class: "ai-tileset-change-detail", text: "올리면 누구나 스토어에서 보고 받을 수 있어요. 나중에 숨길 수 있지만, 이미 받은 사람의 프로젝트에서는 지워지지 않아요." }),
    el("label", { class: "ai-store-agree", children: [agree, el("span", { text: "이 그림·소리의 권리가 나에게 있고, 스토어 이용약관에 동의합니다." })] }),
  ], [cancel, upload]);
  const done = (text: string): void => {
    upload.disabled = true;
    cancel.disabled = true;
    agree.disabled = true;
    view.status.textContent = text;
  };
  const run = async (): Promise<void> => {
    if (!agree.checked || !ok.length) return;
    const bridge = storeBridge();
    if (!bridge) return done("스토어는 데스크톱 앱에서만 올릴 수 있어요.");
    upload.disabled = true;
    await ensureLogin(view.status, upload.parentElement!, async () => {
      try {
        view.status.textContent = "팩을 만드는 중…";
        const built = await buildUploadPack(store.getCurrent(), { tilesetIds, assetIds }, {
          title: proposal.title, summary: proposal.summary, description: proposal.description, tags: [...proposal.tags],
          kind: proposal.itemKind as StoreItemKind, license: proposal.license, aiGenerated: proposal.aiGenerated, credits: proposal.credits,
        });
        const off = bridge.onProgress((event) => { if (event.phase === "upload") view.status.textContent = `올리는 중 ${event.done}/${event.total}`; });
        try {
          const result = await bridge.upload({
            manifest: built.manifest, blobs: Object.fromEntries([...built.blobs].map(([sha, blob]) => [sha, blob.bytes])),
            ...(proposal.targetSlug ? { targetSlug: proposal.targetSlug } : {}),
          });
          done(result.status === "pending" ? `올렸어요. 운영자 확인 뒤 공개돼요(${result.slug}).` : `올렸어요. 지금 스토어에 공개됐어요(${result.slug}, 판본 ${result.version}).`);
        } finally {
          off();
        }
      } catch (error) {
        const failure = storeFailure(error);
        view.status.textContent = `올리지 못했어요: ${[failure.message, ...failure.details].join(" / ")}`;
        upload.disabled = !agree.checked;
      }
    });
  };
  if (!ok.length) done("올릴 수 있는 것이 없어요.");
  return view.root;
}

function visibilityCard(proposal: StoreVisibilityProposal): HTMLElement {
  const label = proposal.hidden ? "숨기기" : "다시 보이기";
  const apply = button(label, "ai-store-visibility-apply", () => void run(), true);
  const cancel = button("그대로 두기", "ai-store-visibility-cancel", () => finish("그대로 두었어요."));
  const view = shell("확인 필요", proposal.hidden ? "스토어에서 숨길까요?" : "스토어에 다시 보일까요?", "ai-store-visibility-card", [
    el("p", { class: "ai-tileset-change-reason", text: proposal.reason || `상품 ${proposal.slug}` }),
    el("p", { class: "ai-tileset-change-detail", text: proposal.hidden ? "숨기면 목록과 검색에서 사라져요. 이미 받은 사람의 프로젝트에는 그대로 남아요." : "다시 목록과 검색에 나와요." }),
  ], [cancel, apply]);
  const finish = (text: string): void => {
    apply.disabled = true;
    cancel.disabled = true;
    view.status.textContent = text;
  };
  const run = async (): Promise<void> => {
    const bridge = storeBridge();
    if (!bridge) return finish("스토어는 데스크톱 앱에서만 바꿀 수 있어요.");
    apply.disabled = true;
    await ensureLogin(view.status, apply.parentElement!, async () => {
      try {
        const result = await bridge.visibility({ slug: proposal.slug, hidden: proposal.hidden });
        finish(result.status === "hidden" ? "숨겼어요." : result.status === "visible" ? "다시 보이게 했어요." : `지금 상태: ${result.status}`);
      } catch (error) {
        view.status.textContent = `바꾸지 못했어요: ${storeFailure(error).message}`;
        apply.disabled = false;
      }
    });
  };
  return view.root;
}

export function createStoreCard(request: StoreCardRequest, followUp: StoreCardFollowUp): HTMLElement {
  if (request.kind === "store-missing-tiles") return missingTilesCard(request, followUp);
  if (request.kind === "store-publish-proposal") return publishCard(request);
  return visibilityCard(request);
}
