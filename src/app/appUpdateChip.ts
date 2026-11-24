// 앱 자동 업데이트 칩(렌더러). 메인은 electron/main/appUpdate.ts, 상태 모양은 electron/shared/appUpdate.ts.
//
// 칩은 하나뿐이고 누를 일이 있을 때만 보인다: 「v0.x 준비됨 · 다시 시작」(설치판·AppImage) 또는
// 「새 버전 있음 · 내려받기」(portable). 확인·내려받기 중에는 아무것도 보이지 않는다.
// 새 CSS 파일을 만들지 않는다 — 놓일 곳의 단추 클래스를 빌리고 강조색만 토큰 변수로 준다.
import { appUpdateChipText, shortVersion, type AppUpdateStatus } from "../../electron/shared/appUpdate";
import type { OprnUpdateBridge } from "@/project/persistence/electronRepository";
import { toast } from "@/util/toast";

export interface AppUpdateChipOptions {
  readonly className: string;
  /**
   * 다시 시작 전에 할 일 — 조수 대기와 저장. say 로 칩 글자를 바꾼다.
   * false 를 돌려주면(저장 실패) 다시 시작하지 않는다.
   */
  readonly beforeRestart?: (say: (text: string) => void) => Promise<boolean>;
}

let latest: AppUpdateStatus | null = null;
let restartFlush: (() => Promise<boolean>) | null = null;
const listeners = new Set<(status: AppUpdateStatus) => void>();
let watching = false;

function bridge(): OprnUpdateBridge | null {
  return (typeof window !== "undefined" ? window.oprn?.update : undefined) ?? null;
}

function publish(status: AppUpdateStatus): void {
  latest = status;
  for (const listener of listeners) listener(status);
}

function watch(update: OprnUpdateBridge): void {
  if (watching) return;
  watching = true;
  update.onState((payload) => publish(payload as AppUpdateStatus));
  void update.status().then(publish, () => {});
  showAppUpdateWhatsNewOnce();
}

/** 편집기 문서가 창 닫기와 같은 저장(src/main.ts flushForClose)을 넘긴다. 시작 화면에는 저장할 것이 없다. */
export function provideAppUpdateRestartFlush(flush: () => Promise<boolean>): void {
  restartFlush = flush;
}

export function flushForAppUpdateRestart(): Promise<boolean> {
  return restartFlush ? restartFlush() : Promise.resolve(true);
}

export function renderAppUpdateChip(options: AppUpdateChipOptions): { readonly element: HTMLButtonElement; dispose(): void } | null {
  const update = bridge();
  if (!update) return null;
  const button = document.createElement("button");
  button.type = "button";
  button.className = options.className;
  button.dataset.testid = "app-update-chip";
  button.hidden = true;
  button.style.color = "var(--accent)";
  button.style.fontWeight = "600";
  button.style.whiteSpace = "nowrap";
  let busy = false;

  const paint = (status: AppUpdateStatus): void => {
    if (busy) return;
    const text = status.enabled || status.state.kind === "ready" ? appUpdateChipText(status.state) : null;
    button.hidden = text === null;
    button.textContent = text ?? "";
    button.title = status.state.kind === "ready"
      ? `저장하고 다시 시작하면 v${shortVersion(status.state.version)} 으로 바뀌어요. 그냥 두면 앱을 끌 때 바뀌어요.`
      : status.state.kind === "available" ? `v${shortVersion(status.state.version)} 을 내려받아요` : "";
    button.dataset.updateState = status.state.kind;
  };

  button.addEventListener("click", () => {
    const state = latest?.state;
    if (!state || busy) return;
    if (state.kind === "available") {
      void update.openDownload();
      return;
    }
    if (state.kind !== "ready") return;
    busy = true;
    button.disabled = true;
    const say = (text: string): void => { button.textContent = text; };
    void (async () => {
      const ok = options.beforeRestart ? await options.beforeRestart(say) : true;
      if (!ok) throw new Error("저장하지 못해 다시 시작하지 않았어요. 저장 상태를 확인해 주세요.");
      say("다시 시작하는 중…");
      if (!(await update.install())) throw new Error("업데이트를 설치하지 못했어요.");
    })().catch((error: unknown) => {
      busy = false;
      button.disabled = false;
      if (latest) paint(latest);
      toast(error instanceof Error ? error.message : String(error), "error");
    });
  });

  listeners.add(paint);
  if (latest) paint(latest);
  watch(update);
  return { element: button, dispose: () => { listeners.delete(paint); } };
}

/** 업데이트 뒤 처음 켜졌으면 바뀐 점을 한 번 보인다. 메인이 한 번만 내주므로 두 문서가 불러도 한 번이다. */
export function showAppUpdateWhatsNewOnce(): void {
  const update = bridge();
  if (!update) return;
  void update.takeWhatsNew().then((news) => {
    if (!news) return;
    const head = `v${shortVersion(news.version)} 으로 업데이트했어요`;
    const message = news.lines.length > 0 ? `${head} · ${news.lines.join(" · ")}` : head;
    toast(message, { kind: "ok", durationMs: 9000 });
  }, () => {});
}
