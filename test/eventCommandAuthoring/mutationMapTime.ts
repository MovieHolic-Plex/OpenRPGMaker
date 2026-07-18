import type { AuthoringReferenceFixture } from "./referenceFixture";
import { AUTHORING_TARGET_EVENT_ID } from "./referenceFixture";
import {
  clickControl,
  setControlChecked,
  setControlValue,
  type AuthoringCase,
} from "./mutationTypes";

export function mapTimeCases(fixture: AuthoringReferenceFixture): readonly AuthoringCase[] {
  return [
    {
      mode: "mutation",
      kind: "timer",
      expected: { kind: "timer", action: "start", seconds: 60, timerId: "timer1" },
      apply: (body) => setControlValue(body, "event-command-timer-action", "start"),
    },
    {
      mode: "mutation",
      kind: "advanceTime",
      expected: { kind: "advanceTime", hours: 2, minutes: 10 },
      apply: (body) => setControlValue(body, "advance-time-hours-input", "2", "input"),
    },
    {
      mode: "mutation",
      kind: "advanceCropGrowth",
      expected: { kind: "advanceCropGrowth", days: 2 },
      apply: (body) => setControlValue(body, "advance-crop-growth-days-input", "2", "input"),
    },
    {
      mode: "mutation",
      kind: "setTime",
      expected: { kind: "setTime", hour: 9, minute: 0 },
      apply: (body) => setControlValue(body, "set-time-hour-input", "9", "input"),
    },
    {
      mode: "boundary",
      kind: "sleepUntilMorning",
      testId: "sleep-until-morning-editor",
      tagName: "SPAN",
    },
    {
      mode: "mutation",
      kind: "transfer",
      expected: {
        kind: "transfer",
        mapId: fixture.ids.mapId,
        x: 0,
        y: 0,
        direction: "right",
        fade: "black",
      },
      apply: (body) => setControlChecked(body, "transfer-player-direction-right", true),
      clearAfterRender: true,
    },
    {
      mode: "mutation",
      kind: "moveEvent",
      expected: {
        kind: "moveEvent",
        eventId: AUTHORING_TARGET_EVENT_ID,
        route: {
          moves: [{ kind: "move", dir: "up" }],
          repeat: false,
          wait: false,
          skippable: false,
        },
      },
      apply: (body) => clickControl(body, "move-route-add-move-up"),
    },
    {
      mode: "mutation",
      kind: "setEventGraphicPattern",
      expected: {
        kind: "setEventGraphicPattern",
        eventId: AUTHORING_TARGET_EVENT_ID,
        pattern: 3,
      },
      apply: (body) => clickControl(body, "event-command-frame-slot-1"),
    },
    {
      mode: "mutation",
      kind: "changeTile",
      expected: {
        kind: "changeTile",
        mapId: fixture.ids.mapId,
        layer: "lower",
        x: 0,
        y: 0,
        tile: 7,
      },
      apply: (body) => setControlValue(body, "change-tile-tile-input", "7"),
    },
    {
      mode: "mutation",
      kind: "callCommonEvent",
      expected: { kind: "callCommonEvent", commonEventId: "" },
      apply: (body) => setControlValue(body, "event-command-call-common-event-select", ""),
    },
    {
      mode: "mutation",
      kind: "callMapEvent",
      expected: { kind: "callMapEvent", eventId: "" },
      apply: (body) => setControlValue(body, "event-command-call-map-event-select", ""),
    },
  ];
}
