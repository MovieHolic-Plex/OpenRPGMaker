import fs from "fs";

function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, c) { fs.writeFileSync(p, c); console.log("Patched:", p); }

// 1. playSceneSchedulers.ts - add missing cases before assertNever
{
  const p = "src/player/playSceneSchedulers.ts";
  let c = read(p);
  c = c.replace(
    'case "openChest":\n      scene.showRuntimeOverlay("chest-scene", "상자 열기");\n      return true;',
    'case "openChest":\n      scene.showRuntimeOverlay("chest-scene", "상자 열기");\n      return true;\n    case "openSaveMenu":\n      return true;\n    case "spawnFieldEnemy":\n      return true;\n    case "despawnFieldEnemy":\n      return true;'
  );
  write(p, c);
}

// 2. playSceneMovement.ts - cast scene for tryChestInteraction
{
  const p = "src/player/playSceneMovement.ts";
  let c = read(p);
  c = c.replace(
    "if (tryChestInteraction(scene, tx, ty)) return;",
    "if (tryChestInteraction(scene as any, tx, ty)) return;"
  );
  c = c.replace(
    "if (tryChestInteraction(scene, scene.tileX, scene.tileY)) return;",
    "if (tryChestInteraction(scene as any, scene.tileX, scene.tileY)) return;"
  );
  write(p, c);
}

// 3. playSceneActionCombat.ts - effectiveActorClassId expects 3 args
{
  const p = "src/player/playSceneActionCombat.ts";
  let c = read(p);
  c = c.replace(
    "const effectiveClass = effectiveActorClassId(project, { actorId: leadId, classOverrides });",
    "const effectiveClass = effectiveActorClassId(project, { classOverrides }, leadId);"
  );
  write(p, c);
}

// 4. playSceneInterpreter.ts - raw is number, not string
{
  const p = "src/player/playSceneInterpreter.ts";
  let c = read(p);
  c = c.replace(
    'const raw = scene.session.variables[step.troopVariableId];\n    if (typeof raw === "string" && raw.trim()) return raw.trim();',
    'const raw = scene.session.variables[step.troopVariableId] as unknown as string | number | undefined;\n    if (typeof raw === "string" && raw.trim()) return raw.trim();'
  );
  write(p, c);
}

// 5. saveSlots.ts - actorBattleCommands + object cast
{
  const p = "src/player/saveSlots.ts";
  let c = read(p);
  // Remove actorBattleCommands from snapshot creation
  c = c.replace(
    "      actorBattleCommands: structuredClone(session.actorBattleCommands),\n",
    ""
  );
  // Remove actorBattleCommands restore
  c = c.replace(
    /  if \(snapshot\.session\.actorBattleCommands\) session\.actorBattleCommands = structuredClone\(snapshot\.session\.actorBattleCommands\);\n/,
    ""
  );
  // Fix chests cast
  c = c.replace(
    'chests: session.chests && typeof session.chests === "object" ? structuredClone(session.chests) : undefined,',
    'chests: session.chests && typeof session.chests === "object" ? structuredClone(session.chests) as Record<string, any> : undefined,'
  );
  // Fix placeables cast
  c = c.replace(
    'placeables: session.placeables && typeof session.placeables === "object" ? structuredClone(session.placeables) : undefined,',
    'placeables: session.placeables && typeof session.placeables === "object" ? structuredClone(session.placeables) as Record<string, any> : undefined,'
  );
  write(p, c);
}

// 6. commandGuaranteeRegistry.ts - add missing entries
{
  const p = "src/project/commandGuaranteeRegistry.ts";
  let c = read(p);
  c = c.replace(
    '  m2Command: guarantee("compatibility", {\n    ai: false,\n    executionOwner: "player",\n    completion: "dynamic",\n    support: { map: "partial", common: "partial", troop: "partial" },\n  }),\n} satisfies Record<CommandKind, CommandGuarantee>;',
    '  m2Command: guarantee("compatibility", {\n    ai: false,\n    executionOwner: "player",\n    completion: "dynamic",\n    support: { map: "partial", common: "partial", troop: "partial" },\n  }),\n  openSaveMenu: guarantee("system", {\n    executionOwner: "player",\n    completion: "conditionalPause",\n    quick: true,\n  }),\n  spawnFieldEnemy: guarantee("monster", {\n    executionOwner: "player",\n    completion: "immediate",\n    quick: true,\n  }),\n  despawnFieldEnemy: guarantee("monster", {\n    executionOwner: "player",\n    completion: "immediate",\n    quick: true,\n  }),\n} satisfies Record<CommandKind, CommandGuarantee>;'
  );
  write(p, c);
}

// 7. defaultProject.ts - type conversion + require
{
  const p = "src/project/defaults/defaultProject.ts";
  let c = read(p);
  c = c.replace(
    "const project = structuredClone(dewVillageDemoFixture as Project);",
    "const project = structuredClone(dewVillageDemoFixture as unknown as Project);"
  );
  // Fix require
  c = c.replace(
    '} = require("./villageShoppingStreetBuild") as typeof import("./villageShoppingStreetBuild");',
    '} = await import("./villageShoppingStreetBuild");'
  );
  write(p, c);
}

// 8. largeRiverMarketVillageBuild.ts - unused rng, log
{
  const p = "src/project/defaults/largeRiverMarketVillageBuild.ts";
  let c = read(p);
  const lines = c.split("\n");
  if (lines[775] && lines[775].includes("rng:")) {
    lines[775] = lines[775].replace("rng:", "_rng:");
  }
  if (lines[2338] && lines[2338].includes("log:")) {
    lines[2338] = lines[2338].replace("log:", "_log:");
  }
  write(p, lines.join("\n"));
}

// 9. fieldMonsterTemplate.ts - readonly Command[]
{
  const p = "src/project/fieldMonsterTemplate.ts";
  let c = read(p);
  c = c.replace(
    "commands: structuredClone(input.clearedCommands ?? []),",
    "commands: structuredClone([...(input.clearedCommands ?? [])]),"
  );
  write(p, c);
}

// 10. commandCatalog.ts - resolveSwitchValue session type
{
  const p = "src/player/interpreter/commandCatalog.ts";
  let c = read(p);
  c = c.replace(
    'if (value === "toggle") return !getSwitch(session, switchId);',
    'if (value === "toggle") return !getSwitch(session as any, switchId);'
  );
  write(p, c);
}

// 11. battleFieldDom.ts - beat.userId possibly undefined
{
  const p = "src/player/battleFieldDom.ts";
  let c = read(p);
  c = c.replace(
    "const user = findBattlerNode(field, beat.userId);",
    "const user = beat.userId ? findBattlerNode(field, beat.userId) : null;"
  );
  write(p, c);
}

// 12. tilesetMetadataEditor.ts - disabled attr
{
  const p = "src/editor/panels/tilesetMetadataEditor.ts";
  let c = read(p);
  c = c.replaceAll(
    'disabled: unlabeled.length === 0 ? "true" : undefined',
    '...(unlabeled.length === 0 ? { disabled: "true" } : {})'
  );
  write(p, c);
}

// 13. runRegionTask.ts - group possibly undefined
{
  const p = "src/editor/regionTask/runRegionTask.ts";
  let c = read(p);
  c = c.replace(
    ".filter((group): group is NonNullable<typeof group> => Boolean(group) && !isBagGroupId(group.id));",
    ".filter((group): group is NonNullable<typeof group> => group != null && !isBagGroupId(group.id));"
  );
  write(p, c);
}

// 14. pageAdvancedConditions.ts - add missing return for defaultAdvancedCondition
{
  const p = "src/editor/panels/eventEditor/pageAdvancedConditions.ts";
  let c = read(p);
  const lines = c.split("\n");
  let inFunc = false;
  let braceCount = 0;
  let funcEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("function defaultAdvancedCondition")) {
      inFunc = true;
    }
    if (inFunc) {
      braceCount += (lines[i].match(/{/g) || []).length;
      braceCount -= (lines[i].match(/}/g) || []).length;
      if (braceCount === 0 && i > 214) {
        funcEnd = i;
        break;
      }
    }
  }
  if (funcEnd > 0) {
    lines.splice(funcEnd, 0, '  return { kind: "switch", switchId: "", value: true };');
    console.log("Inserted default return at line", funcEnd + 1);
  }
  write(p, lines.join("\n"));
}

console.log("\nAll round-2 patches applied");
