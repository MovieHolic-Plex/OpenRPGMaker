import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import {
  CHARSET_CHARACTER_COUNT,
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  CHARSET_SHEET_ROWS,
  EASYRPG_BACKDROP_ASSETS,
  EASYRPG_BATTLE_ASSETS,
  EASYRPG_MONSTER_ASSETS,
  EASYRPG_SYSTEM2_ASSETS,
  EASYRPG_SYSTEM_ASSETS,
  EASYRPG_TITLE_ASSETS,
  EASYRPG_MUSIC_ASSETS,
  EASYRPG_SOUND_ASSETS,
  charsetFrameSource,
} from "@/assets/easyrpgRtp";
import { FACESET_FACE_ASSETS, LEGACY_FACESET_SHEET_IDS } from "@/assets/facesetFaceAssets";
import { CC0_ICON_ASSETS } from "@/assets/cc0IconAssets";
import { CC0_MUSIC_ASSETS, CC0_SOUND_ASSETS } from "@/assets/cc0AudioAssets";
import { BGM_CATALOG, bgmTrackLabel } from "@/assets/bgmCatalog";
import { SE_CATALOG } from "@/assets/seCatalog";
import {
  SCARLOXY_BACKDROP_ASSETS,
  SCARLOXY_MONSTER_ASSETS,
  SCARLOXY_MONSTER_ICON_ASSETS,
  SCARLOXY_UI_ICON_ASSETS,
} from "@/assets/scarloxyPack";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { GENERATED_EFFECT_SHEET_ASSETS } from "@/assets/generatedEffectSheets";
import { getAudioEngine, playAudioCommand, stopAudioCommand } from "@/player/audio";
import { GENERATED_ASSET_PLAN } from "@/assets/oprnGeneratedAssetPlan";
import { openDialog } from "@/editor/panels/databaseEnemyRecordSupport";
import { aiImageGenerateField } from "@/editor/panels/aiImageGenerateField";
import { store } from "@/project/store";
import type { Project, ResourceKind } from "@/project/types";
import { el } from "@/util/dom";
import {
  databaseImageFailurePlaceholder,
  markDatabaseImageFailed,
} from "@/editor/panels/databaseRecordThumbnails";

export type DatabaseResourcePickerKind =
  | "icon"
  | "image"
  | "monster"
  | "faceset"
  | "charset"
  | "battleCharset"
  | "title"
  | "music"
  | "sound"
  | "system"
  | "system2"
  | "backdrop"
  | "battle";

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

export type DatabaseResourceOption = {
  readonly id: string;
  readonly name: string;
  /**
   * 검색 전용 보조 낱말(카테고리·감정·악기 등). 라벨에 다 적으면 목록이 읽히지 않으므로
   * 표시에서 빼고 검색에만 쓴다. BGM 카탈로그 281곡을 "던전"/"보스"로 찾게 하는 배선이다.
   */
  readonly searchTerms?: readonly string[];
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

  const search = el("input", {
    class: "db-resource-picker-search",
    attrs: { type: "search", placeholder: "검색 (이름 또는 ID)", autocomplete: "off" },
    dataset: { testid: `${prefix}-search` },
  }) as HTMLInputElement;
  const list = el("div", { class: "db-resource-picker-list", dataset: { testid: `${prefix}-list` } });
  const preview = el("div", { class: "db-resource-picker-preview", dataset: { testid: `${prefix}-preview` } });
  const indexPanel = el("div", { class: "db-resource-picker-index-panel" });

  const refreshList = (): void => {
    const query = search.value.trim().toLowerCase();
    const filtered = catalog.filter((entry) => {
      if (!query) return true;
      if (entry.name.toLowerCase().includes(query) || entry.id.toLowerCase().includes(query)) return true;
      return entry.searchTerms?.some((term) => term.toLowerCase().includes(query)) ?? false;
    });
    list.replaceChildren(
      ...filtered.map((entry) =>
        resourceButton(entry, selectedId, options.kind, project, characterIndex, () => {
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
    preview.replaceChildren(
      resourceVisual(selectedId, options.kind, project, "선택 리소스", "db-resource-picker-preview-visual", {
        characterIndex,
        hue: options.allowHue ? hue : undefined,
      })
    );
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

  search.addEventListener("input", () => refreshList());
  refreshList();
  refreshPreview();
  refreshIndexPanel();

  const actions: { readonly label: string; readonly testid: string; readonly action?: () => void }[] = [
    {
      // 한국어 UI 안에서 이 대화상자만 OK/Cancel 였다("지우기" 만 한글이라 더 어긋났다).
      label: "선택",
      testid: `${prefix}-ok`,
      action: () => {
        if (!selectedId) return;
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

  openDialog(prefix, options.title, [
    search,
    el("div", { class: "db-resource-picker-grid", children: [list, preview] }),
    indexPanel,
  ], actions);
}

const AI_GENERATABLE_PICKER_KINDS: Readonly<Record<string, "title" | "backdrop" | "monster">> = {
  title: "title",
  backdrop: "backdrop",
  monster: "monster",
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
  const displayName = input.resourceId ? "설정됨" : "(미설정)";
  // Keep a real text input with the historical testid so e2e/unit fill() paths stay compatible.
  const idInput = el("input", {
    class: "db-resource-picker-inline-id db-authoring-id",
    attrs: { type: "text", spellcheck: "false", "aria-hidden": "true", tabindex: "-1" },
    value: input.resourceId ?? "",
    dataset: { testid: input.testid },
  }) as HTMLInputElement;
  const commitText = (): void => {
    input.onChange({
      resourceId: idInput.value.trim(),
      characterIndex: input.currentCharacterIndex,
      graphicHue: input.currentHue,
    });
  };
  idInput.addEventListener("input", commitText);
  idInput.addEventListener("change", () => {
    commitText();
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
      text: "설정...",
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
        queueKey: `resource-picker:${input.testid}:${aiKind}`,
        onInserted: (resourceId) => {
          input.onChange({ resourceId });
          input.rerender();
        },
      }),
    );
  }
  return el("div", {
    class: "db-resource-picker-control",
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
    attrs: { type: "button", title: `${option.name} (${option.id})` },
    dataset: { resourceId: option.id, testid: `${prefix}-option-${option.id}` },
    children: [
      resourceVisual(option.id, kind, project, option.name, "db-resource-picker-option-thumb", { characterIndex }),
      el("span", { text: studioResourceLabel(option.name, option.id) }),
    ],
    on: { click: onSelect },
  });
}

/**
 * 데이터베이스 피커와 이벤트 명령 폼이 함께 쓰는 리소스 목록의 단일 정본이다.
 * 표시 순서와 장면어 검색 태그가 두 저작 표면에서 어긋나지 않게 한다.
 */
export function listDatabaseResourceOptions(
  kind: DatabaseResourcePickerKind,
  project: Project
): readonly DatabaseResourceOption[] {
  const options = new Map<string, DatabaseResourceOption>();
  const add = (id: string, name: string, searchTerms?: readonly string[]): void => {
    if (!id || options.has(id)) return;
    options.set(id, { id, name, searchTerms });
  };

  switch (kind) {
    case "faceset":
      // 낱장 얼굴 112장. 분할 전 시트 id 는 저장본 호환을 위해 등록만 남고 피커에서는 빠진다.
      for (const asset of FACESET_FACE_ASSETS) add(asset.id, asset.name);
      break;
    case "charset":
      for (const asset of CHARSET_ASSETS) add(asset.id, asset.name);
      break;
    case "monster":
      for (const asset of EASYRPG_MONSTER_ASSETS) add(asset.id, asset.name);
      for (const asset of SCARLOXY_MONSTER_ASSETS) add(asset.id, asset.name);
      break;
    case "title":
      for (const asset of EASYRPG_TITLE_ASSETS) add(asset.id, asset.name);
      break;
    case "music":
      // 카탈로그(281곡)를 맨 앞에 둔다 — 이게 이 에디터의 기본 BGM 세트다.
      // brief 를 검색어에 넣어야 "비 오는 실내" 처럼 장면 문장으로 곡을 찾을 수 있다.
      for (const track of BGM_CATALOG) {
        add(track.id, bgmTrackLabel(track), [...track.tags, track.titleEn, track.trackCode, track.brief]);
      }
      for (const asset of CC0_MUSIC_ASSETS) add(asset.id, asset.name);
      for (const asset of EASYRPG_MUSIC_ASSETS) add(asset.id, asset.name);
      break;
    case "sound":
      // 카탈로그(456개)를 맨 앞에 둔다 — 이게 이 에디터의 기본 효과음 세트다.
      // EasyRPG RTP 96개는 뒤에 남긴다(CC-BY 이지만 기존 프로젝트가 참조하고 있다).
      for (const entry of SE_CATALOG) {
        add(entry.id, `${entry.title} — ${entry.category} (${entry.seconds.toFixed(2)}s)`, [
          ...entry.tags,
          entry.category,
          entry.baseName,
        ]);
      }
      for (const asset of CC0_SOUND_ASSETS) add(asset.id, asset.name);
      for (const asset of EASYRPG_SOUND_ASSETS) add(asset.id, asset.name);
      break;
    case "system":
      for (const asset of EASYRPG_SYSTEM_ASSETS) add(asset.id, asset.name);
      break;
    case "system2":
      for (const asset of EASYRPG_SYSTEM2_ASSETS) add(asset.id, asset.name);
      break;
    case "backdrop":
      for (const asset of EASYRPG_BACKDROP_ASSETS) add(asset.id, asset.name);
      for (const asset of SCARLOXY_BACKDROP_ASSETS) add(asset.id, asset.name);
      break;
    case "battle":
      for (const asset of EASYRPG_BATTLE_ASSETS) add(asset.id, asset.name);
      for (const asset of GENERATED_EFFECT_SHEET_ASSETS) add(asset.id, asset.name);
      break;
    case "icon":
    case "image":
      for (const asset of CC0_ICON_ASSETS) add(asset.id, asset.name);
      for (const asset of SCARLOXY_MONSTER_ICON_ASSETS) add(asset.id, asset.name);
      for (const asset of SCARLOXY_UI_ICON_ASSETS) add(asset.id, asset.name);
      break;
    case "battleCharset":
      break;
  }

  for (const asset of GENERATED_ASSET_PLAN.assets) {
    if (asset.status !== "promoted") continue;
    if (matchesGeneratedKind(kind, asset.resourceKind, asset.resourceId)) {
      add(asset.resourceId, `${prettyId(asset.resourceId)} <생성>`);
    }
  }
  for (const id of builtinGeneratedResourceIds()) {
    if (matchesGeneratedKind(kind, undefined, id)) add(id, `${prettyId(id)} <생성>`);
  }
  for (const [id, uploaded] of Object.entries(project.assets.uploaded ?? {})) {
    if (uploadedMatchesKind(kind, uploaded.kind, id)) {
      add(id, uploaded.name || id);
    }
  }
  return Array.from(options.values());
}

function matchesGeneratedKind(kind: DatabaseResourcePickerKind, resourceKind: ResourceKind | undefined, id: string): boolean {
  if (kind === "faceset") {
    // 분할 전 4×4 시트는 얼굴 한 장이 아니다 — 등록만 남기고 피커 목록에서는 제외한다.
    if (LEGACY_FACESET_SHEET_IDS.includes(id)) return false;
    return resourceKind === "faceset" || (id.startsWith("generated-actor-") && id.endsWith("-face"));
  }
  if (kind === "charset") return resourceKind === "charset" || (id.startsWith("generated-actor-") && id.endsWith("-charset"));
  if (kind === "battleCharset") {
    return resourceKind === "battleCharset" || id === "hero" || (id.startsWith("generated-actor-") && id.endsWith("-battle"));
  }
  if (kind === "monster") return resourceKind === "monster" || id.startsWith("generated-enemy-");
  if (kind === "title") return resourceKind === "title" || id.includes("title");
  if (kind === "music") {
    return resourceKind === "music" || id.startsWith("easyrpg-music-") || id.startsWith("cc0-music-") || id.startsWith("cc0-bgm-");
  }
  if (kind === "sound") {
    return (
      resourceKind === "sound" ||
      id.startsWith("easyrpg-sound-") ||
      id.startsWith("cc0-sound-") ||
      // 456개 효과음 카탈로그. 이게 빠지면 카탈로그 항목을 고른 뒤 피커가 다시 열릴 때
      // 현재 선택이 "종류 불일치"로 판정돼 (없음) 으로 보인다.
      id.startsWith("cc0-se-")
    );
  }
  if (kind === "system") return resourceKind === "system";
  if (kind === "system2") return resourceKind === "system2";
  if (kind === "backdrop") return resourceKind === "backdrop" || id.includes("backdrop") || id.includes("troop-preview");
  if (kind === "battle") return resourceKind === "battle" || id.startsWith("easyrpg-battle-") || id.includes("battle-anim");
  if (kind === "icon") {
    return (
      id.includes("-icon") ||
      id.startsWith("cc0-jetrel-") ||
      id.startsWith("generated-item-") ||
      id.startsWith("generated-equipment-")
    );
  }
  if (kind === "image") {
    return (
      id.includes("-image") ||
      id.startsWith("cc0-jetrel-") ||
      id.startsWith("generated-item-") ||
      id.startsWith("generated-equipment-") ||
      id.startsWith("generated-enemy-")
    );
  }
  return false;
}

function uploadedMatchesKind(
  kind: DatabaseResourcePickerKind,
  uploadedKind: string | undefined,
  id: string
): boolean {
  if (!uploadedKind) return matchesGeneratedKind(kind, undefined, id);
  if (kind === "icon" || kind === "image") {
    return uploadedKind === "picture" || uploadedKind === "monster" || uploadedKind === "system" || matchesGeneratedKind(kind, undefined, id);
  }
  if (kind === "monster") return uploadedKind === "monster" || uploadedKind === "picture";
  if (kind === "faceset") return uploadedKind === "faceset";
  if (kind === "charset") return uploadedKind === "charset";
  if (kind === "battleCharset") return uploadedKind === "battleCharset" || uploadedKind === "charset";
  if (kind === "title") return uploadedKind === "title" || uploadedKind === "picture";
  if (kind === "music") return uploadedKind === "music";
  if (kind === "sound") return uploadedKind === "sound";
  if (kind === "system") return uploadedKind === "system";
  if (kind === "system2") return uploadedKind === "system2";
  if (kind === "backdrop") return uploadedKind === "backdrop" || uploadedKind === "picture";
  if (kind === "battle") return uploadedKind === "battle" || uploadedKind === "picture";
  return false;
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
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (!url) return resourceFailureVisual(className, label);

  if (kind === "music" || kind === "sound") {
    const playable = !url.toLowerCase().endsWith(".mid");
    const play = el("button", {
      class: "btn",
      text: playable ? "미리 듣기" : "MIDI 비재생",
      attrs: playable ? { type: "button" } : { type: "button", disabled: "" },
      dataset: { testid: "db-resource-picker-audio-play" },
      on: playable ? {
        click: () => {
          getAudioEngine().installUnlockListeners();
          getAudioEngine().unlock();
          stopAudioCommand();
          playAudioCommand({ resourceId, loop: kind === "music" }, project);
        },
      } : undefined,
    });
    return el("div", {
      class: className + " db-resource-picker-audio",
      children: [
        el("div", { class: "db-resource-picker-audio-title", text: kind === "music" ? "BGM" : "SE" }),
        el("div", { class: "db-resource-picker-audio-id", text: resourceId }),
        el("div", { class: "db-resource-picker-audio-url", text: url }),
        play,
      ],
    });
  }

  if (kind === "charset") {
    const source = charsetFrameSource({ characterIndex: crop.characterIndex, direction: "down", pattern: 1 });
    return cropVisual(className, label, url, {
      ...source,
      sheetWidth: CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH,
      sheetHeight: CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT,
      scale: 1.5,
      hue: crop.hue,
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
  return visual;
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

function prettyId(id: string): string {
  return id.replace(/^generated-(actor|enemy|item|equipment)-/u, "").replaceAll("-", " ");
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
