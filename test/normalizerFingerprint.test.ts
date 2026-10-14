import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizerInputFiles, readNormalizerFingerprint } from "../scripts/lib/normalizerFingerprint.mjs";

const roots: string[] = [];
function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "normalizer-fp-"));
  roots.push(root);
  for (const [path, body] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body);
  }
  return root;
}

describe("normalizerFingerprint — 부팅 정규화 표식의 입력 지문", () => {
  afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

  const base = {
    "src/project/store.ts": "export const a = 1;\n",
    "src/project/defaults/defaultAssets.ts": 'import { x } from "@/util/helper";\nexport const y = x;\n',
    "src/util/helper.ts": "export const x = 1;\n",
    "src/ai/unrelated.ts": "export const z = 1;\n",
    "src/assets/data.json": '{"a":1}',
  };

  it("같은 내용이면 같은 지문이고, 위치가 달라도(다른 체크아웃) 내용·상대 경로가 같으면 같다", () => {
    expect(readNormalizerFingerprint(fixture(base))).toBe(readNormalizerFingerprint(fixture(base)));
  });

  it("src/project · src/assets 안의 어떤 변경도 지문을 바꾼다", () => {
    const fp = readNormalizerFingerprint(fixture(base));
    expect(readNormalizerFingerprint(fixture({ ...base, "src/project/store.ts": "export const a = 2;\n" }))).not.toBe(fp);
    expect(readNormalizerFingerprint(fixture({ ...base, "src/assets/data.json": '{"a":2}' }))).not.toBe(fp);
  });

  it("정규화기 모듈이 import 로 닿는 밖의 파일 변경도 지문을 바꾼다", () => {
    const fp = readNormalizerFingerprint(fixture(base));
    expect(readNormalizerFingerprint(fixture({ ...base, "src/util/helper.ts": "export const x = 2;\n" }))).not.toBe(fp);
  });

  it("정규화기와 무관한 밖의 파일(AI·편집기 등)은 지문을 바꾸지 않는다 — 머지마다 첫 부팅을 되돌리지 않는다", () => {
    const fp = readNormalizerFingerprint(fixture(base));
    expect(readNormalizerFingerprint(fixture({ ...base, "src/ai/unrelated.ts": "export const z = 999;\n" }))).toBe(fp);
    expect(readNormalizerFingerprint(fixture({ ...base, "src/editor/newPanel.ts": "export const p = 1;\n" }))).toBe(fp);
  });

  it("테스트 파일은 입력이 아니다", () => {
    const root = fixture({ ...base, "src/project/store.test.ts": "x" });
    expect(normalizerInputFiles(root).some((file) => file.endsWith(".test.ts"))).toBe(false);
  });
});
