import "../../src/player/exportStorageBoot";
import { deserialize } from "../../src/project/io";
import { startSession } from "../../src/project/session";
import { setExportedProject } from "../../src/player/exportProjectStoreShim";
import { resolveCommunitySaveScope, resolveExportSaveNamespace } from "../../src/player/exportSaveNamespace";
import { renderPlayerLoadPanel } from "../../src/player/playerLoadPanel";
import { attachCursorMenu } from "../../src/player/runtimeCursorMenu";
import { applySaveSnapshot, autosaveKey, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot, setSavePublication, setSaveSlotStorageNamespace } from "../../src/player/saveSlots";
import { performAutosave } from "../../src/player/autosave";

// Narrow browser seam: production codec, host scope resolver, store shim and load DOM, without Phaser/assets.
const project = deserialize(await (await fetch("./project.json")).text());
setExportedProject(project);
setSaveSlotStorageNamespace(resolveExportSaveNamespace(project, { source: "bundled", pathname: location.pathname }));
setSavePublication(project.meta.publication, resolveCommunitySaveScope(location.pathname));
const session = startSession(project, 1);
let detach: (() => void) | undefined;
function showLoad() {
  detach?.();
  const panel = renderPlayerLoadPanel({ fromTitle: true, onBack: () => {}, onLoadAutosave: () => {}, onLoadSlot: slot => {
    const saved = readSaveSlot(localStorage, slot);
    if (saved.kind !== "present") throw new Error("Selected save missing");
    document.body.dataset.loadedGold = String(applySaveSnapshot(project, saved.snapshot).gold);
    document.body.dispatchEvent(new Event("save-loaded"));
  } });
  document.getElementById("app")!.replaceChildren(panel);
  detach = attachCursorMenu(panel, { items: Array.from(panel.querySelectorAll<HTMLButtonElement>('button[data-testid^="save-slot-"]')) });
}
Object.assign(window, { saveIsolationQa: {
  save(gold: number) {
    session.gold = gold;
    const snapshot = createSaveSnapshot(project, session);
    if (!saveToSlot(localStorage, 1, snapshot).ok) throw new Error("Save failed");
    if (!performAutosave(project, session, localStorage, "transfer")) throw new Error("Autosave failed");
    showLoad();
    return { manual: saveSlotKey(1), auto: autosaveKey() };
  },
  keys: () => ({ manual: saveSlotKey(1), auto: autosaveKey() }),
} });
showLoad();
