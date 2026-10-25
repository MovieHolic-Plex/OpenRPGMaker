#!/usr/bin/env node
// 번들 참고문서가 REFERENCE_LIMITS(src/project/tilesetReferences.ts)를 넘지 않는지 빌드 때 검사한다.
//
// 왜 (2026-10-25): 버들항 street-tiles 참고문서 하나가 262k 글자로 상한 120k 를 넘었다. 런타임 검사
// (validateTilesetReferences)는 저장할 때만 돌아서, 번들에 실린 그 문서가 모든 프로젝트의 저장을 막았고
// 저장이 안 되니 매 부팅이 «첫 부팅»(전체 정규화 + 요약, 4.5~7.6s)을 다시 했다(#3473 에서 문서를 셋으로 나눔).
// 상한 넘는 번들 문서는 빌드가 실패해야 한다 — ci-fast 의 build:app 이 이 검사를 탄다(vite.config.ts 플러그인).
//
// 검사 대상: src/assets 아래 JSON 전부에서 «용도»(documents·images 배열을 가진 객체)를 찾는다.
// 상한의 95% 를 넘는 문서는 경고만 찍는다(다음 재생성 때 나눌 것).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ID_PATTERN = /^[\w.-]{1,100}$/u;

/** REFERENCE_LIMITS 를 TS 원본에서 읽는다 — 숫자를 여기 복사하면 둘이 갈라진다. */
export function readReferenceLimits(root = REPO_ROOT) {
  const source = readFileSync(join(root, "src/project/tilesetReferences.ts"), "utf8");
  const match = /export const REFERENCE_LIMITS\s*=\s*\{([^}]*)\}/u.exec(source);
  if (!match) throw new Error("referenceLimitsGuard: REFERENCE_LIMITS 를 src/project/tilesetReferences.ts 에서 찾지 못했습니다.");
  const limits = {};
  for (const [, key, value] of match[1].matchAll(/(\w+)\s*:\s*([\d_]+)/gu)) limits[key] = Number(value.replaceAll("_", ""));
  for (const key of ["categories", "documents", "images", "markdown", "imageBytes"]) {
    if (!Number.isFinite(limits[key])) throw new Error(`referenceLimitsGuard: REFERENCE_LIMITS.${key} 를 읽지 못했습니다.`);
  }
  return limits;
}

const isCategory = (value) => value && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.documents) && Array.isArray(value.images);

function listJsonFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...listJsonFiles(path));
    else if (name.endsWith(".json")) out.push(path);
  }
  return out;
}

/** 한 JSON 값 안의 모든 용도 묶음을 검사한다. errors·warnings 에 사람이 읽을 줄을 쌓는다. */
export function checkReferenceValue(value, file, limits, errors, warnings) {
  const where = (...parts) => `${file}: ${parts.filter(Boolean).join(" / ")}`;
  const checkString = (text, max, label) => {
    if (typeof text !== "string") return;
    if (text.length > max) errors.push(`${label} ${text.length.toLocaleString("en")}자 > 상한 ${max.toLocaleString("en")}`);
  };
  const checkIds = (items, label) => {
    const ids = items.map((item) => item?.id);
    if (ids.some((id) => typeof id !== "string" || id === "." || id === ".." || !ID_PATTERN.test(id))) errors.push(`${label}: id 형식 오류`);
    if (new Set(ids).size !== ids.length) errors.push(`${label}: id 중복`);
  };
  const visit = (node) => {
    if (Array.isArray(node)) {
      const groups = node.filter(isCategory);
      if (groups.length > 0 && groups.length === node.length) {
        if (node.length > limits.categories) errors.push(where(`용도 ${node.length}개 > 상한 ${limits.categories}`));
        checkIds(node, where("용도 목록"));
      }
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== "object") return;
    if (isCategory(node)) {
      const group = where(`용도 ${node.id ?? "?"}`);
      if (node.documents.length > limits.documents) errors.push(`${group}: 문서 ${node.documents.length}개 > 상한 ${limits.documents}`);
      if (node.images.length > limits.images) errors.push(`${group}: 이미지 ${node.images.length}개 > 상한 ${limits.images}`);
      checkIds(node.documents, `${group} 문서`);
      checkIds(node.images, `${group} 이미지`);
      checkString(node.name, 160, `${group} 이름`);
      checkString(node.description, 4000, `${group} 설명`);
      for (const doc of node.documents) {
        const label = `${group} 문서 ${doc?.id ?? "?"}`;
        const length = typeof doc?.markdown === "string" ? doc.markdown.length : 0;
        if (length > limits.markdown) errors.push(`${label}: markdown ${length.toLocaleString("en")}자 > 상한 ${limits.markdown.toLocaleString("en")} — 문서를 나눠 다시 생성하라`);
        else if (length > limits.markdown * 0.95) warnings.push(`${label}: markdown ${length.toLocaleString("en")}자 (상한의 ${Math.round(length / limits.markdown * 100)}%)`);
        checkString(doc?.name, 200, `${label} 이름`);
      }
      const maxImage = Math.ceil(limits.imageBytes * 4 / 3) + 64;
      for (const image of node.images) {
        const label = `${group} 이미지 ${image?.id ?? "?"}`;
        checkString(image?.dataUrl, maxImage, `${label} dataUrl`);
        checkString(image?.name, 200, `${label} 이름`);
        checkString(image?.caption, 4000, `${label} 설명`);
      }
      return;
    }
    for (const child of Object.values(node)) visit(child);
  };
  visit(value);
}

/** src/assets 아래 번들 JSON 전체를 검사한다. */
export function checkBundledReferenceLimits(root = REPO_ROOT) {
  const limits = readReferenceLimits(root);
  const errors = [];
  const warnings = [];
  let scanned = 0;
  for (const path of listJsonFiles(join(root, "src/assets"))) {
    const text = readFileSync(path, "utf8");
    if (!text.includes("\"documents\"")) continue;
    scanned += 1;
    checkReferenceValue(JSON.parse(text), relative(root, path), limits, errors, warnings);
  }
  return { limits, errors, warnings, scanned };
}

/** vite 플러그인: 빌드 시작 때 한 번 검사하고, 상한을 넘으면 빌드를 멈춘다. dev 서버는 건너뛴다. */
export function referenceLimitsGuardPlugin() {
  return {
    name: "oprn-reference-limits-guard",
    apply: "build",
    buildStart() {
      const { errors, warnings } = checkBundledReferenceLimits();
      for (const line of warnings) this.warn(`참고문서 상한 근접: ${line}`);
      if (errors.length > 0) this.error(`번들 참고문서가 REFERENCE_LIMITS 를 넘습니다(저장이 막힌다):\n  ${errors.join("\n  ")}`);
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, warnings, scanned } = checkBundledReferenceLimits();
  for (const line of warnings) console.warn(`경고 ${line}`);
  for (const line of errors) console.error(`오류 ${line}`);
  console.log(`참고문서 상한 검사: JSON ${scanned}개, 오류 ${errors.length}, 경고 ${warnings.length}`);
  process.exit(errors.length > 0 ? 1 : 0);
}
