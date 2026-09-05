/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { NEW_PROJECT_DIALOG_TESTIDS, showNewProjectDialog } from "@/editor/ui/modal";

afterEach(() => {
  document.body.replaceChildren();
});

describe("showNewProjectDialog", () => {
  it("BREAK: 이름·장르·시작 선택을 해석 결과로 돌려준다", async () => {
    const pending = showNewProjectDialog({ defaultValue: "나의 모험" });
    const host = document.querySelector("[data-testid='app-new-project-modal']");
    expect(host).not.toBeNull();
    const name = document.querySelector<HTMLInputElement>("[data-testid='app-new-project-input']");
    const genre = document.querySelector<HTMLSelectElement>("[data-testid='app-new-project-genre']");
    const starter = document.querySelector<HTMLSelectElement>("[data-testid='app-new-project-starter']");
    expect(name).not.toBeNull();
    expect(genre).not.toBeNull();
    expect(starter).not.toBeNull();
    name!.value = "나의 모험";
    genre!.value = "adventure-jrpg";
    starter!.value = "blank";
    document.querySelector<HTMLButtonElement>(`[data-testid='${NEW_PROJECT_DIALOG_TESTIDS.confirm}']`)!.click();
    const selection = await pending;
    expect(selection?.title).toBe("나의 모험");
    expect(selection?.genrePresetId).toBe("adventure-jrpg");
    expect(selection?.systemPresetPlan).toMatchObject({ packId: "adventure-jrpg" });
  });

  it("BREAK: 취소는 null 로, 오버레이는 제거된다", async () => {
    const pending = showNewProjectDialog();
    document.querySelector<HTMLButtonElement>(`[data-testid='${NEW_PROJECT_DIALOG_TESTIDS.cancel}']`)!.click();
    expect(await pending).toBeNull();
    expect(document.querySelector("[data-testid='app-new-project-modal']")).toBeNull();
  });
});
