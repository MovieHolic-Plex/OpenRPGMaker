// player/storeCloudBridge.ts
// 스토어 웹 게임의 클라우드 세이브 다리 — 게임(iframe, games-* 출처) 쪽.
//
// 게임 출처는 로그인 쿠키·토큰을 받지 않는다. 대신 품은 play 화면(부모 창, OpenRPGMaker-store public/cloudsave.js)에
// postMessage 로 「목록」「이 칸 쓰기」를 부탁하고, 부모가 자기 출처의 API 를 쿠키로 불러 결과만 돌려준다.
//
// 받는 쪽 검사(이 파일): 보낸 창이 바로 부모(event.source === window.parent)이고, 출처가 부팅값 embedders 에 든
// 부모 출처이고, slug 가 이 게임일 때만 받는다. 보낼 때는 언제나 그 부모 출처를 targetOrigin 으로 준다 — '*' 를 쓰지 않는다.
// 부모가 없거나(새 창·내보낸 zip·데스크톱) 답이 없으면 null — 플레이어는 지금처럼 브라우저 저장만 쓴다.
import type { StoreGameBoot } from "@/player/storeGameHost";

export const CLOUD_SLOTS = ["1", "2", "3", "auto", "clear"] as const;
export type CloudSlotName = (typeof CLOUD_SLOTS)[number];

export interface CloudSlot {
  readonly slot: CloudSlotName;
  readonly revision: number;
  readonly savedAt: string | null;
  readonly updatedAt: string;
  readonly gameVersion: string | null;
  readonly data: string;
}

export type CloudPutResult =
  | { readonly ok: true; readonly revision: number }
  | { readonly ok: false; readonly conflict: true; readonly current: CloudSlot | null }
  | { readonly ok: false; readonly conflict: false; readonly status: number };

export interface CloudBridge {
  readonly signedIn: boolean;
  /** 이 계정·이 게임을 가리키는 표시용 열쇠(비밀 아님). 브라우저에 「어느 계정과 맞췄나」를 적어 둘 때 쓴다. */
  readonly account: string;
  list(): Promise<CloudSlot[] | null>;
  put(slot: CloudSlotName, payload: string, baseRevision: number, savedAt: string | null): Promise<CloudPutResult>;
  /** play 화면 아래 줄을 바꾼다(on·synced·error). */
  state(state: "on" | "synced" | "error"): void;
}

const isSlotName = (value: unknown): value is CloudSlotName => typeof value === "string" && (CLOUD_SLOTS as readonly string[]).includes(value);

export function parseCloudSlot(value: unknown): CloudSlot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!isSlotName(raw.slot) || typeof raw.data !== "string" || typeof raw.revision !== "number" || !Number.isInteger(raw.revision) || raw.revision < 1) return null;
  return {
    slot: raw.slot,
    revision: raw.revision,
    data: raw.data,
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : null,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
    gameVersion: typeof raw.gameVersion === "string" ? raw.gameVersion : null,
  };
}

/** 품은 바로 위 창의 출처. 허락된 embedders 에 없으면 null(다리를 열지 않는다). */
export function cloudParentOrigin(boot: StoreGameBoot, win: Window = window): string | null {
  let framed = false;
  try { framed = win.parent !== win.self; } catch { framed = true; }
  if (!framed || boot.embedders.length === 0) return null;
  const ancestors = (win.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
  let origin: string | null = null;
  if (ancestors && ancestors.length > 0) origin = ancestors.item(0);
  else {
    try { origin = win.document.referrer ? new URL(win.document.referrer).origin : null; } catch { origin = null; }
  }
  return origin && boot.embedders.includes(origin) && origin !== win.location.origin ? origin : null;
}

type Pending = { resolve: (value: Record<string, unknown>) => void; timer: ReturnType<typeof setTimeout> };

/**
 * 부모에게 인사하고 답(status)을 기다린다. 답이 오면 다리, 아니면 null.
 * 인사는 부모 스크립트가 늦게 붙을 수 있어 몇 번 되풀이한다.
 */
export function connectStoreCloud(boot: StoreGameBoot, options: { win?: Window; timeoutMs?: number; requestTimeoutMs?: number } = {}): Promise<CloudBridge | null> {
  const win = options.win ?? window;
  const parentOrigin = cloudParentOrigin(boot, win);
  if (!parentOrigin) return Promise.resolve(null);
  const parent = win.parent;
  const send = (message: Record<string, unknown>): void => parent.postMessage({ oprnCloud: 1, slug: boot.slug, ...message }, parentOrigin);
  const pending = new Map<number, Pending>();
  let nextId = 1;
  return new Promise((resolve) => {
    let settled = false;
    let hello: ReturnType<typeof setInterval> | undefined;
    const finish = (value: CloudBridge | null): void => {
      if (settled) return;
      settled = true;
      if (hello) clearInterval(hello);
      clearTimeout(deadline);
      if (!value) win.removeEventListener("message", onMessage);
      resolve(value);
    };
    const request = (message: Record<string, unknown>): Promise<Record<string, unknown>> => new Promise((done) => {
      const id = nextId++;
      const timer = setTimeout(() => { pending.delete(id); done({ ok: false, status: 0 }); }, options.requestTimeoutMs ?? 15_000);
      pending.set(id, { resolve: done, timer });
      send({ ...message, id });
    });
    function onMessage(event: MessageEvent): void {
      if (event.source !== parent || event.origin !== parentOrigin) return;
      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== "object" || data.oprnCloud !== 1 || data.slug !== boot.slug || typeof data.type !== "string") return;
      if (data.type === "status") {
        const account = typeof data.account === "string" && /^[0-9a-f]{8,64}$/.test(data.account) ? data.account : "";
        finish({
          signedIn: data.signedIn === true && account !== "",
          account,
          list: async () => {
            const result = await request({ type: "list" });
            if (result.ok !== true || !Array.isArray(result.slots)) return null;
            return result.slots.map(parseCloudSlot).filter((slot): slot is CloudSlot => slot !== null);
          },
          put: async (slot, payload, baseRevision, savedAt) => {
            const result = await request({ type: "put", slot, payload, baseRevision, savedAt, gameVersion: boot.version });
            if (result.ok === true) {
              const save = result.save as Record<string, unknown> | undefined;
              const revision = typeof save?.revision === "number" ? save.revision : baseRevision + 1;
              return { ok: true, revision };
            }
            if (result.conflict === true) return { ok: false, conflict: true, current: parseCloudSlot(result.current) };
            return { ok: false, conflict: false, status: typeof result.status === "number" ? result.status : 0 };
          },
          state: (state) => send({ type: "state", state }),
        });
        return;
      }
      const id = typeof data.id === "number" ? data.id : -1;
      const waiting = pending.get(id);
      if (!waiting || !data.type.endsWith("-result")) return;
      pending.delete(id);
      clearTimeout(waiting.timer);
      waiting.resolve(data);
    }
    win.addEventListener("message", onMessage);
    const deadline = setTimeout(() => finish(null), options.timeoutMs ?? 4000);
    send({ type: "hello" });
    hello = setInterval(() => send({ type: "hello" }), 300);
  });
}
