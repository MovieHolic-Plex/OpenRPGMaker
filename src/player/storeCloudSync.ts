// player/storeCloudSync.ts
// 스토어 웹 게임의 클라우드 세이브 맞추기. 다리(storeCloudBridge.ts)가 있고 로그인했을 때만 돈다.
//
// 원칙
// - 언제나 브라우저(localStorage)에 먼저 쓴다. 클라우드는 그 뒤에 따라간다(디바운스). 네트워크가 없어도 게임은 지금과 같다.
// - 클라우드는 판본이 아니라 게임(slug)에 묶인다 — 판본이 바뀌어도 같은 칸을 본다. 판본별 이어하기(storeGameHost.ts)는 그대로다.
// - 칸마다 「마지막으로 맞춘 판(rev)·내용 해시」를 이 브라우저에 적어 둔다(계정별). 그것으로 어느 쪽이 바뀌었는지 안다.
//     한쪽만 바뀜 → 그쪽을 따른다. 둘 다 바뀜(충돌) → 저장 시각이 늦은 쪽이 칸을 차지하고, 다른 쪽은 「다른 기기 세이브」로 남긴다.
//     조용히 지우는 일은 없다. 불러오기 화면에서 언제든 맞바꿔 고를 수 있다.
// - 이 브라우저에 있던 세이브를 계정에 처음 올리는 것은 묻고 나서다(공용 PC 에서 남의 세이브가 내 계정으로 가지 않게).
import { autosaveKey, clearRecordKey, saveSlotKey } from "@/player/saveSlots";
import type { StoreGameBoot } from "@/player/storeGameHost";
import { CLOUD_SLOTS, connectStoreCloud, type CloudBridge, type CloudSlot, type CloudSlotName } from "@/player/storeCloudBridge";

interface SlotMeta { rev: number; hash: string; localOnly?: true }
interface CloudMeta { account: string; slots: Partial<Record<CloudSlotName, SlotMeta>> }
export interface CloudOtherSave { readonly slot: CloudSlotName; readonly data: string; readonly savedAt: string | null; readonly keptAt: string }

type Status = "local-only" | "pending" | "synced" | "error";

interface ActiveSync {
  readonly boot: StoreGameBoot;
  readonly bridge: CloudBridge;
  readonly storage: Storage;
  meta: CloudMeta;
  status: Status;
  readonly timers: Map<CloudSlotName, ReturnType<typeof setTimeout>>;
  readonly inFlight: Set<CloudSlotName>;
  readonly again: Set<CloudSlotName>;
  suppress: number;
  restoreHook: () => void;
}

let connecting: Promise<CloudBridge | null> | null = null;
let listing: Promise<CloudSlot[] | null> | null = null;
let present: CloudBridge | null = null;
let active: ActiveSync | null = null;

const PUSH_DELAY_MS = 1200;
const RETRY_DELAY_MS = 20_000;

// ── 순수 도우미 ─────────────────────────────────────────────────────────

/** 내용 해시(비밀 아님, 바뀌었나만 본다). FNV-1a 두 갈래 + 길이. */
export function contentHash(text: string): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ text.length;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ (code + index), 0x5bd1e995) >>> 0;
  }
  return `${text.length.toString(36)}-${a.toString(36)}-${b.toString(36)}`;
}

/** 세이브(또는 클리어 기록) 안의 저장 시각(ms). 모르면 0. */
export function savedAtMs(text: string | null): number {
  if (!text) return 0;
  try {
    const value = JSON.parse(text) as { savedAt?: unknown; clearedAt?: unknown };
    const raw = value.savedAt ?? value.clearedAt;
    const at = typeof raw === "string" ? Date.parse(raw) : typeof raw === "number" ? raw : NaN;
    return Number.isFinite(at) ? at : 0;
  } catch {
    return 0;
  }
}

const baseOf = (boot: StoreGameBoot): string => boot.savePrefix.replace(/@$/u, "");
export const cloudMetaKey = (boot: StoreGameBoot): string => `${baseOf(boot)}:cloud-sync:v1`;
export const cloudOtherKey = (boot: StoreGameBoot, slot: CloudSlotName): string => `${baseOf(boot)}:cloud-other:v1:${slot}`;

/** 논리 칸 → 이 판본의 localStorage 키(세이브 이름·발행 정체성을 따른다 — saveSlots.ts 가 정본). */
export function localKeyOf(slot: CloudSlotName): string {
  if (slot === "auto") return autosaveKey();
  if (slot === "clear") return clearRecordKey();
  return saveSlotKey(Number(slot) as 1 | 2 | 3);
}

function readMeta(storage: Storage, boot: StoreGameBoot, account: string): CloudMeta {
  try {
    const raw = JSON.parse(storage.getItem(cloudMetaKey(boot)) ?? "null") as CloudMeta | null;
    if (raw && raw.account === account && raw.slots && typeof raw.slots === "object") return { account, slots: raw.slots };
  } catch { /* 망가진 기록은 새로 */ }
  return { account, slots: {} };
}

/** 두 클리어 기록 합치기: 본 엔딩은 합집합, 클리어 횟수는 큰 쪽, 나머지는 늦은 쪽. */
export function mergeClearRecords(a: string, b: string): string {
  try {
    const left = JSON.parse(a) as { endingIds?: unknown; clearCount?: unknown };
    const right = JSON.parse(b) as { endingIds?: unknown; clearCount?: unknown };
    const newer = savedAtMs(a) >= savedAtMs(b) ? left : right;
    const ids = (value: unknown): string[] => (Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
    const count = (value: unknown): number => (typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0);
    const clearCount = Math.max(count(left.clearCount), count(right.clearCount));
    return JSON.stringify({ ...newer, endingIds: [...new Set([...ids(left.endingIds), ...ids(right.endingIds)])], ...(clearCount ? { clearCount } : {}) });
  } catch {
    return savedAtMs(a) >= savedAtMs(b) ? a : b;
  }
}

export type SlotPlan =
  | { readonly kind: "none" }
  | { readonly kind: "take-cloud"; readonly keepLocalAsOther: boolean }
  | { readonly kind: "push"; readonly base: number; readonly keepCloudAsOther: boolean }
  | { readonly kind: "offer-upload"; readonly base: number; readonly keepCloudAsOther: boolean }
  | { readonly kind: "mark"; readonly rev: number }
  | { readonly kind: "merge-clear"; readonly base: number; readonly push: boolean };

/**
 * 한 칸을 어떻게 맞출지(부팅 때). local/cloud 는 내용, meta 는 이 계정으로 마지막에 맞춘 기록.
 * meta 가 없으면(이 브라우저에서 이 계정과 처음) 로컬을 계정에 올리는 일은 묻는다(offer-upload).
 */
export function planSlot(slot: CloudSlotName, local: string | null, cloud: CloudSlot | null, meta: SlotMeta | undefined): SlotPlan {
  if (local === null && !cloud) return { kind: "none" };
  if (local === null) return { kind: "take-cloud", keepLocalAsOther: false };
  const localHash = contentHash(local);
  if (!cloud) {
    if (!meta) return { kind: "offer-upload", base: 0, keepCloudAsOther: false };
    if (meta.localOnly && meta.hash === localHash) return { kind: "none" };
    return { kind: "push", base: 0, keepCloudAsOther: false };
  }
  const cloudHash = contentHash(cloud.data);
  if (localHash === cloudHash) return { kind: "mark", rev: cloud.revision };
  if (meta && !meta.localOnly && meta.rev === cloud.revision) return { kind: "push", base: cloud.revision, keepCloudAsOther: false };
  if (meta && meta.hash === localHash) {
    // 로컬은 그대로인데 클라우드가 바뀜 → 클라우드를 따른다. 단 「올리지 않기로 한」 로컬이면 버리지 않고 남긴다.
    return { kind: "take-cloud", keepLocalAsOther: meta.localOnly === true };
  }
  // 둘 다 바뀌었다(또는 이 계정과 처음인데 내용이 다르다).
  if (slot === "clear") return { kind: "merge-clear", base: cloud.revision, push: meta !== undefined && !meta.localOnly };
  const localNewer = savedAtMs(local) > savedAtMs(cloud.data);
  if (!localNewer) return { kind: "take-cloud", keepLocalAsOther: true };
  if (meta && !meta.localOnly) return { kind: "push", base: cloud.revision, keepCloudAsOther: true }; // 클라우드 것은 「다른 기기 세이브」로 남긴다
  return { kind: "offer-upload", base: cloud.revision, keepCloudAsOther: true };
}

// ── 다른 기기 세이브(충돌 때 남긴 쪽) ───────────────────────────────────

function keepOther(sync: ActiveSync, slot: CloudSlotName, data: string): void {
  if (slot === "clear") return; // 클리어 기록은 합친다(mergeClearRecords) — 따로 남기지 않는다
  const value: CloudOtherSave = { slot, data, savedAt: new Date(savedAtMs(data) || Date.now()).toISOString(), keptAt: new Date().toISOString() };
  writeQuiet(sync, cloudOtherKey(sync.boot, slot), JSON.stringify(value));
}

/** 불러오기 화면이 보일 「다른 기기 세이브」. 클라우드 다리가 없으면 빈 목록. */
export function listCloudOtherSaves(): CloudOtherSave[] {
  if (!active) return [];
  const out: CloudOtherSave[] = [];
  for (const slot of CLOUD_SLOTS) {
    try {
      const raw = JSON.parse(active.storage.getItem(cloudOtherKey(active.boot, slot)) ?? "null") as CloudOtherSave | null;
      if (raw && typeof raw.data === "string") out.push({ slot, data: raw.data, savedAt: typeof raw.savedAt === "string" ? raw.savedAt : null, keptAt: String(raw.keptAt ?? "") });
    } catch { /* 무시 */ }
  }
  return out;
}

/**
 * 「다른 기기 세이브」를 그 칸으로 고른다: 둘을 맞바꾼다(지금 칸 내용은 「다른 기기 세이브」 자리로 간다 — 지우지 않는다).
 * 칸이 바뀌었으니 클라우드에도 올라간다.
 */
export function chooseCloudOtherSave(slot: CloudSlotName): boolean {
  const sync = active;
  if (!sync) return false;
  const otherKey = cloudOtherKey(sync.boot, slot);
  let other: CloudOtherSave | null = null;
  try { other = JSON.parse(sync.storage.getItem(otherKey) ?? "null") as CloudOtherSave | null; } catch { other = null; }
  if (!other || typeof other.data !== "string") return false;
  const key = localKeyOf(slot);
  const current = sync.storage.getItem(key);
  if (current !== null) writeQuiet(sync, otherKey, JSON.stringify({ slot, data: current, savedAt: new Date(savedAtMs(current) || Date.now()).toISOString(), keptAt: new Date().toISOString() }));
  else sync.storage.removeItem(otherKey);
  sync.storage.setItem(key, other.data); // 훅이 올린다
  return true;
}

// ── 상태 글자(저장·불러오기 화면) ────────────────────────────────────────

/** 저장·불러오기 화면 한 줄. 스토어 play 화면 밖(내보낸 게임·새 창)이면 null — 지금 화면 그대로. */
export function cloudSaveStatusText(): string | null {
  if (!present) return null;
  if (!present.signedIn || !active) return "☁ 이 브라우저에만 저장됨 — 로그인하면 기기 간 이어하기";
  switch (active.status) {
    case "pending": return "☁ 클라우드에 올리는 중…";
    case "error": return "☁ 클라우드 저장 실패 — 이 브라우저에는 저장됨";
    case "local-only": return "☁ 이 브라우저에만 저장됨(계정에 올리지 않기로 함)";
    default: return "☁ 클라우드 저장됨";
  }
}

// ── 부팅 ──────────────────────────────────────────────────────────────

/** 부팅 맨 앞에서 부른다: 부모에게 인사하고, 로그인했으면 목록을 미리 받아 둔다(프로젝트를 받는 동안). */
export function prepareStoreCloud(boot: StoreGameBoot): void {
  if (connecting) return;
  connecting = connectStoreCloud(boot).catch(() => null);
  listing = connecting.then((bridge) => (bridge?.signedIn ? bridge.list().catch(() => null) : null));
}

export interface StoreCloudStartResult { readonly bridge: boolean; readonly signedIn: boolean; readonly pulled: number; readonly conflicts: number; readonly offered: number }

/**
 * 세이브 이름이 정해진 뒤(startPlayer), 타이틀을 그리기 전에 부른다. 클라우드와 맞추고, 처음이면 올릴지 묻고, 이후 쓰기를 따라간다.
 * 어떤 실패도 부팅을 막지 않는다.
 */
export async function startStoreCloudSync(root: HTMLElement, boot: StoreGameBoot, storage: Storage): Promise<StoreCloudStartResult> {
  const none = { bridge: false, signedIn: false, pulled: 0, conflicts: 0, offered: 0 };
  if (!connecting) return none;
  const bridge = await connecting;
  present = bridge;
  if (!bridge) return none;
  if (!bridge.signedIn) { bridge.state("on"); return { ...none, bridge: true }; }
  const cloud = await listing;
  const sync: ActiveSync = {
    boot, bridge, storage, meta: readMeta(storage, boot, bridge.account), status: "synced",
    timers: new Map(), inFlight: new Set(), again: new Set(), suppress: 0, restoreHook: () => undefined,
  };
  active = sync;
  if (!cloud) {
    // 목록을 못 받았다(네트워크·서버). 로컬만으로 돈다 — 쓰기는 다음에 다시 시도한다.
    sync.status = "error";
    bridge.state("error");
    sync.restoreHook = installHook(sync);
    return { bridge: true, signedIn: true, pulled: 0, conflicts: 0, offered: 0 };
  }
  const byName = new Map(cloud.map((slot) => [slot.slot, slot] as const));
  let pulled = 0, conflicts = 0;
  const pushes: { slot: CloudSlotName; base: number }[] = [];
  const offers: { slot: CloudSlotName; base: number }[] = [];
  for (const slot of CLOUD_SLOTS) {
    const key = localKeyOf(slot);
    const local = storage.getItem(key);
    const remote = byName.get(slot) ?? null;
    const plan = planSlot(slot, local, remote, sync.meta.slots[slot]);
    switch (plan.kind) {
      case "none": break;
      case "mark": sync.meta.slots[slot] = { rev: plan.rev, hash: contentHash(local!) }; break;
      case "take-cloud":
        if (plan.keepLocalAsOther && local !== null) { keepOther(sync, slot, local); conflicts += 1; }
        writeQuiet(sync, key, remote!.data);
        sync.meta.slots[slot] = { rev: remote!.revision, hash: contentHash(remote!.data) };
        pulled += 1;
        break;
      case "push":
        if (plan.keepCloudAsOther && remote) { keepOther(sync, slot, remote.data); conflicts += 1; }
        pushes.push({ slot, base: plan.base });
        break;
      case "offer-upload":
        if (plan.keepCloudAsOther && remote) { keepOther(sync, slot, remote.data); conflicts += 1; }
        offers.push({ slot, base: plan.base });
        break;
      case "merge-clear": {
        const merged = mergeClearRecords(local!, remote!.data);
        writeQuiet(sync, key, merged);
        if (plan.push) pushes.push({ slot, base: plan.base });
        else offers.push({ slot, base: plan.base });
        break;
      }
    }
  }
  saveMeta(sync);
  if (offers.length > 0) {
    const choice = await askUploadLocalSaves(root, offers.filter((offer) => offer.slot !== "clear").length || 1);
    for (const offer of offers) {
      const local = storage.getItem(localKeyOf(offer.slot));
      if (local === null) continue;
      if (choice === "upload") pushes.push(offer);
      else sync.meta.slots[offer.slot] = { rev: offer.base, hash: contentHash(local), localOnly: true };
    }
    if (choice !== "upload") sync.status = "local-only";
    saveMeta(sync);
  }
  sync.restoreHook = installHook(sync);
  for (const push of pushes) {
    // push 의 base 는 계획 때 본 클라우드 판이다. 메타에 적어 두고 올린다.
    const local = storage.getItem(localKeyOf(push.slot));
    if (local === null) continue;
    sync.meta.slots[push.slot] = { rev: push.base, hash: "" };
    void pushSlot(sync, push.slot);
  }
  if (pushes.length === 0 && sync.status !== "local-only") bridge.state("synced");
  if (conflicts > 0) showCloudToast(root, "다른 기기 세이브가 있어요 — 불러오기 화면에서 고를 수 있어요");
  return { bridge: true, signedIn: true, pulled, conflicts, offered: offers.length };
}

function saveMeta(sync: ActiveSync): void {
  writeQuiet(sync, cloudMetaKey(sync.boot), JSON.stringify(sync.meta));
}

/** 훅이 보지 않게 쓴다(맞추기 때 받아 온 내용·기록). 저장 공간이 모자라도 부팅은 계속. */
function writeQuiet(sync: ActiveSync, key: string, value: string): void {
  sync.suppress += 1;
  try { sync.storage.setItem(key, value); } catch (error) { console.warn("[cloud-save] 로컬에 쓰지 못했습니다:", error); } finally { sync.suppress -= 1; }
}

/** 이 게임 세이브 키에 쓰면(수동 저장·자동 저장·클리어 기록·이어하기 복사) 잠시 뒤 클라우드로 올린다. */
function installHook(sync: ActiveSync): () => void {
  if (typeof Storage === "undefined") return () => undefined;
  const original = Storage.prototype.setItem;
  const hooked = function (this: Storage, key: string, value: string): void {
    original.call(this, key, value);
    if (this !== sync.storage || sync.suppress > 0 || active !== sync) return;
    for (const slot of CLOUD_SLOTS) if (localKeyOf(slot) === key) { schedulePush(sync, slot, PUSH_DELAY_MS); break; }
  };
  try { Storage.prototype.setItem = hooked; } catch { return () => undefined; }
  const flush = (): void => { if (document.visibilityState === "hidden") for (const slot of [...sync.timers.keys()]) schedulePush(sync, slot, 0); };
  document.addEventListener("visibilitychange", flush);
  return () => {
    document.removeEventListener("visibilitychange", flush);
    if (Storage.prototype.setItem === hooked) Storage.prototype.setItem = original;
  };
}

function schedulePush(sync: ActiveSync, slot: CloudSlotName, delay: number): void {
  const timer = sync.timers.get(slot);
  if (timer) clearTimeout(timer);
  if (sync.status !== "error") { sync.status = "pending"; }
  sync.timers.set(slot, setTimeout(() => { sync.timers.delete(slot); void pushSlot(sync, slot); }, delay));
}

async function pushSlot(sync: ActiveSync, slot: CloudSlotName, attempt = 0): Promise<void> {
  if (sync.inFlight.has(slot)) { sync.again.add(slot); return; }
  const key = localKeyOf(slot);
  const local = sync.storage.getItem(key);
  if (local === null) return;
  const hash = contentHash(local);
  const meta = sync.meta.slots[slot];
  if (meta && !meta.localOnly && meta.hash === hash) { settle(sync); return; }
  sync.inFlight.add(slot);
  sync.status = "pending";
  try {
    const savedAt = savedAtMs(local);
    const result = await sync.bridge.put(slot, local, meta?.rev ?? 0, savedAt ? new Date(savedAt).toISOString() : null);
    if (result.ok) {
      sync.meta.slots[slot] = { rev: result.revision, hash };
      saveMeta(sync);
      sync.status = "synced";
    } else if (result.conflict) {
      const current = result.current;
      if (!current) { sync.meta.slots[slot] = { rev: 0, hash: "" }; if (attempt < 2) { sync.inFlight.delete(slot); return pushSlot(sync, slot, attempt + 1); } }
      else if (contentHash(current.data) === hash) { sync.meta.slots[slot] = { rev: current.revision, hash }; saveMeta(sync); sync.status = "synced"; }
      else if (slot === "clear") {
        writeQuiet(sync, key, mergeClearRecords(local, current.data));
        sync.meta.slots[slot] = { rev: current.revision, hash: "" };
        if (attempt < 2) { sync.inFlight.delete(slot); return pushSlot(sync, slot, attempt + 1); }
      } else if (savedAtMs(local) >= savedAtMs(current.data)) {
        // 방금 여기서 저장한 쪽이 더 늦다 → 칸은 이것, 클라우드에 있던 것은 「다른 기기 세이브」로 남기고 올린다.
        keepOther(sync, slot, current.data);
        sync.meta.slots[slot] = { rev: current.revision, hash: "" };
        if (attempt < 2) { sync.inFlight.delete(slot); return pushSlot(sync, slot, attempt + 1); }
      } else {
        // 다른 기기가 더 늦게 저장했다 → 칸은 그쪽, 여기 것은 「다른 기기 세이브」 자리에 남긴다(지우지 않는다).
        keepOther(sync, slot, local);
        writeQuiet(sync, key, current.data);
        sync.meta.slots[slot] = { rev: current.revision, hash: contentHash(current.data) };
        saveMeta(sync);
        sync.status = "synced";
      }
    } else {
      sync.status = "error";
      sync.bridge.state("error");
      setTimeout(() => { if (active === sync) schedulePush(sync, slot, 0); }, RETRY_DELAY_MS);
      return;
    }
  } finally {
    sync.inFlight.delete(slot);
  }
  if (sync.again.delete(slot)) { void pushSlot(sync, slot); return; }
  settle(sync);
}

function settle(sync: ActiveSync): void {
  if (sync.inFlight.size > 0 || sync.timers.size > 0 || sync.status === "error") return;
  sync.status = "synced";
  sync.bridge.state("synced");
}

// ── 작은 창 ────────────────────────────────────────────────────────────

/** 처음 로그인한 브라우저: 여기 있던 세이브를 계정에 올릴지 묻는다. */
export function askUploadLocalSaves(root: HTMLElement, count: number): Promise<"upload" | "later"> {
  return new Promise((resolve) => {
    const panel = document.createElement("section");
    panel.className = "store-cloud-upload";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.dataset.testid = "store-cloud-upload";
    panel.style.cssText = "position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.82);color:#eee;font:15px/1.6 system-ui,sans-serif;z-index:20;";
    const box = document.createElement("div");
    box.style.cssText = "max-width:min(440px,90vw);padding:22px 24px;border:1px solid #444;border-radius:10px;background:#15171d;";
    const title = document.createElement("h2");
    title.style.cssText = "margin:0 0 8px;font-size:18px;";
    title.textContent = "☁ 이 브라우저의 세이브를 계정에 올릴까요?";
    const note = document.createElement("p");
    note.style.cssText = "margin:0 0 16px;";
    note.textContent = `이 브라우저에 세이브 ${count}개가 있습니다. 올리면 다른 기기에서도 이어서 할 수 있어요. 올리지 않아도 이 브라우저에는 그대로 남습니다.`;
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;";
    const button = (label: string, primary: boolean, choice: "upload" | "later"): HTMLButtonElement => {
      const node = document.createElement("button");
      node.type = "button";
      node.textContent = label;
      node.dataset.choice = choice;
      node.style.cssText = `font:inherit;padding:8px 16px;border-radius:6px;cursor:pointer;border:1px solid ${primary ? "#f0b54a" : "#555"};background:${primary ? "#f0b54a" : "transparent"};color:${primary ? "#1b1406" : "#eee"};`;
      node.addEventListener("click", () => finish(choice));
      return node;
    };
    const upload = button("올리기", true, "upload");
    const later = button("이 브라우저에만 두기", false, "later");
    row.append(later, upload);
    box.append(title, note, row);
    panel.append(box);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); (document.activeElement === upload ? later : upload).focus(); }
      else if (event.key === "Escape") { event.preventDefault(); finish("later"); }
    };
    const finish = (choice: "upload" | "later"): void => {
      document.removeEventListener("keydown", onKey, true);
      panel.remove();
      resolve(choice);
    };
    document.addEventListener("keydown", onKey, true);
    root.append(panel);
    upload.focus();
  });
}

function showCloudToast(_root: HTMLElement, text: string): void {
  const toast = document.createElement("div");
  toast.dataset.testid = "store-cloud-toast";
  toast.setAttribute("role", "status");
  toast.style.cssText = "position:fixed;left:50%;top:14px;transform:translateX(-50%);max-width:90vw;padding:8px 14px;border-radius:8px;background:rgba(21,23,29,.94);border:1px solid #f0b54a;color:#eee;font:14px/1.5 system-ui,sans-serif;z-index:20;pointer-events:none;";
  toast.textContent = `☁ ${text}`;
  // 타이틀을 그리면서 root 를 비우므로 body 에 붙인다.
  document.body.append(toast);
  setTimeout(() => toast.remove(), 9000);
}
