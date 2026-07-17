import { nativeManifestEntry } from "../specTypes";

export const CONTROL_FLOW_SPECS = {
  fork: nativeManifestEntry("controlFlow", {
    kind: "fork",
    condition: { kind: "switch", switchId: "switch_contract", value: true },
    then: [{ kind: "text", body: "Then" }],
    else: [{ kind: "text", body: "Else" }],
  }),
  wait: nativeManifestEntry("controlFlow", { kind: "wait", ms: 1 }),
  label: nativeManifestEntry("controlFlow", { kind: "label", name: "contract_label" }),
  gotoLabel: nativeManifestEntry("controlFlow", { kind: "gotoLabel", name: "contract_label" }),
  loop: nativeManifestEntry("controlFlow", {
    kind: "loop",
    body: [{ kind: "breakLoop" }],
  }),
  breakLoop: nativeManifestEntry("controlFlow", { kind: "breakLoop" }),
  callCommonEvent: nativeManifestEntry("controlFlow", {
    kind: "callCommonEvent",
    commonEventId: "common_contract",
  }),
  callMapEvent: nativeManifestEntry("controlFlow", { kind: "callMapEvent", eventId: "event_contract" }),
  cutsceneControl: nativeManifestEntry("controlFlow", {
    kind: "cutsceneControl",
    mode: "begin",
    skippable: true,
  }),
} as const;
