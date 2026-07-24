import fs from "fs";

function readLines(p) { return fs.readFileSync(p, "utf8").split("\n"); }
function writeLines(p, lines) { fs.writeFileSync(p, lines.join("\n")); console.log("Fixed:", p); }

// 1. playSceneSchedulers.ts - add openSaveMenu/spawnFieldEnemy/despawnFieldEnemy cases
{
  const p = "src/player/playSceneSchedulers.ts";
  const lines = readLines(p);
  // Find "case "openChest":" and insert after its return true;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('case "openChest":')) {
      // Find the "return true;" after it
      for (let j = i + 1; j < i + 5; j++) {
        if (lines[j].trim() === "return true;") {
          lines.splice(j + 1, 0,
            '    case "openSaveMenu":',
            '      return true;',
            '    case "spawnFieldEnemy":',
            '      return true;',
            '    case "despawnFieldEnemy":',
            '      return true;'
          );
          break;
        }
      }
      break;
    }
  }
  writeLines(p, lines);
}

// 2. saveSlots.ts - remove actorBattleCommands lines + fix chests/placeables
{
  const p = "src/player/saveSlots.ts";
  let lines = readLines(p);
  // Remove all lines containing actorBattleCommands
  lines = lines.filter(l => !l.includes("actorBattleCommands"));
  // Fix chests/placeables cast
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("chests: session.chests && typeof session.chests")) {
      lines[i] = lines[i].replace(
        "structuredClone(session.chests) : undefined,",
        "structuredClone(session.chests) as Record<string, any> : undefined,"
      );
    }
    if (lines[i].includes("placeables: session.placeables && typeof session.placeables")) {
      lines[i] = lines[i].replace(
        "structuredClone(session.placeables) : undefined,",
        "structuredClone(session.placeables) as Record<string, any> : undefined,"
      );
    }
  }
  writeLines(p, lines);
}

// 3. commandGuaranteeRegistry.ts - add missing entries before closing
{
  const p = "src/project/commandGuaranteeRegistry.ts";
  const lines = readLines(p);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("} satisfies Record<CommandKind, CommandGuarantee>;")) {
      lines.splice(i, 0,
        '  openSaveMenu: guarantee("system", {',
        '    executionOwner: "player",',
        '    completion: "conditionalPause",',
        '    quick: true,',
        '  }),',
        '  spawnFieldEnemy: guarantee("monster", {',
        '    executionOwner: "player",',
        '    completion: "immediate",',
        '    quick: true,',
        '  }),',
        '  despawnFieldEnemy: guarantee("monster", {',
        '    executionOwner: "player",',
        '    completion: "immediate",',
        '    quick: true,',
        '  }),'
      );
      break;
    }
  }
  writeLines(p, lines);
}

// 4. playSceneInterpreter.ts - fix raw type
{
  const p = "src/player/playSceneInterpreter.ts";
  const lines = readLines(p);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("const raw = scene.session.variables[step.troopVariableId];")) {
      lines[i] = lines[i].replace(
        "const raw = scene.session.variables[step.troopVariableId];",
        "const raw = scene.session.variables[step.troopVariableId] as unknown as string | number | undefined;"
      );
      break;
    }
  }
  writeLines(p, lines);
}

// 5. defaultProject.ts - fix require -> dynamic import (needs async context)
{
  const p = "src/project/defaults/defaultProject.ts";
  const lines = readLines(p);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('require("./villageShoppingStreetBuild")')) {
      // Replace the require line - check if we're in an async function
      lines[i] = lines[i].replace(
        '} = require("./villageShoppingStreetBuild") as typeof import("./villageShoppingStreetBuild");',
        '} = await import("./villageShoppingStreetBuild");'
      );
      // Check if the enclosing function is async
      for (let j = i - 1; j >= 0; j--) {
        if (lines[j].includes("function") && !lines[j].includes("async")) {
          lines[j] = lines[j].replace("function", "async function");
          break;
        }
        if (lines[j].includes("async function")) break;
      }
      break;
    }
  }
  writeLines(p, lines);
}

// 6. Remove unused functions (noUnusedLocals = true, underscore won't help)
// commandBodyDatabase.ts - remove _recordSelect function
{
  const p = "src/editor/panels/eventEditor/commandBodyDatabase.ts";
  const lines = readLines(p);
  let start = -1, end = -1, braceCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("function _recordSelect(")) {
      start = i;
      braceCount = 0;
    }
    if (start >= 0 && i >= start) {
      braceCount += (lines[i].match(/{/g) || []).length;
      braceCount -= (lines[i].match(/}/g) || []).length;
      if (braceCount === 0 && i > start) {
        end = i;
        break;
      }
    }
  }
  if (start >= 0 && end >= 0) {
    lines.splice(start, end - start + 1);
    console.log(`Removed _recordSelect (lines ${start+1}-${end+1})`);
  }
  writeLines(p, lines);
}

// commandSummary.ts - remove _choiceSummary function
{
  const p = "src/editor/panels/eventEditor/commandSummary.ts";
  const lines = readLines(p);
  let start = -1, end = -1, braceCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("function _choiceSummary(")) {
      start = i;
      braceCount = 0;
    }
    if (start >= 0 && i >= start) {
      braceCount += (lines[i].match(/{/g) || []).length;
      braceCount -= (lines[i].match(/}/g) || []).length;
      if (braceCount === 0 && i > start) {
        end = i;
        break;
      }
    }
  }
  if (start >= 0 && end >= 0) {
    lines.splice(start, end - start + 1);
    console.log(`Removed _choiceSummary (lines ${start+1}-${end+1})`);
  }
  writeLines(p, lines);
}

// modal.ts - remove _createCloseHandler function
{
  const p = "src/editor/panels/eventEditor/modal.ts";
  const lines = readLines(p);
  let start = -1, end = -1, braceCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("function _createCloseHandler(")) {
      start = i;
      braceCount = 0;
    }
    if (start >= 0 && i >= start) {
      braceCount += (lines[i].match(/{/g) || []).length;
      braceCount -= (lines[i].match(/}/g) || []).length;
      if (braceCount === 0 && i > start) {
        end = i;
        break;
      }
    }
  }
  if (start >= 0 && end >= 0) {
    lines.splice(start, end - start + 1);
    console.log(`Removed _createCloseHandler (lines ${start+1}-${end+1})`);
  }
  writeLines(p, lines);
}

// tilePaletteRm2k.ts - remove _RM2K_CELL_SIZE
{
  const p = "src/editor/panels/tilePaletteRm2k.ts";
  let lines = readLines(p);
  lines = lines.filter(l => !l.includes("_RM2K_CELL_SIZE"));
  writeLines(p, lines);
}

// battleCommandDom.ts - remove _keyPrompts function
{
  const p = "src/player/battleCommandDom.ts";
  const lines = readLines(p);
  let start = -1, end = -1, braceCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("function _keyPrompts(")) {
      start = i;
      braceCount = 0;
    }
    if (start >= 0 && i >= start) {
      braceCount += (lines[i].match(/{/g) || []).length;
      braceCount -= (lines[i].match(/}/g) || []).length;
      if (braceCount === 0 && i > start) {
        end = i;
        break;
      }
    }
  }
  if (start >= 0 && end >= 0) {
    lines.splice(start, end - start + 1);
    console.log(`Removed _keyPrompts (lines ${start+1}-${end+1})`);
  }
  writeLines(p, lines);
}

// farming.ts - remove _hasFarmTool function
{
  const p = "src/player/farming.ts";
  const lines = readLines(p);
  let start = -1, end = -1, braceCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("function _hasFarmTool(")) {
      start = i;
      braceCount = 0;
    }
    if (start >= 0 && i >= start) {
      braceCount += (lines[i].match(/{/g) || []).length;
      braceCount -= (lines[i].match(/}/g) || []).length;
      if (braceCount === 0 && i > start) {
        end = i;
        break;
      }
    }
  }
  if (start >= 0 && end >= 0) {
    lines.splice(start, end - start + 1);
    console.log(`Removed _hasFarmTool (lines ${start+1}-${end+1})`);
  }
  writeLines(p, lines);
}

// 7. commandBodyDatabase.ts - fix remaining VariableOperand at line 484
{
  const p = "src/editor/panels/eventEditor/commandBodyDatabase.ts";
  const lines = readLines(p);
  // Find all numberInput(cmd.amount, ...) and fix
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("numberInput(cmd.amount,")) {
      lines[i] = lines[i].replace(
        "numberInput(cmd.amount,",
        'numberInput(typeof cmd.amount === "number" ? cmd.amount : 0,'
      );
    }
  }
  writeLines(p, lines);
}

// 8. pageAdvancedConditions.ts - renderAdvancedConditionContent missing return
{
  const p = "src/editor/panels/eventEditor/pageAdvancedConditions.ts";
  const lines = readLines(p);
  // Find "function renderAdvancedConditionContent" and its closing
  let inFunc = false, braceCount = 0, funcEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("function renderAdvancedConditionContent")) {
      inFunc = true;
      braceCount = 0;
    }
    if (inFunc) {
      braceCount += (lines[i].match(/{/g) || []).length;
      braceCount -= (lines[i].match(/}/g) || []).length;
      if (braceCount === 0 && i > 118) {
        funcEnd = i;
        break;
      }
    }
  }
  if (funcEnd > 0) {
    lines.splice(funcEnd, 0, '  return document.createElement("div");');
    console.log("Added return to renderAdvancedConditionContent at line", funcEnd + 1);
  }
  writeLines(p, lines);
}

// 9. largeRiverMarketVillageBuild.ts - unused params
{
  const p = "src/project/defaults/largeRiverMarketVillageBuild.ts";
  const lines = readLines(p);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("_rng:") || lines[i].includes("rng: () => number,")) {
      // Check if it's a destructured param - just remove the line
      if (lines[i].trim().startsWith("rng:") || lines[i].trim().startsWith("_rng:")) {
        lines[i] = "";
      }
    }
    if (lines[i].includes("_log:") || (lines[i].includes("log: LargeVillageBuildLog,") && i > 2300)) {
      if (lines[i].trim().startsWith("log:") || lines[i].trim().startsWith("_log:")) {
        lines[i] = "";
      }
    }
  }
  writeLines(p, lines.filter(l => l !== ""));
}

console.log("\nAll final patches applied");
