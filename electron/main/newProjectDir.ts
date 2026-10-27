// 새 프로젝트 폴더 검사. Electron 을 부르지 않는다 — 시작 화면·파일 메뉴·테스트가 같은 표를 본다.
//
// 시작 화면은 고른 경로를 prepareNewProjectDir 로 거른다. 파일 메뉴 「새 프로젝트」가 그 검사를
// 건너뛰면 사진·문서가 있는 폴더에 project.sqlite 와 assets/ 가 생긴다. 「폴더 열기」는 다르다 —
// 저장소가 없는 폴더도 연다.
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

/** 없거나, 비어 있는 디렉터리. 파일이 하나라도 있으면 새 프로젝트를 심지 않는다. */
export function isUsableNewDir(path: string): boolean {
  if (!existsSync(path)) return true;
  try {
    return statSync(path).isDirectory() && readdirSync(path).length === 0;
  } catch {
    return false;
  }
}

/**
 * 새 프로젝트 폴더를 준비한다. 절대 경로여야 하고, 없거나 비어 있어야 한다 —
 * 이미 무언가 있는 폴더에 새 프로젝트를 심으면 사용자의 파일 옆에 project.sqlite 가 생긴다.
 */
export function prepareNewProjectDir(projectDir: string): string {
  if (!isAbsolute(projectDir)) throw new Error("새 프로젝트 폴더는 절대 경로여야 합니다.");
  const dir = resolve(projectDir);
  if (!isUsableNewDir(dir)) throw new Error("이미 파일이 있는 폴더입니다. 다른 이름이나 위치를 골라 주세요.");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * 파일 메뉴가 고른 폴더.
 * `new` 는 없거나 빈 폴더만 만든다. `open` 은 고른 경로를 그대로 연다.
 */
export function acceptMenuFolder(picked: string, kind: "new" | "open"): string {
  if (kind === "open") return picked;
  return prepareNewProjectDir(picked);
}
