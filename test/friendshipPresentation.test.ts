import { describe, expect, it } from "vitest";
import {
  formatFriendshipFeedback,
  friendshipTier,
  friendshipTierLabel,
  listFriendshipEntries,
} from "@/project/friendship";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import {
  createPlayerStatusMenuSnapshot,
  listStatusMenuCommandIds,
  STATUS_MENU_COMMAND_IDS,
  statusMenuCommandLabel,
} from "@/player/playerStatusMenuModel";
import { createBlankProject } from "@/project/defaults";
import { changeFriendship, startSession } from "@/project/session";
import type { SaveSlotReadResult } from "@/player/saveSlots";

describe("friendship presentation", () => {
  it("maps friendshipTier bounds at 0, mid, and max", () => {
    expect(friendshipTier(0)).toBe(0);
    expect(friendshipTier(-10)).toBe(0);
    expect(friendshipTier(500)).toBe(5);
    expect(friendshipTier(999)).toBe(9);
    expect(friendshipTier(1000)).toBe(10);
    expect(friendshipTier(1200)).toBe(10);
    expect(friendshipTierLabel(0)).toBe("무관심");
    expect(friendshipTierLabel(3)).toBe("친구");
  });

  it("formats non-empty friendship feedback for a positive gift delta", () => {
    const feedback = formatFriendshipFeedback({ delta: 80, friendship: 80 });
    expect(feedback.length).toBeGreaterThan(0);
    expect(feedback).toContain("호감");
    expect(feedback).toContain("+80");
    expect(feedback).toMatch(/\(0\/10\)/);
  });

  it("lists no relationship entries without friendship keys, then shows keys after changeFriendship", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const slots: readonly SaveSlotReadResult[] = [];

    expect(listFriendshipEntries(session.friendship)).toEqual([]);
    const emptyDetail = createStatusMenuDetail({
      project,
      session,
      selectedCommand: "relationships",
      slots,
      waitModeEnabled: true,
    });
    expect(emptyDetail.title).toBe("관계");
    expect(emptyDetail.entries).toEqual([]);
    expect(emptyDetail.emptyLabel).toBe("알려진 관계가 없습니다.");

    changeFriendship(session, "char_farmer", 240);
    changeFriendship(session, "char_miner", 80);

    const entries = listFriendshipEntries(session.friendship);
    expect(entries.map((entry) => entry.key)).toEqual(["char_farmer", "char_miner"]);
    expect(entries[0]?.secondary).toMatch(/\(2\/10\) · 240/);
    expect(entries[1]?.secondary).toMatch(/\(0\/10\) · 80/);

    const detail = createStatusMenuDetail({
      project,
      session,
      selectedCommand: "relationships",
      slots,
      waitModeEnabled: true,
    });
    expect(detail.entries.map((entry) => entry.label)).toEqual(["char_farmer", "char_miner"]);
    expect(detail.entries[0]?.value).toContain("240");
    expect(detail.entries[0]?.testId).toBe("status-menu-relationship-char_farmer");
  });

  it("registers the relationships status menu command as 관계", () => {
    expect(STATUS_MENU_COMMAND_IDS).toContain("relationships");
    expect(statusMenuCommandLabel("relationships", true)).toBe("관계");
  });

  it("gates relationships command unless giftSystem or friendship keys", () => {
    const project = createBlankProject();
    const session = startSession(project);
    expect(listStatusMenuCommandIds(project, session)).not.toContain("relationships");
    project.system.giftSystem = true;
    expect(listStatusMenuCommandIds(project, session)).toContain("relationships");
    project.system.giftSystem = false;
    session.friendship = { char_a: 10 };
    expect(listStatusMenuCommandIds(project, session)).toContain("relationships");
    const snap = createPlayerStatusMenuSnapshot(project, session);
    expect(snap.commands.some((c) => c.id === "relationships")).toBe(true);
  });
});
