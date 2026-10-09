import { assetPageUrl } from "@/editor/assetBrowser/assetPageAllowlist";
import { lookupPackCatalog, readLearnedPackCatalog, rememberPackCatalog, sha256Hex, type PackTileSize } from "@/editor/assetBrowser/packCatalog";
import { extractPackImage, listPackImages, suggestPackImage, type PackImage } from "@/editor/assetBrowser/packImages";
import { MV_PACK_PRESETS } from "@/project/rpgmakerMv/packs";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

const STARTER_URL = "https://guttykreum.itch.io/free-japanese-city-game-assets";

type ReceivedPack = {
  readonly fileName: string;
  readonly pageUrl: string;
  readonly pageTitle: string;
  readonly bytes: Uint8Array;
};

type BrowserChrome = {
  readonly status: HTMLElement;
  readonly viewport: HTMLElement;
  readonly aside: HTMLElement;
  readonly input: HTMLInputElement;
};

let current: HTMLElement | null = null;
const previewUrls: string[] = [];

export type AssetSourceImport = {
  readonly file: File;
  readonly tileSize: PackTileSize | null;
  readonly rememberTileSize: (tileSize: PackTileSize) => void;
};

/** 받은 팩이 알려진 RPG Maker 팩(시트 이름이 프리셋과 같음)이면 시트 묶음 전체를 넘긴다 — 한 장씩 등록하지 않고 프리셋으로 굽는다. */
export type AssetSourceHandlers = {
  readonly onImportFile: (request: AssetSourceImport) => void;
  readonly onImportPack?: (files: readonly File[]) => Promise<void>;
};

export function openAssetSourceBrowser(handlers: AssetSourceHandlers): void {
  const { onImportFile } = handlers;
  if (current?.isConnected) return;
  const bridge = window.oprn?.assetBrowser;
  const status = el("p", { class: "asset-source-status", text: "제작자 페이지에서 Download를 누르면 이 프로젝트에만 저장됩니다.", dataset: { testid: "asset-source-status" } });
  const input = el("input", {
    class: "asset-source-url",
    attrs: { type: "url", placeholder: "https://….itch.io/…", "aria-label": "제작자 페이지 주소" },
    dataset: { testid: "asset-source-url" },
  });
  const viewport = el("div", { class: "asset-source-viewport", dataset: { testid: "asset-source-viewport" } });
  const aside = el("aside", { class: "asset-source-picker", dataset: { testid: "asset-source-picker" } });
  const chrome: BrowserChrome = { status, viewport, aside, input };
  const backdrop = el("div", {
    class: "asset-source-backdrop",
    dataset: { testid: "asset-source-browser" },
    children: [
      el("section", {
        class: "asset-source-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "제작자 페이지에서 받기" },
        children: [
          header(chrome, () => close()),
          el("div", { class: "asset-source-body", children: [viewport, aside] }),
        ],
      }),
    ],
  });
  const close = async (): Promise<void> => {
    stopListen();
    revokePreviews();
    if (bridge) await bridge.close();
    backdrop.remove();
    if (current === backdrop) current = null;
  };
  const deliver = (request: AssetSourceImport): void => {
    void close().then(() => onImportFile(request));
  };
  const deliverPack = handlers.onImportPack
    ? (files: readonly File[]): void => { void close().then(() => handlers.onImportPack!(files)); }
    : null;
  let stopListen = (): void => {};
  if (bridge) {
    stopListen = bridge.onDownload((payload) => {
      const event = readDownloadEvent(payload);
      if (event === null) return;
      if ("kind" in event) {
        toast(event.message, "error");
        return;
      }
      void showReceived(chrome, event, deliver, deliverPack);
    });
    const sync = (): void => {
      const rect = viewport.getBoundingClientRect();
      void bridge.setBounds({
        x: Math.max(0, Math.round(rect.x)),
        y: Math.max(0, Math.round(rect.y)),
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height)),
      });
    };
    const observer = new ResizeObserver(() => sync());
    observer.observe(viewport);
    window.addEventListener("resize", sync);
    const previousStop = stopListen;
    stopListen = () => {
      previousStop();
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  } else {
    viewport.append(el("p", { class: "asset-source-desktop-note", text: "제작자 페이지는 데스크톱 앱의 브라우저에서 열립니다. 웹에서는 이미 받은 zip을 올릴 수 있습니다." }));
    const file = el("input", { attrs: { type: "file", accept: ".zip,.png,.jpg,.jpeg,.webp,.gif" }, dataset: { testid: "asset-source-file" } });
    file.addEventListener("change", () => {
      const picked = file.files?.[0];
      if (!picked) return;
      void picked.arrayBuffer().then((buffer) => showReceived(chrome, {
        fileName: picked.name,
        pageUrl: "",
        pageTitle: picked.name.replace(/\.[^.]+$/, ""),
        bytes: new Uint8Array(buffer),
      }, deliver, deliverPack));
    });
    viewport.append(file);
  }
  document.body.append(backdrop);
  current = backdrop;
  aside.append(el("p", { text: "아직 받은 파일이 없습니다." }));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") void loadPage(chrome);
  });
}

function header(chrome: BrowserChrome, close: () => void): HTMLElement {
  return el("header", {
    class: "asset-source-header",
    children: [
      el("h2", { text: "제작자 페이지에서 받기" }),
      chrome.input,
      el("button", { class: "btn primary", text: "열기", attrs: { type: "button" }, dataset: { testid: "asset-source-open" }, on: { click: () => void loadPage(chrome) } }),
      el("button", { class: "btn", text: "일본 거리 무료 타일셋", attrs: { type: "button" }, dataset: { testid: "asset-source-starter" }, on: { click: () => { chrome.input.value = STARTER_URL; void loadPage(chrome); } } }),
      ...MV_PACK_PRESETS.map((preset) => el("button", { class: "btn", text: preset.name, attrs: { type: "button", title: `${preset.url} — Download 를 누르면 시트를 찾아 타일셋으로 굽습니다` }, dataset: { testid: `asset-source-pack-${preset.id}` }, on: { click: () => { chrome.input.value = preset.url; void loadPage(chrome); } } })),
      el("button", { class: "btn", text: "닫기", attrs: { type: "button" }, dataset: { testid: "asset-source-close" }, on: { click: close } }),
      chrome.status,
    ],
  });
}

async function loadPage(chrome: BrowserChrome): Promise<void> {
  const bridge = window.oprn?.assetBrowser;
  const url = assetPageUrl(chrome.input.value);
  if (url === null) {
    toast("itch.io 페이지 주소만 열 수 있습니다.", "error");
    return;
  }
  if (!bridge) {
    toast("제작자 페이지는 데스크톱 앱에서 열립니다.", "error");
    return;
  }
  chrome.status.textContent = "페이지를 여는 중";
  const rect = chrome.viewport.getBoundingClientRect();
  try {
    const opened = await bridge.open({
      url: url.toString(),
      x: Math.max(0, Math.round(rect.x)),
      y: Math.max(0, Math.round(rect.y)),
      width: Math.max(0, Math.round(rect.width)),
      height: Math.max(0, Math.round(rect.height)),
    });
    chrome.status.textContent = opened.title.length > 0 ? opened.title : url.hostname;
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    toast(error.message, "error");
  }
}

async function showReceived(chrome: BrowserChrome, pack: ReceivedPack, onImportFile: (request: AssetSourceImport) => void, onImportPack: ((files: readonly File[]) => void) | null): Promise<void> {
  chrome.status.textContent = "받은 파일에서 타일맵을 고르는 중";
  let images: readonly PackImage[];
  try {
    images = await listPackImages(pack.fileName, pack.bytes);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    toast(error.message, "error");
    return;
  }
  if (onImportPack !== null) {
    const preset = knownMvPack(images);
    if (preset !== null) {
      chrome.status.textContent = `${preset.preset.name}: 시트 ${preset.entries.length}장을 찾았습니다. 타일셋으로 굽습니다.`;
      try {
        const files = await Promise.all(preset.entries.map(async (image) => {
          const base = image.name.split("/").pop() ?? image.name;
          return new File([(await extractPackImage(pack.fileName, pack.bytes, image.name)).slice()], base, { type: mimeFor(base) });
        }));
        onImportPack(files);
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        toast(error.message, "error");
      }
      return;
    }
  }
  const known = await knownPackImage(pack, images);
  if (known !== null) {
    chrome.status.textContent = `${known.entry.name}을 ${known.entry.tileSize}×${known.entry.tileSize}로 넣습니다.`;
    await useSheet(pack, known.image, (file) => onImportFile({
      file,
      tileSize: known.entry.tileSize,
      rememberTileSize: () => {},
    }));
    return;
  }
  const sheets = images.filter((image) => image.role !== "single").sort((a, b) => area(b) - area(a)).slice(0, 8);
  const suggested = suggestPackImage(images);
  const singleCount = images.filter((image) => image.role === "single").length;
  revokePreviews();
  chrome.aside.replaceChildren();
  chrome.aside.append(el("p", { class: "asset-source-attribution", dataset: { testid: "asset-source-attribution" }, text: pack.pageUrl.length > 0 ? pack.pageUrl : pack.fileName }));
  if (singleCount > 0) chrome.aside.append(el("p", { text: `낱장 ${singleCount}장은 시트로 합치지 않습니다.` }));
  if (sheets.length === 0) {
    chrome.aside.append(el("p", { text: "타일맵으로 쓸 큰 그림이 없습니다." }));
    return;
  }
  let chosen = suggested ?? sheets[0];
  if (chosen === undefined) return;
  const list = el("div", { class: "asset-source-sheets" });
  for (const image of sheets) {
    const preview = image.name === chosen.name ? await sheetPreview(pack, image) : null;
    const row = el("label", {
      class: "asset-source-sheet",
      dataset: { testid: `asset-source-sheet-${sheetKey(image.name)}` },
      children: [
        el("input", { attrs: { type: "radio", name: "asset-source-sheet", ...(image.name === chosen.name ? { checked: "true" } : {}) }, on: { change: () => { chosen = image; } } }),
        preview ?? el("span", { text: "미리보기 없음" }),
        el("span", { text: `${image.name.split("/").pop() ?? image.name} · ${image.width ?? "?"}×${image.height ?? "?"} · ${roleLabel(image.role)}` }),
      ],
    });
    list.append(row);
  }
  chrome.aside.append(list, el("button", {
    class: "btn primary",
    text: "이 시트로 등록",
    attrs: { type: "button" },
    dataset: { testid: "asset-source-use" },
    on: { click: () => {
      if (chosen === undefined) return;
      const image = chosen;
      void useSheet(pack, image, (file) => onImportFile({
        file,
        tileSize: null,
        rememberTileSize: (tileSize) => void rememberChosenPack(pack, image, tileSize),
      }));
    } },
  }));
  chrome.status.textContent = "타일맵을 고른 뒤 이 프로젝트에 등록합니다.";
}

function knownMvPack(images: readonly PackImage[]): { readonly preset: (typeof MV_PACK_PRESETS)[number]; readonly entries: readonly PackImage[] } | null {
  for (const preset of MV_PACK_PRESETS) {
    const entries = preset.sheets.flatMap((sheet) => {
      const hit = images.find((image) => image.name.endsWith(`${sheet.folder}/${sheet.file}`)) ?? images.find((image) => (image.name.split("/").pop() ?? "") === sheet.file);
      return hit ? [hit] : [];
    });
    if (entries.length >= Math.ceil(preset.sheets.length / 2)) return { preset, entries };
  }
  return null;
}

async function knownPackImage(pack: ReceivedPack, images: readonly PackImage[]): Promise<{ readonly entry: { readonly name: string; readonly tileSize: PackTileSize; readonly entryName: string }; readonly image: PackImage } | null> {
  if (pack.bytes.length < 4 || pack.bytes[0] !== 0x50 || pack.bytes[1] !== 0x4b) return null;
  const known = lookupPackCatalog(await sha256Hex(pack.bytes), readLearnedPackCatalog());
  if (known === null) return null;
  const image = images.find((candidate) => candidate.name === known.entryName);
  if (image === undefined) return null;
  return { entry: known, image };
}

async function rememberChosenPack(pack: ReceivedPack, image: PackImage, tileSize: PackTileSize): Promise<void> {
  if (pack.bytes.length < 4 || pack.bytes[0] !== 0x50 || pack.bytes[1] !== 0x4b) return;
  const name = pack.pageTitle.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  rememberPackCatalog({
    zipSha256: await sha256Hex(pack.bytes),
    entryName: image.name,
    tileSize,
    name: name.length > 0 ? name : image.name,
    pageUrl: pack.pageUrl,
  });
}

async function useSheet(pack: ReceivedPack, image: PackImage, onUse: (file: File) => void): Promise<void> {
  try {
    const bytes = await extractPackImage(pack.fileName, pack.bytes, image.name);
    const base = image.name.split("/").pop() ?? "tileset.png";
    const extension = base.includes(".") ? base.slice(base.lastIndexOf(".")) : ".png";
    const title = pack.pageTitle.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
    const name = title.length > 0 ? `${title.slice(0, 80)}${extension}` : base;
    onUse(new File([bytes.slice()], name, { type: mimeFor(base) }));
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    toast(error.message, "error");
  }
}

async function sheetPreview(pack: ReceivedPack, image: PackImage): Promise<HTMLImageElement | null> {
  try {
    const bytes = await extractPackImage(pack.fileName, pack.bytes, image.name);
    const url = URL.createObjectURL(new Blob([bytes.slice()], { type: mimeFor(image.name) }));
    previewUrls.push(url);
    return el("img", { attrs: { src: url, alt: image.name } });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return null;
  }
}

function revokePreviews(): void {
  for (const url of previewUrls) URL.revokeObjectURL(url);
  previewUrls.length = 0;
}

function area(image: PackImage): number {
  return (image.width ?? 0) * (image.height ?? 0);
}

function roleLabel(role: PackImage["role"]): string {
  if (role === "tilemap") return "타일맵";
  if (role === "single") return "낱장";
  return "기타";
}

function sheetKey(name: string): string {
  return name.replace(/[^\p{L}\p{N}]+/gu, "-").slice(-40);
}

function mimeFor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

function readDownloadEvent(payload: unknown): ReceivedPack | { readonly kind: "rejected"; readonly message: string } | null {
  if (!isRecord(payload)) return null;
  if (payload.kind === "rejected" && typeof payload.message === "string") return { kind: "rejected", message: payload.message };
  if (payload.kind !== "download") return null;
  if (typeof payload.fileName !== "string" || typeof payload.pageUrl !== "string" || typeof payload.pageTitle !== "string") return null;
  if (!(payload.bytes instanceof Uint8Array)) return null;
  return { fileName: payload.fileName, pageUrl: payload.pageUrl, pageTitle: payload.pageTitle, bytes: payload.bytes };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
