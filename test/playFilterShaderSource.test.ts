import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// J01: Phaser 4 는 `#pragma phaserTemplate(shaderName)` 를 `#define SHADER_NAME …` 로 바꾼다.
// 소스에 `#define SHADER_NAME` 을 또 쓰면 "macro redefined" 로 컴파일이 깨져 시간문·균열 이동이 검정에서 멈춘다.
describe("카메라 필터 셰이더 소스", () => {
  for (const file of ["src/player/playSceneScreenDistortion.ts", "src/player/playSceneMode7.ts"]) {
    it(`${file} 는 SHADER_NAME 을 직접 정의하지 않는다`, () => {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("#pragma phaserTemplate(shaderName)");
      expect(source).not.toMatch(/#define\s+SHADER_NAME/u);
    });
    it(`${file} 는 컴파일 확인을 하는 공용 등록기를 쓴다`, () => {
      expect(readFileSync(file, "utf8")).toContain("ensureFilterShaderNode");
    });
  }
});
