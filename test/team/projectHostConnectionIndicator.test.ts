/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from "vitest";
import { renderHostConnectionIndicator, startTeamSession } from "@/editor/teamSession";

const { refreshFromHost } = vi.hoisted(() => ({ refreshFromHost: vi.fn() }));
vi.mock("@/editor/teamReadOnlyUi", () => ({ syncTeamReadOnlyUi: vi.fn() }));
vi.mock("@/project/store", () => ({
  store: {
    isOwnSavedHostRevision: () => false,
    refreshFromHost,
    subscribeAutoSave: () => vi.fn(),
  },
}));

afterEach(() => {
  window.dispatchEvent(new Event("pagehide"));
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("shows the storage disconnect only when the project status request fails", async () => {
  vi.useFakeTimers();
  refreshFromHost.mockRejectedValue(new Error("Could not read a snapshot"));
  const projectStatus = { revision: 1, member: { role: "owner" } };
  const status = vi.fn(async () => projectStatus)
    .mockResolvedValueOnce(projectStatus)
    .mockRejectedValueOnce(new Error("Project host offline"));
  vi.stubGlobal("oprn", { team: { status } });

  const indicator = renderHostConnectionIndicator();
  document.body.append(indicator);
  startTeamSession();
  await vi.advanceTimersByTimeAsync(0);
  expect(refreshFromHost).toHaveBeenCalled();
  expect(indicator.hidden).toBe(true);

  await vi.advanceTimersByTimeAsync(3000);
  expect(indicator.hidden).toBe(false);
  expect(indicator.textContent).toBe("프로젝트 저장 연결 끊김");

  await vi.advanceTimersByTimeAsync(3000);
  expect(indicator.hidden).toBe(true);
});
