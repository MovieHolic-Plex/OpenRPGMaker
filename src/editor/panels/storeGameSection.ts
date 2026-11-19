// src/editor/panels/storeGameSection.ts
// 발행 대화상자의 「스토어에서 바로 플레이」 칸(데스크톱 앱 전용 — 스토어 로그인 토큰은 메인 프로세스에만 있다).
// - 판본 번호는 자동이다: 스토어가 이 게임의 다음 번호(1.0 → 1.1, 「큰 갱신」이면 2.0)를 알려 준다. 작가가 직접 적으면 그 번호.
// - 「무엇이 바뀌었나」는 스토어의 지금 판본 project.json 과 견줘 미리 채운다. 작가가 고칠 수 있다.
// - 게임 공개 선언(2026-11-15): OPRN PLAY 는 무료·비영리 게임만 싣는다. 올릴 때마다 스토어가 준 문구의 다섯 항목을 확인하고 사는 곳을 골라야
//   「올리기」가 켜진다. 문구는 스토어가 정본이다(여기에 베껴 두지 않는다). 올리고 나면 확인 표시는 지운다 — 다음 판본은 다시 확인한다.
// 서버 계약: OpenRPGMaker-store src/games.ts · src/gameDeclaration.ts, 파일 목록: project/storeGameRelease.ts.
import { el } from "../../util/dom";
import type { FetchBytes } from "../../project/playerDeploymentTypes";
import type { Project } from "../../project/types";
import { prepareWebExport } from "../../project/webExport";
import { buildStoreGameFiles, changelogFromChanges, projectChangeSummary, type StoreGameChanges } from "../../project/storeGameRelease";
import { getLocale } from "@/i18n";
import { STORE_GAME_DECLARATION_KEYS, storeGameDeclaration, type StoreGameDeclarationDoc, type StoreGameMine, type StoreGamePublishResult } from "../../assetStore/gamePublish";
import { storeBridge, storeFailure } from "../assetStore/storeBridge";

export interface StoreGameSection {
  readonly element: HTMLElement;
  /** 지금 고른 갱신 크기로 본 다음 판본(스토어를 모르면 null). */
  autoVersion(): string | null;
  /** 판본 번호가 바뀌면 부른다(대화상자의 버전 칸 placeholder). */
  onAutoVersion(listener: () => void): void;
  /** 작가가 버전 칸을 고쳤다(올릴 판본 표시를 다시 그린다). */
  onVersionInput(): void;
}


/** 올린 뒤 상태 줄에 쓰는 말. 운영자 확인으로 간 판본은 「올렸습니다」가 아니라 「보냈습니다 — 아직 공개되지 않았습니다」다. */
export function storeGamePublishLine(result: Pick<StoreGamePublishResult, "version" | "unchanged" | "status" | "pageUrl" | "held" | "message" | "distribution">): string {
  const region = result.distribution === "outside_kr" ? " 이 게임은 대한민국에서는 보이지 않습니다." : "";
  if (result.status === "pending" || (result.held?.length ?? 0) > 0) {
    return `v${result.version} 을 보냈습니다 — 아직 공개되지 않았습니다. ${result.message?.trim() || "운영자가 확인한 뒤 공개됩니다."}${region} ${result.pageUrl}`.trim();
  }
  if (result.unchanged) return `바뀐 파일이 없어 새 판본을 만들지 않았습니다. 지금 판본 v${result.version}.${region}`;
  return `v${result.version} 을 올렸습니다.${region} ${result.pageUrl}`;
}

/** 이 게임의 지난 제출이 운영자 확인을 기다리거나 돌려보내졌을 때 작가에게 보여 줄 말(없으면 빈 글). */
export function storeGameSubmissionLine(submission: StoreGameMine["submission"]): string {
  if (!submission) return "";
  const reasons = (submission.reasonTexts?.length ? submission.reasonTexts : submission.reasons ?? []).join(" ");
  if (submission.status === "pending") return `운영자 확인을 기다리는 판본이 있습니다. ${reasons} 지금 다시 올리면 기다리는 판본을 대신합니다.`.replace(/\s+/g, " ");
  if (submission.status === "rejected") return `운영자가 지난 판본을 돌려보냈습니다: ${submission.note || reasons || "사유가 적혀 있지 않습니다."} 고친 뒤 다시 올려 주세요.`.replace(/\s+/g, " ");
  return "";
}

export function createStoreGameSection(options: {
  readonly project: Project;
  readonly projectKey: () => string;
  /** 작가가 직접 적은 판본(비면 자동). */
  readonly versionOverride: () => string;
  readonly fetchBytes: FetchBytes;
  readonly bundleBase: string;
}): StoreGameSection | null {
  const bridge = storeBridge();
  if (!bridge?.gamePublish) return null;
  let mine: (StoreGameMine & { baselineProject: string | null }) | null = null;
  let changes: StoreGameChanges | null = null;
  // 게임 공개 선언: loading(아직 모름) · required(스토어가 문구를 줬다) · legacy(선언을 모르는 옛 스토어 — 선언 없이 올린다) · failed(문구를 못 받았다 — 올리지 않는다).
  let declarationMode: "loading" | "required" | "legacy" | "failed" = "loading";
  let declarationDoc: StoreGameDeclarationDoc | null = null;
  let busy = false;
  const declarationChecks = new Map<string, HTMLInputElement>();
  const residenceInputs: HTMLInputElement[] = [];
  const listeners: (() => void)[] = [];
  const box = (style: string) => `margin: 0; font-size: 12px; ${style}`;

  const line = el("p", { dataset: { testid: "store-game-status" }, attrs: { style: box("color: #334155;") }, text: "스토어에서 이 게임의 판본을 확인하는 중…" });
  const major = document.createElement("input");
  major.type = "checkbox";
  major.dataset.testid = "store-game-major";
  const nextLabel = el("strong", { dataset: { testid: "store-game-next-version" }, text: "—" });
  const changelog = document.createElement("textarea");
  changelog.dataset.testid = "store-game-changelog";
  changelog.rows = 4;
  changelog.maxLength = 8000;
  changelog.setAttribute("aria-label", "무엇이 바뀌었나");
  changelog.placeholder = "첫 줄: 한 줄 제목\n+ 새 기능\n~ 개선\n! 버그 수정";
  changelog.title = "첫 줄은 스토어 업데이트 기록의 제목이 됩니다. + 새 기능, ~ 개선, ! 버그 수정으로 시작하는 줄은 묶어서 보여 줍니다.";
  changelog.style.cssText = "width: 100%; box-sizing: border-box; font: 12px/1.5 inherit; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;";
  let changelogEdited = false;
  changelog.addEventListener("input", () => { changelogEdited = true; });
  // 제작자 목소리(스토어 2026-10-25): 판본 코멘트와 소식 글. 둘 다 선택이다 — 비우면 보내지 않는다.
  const fieldStyle = "width: 100%; box-sizing: border-box; font: 12px/1.5 inherit; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;";
  const comment = document.createElement("textarea");
  comment.dataset.testid = "store-game-comment";
  comment.rows = 2;
  comment.maxLength = 600;
  comment.setAttribute("aria-label", "제작자 코멘트");
  comment.placeholder = "이 판본에 대해 플레이어에게 직접 하고 싶은 말 (예: 휴대폰 조작은 사흘 동안 들고 다니며 고쳤어요!)";
  comment.style.cssText = fieldStyle;
  const postTitle = document.createElement("input");
  postTitle.dataset.testid = "store-game-post-title";
  postTitle.maxLength = 120;
  postTitle.placeholder = "소식 제목 (예: 1막 대개편: 지하 미궁과 달의 아이)";
  postTitle.setAttribute("aria-label", "업데이트 글 제목");
  postTitle.style.cssText = fieldStyle;
  const postBody = document.createElement("textarea");
  postBody.dataset.testid = "store-game-post-body";
  postBody.rows = 6;
  postBody.maxLength = 20000;
  postBody.setAttribute("aria-label", "업데이트 글 본문");
  postBody.placeholder = "## 새로 들어온 것\n- 용 보스\n\n![장면](store/shot1.webp) — 그림은 이 판본에 들어 있는 파일 경로만 보여요";
  postBody.style.cssText = fieldStyle;
  const postPin = document.createElement("input");
  postPin.type = "checkbox";
  postPin.dataset.testid = "store-game-post-pin";
  const postBox = el("details", {
    dataset: { testid: "store-game-post" },
    attrs: { style: "font-size: 12px;" },
    children: [
      el("summary", { attrs: { style: "cursor: pointer; font-weight: 700; color: #475569;" }, text: "업데이트 글도 올리기 (선택 — 스토어 게임 화면 「소식」 탭)" }),
      el("div", { attrs: { style: "display: flex; flex-direction: column; gap: 6px; margin-top: 6px;" }, children: [
        postTitle, postBody,
        el("label", { attrs: { style: "display: flex; gap: 4px; align-items: center;" }, children: [postPin, el("span", { text: "맨 위에 고정" })] }),
        el("p", { attrs: { style: box("color: #64748b;") }, text: "# 제목 · - 목록 · **굵게** · [링크](https://…) 를 쓸 수 있어요. 조수에게 「스토어 업데이트 글 써 줘」라고 하면 바뀐 점과 대본 변화로 초안을 써 줍니다." }),
      ] }),
    ],
  });
  const publish = el("button", {
    class: "app-modal-button is-confirm",
    dataset: { testid: "store-game-publish" },
    attrs: { type: "button", style: "font-size: 12px; font-weight: 800; padding: 7px 14px;" },
    text: "스토어에 올리기 (바로 플레이)",
  }) as HTMLButtonElement;
  publish.disabled = true;

  const submissionLine = el("p", { dataset: { testid: "store-game-submission" }, attrs: { style: box("color: #92400e; font-weight: 700;"), hidden: "" } });
  const declarationBox = el("fieldset", {
    dataset: { testid: "store-game-declaration" },
    attrs: { style: "display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 8px 10px; border: 1px solid #a5b4fc; border-radius: 8px; background: #fff; font-size: 12px; min-width: 0;" },
  });
  // display: flex 인 상자는 hidden 속성으로 가려지지 않는다 — display 를 직접 바꾼다.
  const showDeclaration = (on: boolean) => { declarationBox.style.display = on ? "flex" : "none"; };
  showDeclaration(false);
  const declarationHint = el("p", { dataset: { testid: "store-game-declaration-hint" }, attrs: { style: box("color: #b45309;"), hidden: "" }, text: "선언의 항목을 모두 확인하고 지금 사는 곳을 골라야 올릴 수 있습니다." });
  const currentDeclaration = () => {
    if (!declarationDoc) return null;
    const checked = new Set([...declarationChecks].filter(([, input]) => input.checked).map(([key]) => key));
    return storeGameDeclaration(declarationDoc, checked, residenceInputs.find((input) => input.checked)?.value ?? null);
  };
  /** 「올리기」는 스토어를 알고, 선언을 다 했을 때만 켠다(옛 스토어는 선언 없이). */
  const syncPublish = () => {
    const declared = declarationMode === "legacy" || (declarationMode === "required" && currentDeclaration() !== null);
    publish.disabled = busy || !mine || !changes || !declared;
    declarationHint.hidden = !(declarationMode === "required" && mine !== null && !declared);
  };
  const renderDeclaration = (doc: StoreGameDeclarationDoc) => {
    declarationChecks.clear();
    residenceInputs.length = 0;
    const row = "display: flex; gap: 6px; align-items: flex-start; line-height: 1.5;";
    const items = doc.items.map((item) => {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.testid = `store-game-declare-${item.key}`;
      input.style.marginTop = "3px";
      input.addEventListener("change", syncPublish);
      declarationChecks.set(item.key, input);
      return el("label", { attrs: { style: row }, children: [input, el("span", { text: item.text })] });
    });
    const places = doc.residence.options.map((option) => {
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "store-game-residence";
      input.value = option.value;
      input.dataset.testid = `store-game-residence-${option.value}`;
      input.addEventListener("change", syncPublish);
      residenceInputs.push(input);
      return el("label", { attrs: { style: "display: flex; gap: 4px; align-items: center;" }, children: [input, el("span", { text: option.label })] });
    });
    declarationBox.replaceChildren(
      el("legend", { attrs: { style: "font-weight: 800; color: #1e1b4b; padding: 0 4px;" }, text: doc.title }),
      el("p", { dataset: { testid: "store-game-declaration-lead" }, attrs: { style: box("color: #334155;") }, text: doc.lead }),
      ...items,
      el("div", { attrs: { style: "display: flex; gap: 12px; align-items: center; flex-wrap: wrap;", role: "radiogroup", "aria-label": doc.residence.question }, children: [el("strong", { text: doc.residence.question }), ...places] }),
      el("p", { dataset: { testid: "store-game-residence-note" }, attrs: { style: box("color: #475569;") }, text: doc.residence.note }),
      el("a", { dataset: { testid: "store-game-terms" }, attrs: { href: doc.termsUrl, target: "_blank", rel: "noopener noreferrer", style: "color: #4338ca; font-weight: 700;" }, text: "이용약관 전문 보기" }),
    );
    showDeclaration(true);
  };
  /** 스토어에서 선언 문구를 받는다. 문구가 바뀌었으면(판이 다르면) 확인 표시를 지우고 다시 그린다. */
  const loadDeclaration = async () => {
    const doc = bridge.gameDeclaration ? await bridge.gameDeclaration({ lang: getLocale() }) : null;
    if (!doc) { declarationMode = "legacy"; declarationDoc = null; showDeclaration(false); return; }
    if (declarationDoc?.version !== doc.version || declarationChecks.size !== STORE_GAME_DECLARATION_KEYS.length) renderDeclaration(doc);
    declarationDoc = doc;
    declarationMode = "required";
  };

  const autoVersion = (): string | null => (mine ? (major.checked ? mine.next.major : mine.next.minor) : null);
  const render = () => {
    const override = options.versionOverride().trim();
    nextLabel.textContent = override ? `v${override} (직접 정함)` : autoVersion() ? `v${autoVersion()} (자동)` : "—";
    for (const listener of listeners) listener();
  };
  major.addEventListener("change", render);

  const element = el("section", {
    dataset: { testid: "store-game-section" },
    attrs: { style: "display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid #c7d2fe; border-radius: 10px; background: #eef2ff;" },
    children: [
      el("h3", { attrs: { style: "margin: 0; font-size: 13px; color: #1e1b4b;" }, text: "스토어에서 바로 플레이" }),
      // Studio 는 만드는 앱이다 — 완성한 게임을 다른 사람이 하는 곳은 웹 OPRN PLAY 다(2026-11-04 Studio/런타임 분리).
      el("p", { attrs: { style: "margin: 0; font-size: 12px; color: #475569;" }, text: "여기서 올리면 play.openrpgmaker.com 에서 누구나 바로 해 볼 수 있어요." }),
      line,
      submissionLine,
      el("div", {
        attrs: { style: "display: flex; gap: 14px; align-items: center; flex-wrap: wrap; font-size: 12px;" },
        children: [
          el("span", { children: [el("span", { text: "올릴 판본: " }), nextLabel] }),
          el("label", { attrs: { style: "display: flex; gap: 4px; align-items: center;" }, children: [major, el("span", { text: "큰 갱신 (앞자리 올리기)" })] }),
        ],
      }),
      el("label", { attrs: { style: box("font-weight: 700; color: #475569;") }, text: "무엇이 바뀌었나 (자동으로 채움 — 고칠 수 있습니다)" }),
      changelog,
      el("label", { attrs: { style: box("font-weight: 700; color: #475569;") }, text: "제작자 코멘트 (선택 — 스토어 판본 카드에 작가 말로 보여요)" }),
      comment,
      postBox,
      declarationBox,
      declarationHint,
      el("div", { attrs: { style: "display: flex; justify-content: flex-end;" }, children: [publish] }),
    ],
  });

  const load = async () => {
    try {
      const status = await bridge.status();
      if (!status.loggedIn) {
        line.textContent = "스토어에 로그인하면 이 게임을 브라우저에서 바로 플레이하도록 올릴 수 있습니다(왼쪽 막대 「스토어」).";
        return;
      }
      mine = await bridge.gameMine({ projectKey: options.projectKey() });
      const project = JSON.parse(prepareWebExport(options.project).projectJson);
      changes = projectChangeSummary(mine.baselineProject ? JSON.parse(mine.baselineProject) : null, project);
      if (!changelogEdited) changelog.value = changelogFromChanges(changes, mine.baseline?.version ?? null);
      line.textContent = mine.game
        ? `스토어의 「${mine.game.title}」 — 지금 판본 v${mine.game.currentVersion ?? "?"}. 옛 판본도 계속 플레이할 수 있고, 스토어 게임 쪽에서 되돌릴 수 있습니다.`
        : "아직 스토어에 올리지 않은 게임입니다. 첫 판본은 v1.0 입니다.";
      const waiting = storeGameSubmissionLine(mine.submission);
      submissionLine.textContent = waiting;
      submissionLine.hidden = waiting === "";
      try {
        await loadDeclaration();
      } catch (error) {
        declarationMode = "failed";
        showDeclaration(false);
        line.textContent = `게임 공개 선언을 받지 못해 올릴 수 없습니다: ${storeFailure(error).message}`;
      }
      syncPublish();
      render();
    } catch (error) {
      line.textContent = `스토어를 확인하지 못했습니다: ${storeFailure(error).message}`;
      syncPublish();
    }
  };

  publish.addEventListener("click", () => {
    if (!mine || !changes) return;
    const declaration = declarationMode === "required" ? currentDeclaration() : null;
    if (declarationMode !== "legacy" && !declaration) { syncPublish(); return; }
    busy = true;
    syncPublish();
    const unsubscribe = bridge.onProgress((event) => {
      if (event.phase === "upload") line.textContent = `파일 올리는 중… ${event.done}/${event.total}`;
    });
    void (async () => {
      try {
        line.textContent = "판본 파일을 만드는 중…";
        const built = await buildStoreGameFiles(options.project, { fetchBytes: options.fetchBytes, bundleBase: options.bundleBase });
        const title = options.project.meta.title || "이름 없는 게임";
        const override = options.versionOverride().trim();
        const result = await bridge.gamePublish({
          projectKey: options.projectKey(),
          meta: { title, summary: "", description: "", credits: "", genre: "", controls: [] },
          files: Object.fromEntries(built.files), entry: built.entry, cover: null, art: [],
          changelog: changelog.value, changes: changes as unknown as Record<string, { added: string[]; changed: string[]; removed: string[] }>,
          bump: major.checked ? "major" : "minor", version: override || null,
          ...(comment.value.trim() ? { comment: comment.value.trim() } : {}),
          ...(postTitle.value.trim() ? { post: { title: postTitle.value.trim(), body: postBody.value, pinned: postPin.checked } } : {}),
          ...(declaration ? { declaration } : {}),
        });
        const voice = [
          result.comment ? (result.comment.error ? `코멘트를 올리지 못했습니다(${result.comment.error})` : result.comment.status === "pending" ? "코멘트는 운영자 확인 뒤 보입니다" : "코멘트를 달았습니다") : "",
          result.post ? (result.post.error ? `소식 글을 올리지 못했습니다(${result.post.error})` : `소식 글${result.post.status === "pending" ? "(운영자 확인 뒤 공개)" : ""}: ${result.post.url ?? ""}`) : "",
        ].filter(Boolean).join(" · ");
        line.textContent = storeGamePublishLine(result) + (voice ? ` ${voice}` : "");
        // 선언은 올릴 때마다 한다 — 다음 판본을 위해 확인 표시를 지운다(사는 곳은 남긴다).
        for (const input of declarationChecks.values()) input.checked = false;
        if (result.post && !result.post.error) { postTitle.value = ""; postBody.value = ""; postPin.checked = false; }
        // 다시 불러오면 상태 줄이 「지금 판본 …」으로 바뀐다 — 방금 올린 결과를 남긴다.
        const message = line.textContent;
        busy = false;
        await load();
        line.textContent = message;
      } catch (error) {
        const failure = storeFailure(error);
        line.textContent = `올리지 못했습니다: ${failure.message}`;
        // 선언 문구가 바뀌었다(409) — 새 문구를 받아 다시 확인하게 한다.
        if (failure.status === 409) await loadDeclaration().catch(() => undefined);
      } finally {
        busy = false;
        syncPublish();
        unsubscribe();
      }
    })();
  });

  void load();
  return { element, autoVersion, onAutoVersion: (listener) => { listeners.push(listener); }, onVersionInput: () => { nextLabel.textContent = options.versionOverride().trim() ? `v${options.versionOverride().trim()} (직접 정함)` : autoVersion() ? `v${autoVersion()} (자동)` : "—"; } };
}
