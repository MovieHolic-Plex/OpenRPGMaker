// player/storeGameHost.ts
// 스토어에서 바로 플레이하는 웹 게임(store.openrpgmaker.com/games/<slug>)의 부팅 계약.
//
// 스토어 서버가 판본마다 index.html 에 넣는 __OPENRPG_BOOT__.storeGame 을 읽는다(OpenRPGMaker-store src/games.ts).
// - 세이브는 게임 + 판본 이름(`oprn-export:store:<slug>@<판본>`)에 둔다. 판본이 바뀌어도 옛 세이브는 그대로 남는다.
// - 새 판본을 처음 열었는데 그 판본 세이브가 없고 옛 판본 세이브가 있으면, 이어서 할지 묻고(호환 안내 포함) 고르면 복사한다.
// - 게임은 cdn 출처의 iframe 에서 돈다. meta CSP 는 frame-ancestors 를 줄 수 없으므로, 다른 사이트가 품었으면 부팅하지 않는다.
// 잘못된 값은 조용히 무시한다 — 호스트 주입값 때문에 일반 내보내기 부팅이 깨지면 안 된다.

export interface StoreGameBoot {
  readonly slug: string;
  readonly version: string;
  readonly title: string;
  /** 같은 게임의 모든 판본 세이브 이름 앞부분(`oprn-export:store:<slug>@`). */
  readonly savePrefix: string;
  /** 이 판본을 iframe 으로 품어도 되는 출처(스토어). */
  readonly embedders: readonly string[];
}

const VERSION = /^\d{1,4}\.\d{1,4}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export function parseStoreGameBoot(raw: unknown): StoreGameBoot | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const slug = typeof value.slug === "string" && SLUG.test(value.slug) ? value.slug : null;
  const version = typeof value.version === "string" && VERSION.test(value.version) ? value.version : null;
  const savePrefix = typeof value.savePrefix === "string" ? value.savePrefix : null;
  if (!slug || !version || !savePrefix || !savePrefix.endsWith(`${slug}@`)) return null;
  const embedders = Array.isArray(value.embedders)
    ? value.embedders.filter((origin): origin is string => typeof origin === "string" && /^https?:\/\/[^/]+$/.test(origin))
    : [];
  return { slug, version, savePrefix, embedders, title: typeof value.title === "string" ? value.title.slice(0, 120) : slug };
}

/** 이 판본의 세이브 이름. 스토어 서버 gameSaveNamespace 와 같은 모양이다. */
export const storeGameSaveNamespace = (boot: StoreGameBoot): string => `${boot.savePrefix}${boot.version}`;

/**
 * 품은 쪽이 허락된 스토어인가. 최상위 창(새 창으로 열기)은 언제나 된다.
 * 크로뮴·사파리는 location.ancestorOrigins 로, 그 밖은 document.referrer(스토어가 strict-origin 으로 보낸다)로 본다.
 * 품었는데 둘 다 알 수 없으면 막는다(보안 검토 2026-10-23) — 다른 사이트가 referrer 를 끄고 품는 길을 닫는다.
 */
export function storeGameEmbedderAllowed(boot: StoreGameBoot, win: Window = window): boolean {
  let framed = false;
  try { framed = win.top !== win.self; } catch { framed = true; }
  if (!framed || boot.embedders.length === 0) return true;
  const ancestors = (win.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
  if (ancestors && ancestors.length > 0) {
    for (let index = 0; index < ancestors.length; index += 1) if (!boot.embedders.includes(ancestors.item(index) ?? "")) return false;
    return true;
  }
  // 품은 쪽을 알 수 없으면 막는다(스토어는 strict-origin 으로 출처를 보낸다). 새 창으로 열면 최상위라 위에서 통과한다.
  const referrer = win.document.referrer;
  if (!referrer) return false;
  try { return boot.embedders.includes(new URL(referrer).origin); } catch { return false; }
}

export interface OlderVersionSave {
  readonly version: string;
  readonly keys: readonly string[];
  /** 그 판본 세이브 중 가장 최근 저장 시각(ms). 모르면 0. */
  readonly savedAt: number;
}

const compareVersions = (a: string, b: string): number => {
  const [am = 0, an = 0] = a.split(".").map(Number);
  const [bm = 0, bn = 0] = b.split(".").map(Number);
  return am - bm || an - bn;
};

function savedAtOf(text: string | null): number {
  if (!text) return 0;
  try {
    const value = JSON.parse(text) as { savedAt?: unknown };
    const at = typeof value.savedAt === "string" ? Date.parse(value.savedAt) : typeof value.savedAt === "number" ? value.savedAt : NaN;
    return Number.isFinite(at) ? at : 0;
  } catch {
    return 0;
  }
}

/** 이 게임의 다른 판본 세이브(세이브 슬롯 키가 있는 판본만). 최근에 저장한 판본이 앞이다. */
export function olderVersionSaves(storage: Storage, boot: StoreGameBoot): OlderVersionSave[] {
  const byVersion = new Map<string, string[]>();
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(boot.savePrefix)) continue;
    const rest = key.slice(boot.savePrefix.length);
    const version = rest.slice(0, rest.indexOf(":"));
    if (!VERSION.test(version) || version === boot.version) continue;
    byVersion.set(version, [...(byVersion.get(version) ?? []), key]);
  }
  return [...byVersion.entries()]
    .filter(([, keys]) => keys.some((key) => key.includes(":save-slot:")))
    .map(([version, keys]) => ({
      version, keys,
      savedAt: Math.max(0, ...keys.filter((key) => key.includes(":save-slot:")).map((key) => savedAtOf(storage.getItem(key)))),
    }))
    .sort((a, b) => b.savedAt - a.savedAt || compareVersions(b.version, a.version));
}

const DECIDED_SUFFIX = ":store-continue:v1";

/** 이 판본에서 이미 고른 적이 있거나(이어서/새로) 이 판본 세이브가 있으면 다시 묻지 않는다. */
export function shouldOfferContinue(storage: Storage, boot: StoreGameBoot): OlderVersionSave | null {
  const namespace = storeGameSaveNamespace(boot);
  if (storage.getItem(`${namespace}${DECIDED_SUFFIX}`) !== null) return null;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(`${namespace}:save-slot:`)) return null;
  }
  return olderVersionSaves(storage, boot)[0] ?? null;
}

/** 옛 판본 세이브를 이 판본 이름으로 복사한다. 옛 키는 지우지 않는다(옛 판본을 다시 열어도 그대로). 복사한 키 수. */
export function continueFromOlderVersion(storage: Storage, boot: StoreGameBoot, from: OlderVersionSave): number {
  const fromNamespace = `${boot.savePrefix}${from.version}`;
  const namespace = storeGameSaveNamespace(boot);
  let copied = 0;
  for (const key of from.keys) {
    if (key.endsWith(DECIDED_SUFFIX)) continue;
    const value = storage.getItem(key);
    if (value === null) continue;
    storage.setItem(`${namespace}${key.slice(fromNamespace.length)}`, value);
    copied += 1;
  }
  storage.setItem(`${namespace}${DECIDED_SUFFIX}`, JSON.stringify({ choice: "continue", from: from.version }));
  return copied;
}

export function declineOlderVersion(storage: Storage, boot: StoreGameBoot): void {
  storage.setItem(`${storeGameSaveNamespace(boot)}${DECIDED_SUFFIX}`, JSON.stringify({ choice: "fresh" }));
}

/** 이어서 할지 묻는 작은 창. 키보드(←/→, Enter)와 터치 모두. 고르면 닫고 답을 돌려준다. */
export function askContinueFromOlderVersion(root: HTMLElement, boot: StoreGameBoot, from: OlderVersionSave): Promise<"continue" | "fresh"> {
  return new Promise((resolve) => {
    const panel = document.createElement("section");
    panel.className = "store-continue";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.dataset.testid = "store-continue";
    panel.style.cssText = "position:fixed;inset:0;display:grid;place-items:center;background:#000;color:#eee;font:15px/1.6 system-ui,sans-serif;z-index:10;";
    const box = document.createElement("div");
    box.style.cssText = "max-width:min(440px,90vw);padding:22px 24px;border:1px solid #444;border-radius:10px;background:#15171d;";
    const title = document.createElement("h2");
    title.style.cssText = "margin:0 0 8px;font-size:18px;";
    title.textContent = `v${from.version} 세이브로 이어서 할까요?`;
    const note = document.createElement("p");
    note.style.cssText = "margin:0 0 6px;";
    note.textContent = `지금 판본은 v${boot.version} 입니다. 이전 판본(v${from.version})에서 저장한 기록이 이 브라우저에 있습니다.`;
    const caution = document.createElement("p");
    caution.dataset.testid = "store-continue-note";
    caution.style.cssText = "margin:0 0 16px;color:#f0b54a;font-size:13px;";
    caution.textContent = "판본이 달라 맵·이벤트가 바뀌었다면 일부 진행이 맞지 않을 수 있습니다. 옛 판본 세이브는 그대로 남습니다.";
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;";
    const button = (label: string, primary: boolean, choice: "continue" | "fresh"): HTMLButtonElement => {
      const node = document.createElement("button");
      node.type = "button";
      node.textContent = label;
      node.dataset.choice = choice;
      node.style.cssText = `font:inherit;padding:8px 16px;border-radius:6px;cursor:pointer;border:1px solid ${primary ? "#f0b54a" : "#555"};background:${primary ? "#f0b54a" : "transparent"};color:${primary ? "#1b1406" : "#eee"};`;
      node.addEventListener("click", () => finish(choice));
      return node;
    };
    const keep = button("이어서 하기", true, "continue");
    const fresh = button("새로 시작", false, "fresh");
    row.append(fresh, keep);
    box.append(title, note, caution, row);
    panel.append(box);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); (document.activeElement === keep ? fresh : keep).focus(); }
      else if (event.key === "Escape") { event.preventDefault(); finish("fresh"); }
    };
    const finish = (choice: "continue" | "fresh"): void => {
      document.removeEventListener("keydown", onKey, true);
      panel.remove();
      resolve(choice);
    };
    document.addEventListener("keydown", onKey, true);
    root.append(panel);
    keep.focus();
  });
}

export function renderStoreEmbedBlocked(root: HTMLElement, boot: StoreGameBoot): void {
  root.textContent = "";
  const panel = document.createElement("section");
  panel.className = "player-export-error";
  panel.textContent = `「${boot.title}」은(는) OPRN 스토어에서 플레이할 수 있습니다.`;
  root.append(panel);
}
