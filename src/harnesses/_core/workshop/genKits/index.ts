// src/harnesses/_core/workshop/genKits/index.ts
/**
 * 생성기 저장소에서 뽑은 고정판(npm run gen-kits:sync, lock = tiledata/gen-kits.lock.json). 손으로 고치지 않는다.
 * - object-gen.json: object-gen(공개) 의 모듈 상수(프롬프트·참고 그림 시점 글·판정 기준·팔레트 이름 …)와 팔레트·기준 그림 묶음 글.
 *   공방 실행기는 손으로 옮긴 사본 대신 여기서 읽는다(kitText). 파이썬 형식 자리표시({kind} 등)는 그대로라 쓰는 쪽이 채운다.
 * - kits.json: 세 저장소(object-gen·char-gen·tile-gen)의 고정 커밋과 계약 검사 결과. 비공개 저장소의 글은 들어 있지 않다.
 */
import objectGen from "./object-gen.json";
import kits from "./kits.json";

export type GenKit = {
  readonly kit: string;
  readonly repo: string;
  readonly commit: string;
  readonly constants: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly files: Readonly<Record<string, string>>;
  readonly assets: readonly string[];
};

export const objectGenKit: GenKit = objectGen as GenKit;
export const genKitPins = kits.kits as Readonly<Record<string, { readonly repo: string; readonly visibility: string; readonly commit: string; readonly vendored: boolean; readonly contract: "ok" | readonly string[] }>>;

/** 모듈 상수 하나. 고정 커밋에 없으면 던진다 — 저장소가 이름을 바꾸면 조용히 옛 글로 돌지 않고 바로 드러난다. */
export function kitConstant<T = unknown>(kit: GenKit, module: string, name: string): T {
  const value = kit.constants[module]?.[name];
  if (value === undefined) throw new Error(`${kit.kit}@${kit.commit.slice(0, 9)} 에 ${module}.${name} 이 없다(npm run gen-kits:sync 로 다시 뽑거나 쓰는 쪽을 고쳐라)`);
  return value as T;
}

export function kitText(kit: GenKit, module: string, name: string): string {
  const value = kitConstant(kit, module, name);
  if (typeof value !== "string") throw new Error(`${kit.kit} ${module}.${name} 은 글이 아니다`);
  return value;
}

/** 저장소 안 경로의 글 파일(팔레트 .pal, 기준 그림 set.json …) */
export function kitFile(kit: GenKit, path: string): string {
  const text = kit.files[path];
  if (text === undefined) throw new Error(`${kit.kit}@${kit.commit.slice(0, 9)} 에 ${path} 가 없다`);
  return text;
}

/** object-gen .pal(`@rampc <재료> #어두움 … #밝음` 줄) → 재료별 램프. object-gen 팔레트 키는 `<재료>:<단>` 이다. */
export function parseRamps(text: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^@ramp\w*\s+(\S+)\s+(.*)$/.exec(line.trim());
    if (!m) continue;
    out[m[1]!] = [...m[2]!.matchAll(/#([0-9a-f]{6})\b/gi)].map((hex) => `#${hex[1]!.toLowerCase()}`);
  }
  return out;
}
