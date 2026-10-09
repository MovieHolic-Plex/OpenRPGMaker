/** @vitest-environment happy-dom */
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { createInterpreter } from "../src/player/interpreter";
import { deserialize, serialize } from "../src/project/io";
import type { PlaySessionLike } from "../src/project/sessionRuntimeTypes";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { own } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { geographyRoot } from "./support/spatialGeographyFixture";
import { geographyMotionFixture, motionChild, moveMotionChild } from "./support/spatialGeographyMotionFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

let baseline: string;
const previous = store.getCurrent();
const request = { operation: { kind: "edit" }, compile: { occurrenceId: geographyRoot } } as const;
beforeAll(() => { baseline = serialize(geographyMotionFixture()); });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(deserialize(baseline)); resetMapEditHistory();
});
afterEach(() => { store.replace(previous); resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it.each([
  { nested: false, continued: false, x: 8 },
  { nested: true, continued: false, x: 7 },
  { nested: false, continued: true, x: 9 },
])("preserves saved pairs when a compiled child moves (nested=$nested, continued=$continued)", ({ nested, continued, x }) => {
  // Given canonical compiled output with opaque pair IDs, custom event payload and a sibling override.
  const before = serialize(store.getCurrent());
  const first = motionChild(store.getCurrent(), geographyRoot, "first");
  const parentId = nested ? first : geographyRoot;
  const slot = nested ? "west" : "first";
  const selectedId = motionChild(store.getCurrent(), parentId, slot);
  const third = motionChild(store.getCurrent(), geographyRoot, "third");
  const controller = createSpatialAuthoringController();
  let draft = authoringValue(controller.createDraft());
  if (continued) {
    Object.assign(draft.project, moveMotionChild(draft.project, { parentId, slot, x: 8 }));
    const checkpoint = authoringValue(controller.preview(draft, request));
    draft = authoringValue(controller.continueDraft(checkpoint));
  }
  const protectedProject = structuredClone(draft.project);
  const original = fixtureDocument(protectedProject);
  // When the actual selected placement is compiled through its containing world and accepted once.
  Object.assign(draft.project, moveMotionChild(draft.project, { parentId, slot, x }));
  const preview = authoringValue(controller.preview(draft, request));
  // Then only selected pair navigation changes; saved identities and unaffected payloads survive compilation.
  const result = fixtureDocument(preview.project);
  expect(own(result.occurrences, selectedId).x).toBe(x);
  expect(own(result.occurrences, third).x).toBe(53);
  for (const owner of Object.values(original.occurrences)) for (const binding of owner.bindings.filter(isOwnedSpatialBinding)) {
    const after = own(result.occurrences, owner.id).bindings.find(isOwnedSpatialBinding);
    expect(after?.ports).toEqual(binding.ports);
    expect(after?.eventIds).toEqual(binding.eventIds);
    for (const entry of binding.overviewEntries ?? []) {
      const updated = after?.overviewEntries?.find(value => value.target.occurrenceId === entry.target.occurrenceId && value.target.portId === entry.target.portId);
      expect(updated).toMatchObject({ eventId: entry.eventId, returnEventId: entry.returnEventId, target: entry.target });
      for (const id of [entry.eventId, entry.returnEventId]) {
        const oldLink = protectedProject.mapConnections?.find(link => link.id === id);
        const link = preview.project.mapConnections?.find(link => link.id === id);
        if (!oldLink || !link) throw new TypeError("Missing saved pair projection");
        const event = own(preview.project.maps, link.from.mapId).events.find(event => event.id === id);
        if (!event) throw new TypeError("Missing saved pair event");
        if (entry.target.occurrenceId !== selectedId) {
          expect(link).toEqual(oldLink);
          expect(event).toEqual(own(protectedProject.maps, oldLink.from.mapId).events.find(event => event.id === id));
        } else {
          const page = event.pages?.[0];
          if (!page) throw new TypeError("Missing transfer page");
          const session: PlaySessionLike = { flags: {}, switches: {}, variables: {}, timers: {}, gold: 0, inventory: {},
            partyActorIds: [], actorExperience: {}, actorLevels: {}, actorEquipment: {}, actorVitals: {},
            currentMapId: link.from.mapId, x: link.from.x, y: link.from.y };
          expect(createInterpreter(page.commands, session, preview.project).start()).toMatchObject({ kind: "transfer", ...link.to });
          expect(id === entry.eventId ? link.from.x : link.to.x).toBe(x);
        }
      }
    }
  }
  expect(serialize(store.getCurrent())).toBe(before);
  expect(getMapEditHistoryEntries()).toEqual([]);
  expect(authoringValue(controller.apply(preview)).changed).toBe(true);
  expect(getMapEditHistoryEntries()).toHaveLength(1);
  const accepted = serialize(store.getCurrent());
  expect(serialize(deserialize(accepted))).toBe(accepted);
  expect(controller.undo()).toBe(true); expect(serialize(store.getCurrent())).toBe(before);
  expect(controller.redo()).toBe(true); expect(serialize(store.getCurrent())).toBe(accepted);
});
