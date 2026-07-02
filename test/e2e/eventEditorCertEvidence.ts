import { expect, type Locator, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import type { Project } from "@/project/types";

export type RuntimeState = {
  readonly mapId: string;
  readonly running: boolean;
  readonly inputEnabled: boolean;
  readonly player: { readonly x: number; readonly y: number };
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  readonly timers: Record<string, number>;
  readonly timerActive?: Record<string, boolean>;
  readonly gold: number;
  readonly inventory: Record<string, number>;
  readonly partyActorIds: readonly string[];
  readonly actorSkillIds?: Record<string, readonly string[]>;
  readonly actorVitals: Record<string, { readonly hp: number; readonly mp: number; readonly maxHp: number; readonly maxMp: number }>;
  readonly mapOverrides: Record<string, { readonly lower: Record<string, number>; readonly upper: Record<string, number> }>;
  readonly events: Record<string, { readonly x: number; readonly y: number; readonly pageId?: string }>;
  readonly movers: Record<string, RuntimeMoverState>;
};

export type RuntimeMoverState = {
  readonly step: number;
  readonly moveCount: number;
  readonly remainingMoveCount: number;
  readonly repeat: boolean;
  readonly strategy: string;
  readonly facing: string;
  readonly directionFix: boolean;
  readonly through: boolean;
  readonly animationEnabled: boolean;
  readonly opacity: number;
  readonly speedRank: number;
  readonly frequencyRank: number;
  readonly moveIntervalMs: number;
  readonly moveDurationMs: number;
  readonly activeMove: RuntimeMoverActiveMove | null;
};

export type RuntimeMoverActiveMove = {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly dir: string;
};

export type DebugState = {
  readonly project: Project;
};

export async function dismissDialogue(page: Page): Promise<void> {
  await page.getByTestId("dialogue-box").click();
}

export async function openEventEditor(page: Page, eventId: string): Promise<void> {
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await page.getByTestId(`event-list-row-${eventId}`).click();
  await page.getByTestId("event-editor-open").click();
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
}

export async function dispatchChange(locator: Locator): Promise<void> {
  await locator.evaluate((node) => node.dispatchEvent(new Event("change", { bubbles: true })));
}

export async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  const parsed: unknown = JSON.parse(text);
  if (!isDebugState(parsed)) throw new Error("invalid project export");
  return parsed;
}

export async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  const parsed: unknown = JSON.parse(text);
  if (!isRuntimeState(parsed)) throw new Error("invalid runtime state");
  return parsed;
}

export async function screenshotEvidence(page: Page, dir: string, name: string): Promise<void> {
  await page.screenshot({ path: `${dir}/${name}`, fullPage: true });
}

export async function writeEvidenceJson(dir: string, name: string, value: unknown): Promise<void> {
  await writeFile(`${dir}/${name}`, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeEvidenceText(dir: string, name: string, value: string): Promise<void> {
  await writeFile(`${dir}/${name}`, value, "utf8");
}

function isDebugState(value: unknown): value is DebugState {
  return isRecord(value) && isRecord(value.project);
}

function isRuntimeState(value: unknown): value is RuntimeState {
  return isRecord(value)
    && typeof value.mapId === "string"
    && typeof value.running === "boolean"
    && typeof value.inputEnabled === "boolean"
    && isRecord(value.player)
    && typeof value.player.x === "number"
    && typeof value.player.y === "number"
    && isBooleanRecord(value.switches)
    && isNumberRecord(value.variables)
    && isNumberRecord(value.timers)
    && isRecord(value.actorVitals)
    && isRecord(value.mapOverrides)
    && isRecord(value.events)
    && isMoverRecord(value.movers);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "boolean");
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "number");
}

function isMoverRecord(value: unknown): value is Record<string, RuntimeMoverState> {
  return isRecord(value) && Object.values(value).every(isMoverState);
}

function isMoverState(value: unknown): value is RuntimeMoverState {
  if (!isRecord(value)) return false;
  return typeof value.step === "number"
    && typeof value.moveCount === "number"
    && typeof value.remainingMoveCount === "number"
    && typeof value.repeat === "boolean"
    && typeof value.strategy === "string"
    && typeof value.facing === "string"
    && typeof value.directionFix === "boolean"
    && typeof value.through === "boolean"
    && typeof value.animationEnabled === "boolean"
    && typeof value.opacity === "number"
    && typeof value.speedRank === "number"
    && typeof value.frequencyRank === "number"
    && typeof value.moveIntervalMs === "number"
    && typeof value.moveDurationMs === "number"
    && (value.activeMove === null || isActiveMove(value.activeMove));
}

function isActiveMove(value: unknown): value is RuntimeMoverActiveMove {
  return isRecord(value)
    && typeof value.fromX === "number"
    && typeof value.fromY === "number"
    && typeof value.toX === "number"
    && typeof value.toY === "number"
    && typeof value.dir === "string";
}
