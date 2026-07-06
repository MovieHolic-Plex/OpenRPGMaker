import { assert, requireArray, requireNumber, requireRecord, requireString, resourceKinds } from "./guards";
import { validateAssetRef } from "./shapeReferenceFields";

export function validateMeta(value: unknown): void {
  const meta = requireRecord("meta", value);
  requireString("meta.title", meta.title);
  requireString("meta.author", meta.author);
  const terms = requireRecord("meta.terms", meta.terms);
  requireString("meta.terms.gold", terms.gold);
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
  requireString(`tileset ${id}.id`, tileset.id);
  requireString(`tileset ${id}.name`, tileset.name);
  validateAssetRef(`tileset ${id}.image`, tileset.image);
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
  }
  if (tileset.transparentColor !== undefined) {
    requireString(`tileset ${id}.transparentColor`, tileset.transparentColor);
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
    }
  }
  if (tileset.terrainTemplates !== undefined) {
    for (const [index, template] of requireArray(`tileset ${id}.terrainTemplates`, tileset.terrainTemplates).entries()) {
      const record = requireRecord(`tileset ${id}.terrainTemplates[${index}]`, template);
      requireString(`tileset ${id}.terrainTemplates[${index}].id`, record.id);
      requireString(`tileset ${id}.terrainTemplates[${index}].name`, record.name);
      requireString(`tileset ${id}.terrainTemplates[${index}].sourceMapName`, record.sourceMapName);
      if (record.grammar !== undefined) {
        for (const [grammarIndex, grammar] of requireArray(`tileset ${id}.terrainTemplates[${index}].grammar`, record.grammar).entries()) {
          const grammarRecord = requireRecord(`tileset ${id}.terrainTemplates[${index}].grammar[${grammarIndex}]`, grammar);
          const kind = requireString(`tileset ${id}.terrainTemplates[${index}].grammar[${grammarIndex}].kind`, grammarRecord.kind);
          assert(kind === "overlay" || kind === "roof-row" || kind === "wall-row", `tileset ${id}: terrainTemplates[${index}] grammar.kind invalid`);
          requireString(`tileset ${id}.terrainTemplates[${index}].grammar[${grammarIndex}].role`, grammarRecord.role);
          requireString(`tileset ${id}.terrainTemplates[${index}].grammar[${grammarIndex}].layer`, grammarRecord.layer);
          requireString(`tileset ${id}.terrainTemplates[${index}].grammar[${grammarIndex}].meaning`, grammarRecord.meaning);
          if (grammarRecord.left !== undefined) requireNumber(`tileset ${id}.terrainTemplates[${index}].grammar[${grammarIndex}].left`, grammarRecord.left);
          if (grammarRecord.middle !== undefined) requireNumber(`tileset ${id}.terrainTemplates[${index}].grammar[${grammarIndex}].middle`, grammarRecord.middle);
          if (grammarRecord.right !== undefined) requireNumber(`tileset ${id}.terrainTemplates[${index}].grammar[${grammarIndex}].right`, grammarRecord.right);
          if (grammarRecord.mustTouch !== undefined) requireString(`tileset ${id}.terrainTemplates[${index}].grammar[${grammarIndex}].mustTouch`, grammarRecord.mustTouch);
          if (grammarRecord.tiles !== undefined) {
            for (const tile of requireArray(`tileset ${id}.terrainTemplates[${index}].grammar[${grammarIndex}].tiles`, grammarRecord.tiles)) {
              requireNumber(`tileset ${id}.terrainTemplates[${index}].grammar[${grammarIndex}].tiles[]`, tile);
            }
          }
        }
      }
      for (const [rowIndex, row] of requireArray(`tileset ${id}.terrainTemplates[${index}].rows`, record.rows).entries()) {
        const rowRecord = requireRecord(`tileset ${id}.terrainTemplates[${index}].rows[${rowIndex}]`, row);
        requireString(`tileset ${id}.terrainTemplates[${index}].rows[${rowIndex}].section`, rowRecord.section);
        requireString(`tileset ${id}.terrainTemplates[${index}].rows[${rowIndex}].coord`, rowRecord.coord);
        requireString(`tileset ${id}.terrainTemplates[${index}].rows[${rowIndex}].meaning`, rowRecord.meaning);
        for (const layer of ["lower", "upper", "stack"] as const) {
          for (const tile of requireArray(`tileset ${id}.terrainTemplates[${index}].rows[${rowIndex}].${layer}`, rowRecord[layer])) {
            requireNumber(`tileset ${id}.terrainTemplates[${index}].rows[${rowIndex}].${layer}[]`, tile);
          }
        }
      }
      for (const rule of requireArray(`tileset ${id}.terrainTemplates[${index}].rules`, record.rules)) {
        requireString(`tileset ${id}.terrainTemplates[${index}].rules[]`, rule);
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
      const variantMap = requireRecord(`tileset ${id}.autotileGroups[${index}].variantMap`, record.variantMap);
      for (const [mask, variant] of Object.entries(variantMap)) {
        requireNumber(`tileset ${id}.autotileGroups[${index}].variantMap[${mask}]`, variant);
      }
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
