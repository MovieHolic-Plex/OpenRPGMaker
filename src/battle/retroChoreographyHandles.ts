import {
  buildBattleMotionTracks,
  type MotionContext,
  type MotionTrack,
} from "@/battle/battleMotionProgram";
// 연출 레코드 손잡이(speed · tint · screen)를 **완성된 타임라인 위에 얹는** 순수 함수.
//
// 손잡이가 하나도 없으면 입력 객체를 그대로 돌려준다 — 기본 연출(계약)은 A1 과 바이트까지 같아야 한다.
// 런타임(src/player/retroSkillChoreography)과 편집기 미리보기(databaseSkillRetroStage)가 같은 함수를 쓴다.
//
// 순서: 화면 효과 추가(원래 시간축) → 레코드 전체 색 채우기 → 속도 배율. 속도는 마지막에 모든 시각·길이를 나눈다.
import type { SkillChoreographyRecord } from "@/project/types/database";
import { retroTintFilter } from "@/assets/retroChoreographyTints";
import {
  RETRO_SOUND_FLASH,
  type RetroSkillTimeline,
  type RetroTimelineEvent,
} from "@/battle/retroSkillTimeline";

/** 흔들림 길이·번쩍임 길이·어둠 길이(원래 시간축 ms). */
export const HANDLE_SHAKE_MS = 320;
export const HANDLE_FLASH_MS = 260;
export const HANDLE_DIM_MS = 520;
const DIM_LEAD_MS = 160;
const CUTIN_AT = 200;
const CUTIN_MS = 820;

type HandleRecord = Pick<
  SkillChoreographyRecord,
  "speed" | "tint" | "screen" | "movement"
>;

function speedOf(record: HandleRecord): number {
  const s = record.speed;
  return typeof s === "number" && Number.isFinite(s) && s > 0 && s !== 1
    ? s
    : 1;
}

function hasScreen(record: HandleRecord): boolean {
  const screen = record.screen;
  return Boolean(
    screen &&
      ((screen.shake ?? 0) > 0 || screen.flash || screen.dim || screen.cutIn),
  );
}

export function hasChoreographyHandles(
  record: HandleRecord | undefined,
): boolean {
  if (!record) return false;
  return (
    Boolean(record.movement) ||
    speedOf(record) !== 1 ||
    Boolean(record.tint && record.tint !== "original") ||
    hasScreen(record)
  );
}

/** 화면 효과를 붙일 기준 시각: 첫 hit → 첫 사용자 아님 fx → 대표 시각. */
function anchorMs(timeline: RetroSkillTimeline): number {
  const hit = timeline.events.find((event) => event.kind === "hit");
  if (hit) return hit.at;
  const fx = timeline.events.find(
    (event) => event.kind === "fx" && event.anchor !== "user",
  );
  return fx ? fx.at : timeline.representativeMs;
}

function scaled(event: RetroTimelineEvent, speed: number): RetroTimelineEvent {
  const at = Math.round(event.at / speed);
  switch (event.kind) {
    case "pose":
    case "sound":
      return { ...event, at };
    case "fx":
      return {
        ...event,
        at,
        frameMs: Math.max(1, Math.round(event.frameMs / speed)),
      };
    case "projectile":
      return {
        ...event,
        at,
        durationMs: Math.max(1, Math.round(event.durationMs / speed)),
        frameMs: Math.max(1, Math.round(event.frameMs / speed)),
      };
    default:
      return {
        ...event,
        at,
        durationMs: Math.max(1, Math.round(event.durationMs / speed)),
      };
  }
}

export function applyChoreographyHandles(
  timeline: RetroSkillTimeline,
  record: HandleRecord | undefined,
  context: MotionContext = {},
): RetroSkillTimeline {
  if (!hasChoreographyHandles(record)) return timeline;
  const rec = record!;
  let events: RetroTimelineEvent[] = [...timeline.events];
  let durationMs = timeline.durationMs;
  let representativeMs = timeline.representativeMs;
  let actors = timeline.actors;
  if (rec.movement) {
    const original = anchorMs(timeline),
      contact = Math.max(
        original,
        (rec.movement.anticipationMs ?? 140) +
          (rec.movement.travelMs ?? 180) +
          120,
      );
    const authoredHits = events.filter((e) => e.kind === "hit");
    const requestedHits = Math.min(
      16,
      Math.max(1, timeline.hitCount ?? authoredHits.length),
    );
    if (
      authoredHits.length < requestedHits &&
      (authoredHits.length > 0 || timeline.hitCount !== undefined)
    ) {
      const lead: RetroTimelineEvent = authoredHits[0] ?? {
        kind: "hit",
        at: original,
        who: "target",
      };
      const layers = events.filter(
        (e) =>
          e.kind === "fx" && e.anchor !== "user" && e.anchor !== "allAllies",
      );
      const repeated = layers.filter((e) => e.layer === layers[0]?.layer);
      events = events.filter((e) => e.kind !== "hit");
      for (let i = 0; i < requestedHits; i++) {
        const offset =
          repeated[i] && repeated[0]
            ? repeated[i]!.at - repeated[0]!.at
            : i * 160;
        events.push({ ...lead, at: lead.at + offset });
      }
    }
    const oldContacts = [
      ...new Set(events.filter((e) => e.kind === "hit").map((e) => e.at)),
    ].sort((a, b) => a - b);
    const spacing = ["return-weapon", "marked-spear"].includes(
      rec.movement.pattern,
    )
      ? 600
      : ["air-chase", "sky-crush", "throw"].includes(rec.movement.pattern)
        ? 260
        : 180;
    const remap = (at: number) => {
      if (at < original)
        return Math.round((at * contact) / Math.max(1, original));
      let i = 0;
      while (i + 1 < oldContacts.length && oldContacts[i + 1]! <= at) i++;
      return contact + i * spacing + at - (oldContacts[i] ?? original);
    };
    events = events
      .filter((e) => !["move", "pose", "hide"].includes(e.kind))
      .map((e) => ({ ...e, at: remap(e.at) }));
    const contacts = [
      ...new Set(events.filter((e) => e.kind === "hit").map((e) => e.at)),
    ].sort((a, b) => a - b);
    // Repeated impact sheets are tied to contacts, not the legacy flurry's 90ms spacing.
    // Shorten each sheet so consecutive strikes remain readable instead of stacking three crosses.
    const impactLayers = new Map<
      number,
      Extract<RetroTimelineEvent, { kind: "fx" }>[]
    >();
    for (const event of events)
      if (event.kind === "fx" && event.anchor === "target") {
        const group = impactLayers.get(event.layer) ?? [];
        group.push(event);
        impactLayers.set(event.layer, group);
      }
    events = events.map((event) => {
      if (event.kind !== "fx" || event.anchor !== "target" || !contacts.length)
        return event;
      const group = impactLayers.get(event.layer)!,
        index = group.indexOf(event),
        first = group[0]!;
      const frameMs = Math.min(
        event.frameMs,
        40,
        contacts.length > 1 ? (spacing * 0.9) / event.cells.length : Infinity,
      );
      const contactFrame = Math.max(
        0,
        Math.min(first.cells.length - 1, (contact - first.at) / first.frameMs),
      );
      return {
        ...event,
        at: Math.max(
          0,
          Math.round(
            (contacts[Math.min(index, contacts.length - 1)] ?? contact) -
              contactFrame * frameMs,
          ),
        ),
        frameMs,
      };
    });
    actors = buildBattleMotionTracks(
      rec.movement,
      contacts.length ? contacts : [contact],
      context,
    );
    const projectile = events.find((e) => e.kind === "projectile");
    if (projectile?.kind === "projectile") {
      const first = contacts[0] ?? contact,
        last = contacts.at(-1) ?? first;
      const returning = ["return-weapon", "marked-spear"].includes(
        rec.movement.pattern,
      );
      const orbit = rec.movement.pattern === "orbit";
      const points: MotionTrack["points"] =
        rec.movement.pattern === "bounce"
          ? [
              { at: projectile.at, anchor: "home", y: -25 },
              ...contacts.map((at, i) => ({
                at,
                anchor: (["target", "target2", "target3"] as const)[
                  Math.min(i, 2)
                ]!,
                y: -22,
                curve: "flow" as const,
              })),
            ]
          : returning
            ? [
                { at: projectile.at, anchor: "home", y: -25 },
                { at: first, anchor: "target", y: -22, curve: "flow" },
                { at: first + 140, anchor: "exit", y: -22, curve: "flow" },
                {
                  at: Math.max(first + 280, last - 140),
                  anchor: "exit",
                  y: -22,
                },
                {
                  at: Math.max(first + 420, last),
                  anchor: "target",
                  y: -22,
                  curve: "flow",
                },
                {
                  at: Math.max(first + 600, last + 180),
                  anchor: "home",
                  y: -25,
                },
              ]
            : orbit
              ? [
                  ...Array.from({ length: 13 }, (_, i) => {
                    const u = i / 12,
                      theta = u * u * Math.PI * 4;
                    return {
                      at: projectile.at + (first - projectile.at) * u * 0.8,
                      anchor: "target" as const,
                      x: Math.cos(theta) * 65,
                      y: -22 + Math.sin(theta) * 38,
                      curve: "flow" as const,
                    };
                  }),
                  { at: first, anchor: "target", y: -22, curve: "pull" },
                ]
              : [
                  { at: projectile.at, anchor: "home", y: -25 },
                  { at: first, anchor: "target", y: -22, curve: "burst" },
                ];
      events = events.map((e) =>
        e === projectile
          ? {
              ...projectile,
              trajectory: { role: "user", points },
              durationMs: Math.max(1, points.at(-1)!.at - projectile.at),
            }
          : e,
      );
    }
    representativeMs = contact;
    durationMs =
      Math.max(
        ...actors.flatMap((a) => a.points.map((p) => p.at)),
        ...events.map(
          (e) =>
            e.at +
            ("durationMs" in e
              ? e.durationMs
              : e.kind === "fx"
                ? e.cells.length * e.frameMs
                : 0),
        ),
      ) + 120;
  }
  const screen = rec.screen;
  if (screen && hasScreen(rec)) {
    const at = anchorMs(timeline);
    if ((screen.shake ?? 0) > 0) {
      events.push({
        kind: "screen",
        at,
        durationMs: HANDLE_SHAKE_MS,
        effect: "shake",
        intensity: screen.shake,
      });
      durationMs = Math.max(durationMs, at + HANDLE_SHAKE_MS);
    }
    if (screen.flash) {
      events.push({
        kind: "screen",
        at,
        durationMs: HANDLE_FLASH_MS,
        effect: "flash",
        color: screen.flash,
      });
      durationMs = Math.max(durationMs, at + HANDLE_FLASH_MS);
    }
    if (screen.dim) {
      const start = Math.max(0, at - DIM_LEAD_MS);
      events.push({
        kind: "screen",
        at: start,
        durationMs: HANDLE_DIM_MS,
        effect: "dim",
      });
      durationMs = Math.max(durationMs, start + HANDLE_DIM_MS);
    }
    if (
      screen.cutIn &&
      !events.some(
        (event) => event.kind === "screen" && event.effect === "cutin",
      )
    ) {
      events.push(
        { kind: "sound", at: 160, id: RETRO_SOUND_FLASH },
        { kind: "screen", at: CUTIN_AT, durationMs: CUTIN_MS, effect: "cutin" },
      );
      durationMs = Math.max(durationMs, CUTIN_AT + CUTIN_MS);
    }
  }
  const filter =
    rec.tint && rec.tint !== "original" ? retroTintFilter(rec.tint) : undefined;
  if (filter) {
    events = events.map((event) =>
      (event.kind === "fx" || event.kind === "projectile") &&
      event.filter === undefined
        ? { ...event, filter }
        : event,
    );
  }
  const speed = speedOf(rec);
  if (speed !== 1) {
    events = events.map((event) => {
      const e = scaled(event, speed);
      return e.kind === "projectile" && e.trajectory
        ? {
            ...e,
            trajectory: {
              ...e.trajectory,
              points: e.trajectory.points.map((p) => ({
                ...p,
                at: p.at / speed,
              })),
            },
          }
        : e;
    });
    actors = actors?.map((a) => ({
      ...a,
      points: a.points.map((p) => ({ ...p, at: p.at / speed })),
    }));
    durationMs = Math.round(durationMs / speed);
    representativeMs = Math.round(representativeMs / speed);
  }
  events.sort((a, b) => a.at - b.at);
  return {
    ...timeline,
    durationMs,
    representativeMs,
    events,
    ...(actors ? { actors } : {}),
    ...(rec.movement ? { movement: rec.movement } : {}),
  };
}
