import { describe, expect, it } from "vitest";
import { friendlyExecutionError, WORKER_DATA_MISSING } from "@/ai/piAgent/userFacingCopy";

describe("friendlyExecutionError: 데스크톱 워커 자료 없음", () => {
  it("워커가 worker-data 를 못 찾고 끝나면 재설치 안내를 보인다", () => {
    const raw = "oh-my-pi worker exited (78): 조수 워커 자료를 읽지 못했습니다(파일이 없습니다): C:\\Users\\a\\AppData\\Local\\Programs\\oprn\\resources\\app.asar.unpacked\\dist-electron\\worker-data\\src\\assets\\x.json. 앱 설치가 깨졌을 수 있습니다.";
    expect(friendlyExecutionError(raw)).toBe(WORKER_DATA_MISSING);
  });

  it("다른 이유로 워커가 끝나면 그대로 «갑자기 멈췄어요»", () => {
    expect(friendlyExecutionError("oh-my-pi worker exited (1)")).not.toBe(WORKER_DATA_MISSING);
  });
});
