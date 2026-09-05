// @vitest-environment jsdom
//
// 새 프로젝트 다이얼로그 — 이름 입력 + 시작점 선택(빈 맵 / 예제 마을).
// minimal: 기존 showPromptInput에 선택지 옵션을 얹고, 취소→null·빈이름 폴백 계약은 그대로 둔다.
import { afterEach, describe, expect, it } from "vitest";
import { showPromptInput } from "@/editor/ui/modal";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("showPromptInput starter choices", () => {
  it("선택지 없이 호출하면 기존 동작 그대로 문자열을 돌려준다", async () => {
    const pending = showPromptInput({ message: "이름", defaultValue: "새 프로젝트" });
    const input = document.querySelector<HTMLInputElement>('[data-testid="app-modal-input"]');
    expect(input).not.toBeNull();
    input!.value = "나의 RPG";
    document.querySelector<HTMLButtonElement>('[data-testid="app-modal-confirm"]')!.click();
    await expect(pending).resolves.toBe("나의 RPG");
  });

  it("시작점 선택지를 주면 라디오가 뜨고 고른 값이 함께 돌아온다", async () => {
    const pending = showPromptInput({
      message: "이름",
      defaultValue: "새 프로젝트",
      choices: [
        { value: "blank", label: "빈 맵으로 시작" },
        { value: "sample", label: "예제 마을로 시작" },
      ],
      defaultChoice: "blank",
    });
    const radios = [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios).toHaveLength(2);
    expect(radios.find((r) => r.checked)?.value).toBe("blank");
    radios.find((r) => r.value === "sample")!.click();
    document.querySelector<HTMLButtonElement>('[data-testid="app-modal-confirm"]')!.click();
    await expect(pending).resolves.toEqual({ value: "새 프로젝트", choice: "sample" });
  });

  it("취소는 null을 돌려준다 (선택지 유무와 무관)", async () => {
    const pending = showPromptInput({
      message: "이름",
      choices: [
        { value: "blank", label: "빈 맵으로 시작" },
        { value: "sample", label: "예제 마을로 시작" },
      ],
    });
    document.querySelector<HTMLButtonElement>('[data-testid="app-modal-cancel"]')!.click();
    await expect(pending).resolves.toBeNull();
  });
});
