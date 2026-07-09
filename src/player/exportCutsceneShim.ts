import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import type { Command, FaceGraphic, M2CommandFields, MoveCommand, MoveRoute } from "@/project/types";
import { CUTSCENE_END_LABEL } from "@/player/cutsceneControl";

export type CutsceneBeat =
  | CutsceneSayBeat
  | CutsceneMoveActorBeat
  | CutsceneCameraBeat
  | CutscenePictureBeat
  | CutsceneMusicBeat
  | CutsceneTintBeat
  | CutsceneFlashBeat
  | CutsceneShakeBeat
  | CutsceneWaitBeat
  | CutsceneParallelBeat
  | CutsceneLabelBeat
  | CutsceneJumpBeat;

export type CutsceneSayBeat = {
  readonly kind: "say";
  readonly speaker?: string;
  readonly face?: Partial<FaceGraphic>;
  readonly text?: string;
  readonly lines?: readonly string[];
};

export type CutsceneMoveActorBeat = {
  readonly kind: "moveActor";
  readonly target?: string;
  readonly eventId?: string;
  readonly actor?: string;
  readonly route?: Partial<MoveRoute>;
  readonly moves?: readonly MoveCommand[];
  readonly wait?: boolean;
};

export type CutsceneCameraBeat = {
  readonly kind: "camera";
  readonly mode: "pan" | "follow" | "fixed" | "return";
  readonly target?: string | { readonly eventId?: string; readonly x?: number; readonly y?: number };
  readonly eventId?: string;
  readonly x?: number;
  readonly y?: number;
  readonly durationMs?: number;
  readonly wait?: boolean;
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly zoom?: number;
};

export type CutscenePictureBeat = {
  readonly kind: "picture";
  readonly action: "show" | "move" | "erase";
  readonly pictureId?: string;
  readonly id?: string;
  readonly resourceId?: string;
  readonly x?: number;
  readonly y?: number;
  readonly scale?: number;
  readonly opacity?: number;
  readonly rotation?: number;
  readonly durationMs?: number;
  readonly wait?: boolean;
  readonly waitForPicture?: boolean;
};

export type CutsceneMusicBeat = {
  readonly kind: "music";
  readonly action: "bgm" | "se" | "fade" | "stop";
  readonly resourceId?: string;
  readonly loop?: boolean;
  readonly durationMs?: number;
};

export type CutsceneTintBeat = { readonly kind: "tint"; readonly color?: string; readonly value?: string; readonly durationMs?: number; readonly wait?: boolean };
export type CutsceneFlashBeat = { readonly kind: "flash"; readonly color?: string; readonly durationMs?: number };
export type CutsceneShakeBeat = { readonly kind: "shake"; readonly intensity?: number; readonly durationMs?: number };
export type CutsceneWaitBeat = { readonly kind: "wait"; readonly ms: number };
export type CutsceneParallelBeat = { readonly kind: "parallel"; readonly beats: readonly CutsceneBeat[] };
export type CutsceneLabelBeat = { readonly kind: "label"; readonly name: string };
export type CutsceneJumpBeat = { readonly kind: "jump"; readonly name: string };

export type CutsceneValidationContext = {
  readonly eventIds?: ReadonlySet<string>;
  readonly resourceIds?: ReadonlySet<string>;
};

export type CutsceneCompileOptions = {
  readonly skippable?: boolean;
  readonly context?: CutsceneValidationContext;
};

export class CutsceneValidationError extends Error {
  readonly reasons: readonly string[];

  constructor(reasons: readonly string[]) {
    super(reasons.join("\n"));
    this.name = "CutsceneValidationError";
    this.reasons = reasons;
  }
}

export function compileCutscene(beats: readonly CutsceneBeat[], options: CutsceneCompileOptions = {}): Command[] {
  const validation = validateCutscene(beats, options.context);
  if (!validation.ok) throw new CutsceneValidationError(validation.errors);
  return [
    { kind: "cutsceneControl", mode: "begin", skippable: options.skippable === true },
    ...compileBeats(beats),
    { kind: "label", name: CUTSCENE_END_LABEL },
    { kind: "cutsceneControl", mode: "end" },
  ];
}

export function validateCutscene(
  beats: readonly CutsceneBeat[],
  context: CutsceneValidationContext = {}
): { readonly ok: true; readonly errors: readonly [] } | { readonly ok: false; readonly errors: readonly string[] } {
  const errors: string[] = [];
  visit(beats, (beat, path) => {
    if (!isRecord(beat) || typeof beat.kind !== "string") {
      errors.push(`${path}: 컷신 beat 형식이 올바르지 않습니다.`);
      return;
    }
    if (beat.kind === "moveActor") validateEventId(path, beat.eventId ?? beat.target, context.eventIds, errors);
    if (beat.kind === "picture") validateResourceId(path, beat.resourceId, context.resourceIds, errors);
    if (beat.kind === "music") validateResourceId(path, beat.resourceId, context.resourceIds, errors);
    if (beat.kind === "say" && isRecord(beat.face)) validateResourceId(path, stringValue(beat.face.resourceId), context.resourceIds, errors);
  });
  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

function compileBeats(beats: readonly CutsceneBeat[]): Command[] {
  return beats.flatMap((beat) => compileBeat(beat));
}

function compileBeat(beat: CutsceneBeat): Command[] {
  switch (beat.kind) {
    case "say":
      return compileSay(beat);
    case "moveActor":
      return [compileMoveActor(beat)];
    case "camera":
      return [m2Command("m2-201-camera-control", fieldsFrom(beat))];
    case "picture":
      return compilePicture(beat);
    case "music":
      return compileMusic(beat);
    case "tint":
      return [m2Command("m2-046-tint-screen", fieldsFrom(beat))];
    case "flash":
      return [m2Command("m2-047-flash-screen", { color: beat.color ?? "white", durationMs: durationMs(beat.durationMs, 300) })];
    case "shake":
      return [m2Command("m2-048-shake-screen", { intensity: beat.intensity ?? 3, durationMs: durationMs(beat.durationMs, 400) })];
    case "wait":
      return [{ kind: "wait", ms: Math.max(0, Math.round(beat.ms)) }];
    case "parallel":
      return compileBeats(beat.beats);
    case "label":
      return [{ kind: "label", name: beat.name }];
    case "jump":
      return [{ kind: "gotoLabel", name: beat.name }];
  }
}

function compileSay(beat: CutsceneSayBeat): Command[] {
  const commands: Command[] = [];
  if (beat.face?.resourceId) {
    commands.push({
      kind: "changeFace",
      resourceId: beat.face.resourceId,
      faceIndex: beat.face.faceIndex ?? 0,
      position: beat.face.position ?? "left",
      flipHorizontally: beat.face.flipHorizontally ?? false,
    });
  }
  const lines = beat.lines?.length ? beat.lines : beat.text ? [beat.text] : [];
  for (const body of lines) commands.push({ kind: "text", speaker: beat.speaker, body });
  return commands;
}

function compileMoveActor(beat: CutsceneMoveActorBeat): Command {
  const target = beat.target ?? beat.eventId ?? beat.actor ?? "player";
  return {
    kind: "moveEvent",
    eventId: target === "player" ? PLAYER_MOVE_TARGET : target === "this-event" ? "" : target,
    route: {
      moves: [...(beat.route?.moves ?? beat.moves ?? [])],
      repeat: beat.route?.repeat ?? false,
      wait: beat.wait ?? beat.route?.wait ?? true,
      skippable: beat.route?.skippable ?? false,
    },
  };
}

function compilePicture(beat: CutscenePictureBeat): Command[] {
  const pictureId = beat.pictureId ?? beat.id ?? "pic1";
  if (beat.action === "erase") return [{ kind: "erasePicture", pictureId }];
  if (beat.action === "move") return [m2Command("m2-052-move-picture", { pictureId, ...fieldsFrom(beat) })];
  return [{
    kind: "showPicture",
    pictureId,
    resourceId: beat.resourceId ?? "",
    x: beat.x ?? 0,
    y: beat.y ?? 0,
    scale: beat.scale,
    opacity: beat.opacity,
    rotation: beat.rotation,
    durationMs: beat.durationMs,
    waitForPicture: beat.waitForPicture ?? beat.wait,
  }];
}

function compileMusic(beat: CutsceneMusicBeat): Command[] {
  if (beat.action === "stop" || beat.action === "fade") return [{ kind: "stopAudio" }];
  if (!beat.resourceId) return [];
  return [{ kind: "playAudio", resourceId: beat.resourceId, loop: beat.action === "bgm" ? beat.loop ?? true : false }];
}

function m2Command(commandId: string, fields: M2CommandFields): Command {
  return { kind: "m2Command", commandId, fields };
}

function fieldsFrom(value: Record<string, unknown>): M2CommandFields {
  const fields: M2CommandFields = {};
  for (const [key, raw] of Object.entries(value)) {
    if (key === "kind" || key === "action" || raw === undefined || isRecord(raw)) continue;
    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") fields[key] = raw;
  }
  return fields;
}

function durationMs(value: number | undefined, fallback: number): number {
  return Math.max(0, Math.round(Number.isFinite(value) ? value as number : fallback));
}

function visit(beats: readonly CutsceneBeat[], callback: (beat: CutsceneBeat, path: string) => void, path = "beats"): void {
  beats.forEach((beat, index) => {
    const beatPath = `${path}[${index}]`;
    callback(beat, beatPath);
    if (beat.kind === "parallel") visit(beat.beats, callback, `${beatPath}.beats`);
  });
}

function validateEventId(path: string, eventId: string | undefined, eventIds: ReadonlySet<string> | undefined, errors: string[]): void {
  if (!eventId || eventId === "player" || eventId === "this-event" || !eventIds) return;
  if (!eventIds.has(eventId)) errors.push(`${path}: 이벤트가 존재하지 않습니다: ${eventId}`);
}

function validateResourceId(path: string, resourceId: string | undefined, resourceIds: ReadonlySet<string> | undefined, errors: string[]): void {
  if (!resourceId || !resourceIds) return;
  if (!resourceIds.has(resourceId)) errors.push(`${path}: 리소스가 존재하지 않습니다: ${resourceId}`);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
