// 저장 키 접두사 마이그레이션 (rpg-zzu: / rpg-zzu. → oprn:)
//
// 이게 틀리면 **기존 사용자의 설정이 전부 날아간다** — 편집기 모드, 좌패널 폭,
// AI 대화·설정, 세이브 슬롯, 데이터베이스 탭 위치 등 48개 키. 그래서 경로별로 못박는다.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
  migrateLegacyStorageKeys,
  resetStorageMigrationFlagForTests,
  STORAGE_PREFIX,
} from "@/util/appStorage";

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
});

describe("migrateLegacyStorageKeys", () => {
  it("새 접두사가 PRODUCT_SLUG 에서 온다", () => {
    expect(STORAGE_PREFIX).toBe("oprn:");
  });

  it("콜론 형태 구 키를 옮긴다", () => {
    storage.setItem("rpg-zzu:editor-ui-mode", "expert");
    const result = migrateLegacyStorageKeys(storage);

    expect(result.moved).toBe(1);
    expect(storage.getItem("oprn:editor-ui-mode")).toBe("expert");
    expect(storage.getItem("rpg-zzu:editor-ui-mode")).toBeNull();
  });

  it("점 형태 구 키도 콜론으로 정규화해 옮긴다", () => {
    storage.setItem("rpg-zzu.database.activeTab", "actors");
    migrateLegacyStorageKeys(storage);

    expect(storage.getItem("oprn:database.activeTab")).toBe("actors");
    expect(storage.getItem("rpg-zzu.database.activeTab")).toBeNull();
  });

  // 하이픈 형태는 실브라우저 실측에서 발견했다 — 부팅 후 이 키만 남아 있었다.
  // 콜론·점만 처리하던 초기 구현이 놓쳤다.
  it("하이픈 형태 구 키(세션 id)도 옮긴다", () => {
    storage.setItem("rpg-zzu-editor-session-id", "abc-123");
    migrateLegacyStorageKeys(storage);

    expect(storage.getItem("oprn:editor-session-id")).toBe("abc-123");
    expect(storage.getItem("rpg-zzu-editor-session-id")).toBeNull();
  });

  it("여러 키를 한 번에 옮긴다", () => {
    storage.setItem("rpg-zzu:editor-layout:v4", "{}");
    storage.setItem("rpg-zzu:ai-config", '{"model":"x"}');
    storage.setItem("rpg-zzu:save-slot:1", "save");
    storage.setItem("rpg-zzu.llmApiKey", "k");

    const result = migrateLegacyStorageKeys(storage);

    expect(result.moved).toBe(4);
    expect(storage.getItem("oprn:editor-layout:v4")).toBe("{}");
    expect(storage.getItem("oprn:ai-config")).toBe('{"model":"x"}');
    expect(storage.getItem("oprn:save-slot:1")).toBe("save");
    expect(storage.getItem("oprn:llmApiKey")).toBe("k");
  });

  it("새 키가 이미 있으면 덮지 않고 구 키만 버린다", () => {
    storage.setItem("rpg-zzu:editor-ui-mode", "beginner");
    storage.setItem("oprn:editor-ui-mode", "expert");

    const result = migrateLegacyStorageKeys(storage);

    expect(result.moved).toBe(0);
    expect(result.skipped).toBe(1);
    expect(storage.getItem("oprn:editor-ui-mode")).toBe("expert");
    expect(storage.getItem("rpg-zzu:editor-ui-mode")).toBeNull();
  });

  it("우리 것이 아닌 키는 건드리지 않는다", () => {
    storage.setItem("some-other-app:setting", "keep");
    storage.setItem("rpgzzu-not-a-prefix", "keep");

    migrateLegacyStorageKeys(storage);

    expect(storage.getItem("some-other-app:setting")).toBe("keep");
    expect(storage.getItem("rpgzzu-not-a-prefix")).toBe("keep");
  });

  it("두 번째 호출은 전체 순회를 건너뛴다", () => {
    storage.setItem("rpg-zzu:a", "1");
    expect(migrateLegacyStorageKeys(storage).moved).toBe(1);

    // 완료 표시가 있으므로 이후에 들어온 구 키는 그대로 남는다 —
    // 마이그레이션은 부팅 1회용이고, 그 뒤에 구 키가 생길 경로는 없다.
    storage.setItem("rpg-zzu:b", "2");
    const second = migrateLegacyStorageKeys(storage);

    expect(second.alreadyDone).toBe(true);
    expect(second.moved).toBe(0);
  });

  it("완료 표시를 지우면 다시 돈다 (테스트 헬퍼)", () => {
    storage.setItem("rpg-zzu:a", "1");
    migrateLegacyStorageKeys(storage);
    storage.setItem("rpg-zzu:b", "2");

    resetStorageMigrationFlagForTests(storage);
    expect(migrateLegacyStorageKeys(storage).moved).toBe(1);
    expect(storage.getItem("oprn:b")).toBe("2");
  });

  it("빈 저장소에서도 터지지 않는다", () => {
    expect(() => migrateLegacyStorageKeys(storage)).not.toThrow();
    expect(migrateLegacyStorageKeys(null).moved).toBe(0);
  });

  it("순회 중 삭제로 키를 빠뜨리지 않는다 (인덱스 밀림 방어)", () => {
    // key(index) 로 순회하면서 지우면 인덱스가 밀려 홀수 번째만 옮겨지는 고전 버그.
    for (let i = 0; i < 20; i += 1) storage.setItem(`rpg-zzu:key-${i}`, String(i));

    const result = migrateLegacyStorageKeys(storage);

    expect(result.moved).toBe(20);
    for (let i = 0; i < 20; i += 1) {
      expect(storage.getItem(`oprn:key-${i}`)).toBe(String(i));
      expect(storage.getItem(`rpg-zzu:key-${i}`)).toBeNull();
    }
  });
});

// 접두사 리터럴이 48곳에 흩어져 적혀 있으므로(호출부를 안 고치는 대신) 새로 쓰는 키가
// 구 접두사로 돌아가지 않는지 소스로 지킨다.
describe("저장 키 접두사 회귀", () => {
  const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
  const SCANNED = new Set([".ts", ".tsx"]);
  /** 마이그레이션 자체와 금지어 목록은 구 접두사를 의도적으로 담는다. */
  const EXEMPT = new Set(["src/util/appStorage.ts", "src/storageBoot.ts"]);

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (SCANNED.has(extname(entry))) out.push(full);
    }
    return out;
  }

  it("src 안에 구 저장 키 접두사가 남아 있지 않다", () => {
    const offenders: string[] = [];
    for (const file of walk(join(REPO_ROOT, "src"))) {
      const rel = relative(REPO_ROOT, file).replace(/\\/g, "/");
      if (EXEMPT.has(rel)) continue;
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .forEach((line, index) => {
          if (/rpg-zzu[:.]/.test(line)) offenders.push(`${rel}:${index + 1} ${line.trim().slice(0, 100)}`);
        });
    }
    expect(offenders, `구 접두사 ${offenders.length}건:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("접두사가 하나로 정규화되어 있다 (콜론 형태)", () => {
    expect(STORAGE_PREFIX.endsWith(":")).toBe(true);
    expect(STORAGE_PREFIX).not.toContain(".");
  });
});
