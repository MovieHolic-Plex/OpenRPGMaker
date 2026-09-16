import { OPRN_CHANNELS } from "../shared/channels";

type BrowserBridgeConfig = {
  readonly endpoint: string;
  readonly token: string;
  readonly companionToken?: string | null;
};

declare global {
  interface Window {
    __OPRN_BRIDGE__?: BrowserBridgeConfig;
  }
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0;
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    out += BASE64_ALPHABET[a >> 2];
    out += BASE64_ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? "=" : BASE64_ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? "=" : BASE64_ALPHABET[c & 63];
  }
  return out;
}

function base64ToBytes(value: string): Uint8Array {
  const clean = value.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let cursor = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const a = BASE64_ALPHABET.indexOf(clean[index] ?? "A");
    const b = BASE64_ALPHABET.indexOf(clean[index + 1] ?? "A");
    const c = BASE64_ALPHABET.indexOf(clean[index + 2] ?? "A");
    const d = BASE64_ALPHABET.indexOf(clean[index + 3] ?? "A");
    if (cursor < bytes.length) bytes[cursor++] = (a << 2) | (b >> 4);
    if (cursor < bytes.length) bytes[cursor++] = ((b & 15) << 4) | (c >> 2);
    if (cursor < bytes.length) bytes[cursor++] = ((c & 3) << 6) | d;
  }
  return bytes;
}

async function call(channel: string, payload: unknown): Promise<unknown> {
  const config = window.__OPRN_BRIDGE__;
  if (!config) throw new Error("oprn 브리지 설정이 없습니다 — 로컬 서버가 주입한 페이지가 아닙니다");
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-oprn-bridge-token": config.token },
    body: JSON.stringify({ channel, payload }),
  });
  if (!response.ok) throw new Error(`${channel}: ${response.status} ${await response.text()}`);
  return await response.json();
}

const invoke = (channel: string) => (payload?: unknown) => call(channel, payload);

async function putAsset(payload: Record<string, unknown>): Promise<unknown> {
  const { bytes, ...rest } = payload;
  return await call(OPRN_CHANNELS.assetsPut, { ...rest, bytes: bytesToBase64(bytes as Uint8Array) });
}

async function readAsset(payload: unknown): Promise<Uint8Array> {
  return base64ToBytes(String(await call(OPRN_CHANNELS.assetsRead, payload)));
}

(window as unknown as { oprn?: unknown }).oprn = {
  closeIsHostDriven: false,
  assetBaseUrl: () => "/__oprn/asset/",
  project: {
    status: invoke(OPRN_CHANNELS.projectStatus),
    probe: invoke(OPRN_CHANNELS.projectProbe),
    open: invoke(OPRN_CHANNELS.projectOpen),
    load: invoke(OPRN_CHANNELS.projectLoad),
    save: invoke(OPRN_CHANNELS.projectSave),
    saveMapPatch: invoke(OPRN_CHANNELS.projectSaveMapPatch),
    dataVersion: invoke(OPRN_CHANNELS.projectDataVersion),
    separateMedia: invoke(OPRN_CHANNELS.projectSeparateMedia),
    backup: invoke(OPRN_CHANNELS.projectBackup),
  },
  commits: {
    record: invoke(OPRN_CHANNELS.commitsRecord),
    list: invoke(OPRN_CHANNELS.commitsList),
  },
  ai: {
    recordActivity: invoke(OPRN_CHANNELS.aiRecordActivity),
    listActivity: invoke(OPRN_CHANNELS.aiListActivity),
    recordConversation: invoke(OPRN_CHANNELS.aiRecordConversation),
    listConversations: invoke(OPRN_CHANNELS.aiListConversations),
    loadConversation: invoke(OPRN_CHANNELS.aiLoadConversation),
    recordAnalysisRun: invoke(OPRN_CHANNELS.aiRecordAnalysisRun),
  },
  assets: {
    put: putAsset,
    list: invoke(OPRN_CHANNELS.assetsList),
    read: readAsset,
    pruneUnused: invoke(OPRN_CHANNELS.assetsPruneUnused),
  },
  lifecycle: {
    onFlushBeforeClose: () => {},
    flushDone: async () => true,
  },
  start: {
    recentProjects: async () => [],
    openFolder: async () => null,
    openRecent: async () => null,
    createProject: async () => null,
    importFile: async () => null,
  },
  companionOrigin: null,
  companionToken: window.__OPRN_BRIDGE__?.companionToken ?? null,
};
