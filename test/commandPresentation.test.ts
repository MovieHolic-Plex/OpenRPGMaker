import { describe, expect, it } from "vitest";
import {
  COMMAND_PRESENTATION_DESCRIPTORS,
  commandPresentationDescriptor,
  commandPresentationGroupLabel,
} from "@/editor/eventCommands/commandPresentation";
import {
  EVENT_COMMAND_PICKER_NATIVE_KINDS,
  EVENT_COMMAND_PICKER_NATIVE_ONLY_PLACEMENTS,
} from "@/editor/panels/eventEditor/commandPicker";
import { COMMAND_GUARANTEES } from "@/project/commandGuaranteeRegistry";
import { mapScreenNativeSurfaceGroup } from "@/project/eventCommands/m2PickerLayout";
import { COMMAND_KINDS } from "@/project/commandKindRegistry";

describe("command presentation descriptor", () => {
  it("derives every support, stability, owner, and selectability value from guarantees", () => {
    expect(COMMAND_PRESENTATION_DESCRIPTORS.map((entry) => entry.kind)).toEqual(COMMAND_KINDS);
    for (const descriptor of COMMAND_PRESENTATION_DESCRIPTORS) {
      const guarantee = COMMAND_GUARANTEES[descriptor.kind];
      expect(descriptor.support).toBe(guarantee.supportByContext.map);
      expect(descriptor.stability).toBe(guarantee.stability);
      expect(descriptor.executionOwner).toBe(guarantee.executionOwner);
      expect(descriptor.selectable).toBe(
        guarantee.authoringSurfaces.includes("mainPicker") && guarantee.supportByContext.map === "full"
      );
    }
  });

  it("keeps native picker membership aligned with descriptor selectability", () => {
    for (const descriptor of COMMAND_PRESENTATION_DESCRIPTORS) {
      if (descriptor.kind === "m2Command") continue;
      expect(EVENT_COMMAND_PICKER_NATIVE_KINDS.includes(descriptor.kind)).toBe(descriptor.selectable);
    }
  });

  it("derives every native-only picker page and group from its descriptor", () => {
    for (const placement of EVENT_COMMAND_PICKER_NATIVE_ONLY_PLACEMENTS) {
      const descriptor = commandPresentationDescriptor(placement.kind);
      expect(placement.page).toBe(descriptor.page);
      // 탭 3 저작면은 가족 라벨보다 정밀하다 — 조명·날씨 / 그림 / 화면 연출 헤딩을 kind 단위로 잡는다.
      const surfaceGroup = placement.page === 3 ? mapScreenNativeSurfaceGroup(placement.kind) : undefined;
      expect(placement.group).toBe(surfaceGroup ?? commandPresentationGroupLabel(descriptor.group));
    }
  });

  it("publishes representative interpreter, player, and battle owners from the registry", () => {
    expect(commandPresentationDescriptor("setSwitch").executionOwner).toBe("interpreter");
    expect(commandPresentationDescriptor("transfer").executionOwner).toBe("player");
    expect(commandPresentationDescriptor("battleProcessing").executionOwner).toBe("battle");
  });

  it("keeps partial and direct-hidden commands searchable but outside selectable native kinds", () => {
    for (const kind of ["advanceTime", "checkpointSave", "setTime"] as const) {
      const descriptor = commandPresentationDescriptor(kind);
      expect(descriptor.selectable).toBe(false);
      expect(descriptor.alternateRoute).toBeTruthy();
      expect(EVENT_COMMAND_PICKER_NATIVE_KINDS).not.toContain(kind);
    }
  });
});
