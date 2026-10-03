/**
 * 도트 측면 전투의 배경 종류 고르기(2026-10-02, 사용자 결정 「(가) 배경 종류로」).
 *
 * 도트 측면(retro2003)은 고른 그림을 그대로 깔지 않는다 — 배경 id 를 겹 배경 다섯 종류(풀밭·숲·동굴·설원·사막) 중
 * 하나로 풀어 네 장 겹 배경을 깐다(assets/battleSceneryCatalog.ts resolveSceneryBiome). 이스턴 RPG 기본 배경·옛 스킨 배경은
 * 전부 「풀밭」이 되므로, 그림 목록에서 고르게 두면 무엇을 골라도 풀밭이었다. 그래서 측면 방식에서는 종류를 직접 고른다.
 * 저장값은 `battle-scenery-<종류>` id 다. 업로드한 그림(종류로 풀리지 않는 id)은 그대로 깔리므로 「직접 그림」 칸을 남긴다.
 * 몬스터 대치(pokemon)는 그림을 그대로 쓰므로 이 고르기를 쓰지 않는다.
 */
import {
  BATTLE_SCENERY_BIOMES,
  BATTLE_SCENERY_CATALOG,
  resolveSceneryBiome,
  sceneryBiomeFromResourceId,
  type BattleSceneryBiome,
} from "@/assets/battleSceneryCatalog";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { withInlineAsset } from "@/assets/inlineAssetStore";
import { prettyId, listDatabaseResourceOptions } from "@/editor/resourceOptions";
import { DEFAULT_BATTLE_FIELD_BACKGROUND_ID } from "@/project/databaseEnemyTroopRecordModel";
import { battleMethodOf } from "@/project/battleMethod";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

export const BATTLE_SCENERY_LABELS: Readonly<Record<BattleSceneryBiome, string>> = {
  plains: "풀밭",
  forest: "숲",
  cave: "동굴",
  snow: "설원",
  desert: "사막",
};

export function battleSceneryResourceId(biome: BattleSceneryBiome): string {
  return `battle-scenery-${biome}`;
}

export function battleSceneryPreviewUrl(biome: BattleSceneryBiome): string {
  return withInlineAsset(`/${BATTLE_SCENERY_CATALOG.find((entry) => entry.biome === biome)!.preview}`);
}

/** 저장된 배경 id 가 도트 측면 전투에서 어떻게 보이는지. custom = 업로드 등 종류로 풀리지 않아 그림이 그대로 깔린다. */
export type BattleSceneryReading =
  | { readonly kind: "auto"; readonly biome: BattleSceneryBiome }
  | { readonly kind: "biome"; readonly biome: BattleSceneryBiome }
  | { readonly kind: "legacy"; readonly biome: BattleSceneryBiome; readonly id: string }
  | { readonly kind: "custom"; readonly id: string };

/**
 * 「직접 그림」 고르기에 보일 id — 종류·옛 그림이면 비운다. 옛 그림 썸네일이 「설정됨」으로 보이면 그 그림이 깔리는 줄 안다.
 * (값 입력칸 testid 는 그대로라 e2e fill 계약은 유지된다.)
 */
export function customPickerResourceId(project: Project, resourceId: string | undefined): string | undefined {
  const reading = readBattleScenery(project, resourceId);
  return reading.kind === "custom" ? reading.id : undefined;
}

export function readBattleScenery(project: Project, resourceId: string | undefined, autoFallbackId = DEFAULT_BATTLE_FIELD_BACKGROUND_ID): BattleSceneryReading {
  if (!resourceId) return { kind: "auto", biome: resolveSceneryBiome(project, { backdropResourceId: autoFallbackId }) ?? "plains" };
  const explicit = sceneryBiomeFromResourceId(resourceId);
  if (explicit) return { kind: "biome", biome: explicit };
  const resolved = resolveSceneryBiome(project, { backdropResourceId: resourceId });
  return resolved ? { kind: "legacy", biome: resolved, id: resourceId } : { kind: "custom", id: resourceId };
}

/**
 * 편집기 미리보기·목록 썸네일이 쓸 배경 그림 — 실제 전투에 보이는 것과 같게 한다.
 * 도트 측면이면 종류의 미리보기 그림(업로드 그림만 그대로), 몬스터 대치면 고른 그림. 비었을 때는 showAuto 일 때만 자동 종류를 보인다.
 */
export function battleBackdropPreviewUrl(project: Project, resourceId: string | undefined, options: { readonly showAuto?: boolean } = {}): string | undefined {
  if (!resourceId && !options.showAuto) return undefined;
  if (battleMethodOf(project) === "side") {
    const reading = readBattleScenery(project, resourceId);
    if (reading.kind !== "custom") return battleSceneryPreviewUrl(reading.biome);
  }
  return resolveAssetResourceUrl(resourceId, { project }) ?? undefined;
}

/** 「배경 변경」 단추 — 종류를 차례로 넘긴다(자동 → 풀밭 → … → 사막 → 풀밭). */
export function nextBattleScenery(resourceId: string | undefined): string {
  const current = sceneryBiomeFromResourceId(resourceId);
  const index = current ? BATTLE_SCENERY_BIOMES.indexOf(current) : -1;
  return battleSceneryResourceId(BATTLE_SCENERY_BIOMES[(index + 1) % BATTLE_SCENERY_BIOMES.length]!);
}

export function battleSceneryField(input: {
  readonly project: Project;
  readonly resourceId: string | undefined;
  readonly testid: string;
  /** 「자동」 카드 설명 — 쓰는 곳마다 비었을 때 무엇을 따르는지가 다르다. */
  readonly autoHint: string;
  readonly onChange: (resourceId: string | undefined) => void;
  /** 업로드한 그림을 고르는 기존 그림 고르기(직접 그림). 받은 id 로 그린다 — customPickerResourceId 를 넘길 것. */
  readonly customPicker: HTMLElement;
}): HTMLElement {
  const reading = readBattleScenery(input.project, input.resourceId);
  const activeBiome = reading.kind === "biome" || reading.kind === "legacy" ? reading.biome : undefined;
  const card = (key: string, active: boolean, label: string, sub: string, image: string | undefined, value: string | undefined): HTMLElement =>
    el("button", {
      class: `db-scenery-card${active ? " is-active" : ""}`,
      attrs: { type: "button", role: "radio", "aria-checked": String(active), title: sub },
      dataset: { testid: `${input.testid}-${key}` },
      children: [
        image
          ? el("img", { attrs: { src: image, alt: "", loading: "lazy", draggable: "false" } })
          : el("span", { class: "db-scenery-card-auto", text: "지형 따라" }),
        el("strong", { text: label }),
        el("small", { text: sub }),
      ],
      on: { click: () => { if (!active) input.onChange(value); } },
    });
  const cards = [
    card("auto", reading.kind === "auto", "자동", input.autoHint, undefined, undefined),
    ...BATTLE_SCENERY_BIOMES.map((biome) =>
      card(biome, biome === activeBiome, BATTLE_SCENERY_LABELS[biome], `겹 배경 「${BATTLE_SCENERY_LABELS[biome]}」`, battleSceneryPreviewUrl(biome), battleSceneryResourceId(biome))),
  ];
  const notes: HTMLElement[] = [];
  // 기본 전장(숲 레퍼런스)은 「숲」으로 보이는 게 당연해 안내하지 않는다 — 이스턴 RPG 그림처럼 엉뚱하게 풀밭이 되는 경우만 알린다.
  if (reading.kind === "legacy" && reading.id !== DEFAULT_BATTLE_FIELD_BACKGROUND_ID) {
    notes.push(el("p", {
      class: "db-scenery-note",
      dataset: { testid: `${input.testid}-legacy` },
      text: `저장된 그림 「${optionName(input.project, reading.id)}」은 도트 측면 전투에서 「${BATTLE_SCENERY_LABELS[reading.biome]}」 겹 배경으로 보입니다.`,
    }));
  }
  if (reading.kind === "custom") {
    notes.push(el("p", {
      class: "db-scenery-note",
      dataset: { testid: `${input.testid}-custom` },
      text: `직접 고른 그림 「${optionName(input.project, reading.id)}」을 그대로 깝니다. 종류를 누르면 겹 배경으로 바뀝니다.`,
    }));
  }
  return el("div", {
    class: "db-scenery-picker",
    dataset: { testid: `${input.testid}-scenery` },
    children: [
      el("span", { class: "db-troop-field-label", text: "배경 종류" }),
      el("div", { class: "db-scenery-cards", attrs: { role: "radiogroup", "aria-label": "배경 종류" }, children: cards }),
      ...notes,
      el("div", {
        class: "db-scenery-custom",
        children: [
          el("small", { class: "db-scenery-custom-hint", text: "직접 그림 — 업로드한 그림만 그대로 깔립니다. 기본 그림은 위 종류 중 하나로 바뀝니다." }),
          input.customPicker,
        ],
      }),
    ],
  });
}

function optionName(project: Project, id: string): string {
  return listDatabaseResourceOptions("backdrop", project).find((option) => option.id === id)?.name ?? prettyId(id);
}
