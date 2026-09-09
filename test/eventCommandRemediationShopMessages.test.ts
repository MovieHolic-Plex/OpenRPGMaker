import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io/serialize";
import { ProjectFormatError } from "@/project/io/errors";
import { SHOP_MESSAGE_TYPES } from "@/project/shopMessages";

describe("shop message persistence", () => {
  it.each(SHOP_MESSAGE_TYPES)("reloads the authorable %s message without losing shop settings", (messageType) => {
    // Given: a real project containing a shop authored with a picker-supported value.
    const project = createBlankProject();
    project.commonEvents = [{
      id: "common_audit_shop",
      name: "Shop persistence",
      trigger: "none",
      commands: [{
        kind: "shop",
        itemIds: [],
        messageType,
        allowSell: false,
        merchantGold: 37,
        branchOnTransaction: true,
        transactionBranch: [{ kind: "text", body: "Purchased" }],
      }],
    }];

    // When: the complete project passes through the shipping persistence boundary.
    const reloaded = deserialize(serialize(project));

    // Then: both the selected message and adjacent authored behavior survive.
    expect(reloaded.commonEvents.find(event => event.id === "common_audit_shop")?.commands[0]).toMatchObject({
      kind: "shop",
      messageType,
      allowSell: false,
      merchantGold: 37,
      branchOnTransaction: true,
      transactionBranch: [{ kind: "text", body: "Purchased" }],
    });
  });

  it("rejects an unknown message type at the project load boundary", () => {
    // Given: malformed external project data, not a valid authored command.
    const raw = JSON.stringify({
      ...createBlankProject(),
      commonEvents: [{
        id: "common_audit_invalid",
        name: "Invalid shop",
        trigger: "none",
        commands: [{ kind: "shop", itemIds: [], messageType: "not-a-shop-message" }],
      }],
    });

    // When / Then: loading still rejects values outside the authorable contract.
    expect(() => deserialize(raw)).toThrow(ProjectFormatError);
  });
});
