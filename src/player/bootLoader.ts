// player/bootLoader.ts
// 웹 플레이어의 «불러오는 중» 화면: 게임 이름·표지, 진행 막대(게임 데이터 → 첫 화면 파일 수), 끝나면 「시작하기」.
// 「시작하기」를 누르는 것이 이 문서의 첫 사용자 입력이 되어 소리 자동 재생 제한이 풀린다(타이틀 BGM 이 처음부터 들린다).
// 스토어 판본·웹 내보내기의 부팅(exportEntry.ts)만 쓴다. 표지·크기는 판본에 함께 실린 loading.json 에서 읽는다(없어도 된다).

export interface BootLoaderInfo {
  readonly title?: string;
  /** 표지 그림(판본 폴더 기준 상대 주소). */
  readonly cover?: string;
  /** project.json 의 압축 전 크기(바이트). 있으면 «게임 데이터» 단계도 실제 비율로 그린다. */
  readonly projectBytes?: number;
  /** 원본 대신 실은 파일(`assets/x.wav` → `assets/x.web.mp3`). */
  readonly aliases?: Readonly<Record<string, string>>;
}

export interface BootLoader {
  readonly root: HTMLElement;
  setInfo(info: BootLoaderInfo): void;
  /** 게임 데이터(project.json) 받기 — 받은 바이트. */
  projectProgress(bytes: number): void;
  /** 첫 화면 파일 받기 — 끝난 파일 수 / 전체, 받은 바이트. */
  filesProgress(done: number, total: number, bytes: number): void;
  /** 다 받았다 — 「시작하기」를 띄우고 누를 때까지 기다린다. */
  waitForStart(): Promise<void>;
  remove(): void;
}

const MB = 1048576;
const formatMb = (bytes: number): string => `${(bytes / MB).toFixed(bytes >= 10 * MB ? 0 : 1)} MB`;

/** 게임 데이터는 막대의 앞 30%, 첫 화면 파일이 나머지 70%. */
const PROJECT_SHARE = 0.3;

export function mountBootLoader(host: HTMLElement, initial: BootLoaderInfo): BootLoader {
  const root = document.createElement("section");
  root.dataset.testid = "boot-loader";
  root.setAttribute("aria-busy", "true");
  root.className = "oprn-boot-loader";
  // 가로로 눕힌 폰(스토어 iframe 높이 약 300px)에서도 「시작하기」가 화면 안에 들어오게: 넘치면 스크롤, 낮은 화면은 표지·제목을 줄인다.
  root.style.cssText = "position:fixed;inset:0;z-index:20;display:grid;place-items:center;overflow-y:auto;padding:8px 0;box-sizing:border-box;background:#05060a;color:#e8e6df;font:15px/1.5 system-ui,'Noto Sans KR',sans-serif;";
  const shortStyle = document.createElement("style");
  shortStyle.textContent = "@media (max-height:520px){.oprn-boot-loader>div{gap:8px!important}.oprn-boot-loader img{max-height:28vh!important}.oprn-boot-loader h1{font-size:18px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}}";
  root.append(shortStyle);
  const box = document.createElement("div");
  box.style.cssText = "width:min(520px,88vw);display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;";
  const cover = document.createElement("img");
  cover.alt = "";
  cover.dataset.testid = "boot-loader-cover";
  cover.style.cssText = "width:100%;max-height:46vh;object-fit:cover;border-radius:10px;image-rendering:pixelated;display:none;box-shadow:0 8px 30px #0008;";
  cover.addEventListener("load", () => { cover.style.display = "block"; });
  const title = document.createElement("h1");
  title.dataset.testid = "boot-loader-title";
  title.style.cssText = "margin:0;font-size:clamp(20px,4vw,28px);letter-spacing:.02em;";
  const bar = document.createElement("div");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("aria-label", "불러오는 중");
  bar.dataset.testid = "boot-loader-bar";
  bar.style.cssText = "width:100%;height:10px;border-radius:5px;background:#1c1f29;overflow:hidden;";
  const fill = document.createElement("div");
  fill.style.cssText = "height:100%;width:0;background:linear-gradient(90deg,#f0b54a,#ffd27a);transition:width .15s linear;";
  bar.append(fill);
  const label = document.createElement("p");
  label.dataset.testid = "boot-loader-label";
  label.setAttribute("aria-live", "polite");
  label.style.cssText = "margin:0;font-size:13px;color:#a5a8b3;min-height:1.5em;font-variant-numeric:tabular-nums;";
  label.textContent = "게임을 불러오는 중…";
  const start = document.createElement("button");
  start.type = "button";
  start.dataset.testid = "boot-loader-start";
  start.textContent = "▶ 시작하기";
  start.style.cssText = "display:none;font:inherit;font-size:17px;font-weight:700;padding:10px 28px;border-radius:8px;border:1px solid #f0b54a;background:#f0b54a;color:#1b1406;cursor:pointer;";
  const hint = document.createElement("p");
  hint.style.cssText = "margin:0;font-size:12px;color:#7d808b;display:none;";
  const coarse = typeof matchMedia === "function" && (matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);
  hint.textContent = coarse ? "화면 아무 곳이나 누르세요 (소리가 함께 켜집니다)" : "클릭하거나 Enter·Space 를 누르세요 (소리가 함께 켜집니다)";
  box.append(cover, title, bar, label, start, hint);
  root.append(box);
  host.append(root);

  let projectBytesTotal = 0;
  const setRatio = (ratio: number): void => {
    const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    fill.style.width = `${percent}%`;
    bar.setAttribute("aria-valuenow", String(percent));
  };
  const setInfo = (info: BootLoaderInfo): void => {
    if (info.title) { title.textContent = info.title; }
    if (info.cover && !cover.src) cover.src = info.cover;
    if (info.projectBytes && info.projectBytes > 0) projectBytesTotal = info.projectBytes;
  };
  setInfo(initial);

  return {
    root,
    setInfo,
    projectProgress(bytes) {
      if (projectBytesTotal > 0) {
        setRatio(PROJECT_SHARE * Math.min(1, bytes / projectBytesTotal));
        label.textContent = `게임 데이터 ${formatMb(bytes)} / ${formatMb(projectBytesTotal)}`;
      } else {
        label.textContent = `게임 데이터 ${formatMb(bytes)}`;
      }
    },
    filesProgress(done, total, bytes) {
      setRatio(PROJECT_SHARE + (1 - PROJECT_SHARE) * (total > 0 ? done / total : 1));
      label.textContent = `첫 화면 파일 ${done} / ${total} · ${formatMb(bytes)}`;
    },
    waitForStart() {
      setRatio(1);
      root.setAttribute("aria-busy", "false");
      label.textContent = "준비됐습니다";
      start.style.display = "inline-block";
      hint.style.display = "block";
      start.focus({ preventScroll: true });
      return new Promise<void>((resolve) => {
        const finish = (): void => {
          document.removeEventListener("keydown", onKey, true);
          root.removeEventListener("click", finish);
          resolve();
        };
        const onKey = (event: KeyboardEvent): void => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          finish();
        };
        start.addEventListener("click", finish, { once: true });
        // 준비가 끝나면 화면 어디를 눌러도 시작한다 — 낮은 화면에서 단추가 스크롤 밖에 있어도 막히지 않는다.
        root.addEventListener("click", finish);
        document.addEventListener("keydown", onKey, true);
      });
    },
    remove() {
      root.remove();
    },
  };
}

/** 판본에 함께 실린 loading.json(없으면 빈 값). 잘못된 값은 버린다. */
export async function readLoadingInfo(base: string | URL): Promise<BootLoaderInfo> {
  try {
    const response = await fetch(new URL("loading.json", base));
    if (!response.ok) return {};
    const raw = (await response.json()) as Record<string, unknown>;
    const assetPath = (value: unknown): value is string => typeof value === "string" && /^assets\/[\w./-]+$/.test(value) && !value.includes("..");
    const aliasEntries = raw.aliases && typeof raw.aliases === "object" ? Object.entries(raw.aliases as Record<string, unknown>).filter((pair): pair is [string, string] => assetPath(pair[0]) && assetPath(pair[1])) : [];
    const aliases = aliasEntries.length > 0 ? Object.fromEntries(aliasEntries.slice(0, 5000)) : undefined;
    const cover = typeof raw.cover === "string" && /^[\w./-]+$/.test(raw.cover) && !raw.cover.includes("..") ? new URL(raw.cover, base).href : undefined;
    return {
      ...(typeof raw.title === "string" ? { title: raw.title.slice(0, 120) } : {}),
      ...(cover ? { cover } : {}),
      ...(typeof raw.projectBytes === "number" && Number.isFinite(raw.projectBytes) ? { projectBytes: raw.projectBytes } : {}),
      ...(aliases ? { aliases } : {}),
    };
  } catch {
    return {};
  }
}

/** project.json 을 받으며 바이트를 알린다. 바이트가 12초 동안 오지 않으면 끊고 다시 받는다(운영 엣지의 멈춘 흐름, 2026-10-23). */
export async function fetchTextWithProgress(input: RequestInfo | URL, onBytes: (bytes: number) => void): Promise<{ readonly ok: boolean; readonly status: number; readonly text: string }> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = (): void => { clearTimeout(timer); timer = setTimeout(() => controller.abort(new Error("stalled")), 12_000); };
    try {
      arm();
      const response = await fetch(input, { signal: controller.signal });
      if (!response.ok || !response.body) {
        const text = response.ok ? await response.text() : "";
        clearTimeout(timer);
        if (response.status >= 500) { lastError = new Error(`HTTP ${response.status}`); continue; }
        return { ok: response.ok, status: response.status, text };
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      let received = 0;
      for (;;) {
        arm();
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        text += decoder.decode(value, { stream: true });
        onBytes(received);
      }
      clearTimeout(timer);
      text += decoder.decode();
      return { ok: true, status: response.status, text };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      onBytes(0);
    }
  }
  throw lastError ?? new Error("project fetch failed");
}
