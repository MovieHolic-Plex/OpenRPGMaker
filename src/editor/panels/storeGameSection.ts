// src/editor/panels/storeGameSection.ts
// 발행 대화상자의 「스토어에서 바로 플레이」 칸(데스크톱 앱 전용 — 스토어 로그인 토큰은 메인 프로세스에만 있다).
// - 판본 번호는 자동이다: 스토어가 이 게임의 다음 번호(1.0 → 1.1, 「큰 갱신」이면 2.0)를 알려 준다. 작가가 직접 적으면 그 번호.
// - 「무엇이 바뀌었나」는 스토어의 지금 판본 project.json 과 견줘 미리 채운다. 작가가 고칠 수 있다.
// 서버 계약: OpenRPGMaker-store src/games.ts, 파일 목록: project/storeGameRelease.ts.
import { el } from "../../util/dom";
import type { FetchBytes } from "../../project/playerDeploymentTypes";
import type { Project } from "../../project/types";
import { prepareWebExport } from "../../project/webExport";
import { buildStoreGameFiles, changelogFromChanges, projectChangeSummary, type StoreGameChanges } from "../../project/storeGameRelease";
import type { StoreGameMine } from "../../assetStore/gamePublish";
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
  const publish = el("button", {
    class: "app-modal-button is-confirm",
    dataset: { testid: "store-game-publish" },
    attrs: { type: "button", style: "font-size: 12px; font-weight: 800; padding: 7px 14px;" },
    text: "스토어에 올리기 (바로 플레이)",
  }) as HTMLButtonElement;
  publish.disabled = true;

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
      line,
      el("div", {
        attrs: { style: "display: flex; gap: 14px; align-items: center; flex-wrap: wrap; font-size: 12px;" },
        children: [
          el("span", { children: [el("span", { text: "올릴 판본: " }), nextLabel] }),
          el("label", { attrs: { style: "display: flex; gap: 4px; align-items: center;" }, children: [major, el("span", { text: "큰 갱신 (앞자리 올리기)" })] }),
        ],
      }),
      el("label", { attrs: { style: box("font-weight: 700; color: #475569;") }, text: "무엇이 바뀌었나 (자동으로 채움 — 고칠 수 있습니다)" }),
      changelog,
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
      publish.disabled = false;
      render();
    } catch (error) {
      line.textContent = `스토어를 확인하지 못했습니다: ${storeFailure(error).message}`;
    }
  };

  publish.addEventListener("click", () => {
    if (!mine || !changes) return;
    publish.disabled = true;
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
        });
        line.textContent = result.unchanged
          ? `바뀐 파일이 없어 새 판본을 만들지 않았습니다. 지금 판본 v${result.version}.`
          : `v${result.version} 을 올렸습니다${result.status === "pending" ? " (검토 뒤 공개)" : ""}. ${result.pageUrl}`;
        await load();
      } catch (error) {
        line.textContent = `올리지 못했습니다: ${storeFailure(error).message}`;
        publish.disabled = false;
      } finally {
        unsubscribe();
      }
    })();
  });

  void load();
  return { element, autoVersion, onAutoVersion: (listener) => { listeners.push(listener); }, onVersionInput: () => { nextLabel.textContent = options.versionOverride().trim() ? `v${options.versionOverride().trim()} (직접 정함)` : autoVersion() ? `v${autoVersion()} (자동)` : "—"; } };
}
