import {
  applyBgmStatus,
  cancelBgmInstall,
  fetchBgmStatus,
  startBgmInstall,
  watchBgmInstall,
  type BgmInstallStatus,
} from "@/editor/bgmInstallClient";
import { el } from "@/util/dom";

const REMOTE_HINT = "원격 접속에서는 BGM 설치가 잠겨 있습니다. .env.local 에 RPG_ZZU_BGM_INSTALL_REMOTE=1 을 넣고 서버를 다시 시작하세요.";

function gigabytes(bytes: number): string {
  return `${(bytes / 1_000_000_000).toFixed(2)}GB`;
}

function statusText(status: BgmInstallStatus): string {
  if (!status.installing) {
    return `카탈로그 ${status.expected}곡 중 ${status.installed.length}곡 설치됨`;
  }
  // 다운로드가 끝나면 스테이징 크기가 archive 크기에서 멈추고 검증·전개가 이어진다.
  // 진행률만 보여주면 100% 에서 멈춘 것처럼 보이므로 문구를 바꾼다.
  if (status.stagedBytes >= status.archiveBytes) return "받기 완료 · 검증하고 있습니다";
  const percent = Math.floor((status.stagedBytes / status.archiveBytes) * 100);
  return `받는 중 ${percent}% (${gigabytes(status.stagedBytes)} / ${gigabytes(status.archiveBytes)})`;
}

export function bgmInstallBanner(input: {
  readonly kind: string;
  readonly onInstalled: () => void;
  /** 주입하면 그대로 쓴다(테스트 경로). undefined 면 fetchBgmStatus() 로 비동기 채운다. */
  readonly status?: BgmInstallStatus | null;
}): HTMLElement | null {
  // 팩은 음악 카탈로그 전용이다. 효과음은 레포에 그대로 들어 있다.
  if (input.kind !== "music") return null;
  // status 가 null 이면 설치 엔드포인트가 없는 환경이다 — 누를 수 없는 버튼을 띄우지 않는다.
  if (input.status === null) return null;
  if (input.status !== undefined && input.status.installed.length >= input.status.expected) return null;

  const text = el("div", { text: "설치 상태 확인 중…", dataset: { testid: "bgm-install-status-text" } });
  const error = el("small", { class: "bgm-install-error", attrs: { hidden: "" }, dataset: { testid: "bgm-install-error" } });
  const progress = el("progress", { attrs: { hidden: "" }, dataset: { testid: "bgm-install-progress" } });
  const button = el("button", { attrs: { type: "button", hidden: "" }, dataset: { testid: "bgm-install-button" } });
  const cancel = el("button", {
    attrs: { type: "button" }, text: "취소", dataset: { testid: "bgm-install-cancel" },
    on: { click: () => { void cancelBgmInstall(); } },
  });
  // 취소는 설치 중에만 DOM 에 넣는다 — 누를 수 없는 버튼을 숨겨서 두면 보조기술에는 남는다.
  const banner = el("div", {
    class: "bgm-install-banner",
    dataset: { testid: "bgm-install-banner" },
    children: [text, progress, button, error],
  });

  let stopWatching: (() => void) | undefined;

  const render = (status: BgmInstallStatus): void => {
    if (status.installed.length >= status.expected) { banner.remove(); return; }
    text.textContent = statusText(status);
    button.textContent = `전체 받기 (${gigabytes(status.archiveBytes)})`;
    button.disabled = status.installing || !status.remoteAllowed;
    button.hidden = status.installing;
    if (status.installing) button.after(cancel);
    else cancel.remove();
    progress.hidden = !status.installing;
    progress.max = status.archiveBytes;
    progress.value = status.stagedBytes;
    const reason = status.remoteAllowed ? status.error : REMOTE_HINT;
    error.textContent = reason ?? "";
    error.hidden = reason === null || reason === "";
  };

  const watch = (): void => {
    stopWatching?.();
    stopWatching = watchBgmInstall(status => {
      render(status);
      if (!status.installing && status.error === null) input.onInstalled();
    });
  };

  button.addEventListener("click", () => {
    button.disabled = true;
    void startBgmInstall().then(result => {
      if (!result.ok) {
        error.textContent = result.error ?? "";
        error.hidden = false;
        button.disabled = false;
        return;
      }
      watch();
    });
  });

  if (input.status !== undefined) render(input.status);
  else void fetchBgmStatus().then(status => {
    if (status === null) { banner.remove(); return; }
    // Reopening after an install must replace the build snapshot before hiding the banner.
    applyBgmStatus(status);
    input.onInstalled();
    render(status);
    if (status.installing) watch();
  });

  return banner;
}
