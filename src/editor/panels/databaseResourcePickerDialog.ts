import {
  CHARSET_CHARACTER_COUNT,
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  CHARSET_SHEET_ROWS,
  charsetFrameSource,
} from "@/assets/easyrpgRtp";
// 이 모달은 자료집 모달 청크(databaseModal.ts → database/index.css) 밖에서도 열린다
// (맵 설정 BGM·전투 배경 등). 표면 시트를 여기서 가져온다 — CSS import 는 모듈당 한
// 번만 평가되므로 자료집 경로와 겹쳐도 중복 주입이 아니고, 늦은 표면이라 승자도 같다.
import "@/styles/database/index.css";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { audioPlayback } from "./audioResourcePresentation";
import { createAudioResourcePreview, releaseAudioPreviewOnRemoval } from "./audioResourcePreview";
import { bgmInstallBanner } from "./bgmInstallBanner";
import { monsterResourceSummary } from "./monsterResourcePresentation";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { transparentColorKeyDataUrl } from "@/assets/transparentColorKeyBackground";
import { openDialog } from "@/editor/panels/databaseEnemyRecordSupport";
import { aiImageGenerateField } from "@/editor/panels/aiImageGenerateField";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import {
  databaseImageFailurePlaceholder,
  markDatabaseImageFailed,
} from "@/editor/panels/databaseRecordThumbnails";

import {
  listDatabaseResourceOptions,
  prettyId,
  type DatabaseResourceOption,
  type DatabaseResourcePickerKind,
} from "@/editor/resourceOptions";

export type { DatabaseResourceOption, DatabaseResourcePickerKind } from "@/editor/resourceOptions";
export { listDatabaseResourceOptions } from "@/editor/resourceOptions";


export type DatabaseResourcePickerResult = {
  readonly resourceId: string;
  readonly characterIndex?: number;
  readonly graphicHue?: number;
};

export type OpenDatabaseResourcePickerOptions = {
  readonly kind: DatabaseResourcePickerKind;
  readonly title: string;
  readonly currentId?: string;
  readonly currentCharacterIndex?: number;
  readonly currentHue?: number;
  readonly allowHue?: boolean;
  readonly allowClear?: boolean;
  readonly testidPrefix?: string;
  readonly onConfirm: (result: DatabaseResourcePickerResult) => void;
};

const GENERATED_BATTLE_CHARSET_FRAME_WIDTH = 48;
const GENERATED_BATTLE_CHARSET_FRAME_HEIGHT = 64;
const GENERATED_BATTLE_CHARSET_SHEET_WIDTH = 144;
const GENERATED_BATTLE_CHARSET_SHEET_HEIGHT = 384;
const GENERATED_BATTLE_CHARSET_PREVIEW_SCALE = 0.75;

export function openDatabaseResourcePickerDialog(options: OpenDatabaseResourcePickerOptions): void {
  const project = store.getCurrent();
  const prefix = options.testidPrefix ?? "db-resource-picker";
  const catalog = listDatabaseResourceOptions(options.kind, project);
  let selectedId = options.currentId && catalog.some((entry) => entry.id === options.currentId)
    ? options.currentId
    : catalog[0]?.id ?? options.currentId ?? "";
  let characterIndex = clampIndex(options.currentCharacterIndex ?? 0, CHARSET_CHARACTER_COUNT - 1);
  let hue = clampHue(options.currentHue ?? 0);
  let confirmButton: HTMLButtonElement | null = null;
  const isUnsupportedAudio = (id: string): boolean =>
    (options.kind === "music" || options.kind === "sound") && audioPlayback(id, store.getCurrent()).midi;

  const search = el("input", {
    class: "db-resource-picker-search",
    attrs: { type: "search", placeholder: "검색 (이름 또는 ID)", autocomplete: "off" },
    dataset: { testid: `${prefix}-search` },
  }) as HTMLInputElement;
  const list = el("div", { class: "db-resource-picker-list", dataset: { testid: `${prefix}-list` } });
  const preview = el("div", { class: "db-resource-picker-preview", dataset: { testid: `${prefix}-preview` } });
  const indexPanel = el("div", { class: "db-resource-picker-index-panel" });
  const audioPreview = options.kind === "music" || options.kind === "sound" ? createAudioResourcePreview() : undefined;
  if (audioPreview) {
    preview.classList.add("db-resource-picker-audio-detail");
    preview.append(audioPreview.element);
  }

  const refreshList = (): void => {
    const project = store.getCurrent();
    const catalog = listDatabaseResourceOptions(options.kind, project);
    if ((options.kind === "music" || options.kind === "sound")
      && selectedId && !catalog.some(entry => entry.id === selectedId)) selectedId = "";
    const query = search.value.trim().toLowerCase();
    const filtered = catalog.filter((entry) => {
      if (!query) return true;
      if (entry.name.toLowerCase().includes(query) || entry.id.toLowerCase().includes(query)) return true;
      return entry.searchTerms?.some((term) => term.toLowerCase().includes(query)) ?? false;
    });
    list.replaceChildren(
      ...filtered.map((entry) =>
        resourceButton(entry, selectedId, options.kind, project, characterIndex, () => {
          if (isUnsupportedAudio(entry.id)) return;
          selectedId = entry.id;
          refreshList();
          refreshPreview();
          refreshIndexPanel();
        }, prefix)
      )
    );
    if (filtered.length === 0) {
      list.append(el("div", { class: "db-resource-picker-empty", text: "일치하는 리소스가 없습니다." }));
    }
  };

  const refreshPreview = (): void => {
    const project = store.getCurrent();
    if (confirmButton) confirmButton.disabled = !selectedId || isUnsupportedAudio(selectedId);
    if (audioPreview && (options.kind === "music" || options.kind === "sound")) {
      audioPreview.update(listAudioResources(options.kind, project).find(entry => entry.id === selectedId));
      return;
    }
    preview.replaceChildren(
      resourceVisual(selectedId, options.kind, project, "선택 리소스", "db-resource-picker-preview-visual", {
        characterIndex,
        hue: options.allowHue ? hue : undefined,
      })
    );
    if (options.kind === "monster" && selectedId) preview.append(monsterResourceSummary(project, selectedId));
  };

  const refreshIndexPanel = (): void => {
    indexPanel.replaceChildren();
    if (options.kind === "charset") {
      indexPanel.append(
        numberControl("캐릭터 인덱스", `${prefix}-character-index`, characterIndex, 0, CHARSET_CHARACTER_COUNT - 1, (value) => {
          characterIndex = value;
          refreshList();
          refreshPreview();
        })
      );
    }
    if (options.allowHue) {
      const hueInput = el("input", {
        attrs: { type: "range", min: "0", max: "360" },
        value: String(hue),
        dataset: { testid: `${prefix}-hue` },
      }) as HTMLInputElement;
      // 슬라이더에 수치가 없으면 뒤 패널의 「그래픽 Hue」 스테퍼와 같은 값인지 확인할 방법이 없다.
      const hueReadout = el("output", { class: "db-resource-picker-hue-value", text: `${hue}°` });
      hueInput.addEventListener("input", () => {
        hue = clampHue(Number(hueInput.value));
        hueReadout.textContent = `${hue}°`;
        refreshPreview();
      });
      indexPanel.append(el("label", {
        class: "db-resource-picker-hue",
        children: [el("span", { text: "색조" }), hueInput, hueReadout],
      }));
    }
  };

  search.addEventListener("input", () => {
    refreshList();
    refreshPreview();
  });
  refreshList();
  refreshPreview();
  refreshIndexPanel();

  const actions: { readonly label: string; readonly testid: string; readonly action?: () => void }[] = [
    {
      // 한국어 UI 안에서 이 대화상자만 OK/Cancel 였다("지우기" 만 한글이라 더 어긋났다).
      label: "선택",
      testid: `${prefix}-ok`,
      action: () => {
        if (!selectedId || isUnsupportedAudio(selectedId)) return;
        options.onConfirm({
          resourceId: selectedId,
          characterIndex: options.kind === "charset" ? characterIndex : undefined,
          graphicHue: options.allowHue ? hue : undefined,
        });
      },
    },
    { label: "취소", testid: `${prefix}-cancel` },
  ];
  if (options.allowClear) {
    actions.unshift({
      label: "지우기",
      testid: `${prefix}-clear`,
      action: () => {
        options.onConfirm({
          resourceId: "",
          characterIndex: options.kind === "charset" ? 0 : undefined,
          graphicHue: options.allowHue ? 0 : undefined,
        });
      },
    });
  }

  // 설치가 끝나면 배지만 갱신해서는 안 된다. audioResourceCatalog 가 미설치 곡을 목록에서
  // 아예 빼므로, refreshList 로 카탈로그를 다시 읽어야 항목 수가 3 → 281 로 바뀐다.
  const installBanner = bgmInstallBanner({ kind: options.kind, onInstalled: () => { refreshList(); } });

  let unsubscribe: (() => void) | undefined;
  const closeDialog = openDialog(prefix, options.title, [
    search,
    ...(installBanner ? [installBanner] : []),
    el("div", { class: "db-resource-picker-grid", children: [list, preview] }),
    indexPanel,
  ], actions, undefined, () => { unsubscribe?.(); audioPreview?.dispose(); });
  confirmButton = preview.closest('[role="dialog"]')?.querySelector<HTMLButtonElement>(`[data-testid="${prefix}-ok"]`) ?? null;
  if (confirmButton) confirmButton.disabled = !selectedId || isUnsupportedAudio(selectedId);
  if (options.kind === "music" || options.kind === "sound" || options.kind === "monster") {
    unsubscribe = store.subscribe((_project, change) => {
      if (change.projectSwitch) {
        closeDialog();
        return;
      }
      if (change.scope !== "project" && change.scope !== "assets") return;
      refreshList();
      refreshPreview();
    });
  }
}

const AI_GENERATABLE_PICKER_KINDS: Readonly<Record<string, "title" | "backdrop" | "monster">> = {
  title: "title",
  backdrop: "backdrop",
  monster: "monster",
  // 시네마틱 스틸(오프닝·게임 오버 배경)도 전체화면 아트라 배경화 생성기를 그대로 쓴다.
  still: "backdrop",
};

export function resourcePickerControl(input: {
  readonly label: string;
  readonly resourceId: string | undefined;
  readonly kind: DatabaseResourcePickerKind;
  readonly testid: string;
  readonly dialogTitle?: string;
  readonly allowClear?: boolean;
  readonly allowHue?: boolean;
  readonly currentHue?: number;
  readonly currentCharacterIndex?: number;
  readonly onChange: (result: DatabaseResourcePickerResult) => void;
  readonly rerender: () => void;
  /** AI 큐 공유 키. 레코드별(record.id)로 주면 레코드 전환 시 오적용을 막는다.
   *  없으면 testid+kind(싱글턴 시스템 행용) 으로 공유한다. */
  readonly queueKey?: string;
  /** Preview-first animation editor only; other picker presentation stays unchanged. */
  readonly presentation?: "graphic";
}): HTMLElement {
  const project = store.getCurrent();
  const preview = resourceVisual(
    input.resourceId ?? "",
    input.kind,
    project,
    input.label,
    "db-resource-picker-inline-thumb",
    {
      characterIndex: input.currentCharacterIndex ?? 0,
      hue: input.allowHue ? input.currentHue : undefined,
    }
  );
  const optionName = listDatabaseResourceOptions(input.kind, project).find((option) => option.id === input.resourceId)?.name;
  const rawName = optionName ?? (input.resourceId ? prettyId(input.resourceId) : "");
  const graphic = input.presentation === "graphic";
  const displayName = graphic ? rawName || "선택한 그래픽이 없습니다" : input.kind === "music" || input.kind === "sound" ? rawName || "(미설정)" : input.resourceId ? "설정됨" : "(미설정)";
  // Keep a real text input with the historical testid so e2e/unit fill() paths stay compatible.
  const idInput = el("input", {
    class: "db-resource-picker-inline-id db-authoring-id",
    attrs: { type: "text", spellcheck: "false", "aria-hidden": "true", tabindex: "-1" },
    value: input.resourceId ?? "",
    dataset: { testid: input.testid },
  }) as HTMLInputElement;
  const commitText = (): boolean => {
    const resourceId = idInput.value.trim();
    if ((input.kind === "music" || input.kind === "sound") && audioPlayback(resourceId, store.getCurrent()).midi) return false;
    input.onChange({
      resourceId,
      characterIndex: input.currentCharacterIndex,
      graphicHue: input.currentHue,
    });
    return true;
  };
  idInput.addEventListener("input", commitText);
  idInput.addEventListener("change", () => {
    if (!commitText()) {
      idInput.value = input.resourceId ?? "";
      return;
    }
    input.rerender();
  });
  const pick = (): void => {
    openDatabaseResourcePickerDialog({
      kind: input.kind,
      title: input.dialogTitle ?? `${input.label} 리소스`,
      currentId: input.resourceId,
      currentCharacterIndex: input.currentCharacterIndex,
      currentHue: input.currentHue,
      allowHue: input.allowHue,
      allowClear: input.allowClear,
      testidPrefix: `${input.testid}-dialog`,
      onConfirm: (result) => {
        input.onChange(result);
        input.rerender();
      },
    });
  };
  const aiKind = AI_GENERATABLE_PICKER_KINDS[input.kind];
  const metaChildren: HTMLElement[] = [
    el("span", {
      class: "db-resource-picker-inline-name",
      text: displayName,
      attrs: { title: rawName || input.resourceId || "" },
    }),
    idInput,
    el("button", {
      class: "btn small",
      text: graphic ? input.resourceId ? "그래픽 변경" : "그래픽 선택" : "설정...",
      attrs: { type: "button", "aria-label": `${input.label} 리소스 선택` },
      dataset: { testid: `${input.testid}-set` },
      on: { click: pick },
    }),
  ];
  if (aiKind) {
    metaChildren.push(
      aiImageGenerateField({
        kind: aiKind,
        testidPrefix: `${input.testid}-ai`,
        queueKey: input.queueKey ?? `resource-picker:${input.testid}:${aiKind}`,
        onInserted: (resourceId) => {
          input.onChange({ resourceId });
          input.rerender();
        },
      }),
    );
  }
  return el("div", {
    class: `db-resource-picker-control${graphic ? " db-animation-graphic-control" : ""}`,
    children: [
      el("span", { class: "db-resource-picker-control-label", text: input.label }),
      el("div", {
        class: "db-resource-picker-control-body",
        children: [
          preview,
          el("div", {
            class: "db-resource-picker-control-meta",
            children: metaChildren,
          }),
        ],
      }),
    ],
  });
}

function resourceButton(
  option: DatabaseResourceOption,
  selectedId: string,
  kind: DatabaseResourcePickerKind,
  project: Project,
  characterIndex: number,
  onSelect: () => void,
  prefix: string
): HTMLElement {
  return el("button", {
    class: option.id === selectedId ? "active" : "",
    attrs: {
      type: "button", title: `${option.name} (${option.id})`,
      ...((kind === "music" || kind === "sound") && audioPlayback(option.id, project).midi ? { disabled: "" } : {}),
    },
    dataset: { resourceId: option.id, testid: `${prefix}-option-${option.id}` },
    children: [
      resourceVisual(option.id, kind, project, option.name, "db-resource-picker-option-thumb", { characterIndex }),
      el("span", { text: studioResourceLabel(option.name, option.id) }),
    ],
    on: { click: onSelect },
  });
}

function resourceVisual(
  resourceId: string,
  kind: DatabaseResourcePickerKind,
  project: Project,
  label: string,
  className: string,
  crop: { readonly characterIndex: number; readonly hue?: number }
): HTMLElement {
  if (!resourceId) return el("span", { class: `${className} db-resource-picker-empty`, text: "(없음)" });
  // Selection is not playback. The cinematic sequence preview owns the player.
  // Handle movie identities before the image URL/failure path, including profiles
  // whose source is currently unavailable.
  if (kind === "movie") {
    return el("span", {
      class: className,
      text: "동영상",
      attrs: { "aria-label": `${label} 동영상`, title: resourceId },
    });
  }
  const url = resolveAssetResourceUrl(resourceId, { project });

  if (kind === "music" || kind === "sound") {
    if (className.includes("option-thumb")) return el("span", { class: className, text: kind === "music" ? "BGM" : "SE", attrs: { "aria-hidden": "true" } });
    const view = createAudioResourcePreview();
    view.update(listAudioResources(kind, project).find(entry => entry.id === resourceId));
    releaseAudioPreviewOnRemoval(view);
    return view.element;
  }

  if (!url) return resourceFailureVisual(className, label);

  if (kind === "charset") {
    const source = charsetFrameSource({ characterIndex: crop.characterIndex, direction: "down", pattern: 1 });
    return cropVisual(className, label, url, {
      ...source,
      sheetWidth: CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH,
      sheetHeight: CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT,
      scale: 1.5,
      hue: crop.hue,
      // 캐릭셋 원본은 배경이 단색(RTP 는 청록)이고 알파가 없다 — 키아웃하지 않으면
      // 목록 썸네일마다 스프라이트 뒤에 배경 사각형이 그대로 보인다.
      colorKey: true,
    });
  }
  if (kind === "battleCharset" && (resourceId === "hero" || isGeneratedBattleActorResource(resourceId))) {
    return cropVisual(className, label, url, {
      x: 0,
      y: 0,
      width: GENERATED_BATTLE_CHARSET_FRAME_WIDTH,
      height: GENERATED_BATTLE_CHARSET_FRAME_HEIGHT,
      sheetWidth: GENERATED_BATTLE_CHARSET_SHEET_WIDTH,
      sheetHeight: GENERATED_BATTLE_CHARSET_SHEET_HEIGHT,
      scale: GENERATED_BATTLE_CHARSET_PREVIEW_SCALE,
      hue: crop.hue,
    });
  }

  const dimensions = resourceVisualDimensions(className);
  const image = el("img", {
    class: className,
    attrs: {
      alt: `${label} 미리보기`,
      src: url,
      width: String(dimensions.width),
      height: String(dimensions.height),
    },
  });
  image.style.minWidth = `${dimensions.width}px`;
  image.style.minHeight = `${dimensions.height}px`;
  if (crop.hue !== undefined && crop.hue !== 0) {
    image.style.filter = `hue-rotate(${crop.hue}deg)`;
  }
  image.addEventListener(
    "error",
    () => {
      image.replaceWith?.(resourceFailureVisual(className, label));
    },
    { once: true }
  );
  return image;
}

function cropVisual(
  className: string,
  label: string,
  url: string,
  source: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly sheetWidth: number;
    readonly sheetHeight: number;
    readonly scale: number;
    readonly hue?: number;
    /** 단색 배경 시트(캐릭셋)는 색상 키를 뺀 데이터 URL 로 바꿔 끼운다. */
    readonly colorKey?: boolean;
  }
): HTMLElement {
  const style = [
    `--db-resource-url:url("${url}")`,
    `--db-resource-width:${source.width * source.scale}px`,
    `--db-resource-height:${source.height * source.scale}px`,
    `--db-resource-sheet-width:${source.sheetWidth * source.scale}px`,
    `--db-resource-sheet-height:${source.sheetHeight * source.scale}px`,
    `--db-resource-x:-${source.x * source.scale}px`,
    `--db-resource-y:-${source.y * source.scale}px`,
  ];
  if (source.hue !== undefined && source.hue !== 0) style.push(`filter:hue-rotate(${source.hue}deg)`);
  const visual = el("span", {
    class: `${className} db-resource-picker-crop`,
    attrs: {
      "aria-label": `${label} 미리보기`,
      role: "img",
      style: style.join(";"),
    },
  });
  visual.style.minWidth = `${Math.max(1, source.width * source.scale)}px`;
  visual.style.minHeight = `${Math.max(1, source.height * source.scale)}px`;
  const probe = el("img", {
    class: "db-resource-picker-load-probe",
    attrs: { alt: "", "aria-hidden": "true", src: url, width: "1", height: "1" },
  });
  probe.addEventListener("error", () => markDatabaseImageFailed(visual, label), { once: true });
  visual.append(probe);
  if (source.colorKey) applyCropColorKey(visual, url);
  return visual;
}

/**
 * 원본 URL 로 먼저 그리고, 색상 키를 뺀 데이터 URL 이 준비되면 CSS 변수만 갈아 끼운다.
 * 변환 결과는 `transparentColorKeyDataUrl` 이 경로별로 캐시하므로 시트당 한 번만 돈다.
 */
function applyCropColorKey(visual: HTMLElement, url: string): void {
  void transparentColorKeyDataUrl(url)
    .then((dataUrl) => visual.style.setProperty("--db-resource-url", `url("${dataUrl}")`))
    .catch(() => {
      /* 변환 실패는 원본 표시 그대로 둔다 — 미리보기가 사라지는 쪽이 더 나쁘다. */
    });
}

function resourceFailureVisual(className: string, label: string): HTMLElement {
  const dimensions = resourceVisualDimensions(className);
  return databaseImageFailurePlaceholder(className, label, dimensions.width, dimensions.height);
}

function resourceVisualDimensions(className: string): { readonly width: number; readonly height: number } {
  if (className.includes("preview-visual")) return { width: 140, height: 120 };
  return { width: 40, height: 40 };
}

function numberControl(
  label: string,
  testid: string,
  value: number,
  min: number,
  max: number,
  onChange: (value: number) => void
): HTMLElement {
  const input = el("input", {
    attrs: { type: "number", min: String(min), max: String(max) },
    value: String(value),
    dataset: { testid },
  }) as HTMLInputElement;
  input.addEventListener("input", () => onChange(clampIndex(Number(input.value), max)));
  return el("label", { class: "db-resource-picker-index", children: [el("span", { text: label }), input] });
}

function isGeneratedBattleActorResource(resourceId: string): boolean {
  return resourceId.startsWith("generated-actor-") && resourceId.endsWith("-battle");
}

function studioResourceLabel(name: string, id: string): string {
  const raw = (name || id).trim();
  if (/[가-힣]/u.test(raw)) return raw;
  return raw
    .replace(/^generated-[a-z]+-/u, "")
    .replace(/^easyrpg-[a-z]+-/u, "")
    .replaceAll(/[_-]+/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim() || raw;
}

function clampIndex(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.trunc(value)));
}

function clampHue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(360, Math.max(0, Math.trunc(value)));
}

/** Exported for unit tests and list thumbnail reuse. */
export function listDatabaseResourceOptionsForTest(
  kind: DatabaseResourcePickerKind,
  project: Project
): readonly DatabaseResourceOption[] {
  return listDatabaseResourceOptions(kind, project);
}
