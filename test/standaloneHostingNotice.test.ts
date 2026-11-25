import { describe, expect, it } from "vitest";
import { createTranslator } from "@/i18n/translator";
import en from "@/i18n/catalogs/en.json";
import ja from "@/i18n/catalogs/ja.json";
import zh from "@/i18n/catalogs/zh.json";
import {
  GITHUB_FILE_BLOCK_BYTES,
  GITHUB_FILE_WARN_BYTES,
  STANDALONE_HTML_GITHUB_PAGES_HINT,
  standaloneExportDoneKind,
  standaloneExportDoneMessage,
  standaloneHostingLevel,
  utf8ByteLength,
} from "@/project/standaloneHostingNotice";

const HANGUL = /[\uac00-\ud7a3]/;

describe("standalone HTML GitHub file limit", () => {
  it("counts UTF-8 bytes, not UTF-16 code units", () => {
    expect(utf8ByteLength("가")).toBe(3);
    expect("가".length).toBe(1);
  });

  it("warns at 50MiB and blocks at 100MiB, GitHub's push limits", () => {
    expect(standaloneHostingLevel(GITHUB_FILE_WARN_BYTES - 1)).toBe("ok");
    expect(standaloneHostingLevel(GITHUB_FILE_WARN_BYTES)).toBe("warn");
    expect(standaloneHostingLevel(GITHUB_FILE_BLOCK_BYTES - 1)).toBe("warn");
    expect(standaloneHostingLevel(GITHUB_FILE_BLOCK_BYTES)).toBe("blocked");
    expect(standaloneHostingLevel(Number.NaN)).toBe("ok");
  });

  it("keeps the short completion line under the warning line", () => {
    const message = standaloneExportDoneMessage({ htmlBytes: 12 * 1024 * 1024, assetCount: 40, missingCount: 0 });
    expect(message).toBe("실행형 HTML 완료: 12.0MB, 에셋 40개");
    expect(standaloneExportDoneKind({ htmlBytes: 12 * 1024 * 1024, assetCount: 40, missingCount: 0 })).toBe("ok");
  });

  it("names the web ZIP once the file is too big to commit", () => {
    const blocked = standaloneExportDoneMessage({
      htmlBytes: GITHUB_FILE_BLOCK_BYTES,
      assetCount: 180,
      missingCount: 2,
    });
    expect(blocked).toContain("100.0MB");
    expect(blocked).toContain("못 넣은 에셋 2개");
    expect(blocked).toContain("GitHub Pages");
    expect(blocked).toContain("웹 서버 ZIP");
    expect(standaloneExportDoneKind({
      htmlBytes: GITHUB_FILE_BLOCK_BYTES,
      assetCount: 180,
      missingCount: 0,
    })).toBe("info");
    expect(standaloneExportDoneMessage({
      htmlBytes: GITHUB_FILE_WARN_BYTES,
      assetCount: 90,
      missingCount: 0,
    })).toContain("50MB부터 경고");
  });

  it("translates the size warnings and the button hint in en, ja, and zh", () => {
    const samples = [
      standaloneExportDoneMessage({ htmlBytes: 12 * 1024 * 1024, assetCount: 4, missingCount: 0 }),
      standaloneExportDoneMessage({ htmlBytes: 12 * 1024 * 1024, assetCount: 4, missingCount: 1 }),
      standaloneExportDoneMessage({ htmlBytes: GITHUB_FILE_WARN_BYTES, assetCount: 4, missingCount: 0 }),
      standaloneExportDoneMessage({ htmlBytes: GITHUB_FILE_WARN_BYTES, assetCount: 4, missingCount: 1 }),
      standaloneExportDoneMessage({ htmlBytes: GITHUB_FILE_BLOCK_BYTES, assetCount: 4, missingCount: 0 }),
      standaloneExportDoneMessage({ htmlBytes: GITHUB_FILE_BLOCK_BYTES, assetCount: 4, missingCount: 1 }),
      STANDALONE_HTML_GITHUB_PAGES_HINT,
    ];
    for (const catalog of [en, ja, zh] as Record<string, string>[]) {
      const translator = createTranslator(catalog);
      for (const sample of samples) {
        const translated = translator.translate(sample);
        expect(translated, sample).toEqual(expect.any(String));
        expect(translated).not.toMatch(HANGUL);
      }
    }
  });
});
