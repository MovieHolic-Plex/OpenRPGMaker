// scripts/lib/normalizerFingerprint.mjs
// 부팅 정규화 건너뛰기 표식(src/project/bootNormalization.ts)이 쓰는 «정규화기 입력의 내용 지문».
// node(빌드)에서만 쓴다. 브라우저는 vite define `__OPRN_NORMALIZER_FINGERPRINT__` 로 받는다.
//
// 왜(2026-10-14 실측, 98MB 타일셋 프로젝트): 표식이 «git 커밋 + 수정된 트리 아님» 이면 두 경우에 건너뛰기가 죽는다.
//   1. 수정된 트리(`dirty`)에서 빌드한 번들 — 표식을 새기지도 건너뛰지도 않아 **매 부팅** 정규화기 16개와 전후 내용
//      요약 전체를 돌린다(웜 부팅 편집 화면까지 11.8s → 19–21s). :9888 서비스가 정확히 이 경우였다.
//   2. 머지마다 커밋이 바뀌므로 정규화기와 무관한 변경에도 «새 빌드» 가 되어 첫 부팅마다 전부 다시 돌린다.
// 정규화기의 결과는 «정규화기 코드 + 번들 데이터» 의 함수이므로, 그 입력의 내용 해시가 같으면 결과도 같다.
// git 상태에 기대지 않으므로 수정된 트리에서도 맞게 동작한다.
//
// 입력 = src/project/** 와 src/assets/** 전부(정규화기가 사는 곳, store.ts 의 지역 정규화기 포함) + 정규화기 모듈에서
// 정적 import 로 닿는 그 밖의 파일(src/battle · src/util · src/brand …). 동적 import() 는 따라가지 않는다 —
// 정규화기는 동기 함수라 지연 로드 모듈을 부를 수 없다. 넓게 잡으면 건너뛰기가 덜 일어날 뿐 틀린 건너뛰기는 없다.
// 정규화기 모듈을 새로 만들면 NORMALIZER_ENTRIES 에 더한다(store.ts 에서 import 하는 `ensure*`·`repair*` 모듈).

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/** store.normalizeCurrentProject 가 부르는 정규화기가 정의된 모듈(store.ts 자신은 src/project 통째로 들어간다). */
export const NORMALIZER_ENTRIES = [
  "src/project/io/rewriteLegacyDialogue.ts",
  "src/project/defaults/blankProject.ts",
  "src/project/defaults/defaultAssets.ts",
  "src/project/defaults/interiorTransparentPropLayerRepair.ts",
  "src/project/defaults/defaultDatabaseIconResources.ts",
  "src/project/defaults/defaultDatabase.ts",
  "src/project/faceMatchRepair.ts",
  "src/project/sharedTileReferences.ts",
  "src/project/bundledReferenceImages.ts",
];

/** 디렉터리째 입력으로 치는 곳. */
export const NORMALIZER_DIRS = ["src/project", "src/assets"];

const SOURCE_FILE = /\.(?:ts|tsx|mts|js|mjs|json)$/;
const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx)$/;

function listFiles(dir, out) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) listFiles(path, out);
    else if (entry.isFile() && SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)) out.add(path);
  }
}

function resolveImport(root, from, spec) {
  let base;
  if (spec.startsWith("@/")) base = join(root, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}.json`, join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

// `import … from "x"` · `export … from "x"` · `import "x"` 만 읽는다(주석 속 예시가 섞여도 넓어질 뿐이다).
const IMPORT_PATTERN = /(?:^|\n)\s*(?:import|export)\s[^'"`;]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']/g;

/** 정규화기 모듈에서 정적 import 로 닿는 파일 + 입력 디렉터리 전부. 절대 경로 정렬 배열. */
export function normalizerInputFiles(root = process.cwd()) {
  const base = resolve(root);
  const files = new Set();
  for (const dir of NORMALIZER_DIRS) listFiles(join(base, dir), files);
  const seen = new Set();
  const stack = NORMALIZER_ENTRIES.map((entry) => join(base, entry)).filter((entry) => existsSync(entry));
  while (stack.length > 0) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    files.add(file);
    if (!/\.(?:ts|tsx|mts)$/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    IMPORT_PATTERN.lastIndex = 0;
    for (let match = IMPORT_PATTERN.exec(source); match; match = IMPORT_PATTERN.exec(source)) {
      const target = resolveImport(base, file, match[1] ?? match[2]);
      if (target && !seen.has(target)) stack.push(target);
    }
  }
  return [...files].sort();
}

/** 정규화기 입력의 SHA-256 지문(앞 16자). 파일 경로(루트 기준)와 내용을 함께 먹인다. */
export function readNormalizerFingerprint(root = process.cwd()) {
  const base = resolve(root);
  const hash = createHash("sha256");
  for (const file of normalizerInputFiles(base)) {
    hash.update(relative(base, file).replace(/\\/g, "/"));
    hash.update("\0");
    hash.update(createHash("sha256").update(readFileSync(file)).digest());
  }
  return hash.digest("hex").slice(0, 16);
}

/**
 * vite 플러그인. 번들(build·preview 용 dist)에만 지문을 넣는다. `vite serve` 는 코드가 실행 중에도 바뀌므로 비워 둔다 —
 * 지문이 «서버를 띄운 순간의 내용» 에 묶여 낡은 표식을 새길 수 있다(src/project/bootNormalization.ts 가 빈 값이면 건너뛰지 않는다).
 */
export function normalizerFingerprintPlugin() {
  return {
    name: "oprn-normalizer-fingerprint",
    config(config, env) {
      const root = resolve(config?.root ?? process.cwd());
      const fingerprint = env?.command === "build" ? readNormalizerFingerprint(root) : "";
      return { define: { __OPRN_NORMALIZER_FINGERPRINT__: JSON.stringify(fingerprint) } };
    },
  };
}
