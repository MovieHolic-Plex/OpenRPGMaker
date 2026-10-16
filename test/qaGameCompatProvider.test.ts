import { describe, expect, it } from "vitest";
import { buildQaCompatSetup, QA_COMPAT_PROVIDER_ID } from "../scripts/qa-game/lib/compatProvider";
import { modelForRole } from "../src/ai/modelRoles";
import { defaultAiConfig } from "../src/ai/llmClient";

const env = { OPRN_LIVE_KEY: "test-secret-key" };

describe("qa-game gen 사용자 지정 연결", () => {
  it("키는 환경변수에서만 오고 AiConfig·엔드포인트 정의에는 들어가지 않는다", () => {
    const setup = buildQaCompatSetup({ baseUrl: "http://127.0.0.1:8318/v1", model: "gemini-4-argon-high", env });
    expect(setup.apiKey).toBe("test-secret-key");
    expect(JSON.stringify(setup.endpoint)).not.toContain("test-secret-key");
    expect(JSON.stringify(setup.configPatch)).not.toContain("test-secret-key");
  });

  it("모든 역할이 같은 엔드포인트의 한 모델로 간다", () => {
    const { configPatch } = buildQaCompatSetup({ baseUrl: "http://127.0.0.1:8318/v1", model: "gemini-4-argon-high", env });
    const config = { ...defaultAiConfig(), ...configPatch };
    for (const role of ["deep", "vision", "writer", "build"] as const) {
      expect(modelForRole(config, role)).toMatchObject({ provider: QA_COMPAT_PROVIDER_ID, model: "gemini-4-argon-high" });
    }
    expect(config.providerId).toBe(QA_COMPAT_PROVIDER_ID);
    expect(config.ultrabrainProviderId).toBe(QA_COMPAT_PROVIDER_ID);
  });

  it("키가 없거나 패턴 밖 모델이면 거절한다(폴백 없음)", () => {
    expect(() => buildQaCompatSetup({ baseUrl: "http://127.0.0.1:8318/v1", model: "gemini-4-argon-high", env: {} })).toThrow(/OPRN_LIVE_KEY/u);
    expect(() => buildQaCompatSetup({ baseUrl: "http://127.0.0.1:8318/v1", model: "claude-opus-4", env })).toThrow(/허용 패턴|차단/u);
  });

  it("공개 주소에 http 는 거절한다", () => {
    expect(() => buildQaCompatSetup({ baseUrl: "http://example.com/v1", model: "gemini-4-argon-high", env })).toThrow();
  });
});
