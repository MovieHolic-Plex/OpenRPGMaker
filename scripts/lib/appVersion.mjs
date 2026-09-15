// scripts/lib/appVersion.mjs
// 앱 버전 메타의 **단일 계산 지점** — node(빌드·스크립트)에서만 쓴다.
// 브라우저가 보는 값은 vite define 으로 주입된다(src/brand.ts 의 APP_VERSION).
//
// 왜 필요한가 —
//   package.json 의 version 한 줄은 사람이 읽을 수 있지만 "지금 도는 이 빌드가 어느
//   커밋인지"는 말해주지 않는다. 버그 리포트에 `0.1.0` 만 적히면 재현이 불가능하다.
//   그래서 릴리스 버전과 빌드 식별자를 **둘 다** 만든다.
//
// 두 축을 섞지 않는다 (2026-09-16 결정, 근거: 지난 7일 머지 184건 = 하루 약 26건):
//   릴리스 버전 (0.1.0)          사람이 정한다. 태그 `v0.1.0` 이 그 약속의 정체성이다.
//                                scripts/release.mjs 만이 올린다.
//   빌드 식별자 (dev.184+gddc7a88) 기계가 커밋에서 파생한다. 매 머지·빌드마다 자동으로
//                                바뀌며 아무도 관리하지 않는다.
//   매 머지마다 릴리스 버전을 올리면 하루에 26개 버전이 생겨 숫자가 의미를 잃는다.
//
// git 이 없거나 저장소 밖에서 빌드해도 죽지 않는다 — 라벨이 `+nogit` 로 떨어질 뿐이다.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const GIT_TIMEOUT_MS = 3000;

/** 실패를 삼키는 git 호출. 저장소가 아니거나 git 이 없으면 null. */
function gitMaybe(root, args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      timeout: GIT_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export function readPackageVersion(root) {
  const raw = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const version = typeof raw.version === "string" ? raw.version.trim() : "";
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    throw new Error(`package.json 의 version 이 semver 가 아닙니다: ${JSON.stringify(raw.version)}`);
  }
  return version;
}

/**
 * `git describe --tags --match 'v*' --always --long --dirty --abbrev=7` 출력을 해석한다.
 *
 * 두 형태만 받는다:
 *   `v0.1.0-3-gddc7a88`      태그 이후 3커밋 (+ `-dirty` 가능)
 *   `ddc7a88` / `ddc7a88-dirty` 태그가 하나도 없을 때(--always 폴백)
 * 해석 불가면 null — 호출자가 폴백을 정한다.
 */
export function parseDescribe(describe) {
  const text = typeof describe === "string" ? describe.trim() : "";
  if (!text) return null;
  const dirty = text.endsWith("-dirty");
  const body = dirty ? text.slice(0, -"-dirty".length) : text;

  const withTag = /^(?<tag>v\d+\.\d+\.\d+[^\s-]*)-(?<count>\d+)-g(?<sha>[0-9a-f]+)$/.exec(body);
  if (withTag) {
    return {
      tag: withTag.groups.tag,
      commitsSinceTag: Number(withTag.groups.count),
      commit: `g${withTag.groups.sha}`,
      dirty,
    };
  }
  const shaOnly = /^(?<sha>[0-9a-f]{4,40})$/.exec(body);
  if (shaOnly) return { tag: null, commitsSinceTag: null, commit: `g${shaOnly.groups.sha}`, dirty };
  return null;
}

/**
 * 사람이 읽는 라벨. 규칙은 셋뿐이다.
 *   태그가 현재 버전 그대로이고 그 위에 커밋이 없으면 → `0.1.0`        (릴리스된 빌드)
 *   태그가 있으면                            → `0.1.0-dev.3+gddc7a88` (태그 이후 N커밋)
 *   태그가 없으면                            → `0.1.0-dev.184+gddc7a88` (저장소 전체 커밋 수)
 * 작업 트리가 더러우면 build metadata 에 `.dirty` 를 덧붙인다(semver 허용 문자).
 */
export function appVersionLabel(meta) {
  const { version, tag, commitsSinceTag, commit, dirty } = meta;
  if (!commit || commit === "unknown") return `${version}+nogit`;
  const suffix = dirty ? ".dirty" : "";
  if (tag === `v${version}` && commitsSinceTag === 0) return `${version}${suffix ? `+${commit}${suffix}` : ""}`;
  const count = Number.isFinite(commitsSinceTag) ? commitsSinceTag : 0;
  return `${version}-dev.${count}+${commit}${suffix}`;
}

/** 빌드 시점의 버전 메타. 실패는 값으로 흡수하고 던지지 않는다(빌드를 막지 않는다). */
export function readAppVersion(root = process.cwd()) {
  const cwd = resolve(root);
  const version = readPackageVersion(cwd);
  const described = parseDescribe(
    gitMaybe(cwd, ["describe", "--tags", "--match", "v*", "--always", "--long", "--dirty", "--abbrev=7"]),
  );
  const total = Number(gitMaybe(cwd, ["rev-list", "--count", "HEAD"]) ?? 0);
  const meta = {
    version,
    tag: described?.tag ?? null,
    commitsSinceTag: described?.commitsSinceTag ?? total,
    commit: described?.commit ?? "unknown",
    dirty: described?.dirty ?? false,
    builtAt: new Date().toISOString(),
  };
  return { ...meta, label: appVersionLabel(meta) };
}

/** vite `define` 값. 문자열은 소스에 그대로 치환되므로 JSON 으로 인용한다. */
export function appVersionDefine(meta) {
  return {
    __APP_VERSION__: JSON.stringify(meta.label),
    __APP_VERSION_META__: JSON.stringify({
      version: meta.version,
      label: meta.label,
      tag: meta.tag,
      commitsSinceTag: meta.commitsSinceTag,
      commit: meta.commit,
      dirty: meta.dirty,
      builtAt: meta.builtAt,
    }),
  };
}

/**
 * vite 플러그인. 설정 파일마다 `define` 을 손으로 적지 않게 한다 —
 * 한 곳을 빠뜨리면 그 번들에서만 `__APP_VERSION__` 이 미정의가 되어 조용히 폴백한다.
 */
export function appVersionPlugin() {
  return {
    name: "oprn-app-version",
    config(config) {
      const root = resolve(config?.root ?? process.cwd());
      return { define: appVersionDefine(readAppVersion(root)) };
    },
  };
}
