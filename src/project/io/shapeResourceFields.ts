import { validateTilesetReferences } from "../tilesetReferences";
import { isShopUiPreset } from '../shopUiPresets';
import { validateFieldMenu } from '../fieldMenu';
import { validateMusicScore } from '../musicScore';
import { isInteriorRoomShape } from "@/project/interiorRoomFootprint";
import { parsePublication } from "../publication";
import {
  CONCEPT_PLACE_COUNT_MAX,
  CONCEPT_PLACE_LEVEL_MAX,
  isConceptPlaceLevel,
  isConceptFloorMaterial,
  isConceptPlaceRole,
  isConceptPlaceSize,
  isConceptWallMaterial,
  validateConceptChipId,
} from "../types/conceptBundle";
import { isPaletteSlotRole } from "../tilesetPalette";
import { TERM_KEYS } from "../terms";
import { assert, requireArray, requireBoolean, requireNumber, requireRecord, requireString, resourceKinds } from "./guards";
import { validateAssetRef } from "./shapeReferenceFields";
import { validateTileGroupKnowledgeFields } from "./validateTilesetKnowledgeFields";

export function validateMeta(value: unknown): void {
  const meta = requireRecord("meta", value);
  requireString("meta.title", meta.title);
  requireString("meta.author", meta.author);
  if (meta.oprnMonsterStyle !== undefined) {
    const style = requireRecord('meta.oprnMonsterStyle', meta.oprnMonsterStyle);
    assert(style.version === 1 && style.reference === 'emerald', 'Invalid monster style reference');
    assert(Object.keys(style).every(key => key === 'version' || key === 'reference'), 'Unknown monster style field');
  }
  if(meta.oprnShopPreset!==undefined)assert(isShopUiPreset(requireString('shop preset',meta.oprnShopPreset)),'Unknown shop preset');
  if(meta.oprnOpeningBook!==undefined){
    const book=requireRecord('opening book',meta.oprnOpeningBook);
    assert(book.version===1&&['amber','ivory'].includes(String(book.ink)),'Invalid opening book');
    const ids=requireArray('opening book sceneIds',book.sceneIds);
    assert(ids.length>=1&&ids.length<=64&&new Set(ids).size===ids.length,'Invalid opening book pages');
    for(const id of ids)assert(requireString('opening page id',id).length>0,'Empty page id');
    if(book.portraitResourceId!==undefined)assert(requireString('opening portrait',book.portraitResourceId).length>0,'Empty opening portrait');
  }
  if (meta.oprnFieldMenu !== undefined) validateFieldMenu(meta.oprnFieldMenu);
  if(meta.oprnMenuSounds!==undefined) {
    const sounds=requireRecord('meta.oprnMenuSounds',meta.oprnMenuSounds);
    assert(Object.keys(sounds).every(k=>['cursor','confirm','cancel'].includes(k)),'Unknown menu sound cue');
    for(const value of Object.values(sounds))requireString('menu sound resource',value);
  }
  if (meta.oprnMusicScores !== undefined) {
    const scores = requireRecord('meta.oprnMusicScores', meta.oprnMusicScores);
    assert(Object.keys(scores).length <= 32, 'At most32 music scores');
    for(const value of Object.values(scores)) validateMusicScore(requireRecord('music score', value).score);
  }
  if (meta.publication !== undefined) parsePublication(meta.publication);
  repairTerms(meta);
}

function repairTerms(meta: Record<string, unknown>): void {
  if (meta.terms === undefined) {
    meta.terms = {};
    warnTermsRepair("meta.terms가 없어 빈 용어 설정으로 정리하고 로드했습니다.");
    return;
  }
  if (!isRecord(meta.terms)) {
    meta.terms = {};
    warnTermsRepair("meta.terms가 객체가 아니어서 빈 용어 설정으로 정리하고 로드했습니다.");
    return;
  }
  const terms = meta.terms;
  let removed = 0;
  for (const key of TERM_KEYS) {
    if (terms[key] === undefined || typeof terms[key] === "string") continue;
    delete terms[key];
    removed += 1;
  }
  if (removed > 0) warnTermsRepair(`문자열이 아닌 용어 필드 ${removed}개를 삭제하고 로드했습니다.`);
}

function warnTermsRepair(message: string): void {
  if (typeof console === "undefined") return;
  console.warn(`[project] ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateAssets(value: unknown): void {
  const assets = requireRecord("assets", value);
  const sprites = requireRecord("assets.sprites", assets.sprites);
  for (const [id, sprite] of Object.entries(sprites)) {
    const record = requireRecord(`assets.sprites.${id}`, sprite);
    requireString(`${id}.id`, record.id);
    validateAssetRef(`${id}.image`, record.image);
    requireNumber(`${id}.frames`, record.frames);
    requireNumber(`${id}.frameWidth`, record.frameWidth);
    requireNumber(`${id}.frameHeight`, record.frameHeight);
  }
  requireRecord("assets.uploaded", assets.uploaded);
}

export function validateResourceProfiles(value: unknown): void {
  for (const profile of requireArray("resourceProfiles", value)) {
    const record = requireRecord("resourceProfile", profile);
    const kind = requireString("resourceProfile.kind", record.kind);
    assert(resourceKinds.has(kind), `resourceProfile.kind가 잘못되었습니다: ${kind}`);
    requireString("resourceProfile.name", record.name);
  }
}

export function validateTileset(id: string, value: unknown): void {
  const tileset = requireRecord(`tileset ${id}`, value);
  if (tileset.referenceDocuments !== undefined) validateTilesetReferences(tileset.referenceDocuments);
  if (Array.isArray(tileset.structureKits)) for (const kit of tileset.structureKits) {
    if (kit && typeof kit === 'object' && 'referenceDocuments' in kit && kit.referenceDocuments !== undefined) validateTilesetReferences(kit.referenceDocuments);
  }
  if (tileset.referenceSourceTilesetId !== undefined) {
    const source = requireString(`tileset ${id}.referenceSourceTilesetId`, tileset.referenceSourceTilesetId);
    assert(source.length > 0 && source !== id, "참고문서 원본은 다른 타일셋이어야 합니다.");
    assert(!tileset.referenceDocuments || (tileset.referenceDocuments as unknown[]).length === 0, "공유 문서와 자체 문서를 동시에 저장할 수 없습니다.");
  }
  if (tileset.family !== undefined) {
    assert(requireString(`tileset ${id}.family`, tileset.family).length > 0, `tileset ${id}: family 는 빈 문자열일 수 없습니다.`);
  }
  requireString(`tileset ${id}.id`, tileset.id);
  requireString(`tileset ${id}.name`, tileset.name);
  validateAssetRef(`tileset ${id}.image`, tileset.image);
  if (tileset.kind !== undefined) {
    const kind = requireString(`tileset ${id}.kind`, tileset.kind);
    assert(kind === "rpg2k" || kind === "custom", `tileset ${id}: kind must be rpg2k or custom`);
  }
  const count = requireNumber(`tileset ${id}.count`, tileset.count);
  requireNumber(`tileset ${id}.tileSize`, tileset.tileSize);
  requireNumber(`tileset ${id}.tilesPerRow`, tileset.tilesPerRow);
  assert(
    requireArray(`tileset ${id}.passability`, tileset.passability).length === count,
    `tileset ${id}: passability 길이 불일치.`
  );
  assert(
    requireArray(`tileset ${id}.priority`, tileset.priority).length === count,
    `tileset ${id}: priority 길이 불일치.`
  );
  assert(
    requireArray(`tileset ${id}.terrain`, tileset.terrain).length === count,
    `tileset ${id}: terrain 길이 불일치.`
  );
  if (tileset.tileMeta !== undefined) {
    assert(
      requireArray(`tileset ${id}.tileMeta`, tileset.tileMeta).length === count,
      `tileset ${id}: tileMeta 길이 불일치.`
    );
    for (const [index, meta] of requireArray(`tileset ${id}.tileMeta`, tileset.tileMeta).entries()) {
      if (meta === undefined || meta === null) continue;
      const record = requireRecord(`tileset ${id}.tileMeta[${index}]`, meta);
      if (record.confidence !== undefined) {
        if (typeof record.confidence === "number") {
          const confidence = requireNumber(`tileset ${id}.tileMeta[${index}].confidence`, record.confidence);
          assert(confidence >= 0 && confidence <= 1, `tileset ${id}: tileMeta[${index}] confidence must be 0~1`);
        } else {
          const confidence = requireString(`tileset ${id}.tileMeta[${index}].confidence`, record.confidence);
          assert(
            confidence === "high" || confidence === "medium" || confidence === "low",
            `tileset ${id}: tileMeta[${index}] confidence invalid`
          );
        }
      }
      if (record.origin !== undefined) {
        const origin = requireString(`tileset ${id}.tileMeta[${index}].origin`, record.origin);
        assert(origin === "user" || origin === "ai", `tileset ${id}: tileMeta[${index}] origin invalid`);
      }
      if (record.locked !== undefined) requireBoolean(`tileset ${id}.tileMeta[${index}].locked`, record.locked);
    }
  }
  if (tileset.transparentColor !== undefined) {
    requireString(`tileset ${id}.transparentColor`, tileset.transparentColor);
  }
  if (tileset.tileGrafts !== undefined) {
    for (const [index, graft] of requireArray(`tileset ${id}.tileGrafts`, tileset.tileGrafts).entries()) {
      const record = requireRecord(`tileset ${id}.tileGrafts[${index}]`, graft);
      const targetTile = requireNumber(`tileset ${id}.tileGrafts[${index}].targetTile`, record.targetTile);
      assert(targetTile >= 0, `tileset ${id}: tileGrafts[${index}] targetTile must be >= 0`);
      // count 확장 규칙 일관성: 확장 모드는 addTileGraft 가 count 를 먼저 늘려 저장하므로
      // 로드 시 targetTile 은 항상 count 범위 안이어야 한다.
      assert(targetTile < count, `tileset ${id}: tileGrafts[${index}] targetTile out of range (count 확장 누락)`);
      const sourceTile = requireNumber(`tileset ${id}.tileGrafts[${index}].sourceTile`, record.sourceTile);
      assert(sourceTile >= 0, `tileset ${id}: tileGrafts[${index}] sourceTile must be >= 0`);
      const sourceChipset = requireString(`tileset ${id}.tileGrafts[${index}].sourceChipset`, record.sourceChipset);
      assert(sourceChipset.length > 0, `tileset ${id}: tileGrafts[${index}] sourceChipset must not be empty`);
    }
  }
  if (tileset.grammarProfile !== undefined) {
    requireString(`tileset ${id}.grammarProfile`, tileset.grammarProfile);
  }
  if (tileset.ledgeDirections !== undefined) {
    const ledges = requireRecord(`tileset ${id}.ledgeDirections`, tileset.ledgeDirections);
    for (const [tile, dir] of Object.entries(ledges)) {
      const index = Number(tile);
      assert(Number.isInteger(index) && index >= 0 && index < count, `tileset ${id}: ledgeDirections 타일 ${tile} 범위 밖`);
      assert(dir === "up" || dir === "down" || dir === "left" || dir === "right", `tileset ${id}: ledgeDirections[${tile}] 방향 오류`);
    }
  }
  if (tileset.suppressedHarnessGroupIds !== undefined) {
    for (const groupId of requireArray(`tileset ${id}.suppressedHarnessGroupIds`, tileset.suppressedHarnessGroupIds)) {
      requireString(`tileset ${id}.suppressedHarnessGroupIds[]`, groupId);
    }
  }
  if (tileset.tileGroups !== undefined) {
    for (const [index, group] of requireArray(`tileset ${id}.tileGroups`, tileset.tileGroups).entries()) {
      const record = requireRecord(`tileset ${id}.tileGroups[${index}]`, group);
      requireString(`tileset ${id}.tileGroups[${index}].id`, record.id);
      requireString(`tileset ${id}.tileGroups[${index}].name`, record.name);
      requireString(`tileset ${id}.tileGroups[${index}].role`, record.role);
      requireString(`tileset ${id}.tileGroups[${index}].defaultLayer`, record.defaultLayer);
      requireString(`tileset ${id}.tileGroups[${index}].description`, record.description);
      requireString(`tileset ${id}.tileGroups[${index}].placementRules`, record.placementRules);
      if (record.origin !== undefined) {
        const origin = requireString(`tileset ${id}.tileGroups[${index}].origin`, record.origin);
        assert(origin === "user" || origin === "ai", `tileset ${id}: tileGroups[${index}] origin invalid`);
      }
      if (record.layerHome !== undefined) {
        const layerHome = requireString(`tileset ${id}.tileGroups[${index}].layerHome`, record.layerHome);
        assert(
          layerHome === "lower" || layerHome === "upper" || layerHome === "perCell",
          `tileset ${id}: tileGroups[${index}] layerHome invalid`
        );
      }
      if (record.confidence !== undefined) {
        const confidence = requireString(`tileset ${id}.tileGroups[${index}].confidence`, record.confidence);
        assert(
          confidence === "high" || confidence === "medium" || confidence === "low",
          `tileset ${id}: tileGroups[${index}] confidence invalid`
        );
      }
      if (record.sourceRect !== undefined) {
        const sourceRect = requireRecord(`tileset ${id}.tileGroups[${index}].sourceRect`, record.sourceRect);
        requireNumber(`tileset ${id}.tileGroups[${index}].sourceRect.x`, sourceRect.x);
        requireNumber(`tileset ${id}.tileGroups[${index}].sourceRect.y`, sourceRect.y);
        requireNumber(`tileset ${id}.tileGroups[${index}].sourceRect.width`, sourceRect.width);
        requireNumber(`tileset ${id}.tileGroups[${index}].sourceRect.height`, sourceRect.height);
      }
      if (record.previewMap !== undefined) {
        const previewMap = requireRecord(`tileset ${id}.tileGroups[${index}].previewMap`, record.previewMap);
        const width = requireNumber(`tileset ${id}.tileGroups[${index}].previewMap.width`, previewMap.width);
        const height = requireNumber(`tileset ${id}.tileGroups[${index}].previewMap.height`, previewMap.height);
        const expected = width * height;
        assert(
          requireArray(`tileset ${id}.tileGroups[${index}].previewMap.lowerTiles`, previewMap.lowerTiles).length === expected,
          `tileset ${id}: tileGroups[${index}] previewMap.lowerTiles length mismatch`
        );
        assert(
          requireArray(`tileset ${id}.tileGroups[${index}].previewMap.upperTiles`, previewMap.upperTiles).length === expected,
          `tileset ${id}: tileGroups[${index}] previewMap.upperTiles length mismatch`
        );
      }
      if (record.patternGrammar !== undefined) {
        const grammar = requireRecord(`tileset ${id}.tileGroups[${index}].patternGrammar`, record.patternGrammar);
        const kind = requireString(`tileset ${id}.tileGroups[${index}].patternGrammar.kind`, grammar.kind);
        assert(
          [
            "animated_terrain",
            "autotile_3x3",
            "event_required_object",
            "horizontal_expandable",
            "nine_slice_expandable",
            "overlay_detail",
            "repeatable_block",
            "single",
            "source_rect",
            "vertical_expandable",
          ].includes(kind),
          `tileset ${id}: tileGroups[${index}] patternGrammar.kind invalid`
        );
        if (grammar.axis !== undefined) {
          const axis = requireString(`tileset ${id}.tileGroups[${index}].patternGrammar.axis`, grammar.axis);
          assert(axis === "horizontal" || axis === "vertical" || axis === "both", `tileset ${id}: tileGroups[${index}] patternGrammar.axis invalid`);
        }
        if (grammar.minWidth !== undefined) requireNumber(`tileset ${id}.tileGroups[${index}].patternGrammar.minWidth`, grammar.minWidth);
        if (grammar.minHeight !== undefined) requireNumber(`tileset ${id}.tileGroups[${index}].patternGrammar.minHeight`, grammar.minHeight);
        if (grammar.blockWidth !== undefined) requireNumber(`tileset ${id}.tileGroups[${index}].patternGrammar.blockWidth`, grammar.blockWidth);
        if (grammar.blockHeight !== undefined) requireNumber(`tileset ${id}.tileGroups[${index}].patternGrammar.blockHeight`, grammar.blockHeight);
        const repeat = requireString(`tileset ${id}.tileGroups[${index}].patternGrammar.repeat`, grammar.repeat);
        assert(repeat === "body" || repeat === "center" || repeat === "source_order", `tileset ${id}: tileGroups[${index}] patternGrammar.repeat invalid`);
        assert(typeof grammar.preserveCaps === "boolean", `tileset ${id}: tileGroups[${index}] patternGrammar.preserveCaps invalid`);
        for (const [partIndex, part] of requireArray(`tileset ${id}.tileGroups[${index}].patternGrammar.parts`, grammar.parts).entries()) {
          const partRecord = requireRecord(`tileset ${id}.tileGroups[${index}].patternGrammar.parts[${partIndex}]`, part);
          requireString(`tileset ${id}.tileGroups[${index}].patternGrammar.parts[${partIndex}].role`, partRecord.role);
          for (const tileId of requireArray(`tileset ${id}.tileGroups[${index}].patternGrammar.parts[${partIndex}].tileIds`, partRecord.tileIds)) {
            requireNumber(`tileset ${id}.tileGroups[${index}].patternGrammar.parts[${partIndex}].tileIds[]`, tileId);
          }
        }
      }
      for (const tileId of requireArray(`tileset ${id}.tileGroups[${index}].tileIds`, record.tileIds)) {
        const tileNumber = requireNumber(`tileset ${id}.tileGroups[${index}].tileIds[]`, tileId);
        assert(tileNumber >= 0 && tileNumber < count, `tileset ${id}: tileGroups[${index}] tileId out of range`);
      }
      validateTileGroupKnowledgeFields(`tileset ${id}.tileGroups[${index}]`, record, count);
    }
  }
  if (tileset.palettePresets !== undefined) {
    for (const [index, preset] of requireArray(`tileset ${id}.palettePresets`, tileset.palettePresets).entries()) {
      const record = requireRecord(`tileset ${id}.palettePresets[${index}]`, preset);
      requireString(`tileset ${id}.palettePresets[${index}].id`, record.id);
      requireString(`tileset ${id}.palettePresets[${index}].name`, record.name);
      const origin = requireString(`tileset ${id}.palettePresets[${index}].origin`, record.origin);
      assert(origin === "user" || origin === "ai", `tileset ${id}: palettePresets[${index}] origin invalid`);
      if (record.locked !== undefined) requireBoolean(`tileset ${id}.palettePresets[${index}].locked`, record.locked);
      for (const [slotIndex, slot] of requireArray(`tileset ${id}.palettePresets[${index}].slots`, record.slots).entries()) {
        const slotRecord = requireRecord(`tileset ${id}.palettePresets[${index}].slots[${slotIndex}]`, slot);
        const role = requireString(`tileset ${id}.palettePresets[${index}].slots[${slotIndex}].role`, slotRecord.role);
        assert(isPaletteSlotRole(role), `tileset ${id}: palettePresets[${index}].slots[${slotIndex}] role invalid`);
        for (const tileId of requireArray(`tileset ${id}.palettePresets[${index}].slots[${slotIndex}].tileIds`, slotRecord.tileIds)) {
          const tileNumber = requireNumber(`tileset ${id}.palettePresets[${index}].slots[${slotIndex}].tileIds[]`, tileId);
          assert(tileNumber >= 0 && tileNumber < count, `tileset ${id}: palettePresets[${index}] tileId out of range`);
        }
        if (slotRecord.weight !== undefined) {
          const weight = requireNumber(`tileset ${id}.palettePresets[${index}].slots[${slotIndex}].weight`, slotRecord.weight);
          assert(weight > 0, `tileset ${id}: palettePresets[${index}].slots[${slotIndex}] weight must be > 0`);
        }
      }
    }
  }
  if (tileset.autotileGroups !== undefined) {
    for (const [index, group] of requireArray(`tileset ${id}.autotileGroups`, tileset.autotileGroups).entries()) {
      const record = requireRecord(`tileset ${id}.autotileGroups[${index}]`, group);
      requireString(`tileset ${id}.autotileGroups[${index}].id`, record.id);
      requireString(`tileset ${id}.autotileGroups[${index}].name`, record.name);
      if (record.neighborhood !== undefined) {
        const neighborhood = requireNumber(`tileset ${id}.autotileGroups[${index}].neighborhood`, record.neighborhood);
        assert(neighborhood === 4 || neighborhood === 8, `tileset ${id}: autotileGroups[${index}] neighborhood invalid`);
      }
      for (const tileId of requireArray(`tileset ${id}.autotileGroups[${index}].memberTileIds`, record.memberTileIds)) {
        requireNumber(`tileset ${id}.autotileGroups[${index}].memberTileIds[]`, tileId);
      }
      if (record.connectTileIds !== undefined) {
        for (const tileId of requireArray(`tileset ${id}.autotileGroups[${index}].connectTileIds`, record.connectTileIds)) {
          requireNumber(`tileset ${id}.autotileGroups[${index}].connectTileIds[]`, tileId);
        }
      }
      if (record.triggerTileIds !== undefined) {
        for (const tileId of requireArray(`tileset ${id}.autotileGroups[${index}].triggerTileIds`, record.triggerTileIds)) {
          requireNumber(`tileset ${id}.autotileGroups[${index}].triggerTileIds[]`, tileId);
        }
      }
      if (record.layer !== undefined) {
        assert(record.layer === "lower" || record.layer === "upper", `tileset ${id}: autotileGroups[${index}] layer invalid`);
      }
      if (record.outsideConnects !== undefined) {
        assert(typeof record.outsideConnects === "boolean", `tileset ${id}: autotileGroups[${index}] outsideConnects invalid`);
      }
      const variantMap = requireRecord(`tileset ${id}.autotileGroups[${index}].variantMap`, record.variantMap);
      for (const [mask, variant] of Object.entries(variantMap)) {
        requireNumber(`tileset ${id}.autotileGroups[${index}].variantMap[${mask}]`, variant);
      }
      if (record.edgeConnects !== undefined) requireBoolean(`tileset ${id}.autotileGroups[${index}].edgeConnects`, record.edgeConnects);
      if (record.interiorVariants !== undefined) {
        for (const [depth, tier] of requireArray(`tileset ${id}.autotileGroups[${index}].interiorVariants`, record.interiorVariants).entries()) {
          for (const tileId of requireArray(`tileset ${id}.autotileGroups[${index}].interiorVariants[${depth}]`, tier)) {
            requireNumber(`tileset ${id}.autotileGroups[${index}].interiorVariants[${depth}][]`, tileId);
          }
        }
      }
    }
  }
  if (tileset.interiorRoomKinds !== undefined) {
    for (const [index, kind] of requireArray(`tileset ${id}.interiorRoomKinds`, tileset.interiorRoomKinds).entries()) {
      const record = requireRecord(`tileset ${id}.interiorRoomKinds[${index}]`, kind);
      requireString(`tileset ${id}.interiorRoomKinds[${index}].id`, record.id);
      requireString(`tileset ${id}.interiorRoomKinds[${index}].label`, record.label);
      for (const role of requireArray(`tileset ${id}.interiorRoomKinds[${index}].requiredRoles`, record.requiredRoles)) {
        requireString(`tileset ${id}.interiorRoomKinds[${index}].requiredRoles[]`, role);
      }
      if (record.suggestedModifiers !== undefined) {
        for (const modifier of requireArray(
          `tileset ${id}.interiorRoomKinds[${index}].suggestedModifiers`,
          record.suggestedModifiers,
        )) {
          requireString(`tileset ${id}.interiorRoomKinds[${index}].suggestedModifiers[]`, modifier);
        }
      }
      if (record.walkway !== undefined) {
        requireBoolean(`tileset ${id}.interiorRoomKinds[${index}].walkway`, record.walkway);
      }
    }
  }
  if (tileset.scratchConceptBundles !== undefined) {
    for (const [index, bundle] of requireArray(`tileset ${id}.scratchConceptBundles`, tileset.scratchConceptBundles).entries()) {
      const record = requireRecord(`tileset ${id}.scratchConceptBundles[${index}]`, bundle);
      requireString(`tileset ${id}.scratchConceptBundles[${index}].id`, record.id);
      requireString(`tileset ${id}.scratchConceptBundles[${index}].label`, record.label);
      for (const [facilityIndex, facility] of requireArray(
        `tileset ${id}.scratchConceptBundles[${index}].facilities`,
        record.facilities,
      ).entries()) {
        const entry = requireRecord(`tileset ${id}.scratchConceptBundles[${index}].facilities[${facilityIndex}]`, facility);
        requireString(`tileset ${id}.scratchConceptBundles[${index}].facilities[${facilityIndex}].id`, entry.id);
        requireString(`tileset ${id}.scratchConceptBundles[${index}].facilities[${facilityIndex}].label`, entry.label);
        if (entry.wall !== undefined) {
          const wall = requireString(`tileset ${id}.scratchConceptBundles[${index}].facilities[${facilityIndex}].wall`, entry.wall);
          assert(isConceptWallMaterial(wall), `tileset ${id}.scratchConceptBundles[${index}].facilities[${facilityIndex}].wall unknown wall: ${wall}`);
        }
        for (const placeId of requireArray(
          `tileset ${id}.scratchConceptBundles[${index}].facilities[${facilityIndex}].placeIds`,
          entry.placeIds,
        )) {
          requireString(`tileset ${id}.scratchConceptBundles[${index}].facilities[${facilityIndex}].placeIds[]`, placeId);
        }
      }
      for (const [placeIndex, place] of requireArray(
        `tileset ${id}.scratchConceptBundles[${index}].places`,
        record.places,
      ).entries()) {
        const entry = requireRecord(`tileset ${id}.scratchConceptBundles[${index}].places[${placeIndex}]`, place);
        const placePath = `tileset ${id}.scratchConceptBundles[${index}].places[${placeIndex}]`;
        requireString(`${placePath}.id`, entry.id);
        requireString(`${placePath}.label`, entry.label);
        if (entry.role !== undefined) {
          const role = requireString(`${placePath}.role`, entry.role);
          assert(isConceptPlaceRole(role), `${placePath}.role unknown role: ${role}`);
        }
        if (entry.shape !== undefined) assert(isInteriorRoomShape(entry.shape), `${placePath}.shape unknown shape`);
        if (entry.size !== undefined) {
          const size = requireString(`${placePath}.size`, entry.size);
          assert(isConceptPlaceSize(size), `${placePath}.size unknown size: ${size}`);
        }
        if (entry.count !== undefined) {
          assert(
            typeof entry.count === "number" && Number.isInteger(entry.count) && entry.count >= 1 && entry.count <= CONCEPT_PLACE_COUNT_MAX,
            `${placePath}.count must be an integer 1..${CONCEPT_PLACE_COUNT_MAX}`,
          );
        }
        if (entry.floor !== undefined) {
          const floor = requireString(`${placePath}.floor`, entry.floor);
          assert(isConceptFloorMaterial(floor), `${placePath}.floor unknown floor: ${floor}`);
        }
        if (entry.level !== undefined) {
          const level = requireNumber(`${placePath}.level`, entry.level);
          assert(isConceptPlaceLevel(level), `${placePath}.level must be an integer 1..${CONCEPT_PLACE_LEVEL_MAX}`);
        }
      }
      for (const [thingIndex, thing] of requireArray(
        `tileset ${id}.scratchConceptBundles[${index}].things`,
        record.things,
      ).entries()) {
        const entry = requireRecord(`tileset ${id}.scratchConceptBundles[${index}].things[${thingIndex}]`, thing);
        requireString(`tileset ${id}.scratchConceptBundles[${index}].things[${thingIndex}].id`, entry.id);
        requireString(`tileset ${id}.scratchConceptBundles[${index}].things[${thingIndex}].label`, entry.label);
        requireString(`tileset ${id}.scratchConceptBundles[${index}].things[${thingIndex}].objectId`, entry.objectId);
        for (const placeId of requireArray(
          `tileset ${id}.scratchConceptBundles[${index}].things[${thingIndex}].placeIds`,
          entry.placeIds,
        )) {
          requireString(`tileset ${id}.scratchConceptBundles[${index}].things[${thingIndex}].placeIds[]`, placeId);
        }
        for (const chip of requireArray(
          `tileset ${id}.scratchConceptBundles[${index}].things[${thingIndex}].chips`,
          entry.chips,
        )) {
          const chipPath = `tileset ${id}.scratchConceptBundles[${index}].things[${thingIndex}].chips[]`;
          const chipId = requireString(chipPath, chip);
          const validated = validateConceptChipId(chipId);
          assert(validated.ok, validated.ok ? chipPath : `${chipPath} ${validated.error}`);
        }
        if (entry.required !== undefined) {
          requireBoolean(`tileset ${id}.scratchConceptBundles[${index}].things[${thingIndex}].required`, entry.required);
        }
      }
    }
  }
  if (tileset.animationStrips !== undefined) {
    for (const [index, strip] of requireArray(`tileset ${id}.animationStrips`, tileset.animationStrips).entries()) {
      const record = requireRecord(`tileset ${id}.animationStrips[${index}]`, strip);
      const baseTile = requireNumber(`tileset ${id}.animationStrips[${index}].baseTile`, record.baseTile);
      assert(baseTile >= 0 && baseTile < count, `tileset ${id}: animationStrips[${index}] baseTile out of range`);
      const frames = requireNumber(`tileset ${id}.animationStrips[${index}].frames`, record.frames);
      assert(frames >= 1, `tileset ${id}: animationStrips[${index}] frames must be >= 1`);
      const fps = requireNumber(`tileset ${id}.animationStrips[${index}].fps`, record.fps);
      assert(fps > 0, `tileset ${id}: animationStrips[${index}] fps must be > 0`);
    }
  }
}

export function validateSwitches(value: unknown): void {
  for (const [index, entry] of requireArray("switches", value).entries()) {
    const record = requireRecord(`switches[${index}]`, entry);
    requireString(`switches[${index}].id`, record.id);
    requireString(`switches[${index}].name`, record.name);
  }
}

export function validateVariables(value: unknown): void {
  for (const [index, entry] of requireArray("variables", value).entries()) {
    const record = requireRecord(`variables[${index}]`, entry);
    requireString(`variables[${index}].id`, record.id);
    requireString(`variables[${index}].name`, record.name);
  }
}
