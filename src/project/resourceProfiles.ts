import type { ResourceKind } from "./types";

export type ResourceProfileSpec = {
  kind: ResourceKind;
  label: string;
  tileWidth?: number;
  tileHeight?: number;
  expectedWidth?: number;
  expectedHeight?: number;
  media: "image" | "audio";
};

export type ResourceDimensionResult =
  | { ok: true; tilesPerRow?: number; tileCount?: number; message: string }
  | { ok: false; message: string };

export const RESOURCE_PROFILE_SPECS: readonly ResourceProfileSpec[] = [
  { kind: "chipset", label: "칩셋", tileWidth: 16, tileHeight: 16, expectedWidth: 480, expectedHeight: 256, media: "image" },
  { kind: "charset", label: "캐릭터셋", tileWidth: 24, tileHeight: 32, expectedWidth: 288, expectedHeight: 256, media: "image" },
  { kind: "battle", label: "전투 애니메이션", media: "image" },
  { kind: "battleCharset", label: "전투 캐릭터셋", tileWidth: 48, tileHeight: 48, media: "image" },
  { kind: "battleWeapon", label: "전투 무기", tileWidth: 64, tileHeight: 64, media: "image" },
  { kind: "backdrop", label: "전투 배경", media: "image" },
  { kind: "gameOver", label: "게임 오버", media: "image" },
  { kind: "monster", label: "몬스터", media: "image" },
  { kind: "faceset", label: "얼굴 그래픽", tileWidth: 48, tileHeight: 48, media: "image" },
  { kind: "picture", label: "그림", media: "image" },
  { kind: "system", label: "시스템", media: "image" },
  { kind: "system2", label: "시스템 2", media: "image" },
  { kind: "title", label: "타이틀", media: "image" },
  { kind: "music", label: "음악", media: "audio" },
  { kind: "sound", label: "효과음", media: "audio" },
];

export function getResourceProfileSpec(kind: ResourceKind): ResourceProfileSpec {
  return RESOURCE_PROFILE_SPECS.find((spec) => spec.kind === kind) ?? RESOURCE_PROFILE_SPECS[0];
}

export function validateResourceDimensions(kind: ResourceKind, width: number, height: number): ResourceDimensionResult {
  const spec = getResourceProfileSpec(kind);
  if (spec.media === "audio") return { ok: true, message: `${spec.label}: 오디오 리소스` };
  if (spec.expectedWidth !== undefined && spec.expectedHeight !== undefined) {
    if (width !== spec.expectedWidth || height !== spec.expectedHeight) {
      return {
        ok: false,
        message: `${spec.label}: ${spec.expectedWidth}x${spec.expectedHeight} 크기가 필요합니다. 현재 ${width}x${height}입니다.`,
      };
    }
  }
  if (spec.tileWidth !== undefined && spec.tileHeight !== undefined) {
    if (width % spec.tileWidth !== 0 || height % spec.tileHeight !== 0) {
      return {
        ok: false,
        message: `${spec.label}: 크기는 ${spec.tileWidth}x${spec.tileHeight} 단위에 맞아야 합니다.`,
      };
    }
    return {
      ok: true,
      tilesPerRow: width / spec.tileWidth,
      tileCount: (width / spec.tileWidth) * (height / spec.tileHeight),
      message: `${spec.label}: ${width}x${height}, ${spec.tileWidth}x${spec.tileHeight}`,
    };
  }
  return { ok: true, message: `${spec.label}: ${width}x${height}` };
}
