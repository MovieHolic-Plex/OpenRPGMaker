import type { Page } from "playwright";
import type { Command, Project } from "../../src/project/types";

type EventAiTarget = { readonly mapId: string; readonly eventId: string; readonly pageId: string };

export function eventAiFixture(
  commands: readonly Command[],
  options?: { title?: string; name?: string; secondPage?: boolean },
): { project: Project; target: EventAiTarget; switchId: string };

export function mockEventAi(
  page: Page,
  target: EventAiTarget,
  commands: readonly Command[],
  options?: { gate?: () => Promise<void>; mode?: "edit" | "append" },
): Promise<() => number>;
