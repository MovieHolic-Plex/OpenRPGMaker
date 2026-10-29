// src/editor/assetStore/storeShare.ts
/**
 * 스토어 창 「내 에셋 나누기」 — 세 걸음 마법사: ① 고르기 → ② 자동 검사·소개 → ③ 미리보기·올리기.
 * 팩 만들기·제외 판정은 순수 계약(src/assetStore/pack.ts: packBlockedItems·StorePackBlockedError)을 그대로 쓴다.
 * 로그인은 마지막 걸음에서만 묻는다(고르고 확인하는 동안은 로그인 없이). 위키: openwiki/asset-store.md 「스토어 창 UX」.
 */
import type { MyStoreItem, StoreStatus } from "@/assetStore/bridgeTypes";
import { STORE_ITEM_KINDS, STORE_KIND_NAMES, STORE_LICENSES, type StoreItemKind, type StoreLicense } from "@/assetStore/format";
import { aiMadeAssets, closeSelection, packBlockedItems, StorePackBlockedError, type PackSelection } from "@/assetStore/pack";
import { getLocale, t } from "@/i18n";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { storeBridge, storeFailure, type StoreFailure } from "./storeBridge";
import { contentsSentence, licenseSentence } from "./storeText";
import { aiMadeNote, buildUploadPack, previewGrade, uploadCandidates, type UploadCandidate } from "./storeUpload";

export interface ShareHost {
  render(): void;
  status(): StoreStatus | null;
  mine(): readonly MyStoreItem[] | null;
  startLogin(): void;
  refreshMine(): void;
  openItem(slug: string): void;
  errorBanner(failure: StoreFailure, retry: (() => void) | null): HTMLElement;
}

type Step = 1 | 2 | 3;
interface ShareForm {
  step: Step;
  picked: Set<string>;
  title: string; titleTouched: boolean; summary: string; description: string; tags: string; credits: string;
  kind: StoreItemKind; license: StoreLicense; ai: "" | "yes" | "no"; target: string; agree: boolean;
  progress: string | null;
  result: { slug: string; status: string; version: number } | null;
  error: StoreFailure | null;
  problems: string[];
}

const blank = (): ShareForm => ({
  step: 1, picked: new Set(), title: "", titleTouched: false, summary: "", description: "", tags: "", credits: "",
  kind: "tileset", license: "OPRN-GAME", ai: "", target: "", agree: false, progress: null, result: null, error: null, problems: [],
});
let form: ShareForm = blank();

export function resetShare(): void {
  form = blank();
}

const DATA = { translate: "no" } as const;

function selectionOf(candidates: readonly UploadCandidate[]): PackSelection {
  return {
    tilesetIds: candidates.filter((c) => c.kind === "tileset" && form.picked.has(c.id)).map((c) => c.id),
    assetIds: candidates.filter((c) => c.kind === "asset" && form.picked.has(c.id)).map((c) => c.id),
  };
}

/** 고른 것에서 스토어 종류를 짐작한다(타일셋과 다른 것이 섞이면 묶음). */
function guessKind(project: Project, selection: PackSelection): StoreItemKind {
  const assetKinds = selection.assetIds.map((id) => project.assets.uploaded[id]?.kind ?? "");
  if (selection.tilesetIds.length > 0) return assetKinds.length > 0 ? "pack" : "tileset";
  const kinds = new Set(assetKinds.map((kind) => kind === "charset" ? "character" : kind === "faceset" ? "face"
    : kind.startsWith("battle") || kind === "monster" ? "battler" : kind === "music" ? "music" : kind === "sound" ? "sound" : "picture"));
  return kinds.size === 1 ? ([...kinds][0] as StoreItemKind) : "pack";
}

const kindName = (kind: StoreItemKind): string => STORE_KIND_NAMES[kind][getLocale()];

const SHARE_LICENSE_LABELS: Record<StoreLicense, string> = {
  "OPRN-GAME": "게임 안에서만 쓰게 하기 (추천)",
  "CC-BY-4.0": "이름만 적으면 누구나 쓰게 하기",
  "CC-BY-SA-4.0": "이름을 적고, 고친 것도 같은 조건으로 나누게 하기",
  "CC0": "아무 조건 없이 주기",
  "REFMAP-MODIFIED": "REFMAP 약관 그대로(고친 REFMAP 그림 전용)",
};

export function shareView(host: ShareHost): HTMLElement {
  const project = store.getCurrent();
  const candidates = uploadCandidates(project);
  const selection = selectionOf(candidates);
  const steps = el("ol", { class: "store-steps", dataset: { testid: "store-share-steps", step: String(form.step) }, children: (["고르기", "확인·소개", "미리보기·올리기"] as const).map((label, index) => el("li", {
    class: "store-step" + (form.step === index + 1 ? " is-on" : form.step > index + 1 ? " is-done" : ""),
    attrs: form.step === index + 1 ? { "aria-current": "step" } : {},
    children: [el("span", { class: "store-step-num", text: String(index + 1) }), el("span", { text: label })],
  })) });
  const intro = el("div", { class: "store-share-intro", children: [
    el("h3", { text: "내 에셋 나누기" }),
    el("p", { class: "store-hint", text: "내가 직접 만든 타일·캐릭터·소리를 다른 사람도 쓸 수 있게 스토어에 올려요. 세 걸음이면 끝나요." }),
    steps,
  ] });
  if (form.result) return el("div", { class: "store-share", children: [intro, resultCard(host)] });
  const body = form.step === 1 ? pickStep(host, candidates) : form.step === 2 ? checkStep(host, project, selection) : previewStep(host, project, selection);
  return el("div", { class: "store-share", dataset: { testid: "store-share" }, children: [intro, body] });
}

function nav(host: ShareHost, next: { label: string; enabled: boolean; go: () => void } | null): HTMLElement {
  return el("div", { class: "store-share-nav", children: [
    ...(form.step > 1 ? [el("button", { class: "store-button ghost", text: "← 앞으로", attrs: { type: "button" }, dataset: { testid: "store-share-back" }, on: { click: () => { form.step = (form.step - 1) as Step; form.problems = []; host.render(); } } })] : []),
    ...(next ? [el("button", {
      class: "store-button", text: next.label, attrs: { type: "button", ...(next.enabled ? {} : { disabled: "" }) }, dataset: { testid: "store-share-next" },
      on: { click: next.go },
    })] : []),
  ] });
}

function pickStep(host: ShareHost, candidates: readonly UploadCandidate[]): HTMLElement {
  const open = candidates.filter((c) => !c.blocked);
  const blocked = candidates.filter((c) => c.blocked);
  const reasons = new Map<string, number>();
  for (const c of blocked) reasons.set(c.blocked!, (reasons.get(c.blocked!) ?? 0) + 1);
  const row = (c: UploadCandidate) => el("label", {
    class: "store-pick-row" + (form.picked.has(c.id) ? " is-on" : ""), dataset: { testid: `store-upload-candidate-${c.id}` },
    children: [
      el("input", { attrs: { type: "checkbox", ...(form.picked.has(c.id) ? { checked: "" } : {}) }, on: { change: (event) => {
        if ((event.target as HTMLInputElement).checked) form.picked.add(c.id); else form.picked.delete(c.id);
        host.render();
      } } }),
      el("span", { class: "store-pick-name", attrs: DATA, text: c.name }),
      el("span", { class: "store-card-meta", text: c.detail }),
      ...(c.withReferences ? [el("span", { class: "store-badge pack", text: "깔기 안내 있음" })] : []),
    ],
  });
  return el("section", { class: "store-share-card", children: [
    el("h4", { text: "1. 나눌 것을 고르세요" }),
    el("p", { class: "store-hint", text: "타일셋을 고르면 그 그림과 깔기 안내가 함께 들어가요." }),
    open.length > 0
      ? el("div", { class: "store-pick", children: open.map(row) })
      : el("div", { class: "store-empty-card", dataset: { testid: "store-share-empty" }, children: [
        el("strong", { text: "아직 나눌 수 있는 내 그림이 없어요" }),
        el("p", { text: "직접 그리거나 불러온 타일셋·캐릭터·소리만 나눌 수 있어요. 공방에서 그리거나 리소스 관리자에서 내 그림을 불러온 뒤 다시 와 주세요." }),
      ] }),
    ...(blocked.length > 0 ? [el("details", { class: "store-pick-blocked", dataset: { testid: "store-upload-blocked" }, children: [
      el("summary", { text: `나눌 수 없는 것 ${blocked.length}개 — 편집기 기본 자료·스토어에서 받은 것·남이 만든 팩` }),
      el("ul", { class: "store-reason-list", children: [...reasons].map(([reason, count]) => el("li", { text: `${reason} (${count}개)` })) }),
    ] })] : []),
    nav(host, { label: "다음: 확인하기 →", enabled: form.picked.size > 0, go: () => {
      const sel = selectionOf(candidates);
      if (!form.titleTouched) form.title = candidates.find((c) => form.picked.has(c.id))?.name ?? "";
      form.kind = guessKind(store.getCurrent(), sel);
      form.step = 2;
      host.render();
    } }),
  ] });
}

function checkStep(host: ShareHost, project: Project, selection: PackSelection): HTMLElement {
  const blocked = packBlockedItems(project, selection);
  const aiMade = aiMadeAssets(project, selection);
  const grade = previewGrade(project, selection);
  const check = (ok: boolean | null, text: string, testid: string, extra: readonly HTMLElement[] = []) => el("li", {
    class: "store-check " + (ok === true ? "is-ok" : ok === false ? "is-bad" : "is-info"), dataset: { testid },
    children: [el("span", { class: "store-check-mark", attrs: { "aria-hidden": "true" }, text: ok === true ? "✓" : ok === false ? "✕" : "i" }), el("span", { children: [text, ...extra] })],
  });
  const checks = el("ul", { class: "store-checks", dataset: { testid: "store-share-checks" }, children: [
    blocked.length > 0
      ? check(false, "다른 사람이 만든 것이 함께 묶여 있어요. 이것들을 빼야 올릴 수 있어요:", "store-share-check-own", [el("ul", { class: "store-reason-list", children: blocked.map((item) => el("li", { children: [el("span", { attrs: DATA, text: item.id }), `: ${item.reason}`] })) })])
      : check(true, "내가 만든 것만 들어 있어요 (Rasak·REFMAP·RPG Maker MV·PAW 같은 남의 팩, 스토어에서 받은 것 없음)", "store-share-check-own"),
    check(true, "그림 크기가 스토어 규격에 맞아요", "store-share-check-size"),
    aiMade.length > 0
      ? check(null, aiMadeNote(aiMade), "store-upload-ai-forced")
      : check(null, "AI 로 만든 부분이 있는지 아래에서 골라 주세요", "store-share-check-ai"),
    grade === "pack"
      ? check(true, "깔기 안내가 있어 「조수 사용 가능」으로 올라가요", "store-upload-grade")
      : check(null, "깔기 안내(참고문서)가 없어요. 없어도 올릴 수 있어요", "store-upload-grade"),
  ] });
  const bind = (key: "title" | "summary" | "description" | "tags" | "credits", attrs: Record<string, string> = {}, area = false) => el(area ? "textarea" : "input", {
    attrs: { ...attrs, ...(area ? {} : { value: form[key] }) }, dataset: { testid: `store-upload-${key}`, focusKey: `upload-${key}` },
    ...(area ? { text: form[key] } : {}),
    on: { input: (event) => { form[key] = (event.target as HTMLInputElement).value; if (key === "title") form.titleTouched = true; } },
  });
  const mine = (host.mine() ?? []).filter((item) => item.status !== "removed");
  const licenses = el("fieldset", { class: "store-license-choices", children: [el("legend", { text: "다른 사람이 어떻게 쓸 수 있나요?" }), ...(["OPRN-GAME", "CC-BY-4.0", "CC0", "CC-BY-SA-4.0"] as const).filter((l) => (STORE_LICENSES as readonly string[]).includes(l)).map((license) => el("label", {
    class: "store-license-choice" + (form.license === license ? " is-on" : ""),
    children: [
      el("input", { attrs: { type: "radio", name: "store-license", ...(form.license === license ? { checked: "" } : {}) }, dataset: { testid: `store-upload-license-${license}` }, on: { change: () => { form.license = license; host.render(); } } }),
      el("span", { children: [el("strong", { text: SHARE_LICENSE_LABELS[license] }), el("small", { text: licenseSentence(license, "나") })] }),
    ],
  }))] });
  const aiChoice = aiMade.length > 0 ? null : el("fieldset", { children: [el("legend", { text: "AI 도구로 만든 부분이 있나요?" }), ...([["yes", "네, AI 로 만든 부분이 있어요"], ["no", "아니요, 전부 직접 만들었어요"]] as const).map(([value, label]) => el("label", { class: "store-radio", children: [
    el("input", { attrs: { type: "radio", name: "store-ai", ...(form.ai === value ? { checked: "" } : {}) }, dataset: { testid: `store-upload-ai-${value}` }, on: { change: () => { form.ai = value; } } }), label,
  ] }))] });
  const problems = form.problems.length > 0 ? el("ul", { class: "store-problems", attrs: { role: "alert" }, dataset: { testid: "store-share-problems" }, children: form.problems.map((p) => el("li", { text: p })) }) : null;
  return el("section", { class: "store-share-card store-form", children: [
    el("h4", { text: "2. 자동 검사와 소개" }),
    checks,
    el("label", { children: ["이름", bind("title", { maxlength: "80", placeholder: "숲 마을 타일" })] }),
    el("label", { children: ["한 줄 소개 (선택)", bind("summary", { maxlength: "160", placeholder: "어떤 게임에 어울리는지 한 줄로" })] }),
    el("label", { children: ["종류", el("select", { dataset: { testid: "store-upload-kind" }, on: { change: (event) => { form.kind = (event.target as HTMLSelectElement).value as StoreItemKind; } },
      children: STORE_ITEM_KINDS.map((kind) => el("option", { value: kind, text: kindName(kind), attrs: form.kind === kind ? { selected: "" } : {} })) })] }),
    licenses,
    ...(aiChoice ? [aiChoice] : []),
    el("details", { class: "store-share-more", children: [
      el("summary", { text: "더 적기 (선택): 설명·태그·크레딧·새 버전" }),
      el("label", { children: ["설명", bind("description", { rows: "3", maxlength: "8000" }, true)] }),
      el("label", { children: ["태그 (쉼표로 구분)", bind("tags", { placeholder: "숲, 마을, 16px" })] }),
      el("label", { children: ["크레딧 표기", bind("credits", { maxlength: "400", placeholder: "그림: 내 이름" })] }),
      el("label", { children: ["올릴 곳", el("select", { dataset: { testid: "store-upload-target" }, on: { change: (event) => { form.target = (event.target as HTMLSelectElement).value; } },
        children: [el("option", { value: "", text: "새 에셋으로 올리기" }), ...mine.map((item) => el("option", { value: item.slug, text: `내 에셋 「${item.title}」의 새 버전 (지금 버전 ${item.latestVersion})`, attrs: form.target === item.slug ? { selected: "" } : {} }))] })] }),
    ] }),
    ...(problems ? [problems] : []),
    nav(host, { label: "다음: 미리보기 →", enabled: blocked.length === 0, go: () => {
      const issues: string[] = [];
      if (form.title.trim().length < 2) issues.push("이름을 두 글자 이상 적어 주세요.");
      if (aiMade.length === 0 && !form.ai) issues.push("AI 로 만든 부분이 있는지 골라 주세요.");
      form.problems = issues;
      if (issues.length === 0) form.step = 3;
      host.render();
    } }),
  ] });
}

function previewStep(host: ShareHost, project: Project, selection: PackSelection): HTMLElement {
  const status = host.status();
  const closed = closeSelection(project, selection);
  const counts = { tilesets: closed.tilesetIds.length, assets: closed.assetIds.length, referenceDocuments: closed.tilesetIds.reduce((n, id) => n + (project.tilesets[id]?.referenceDocuments ?? []).reduce((m, c) => m + c.documents.length, 0), 0) };
  const aiMade = aiMadeAssets(project, selection).length > 0 || form.ai === "yes";
  const author = status?.user?.displayName ?? "나";
  const preview = el("div", { class: "store-share-preview", dataset: { testid: "store-share-preview" }, children: [
    el("p", { class: "store-kind", text: kindName(form.kind) }),
    el("strong", { class: "store-share-preview-title", attrs: DATA, text: form.title.trim() }),
    ...(form.summary.trim() ? [el("p", { class: "store-summary", attrs: DATA, text: form.summary.trim() })] : []),
    el("p", { class: "store-by", children: [el("span", { attrs: DATA, text: author }), ...(aiMade ? [el("span", { class: "store-card-ai", text: "AI 생성 포함" })] : [])] }),
    el("p", { class: "store-hint", text: contentsSentence(form.kind, counts) }),
    el("p", { class: "store-hint", text: licenseSentence(form.license, author) }),
  ] });
  const agree = el("label", { class: "store-radio store-agree", children: [
    el("input", { attrs: { type: "checkbox", ...(form.agree ? { checked: "" } : {}) }, dataset: { testid: "store-upload-agree" }, on: { change: (event) => { form.agree = (event.target as HTMLInputElement).checked; host.render(); } } }),
    "이 그림·소리는 내가 만들었거나 나눌 권리가 있어요. 스토어 이용약관에 동의해요.",
  ] });
  const action = !status?.loggedIn
    ? el("div", { class: "store-share-login", children: [
      el("p", { text: "올리려면 스토어 계정으로 로그인해야 해요. 브라우저가 열리면 허락을 눌러 주세요." }),
      el("button", { class: "store-button", text: "로그인하고 올리기", attrs: { type: "button" }, dataset: { testid: "store-upload-login" }, on: { click: () => host.startLogin() } }),
    ] })
    : form.progress
      ? el("div", { class: "store-progress", dataset: { testid: "store-progress" }, attrs: { role: "status" }, text: form.progress })
      : el("button", { class: "store-button", text: form.target ? "새 버전으로 올리기" : "스토어에 올리기", attrs: { type: "button", ...(form.agree ? {} : { disabled: "" }) }, dataset: { testid: "store-upload-submit" }, on: { click: () => void submit(host, selection) } });
  return el("section", { class: "store-share-card", children: [
    el("h4", { text: "3. 이렇게 보여요" }),
    preview,
    agree,
    action,
    ...(form.error ? [host.errorBanner(form.error, () => void submit(host, selection))] : []),
    nav(host, null),
  ] });
}

function resultCard(host: ShareHost): HTMLElement {
  const result = form.result!;
  const visible = result.status === "visible";
  return el("section", { class: "store-share-card store-share-done", dataset: { testid: "store-upload-result", status: result.status }, children: [
    el("h4", { text: visible ? "올렸어요! 지금 스토어에 보여요" : "올렸어요! 운영자가 확인하면 스토어에 보여요" }),
    el("p", { class: "store-hint", text: `버전 ${result.version} 이 올라갔어요. 고치고 싶으면 같은 것을 골라 「새 버전」으로 다시 올리면 돼요.` }),
    el("div", { class: "store-actions", children: [
      ...(visible ? [el("button", { class: "store-button", text: "스토어에서 보기", attrs: { type: "button" }, dataset: { testid: "store-share-view" }, on: { click: () => host.openItem(result.slug) } })] : []),
      el("button", { class: "store-button ghost", text: "하나 더 나누기", attrs: { type: "button" }, dataset: { testid: "store-share-again" }, on: { click: () => { resetShare(); host.render(); } } }),
    ] }),
  ] });
}

async function submit(host: ShareHost, selection: PackSelection): Promise<void> {
  const bridge = storeBridge();
  if (!bridge) return;
  if (form.target) {
    const title = host.mine()?.find((item) => item.slug === form.target)?.title ?? form.target;
    if (!window.confirm(t(`내 에셋 「${title}」을 새 버전으로 바꿔요. 이미 받은 사람에게는 업데이트로 보여요. 계속할까요?`))) return;
  }
  const aiMade = aiMadeAssets(store.getCurrent(), selection).length > 0;
  form.error = null;
  form.progress = t("팩 만드는 중…");
  host.render();
  const unsubscribe = bridge.onProgress((event) => {
    if (event.phase !== "upload") return;
    form.progress = t(`올리는 중 ${event.done}/${event.total}`);
    const bar = document.querySelector<HTMLElement>('[data-testid="store-share"] [data-testid="store-progress"]');
    if (bar) bar.textContent = form.progress;
  });
  try {
    const built = await buildUploadPack(store.getCurrent(), selection, {
      title: form.title, summary: form.summary, description: form.description,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 12),
      kind: form.kind, license: form.license, aiGenerated: aiMade || form.ai === "yes", credits: form.credits,
    });
    form.result = await bridge.upload({ manifest: built.manifest, blobs: Object.fromEntries([...built.blobs].map(([sha, blob]) => [sha, blob.bytes])), ...(form.target ? { targetSlug: form.target } : {}) });
    host.refreshMine();
  } catch (error) {
    form.error = error instanceof StorePackBlockedError
      ? { message: "다른 사람이 만든 것이 함께 묶여 있어 올리지 않았어요.", status: 0, details: error.blocked.map((item) => `${item.id}: ${item.reason}`) }
      : storeFailure(error);
  } finally {
    unsubscribe();
    form.progress = null;
  }
  host.render();
}
