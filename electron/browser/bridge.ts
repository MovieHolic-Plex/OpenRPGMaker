import { encodeBridgeRequest } from "./requestBody";
import { OPRN_CHANNELS } from "../shared/channels";

type BrowserBridgeConfig = {
  readonly endpoint: string;
  readonly token: string;
  readonly companionToken?: string | null;
  readonly requestBodyEncoding?: "gzip";
};

declare global {
  interface Window {
    __OPRN_BRIDGE__?: BrowserBridgeConfig;
  }
}

const tabId = Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('');

const selectedProject = new URL(location.href).searchParams.get('hostProject') ?? '';

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

async function call(channel: string, payload: unknown, keepalive = false, compress = true): Promise<unknown> {
  const config = window.__OPRN_BRIDGE__;
  if (!config) throw new Error("oprn 브리지 설정이 없습니다 — 로컬 서버가 주입한 페이지가 아닙니다");
  const encoded = await encodeBridgeRequest({ channel, payload }, keepalive, compress);
  const response = await fetch(config.endpoint, {
    method: "POST",
    keepalive,
    // x-oprn-channel lets the host grant project-document channels the larger decoded allowance.
    headers: { ...encoded.headers, "content-type": "application/json", "x-oprn-bridge-token": config.token, "x-oprn-session": tabId, "x-oprn-project": selectedProject, "x-oprn-channel": channel },
    body: encoded.body,
  });
  if (!response.ok) throw new Error(`${channel}: ${response.status} ${await response.text()}`);
  return await response.json();
}

const invoke = (channel: string) => (payload?: unknown) => call(channel, payload);

// tabId 는 페이지마다 새로 만들어지므로, 새로고침한 페이지는 자기 이전 임대(90초)를 남의 것으로 본다
// — 혼자 쓰는 프로젝트에서도 F5 한 번에 「호스트님이 편집 중입니다」로 편집이 막혔다.
// 그래서 이 탭이 쥔 잠금을 기억해 두었다가 떠날 때 같은 tabId 로 놓는다.
const heldLocks = new Set<string>();

async function lock(payload: unknown): Promise<unknown> {
  const result = await call(OPRN_CHANNELS.teamLock, payload) as { kind?: unknown } | null;
  const resource = (payload as { resource?: unknown } | null)?.resource;
  if (typeof resource === "string") {
    if (result?.kind === "held") heldLocks.add(resource);
    else heldLocks.delete(resource);
  }
  return result;
}

addEventListener("pagehide", () => {
  for (const resource of heldLocks) void call(OPRN_CHANNELS.teamLock, { resource, release: true }, true).catch(() => {});
  heldLocks.clear();
});

async function putAsset(payload: Record<string, unknown>): Promise<unknown> {
  const { bytes, ...rest } = payload;
  return await call(OPRN_CHANNELS.assetsPut, { ...rest, bytes: bytesToBase64(bytes as Uint8Array) });
}

async function readAsset(payload: unknown): Promise<Uint8Array> {
  return base64ToBytes(String(await call(OPRN_CHANNELS.assetsRead, payload)));
}

(window as unknown as { oprn?: unknown }).oprn = {
  closeIsHostDriven: false,
  team: { status: invoke(OPRN_CHANNELS.teamStatus), lock },
  assetBaseUrl: () => `/__oprn/asset/${selectedProject ? encodeURIComponent(selectedProject) + "/" : ""}`,
  project: {
    status: invoke(OPRN_CHANNELS.projectStatus),
    probe: invoke(OPRN_CHANNELS.projectProbe),
    open: invoke(OPRN_CHANNELS.projectOpen),
    load: invoke(OPRN_CHANNELS.projectLoad),
    loadFolded: invoke(OPRN_CHANNELS.projectLoadFolded),
    tilesetBlobs: invoke(OPRN_CHANNELS.projectTilesetBlobs),
    assetBlobs: invoke(OPRN_CHANNELS.projectAssetBlobs),
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
    onSaveRequest: () => {},
    flushDone: async () => true,
  },
  start: {
    recentProjects: async () => await call(OPRN_CHANNELS.startRecentProjects) as Array<{ projectDir: string; title: string }>,
    openFolder: async (payload?: { projectDir?: string }) => {
      if (!payload?.projectDir) return null;
      const opened = await call(OPRN_CHANNELS.startOpenFolder, payload) as { projectDir: string; projectId: string; isNew: boolean };
      const url = new URL(location.href);
      url.search = '';
      url.hash = '';
      url.searchParams.set('hostProject', opened.projectDir);
      history.replaceState(null, '', url);
      return opened;
    },
    openRecent: async () => null,
    createProject: async (input: unknown) => {
      // The seed is already one JSON string. Gzipping that body costs more than sending it on a LAN.
      const created = await call(OPRN_CHANNELS.startCreateProject, input, false, false) as { projectDir: string; projectId: string };
      const url = new URL(location.href);
      url.search = '';
      url.hash = '';
      url.searchParams.set('hostProject', created.projectDir);
      history.replaceState(null, '', url);
      return created;
    },
    importFile: async () => null,
  },
  companionOrigin: null,
  companionToken: window.__OPRN_BRIDGE__?.companionToken ?? null,
};
