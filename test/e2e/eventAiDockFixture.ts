import type { Page } from "@playwright/test";
import type { Command, Project } from "@/project/types";
import { eventAiFixture, mockEventAi } from "../../scripts/lib/event-ai-fixture.mjs";
import { seedProjectForEditor } from "./projectSeed";

export const EVENT_DOCK_ID = eventAiFixture([]).target;

export function eventDockProject(commands: readonly Command[], options?: { title?: string; name?: string; secondPage?: boolean }): Project {
  return eventAiFixture(structuredClone(commands), options).project;
}

export function mockDockModel(page: Page, commands: readonly Command[], gate?: () => Promise<void>): Promise<() => number> {
  return mockEventAi(page, EVENT_DOCK_ID, commands, { gate });
}

export async function openEventDockFixture(page: Page, project: Project): Promise<void> {
  await seedProjectForEditor(page, project);
  await page.evaluate(async ({ project, target }) => {
    const { store } = await import("/src/project/store.ts");
    const { openEventEditorModal } = await import("/src/editor/panels/eventEditor/modal.ts");
    // Boot normalizes the fixture with bundled data. Keep the assistant's test project small.
    store.replaceProject(project);
    openEventEditorModal(target.mapId, target.eventId);
  }, { project, target: EVENT_DOCK_ID });
}
