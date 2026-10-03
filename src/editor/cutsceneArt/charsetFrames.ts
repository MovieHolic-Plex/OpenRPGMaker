// 컷신에서 쓸 «게임 속 그 캐릭터» — 캐릭터셋 한 인물의 프레임을 picture 리소스로 잘라 낸다.
// 생성한 인물 대신 인게임 캐릭터셋(24×32, 방향 4행 × 걷기 3프레임)을 쓰면 시점·크기·화풍이 맵 위 모습과 정확히 같고,
// 걷기도 진짜 프레임 교체로 움직인다. 청록 키색은 캐릭터셋 규약(팔레트 0번 = 투명)을 따라 투명으로 만든다.
import { charsetFrameSource, type CharsetFrameSelection } from "@/assets/easyrpgRtp";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { Project } from "@/project/types";
import { crop, decodeImage, encodePng, type RgbaImage } from "./imageProcess";

export type CharsetFrameRole = "walkDown0" | "walkDown1" | "walkDown2" | "faceRight" | "faceLeft" | "faceUp";
/** 연출 레이어용 전 방향 걷기 프레임(방향 × 0·1·2). 기본 목록(CHARSET_FRAME_ROLES)은 충돌 컷신 호환을 위해 그대로 둔다. */
export type CharsetWalkRole = `walk${"Up" | "Down" | "Left" | "Right"}${0 | 1 | 2}`;
export type CharsetAnyRole = CharsetFrameRole | CharsetWalkRole;

const ROLE_FRAMES: Readonly<Record<CharsetAnyRole, Pick<CharsetFrameSelection, "direction" | "pattern">>> = {
  ...Object.fromEntries((["up", "down", "left", "right"] as const).flatMap((direction) => [0, 1, 2].map((pattern) => [`walk${direction[0]!.toUpperCase()}${direction.slice(1)}${pattern}`, { direction, pattern }]))) as Record<CharsetWalkRole, Pick<CharsetFrameSelection, "direction" | "pattern">>,
  walkDown0: { direction: "down", pattern: 0 },
  walkDown1: { direction: "down", pattern: 1 },
  walkDown2: { direction: "down", pattern: 2 },
  faceRight: { direction: "right", pattern: 1 },
  faceLeft: { direction: "left", pattern: 1 },
  faceUp: { direction: "up", pattern: 1 },
};
export const CHARSET_FRAME_ROLES: readonly CharsetFrameRole[] = ["walkDown0", "walkDown1", "walkDown2", "faceRight", "faceLeft", "faceUp"];

type AssetFetcher = (url: string) => Promise<string>;
let fetcherOverride: AssetFetcher | undefined;
/** 헤드리스 하네스가 «/assets/…» 번들 경로를 파일에서 읽게 꽂는다. */
export function setCutsceneAssetFetcher(fetcher: AssetFetcher | undefined): void {
  fetcherOverride = fetcher;
}

export async function fetchPictureDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  if (fetcherOverride) return fetcherOverride(url);
  const blob = await (await fetch(url)).blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** 캐릭터셋 청록 키(0,147,146 부근)를 투명으로. 팔레트 PNG 의 0번 색이다. */
function keyOutCharset(image: RgbaImage): RgbaImage {
  const data = new Uint8ClampedArray(image.data);
  for (let i = 0; i < data.length; i += 4) {
    if (Math.abs(data[i]! - 0) < 6 && Math.abs(data[i + 1]! - 147) < 6 && Math.abs(data[i + 2]! - 146) < 6) data[i + 3] = 0;
  }
  return { width: image.width, height: image.height, data };
}

export interface CharsetFramePictures {
  readonly frames: Readonly<Record<string, { readonly id: string; readonly dataUrl: string }>>;
  readonly width: number;
  readonly height: number;
}

export function charsetPictureId(resourceId: string, characterIndex: number, role: CharsetAnyRole): string {
  return `cutscene_char_${resourceId.replace(/[^a-z0-9]+/giu, "_")}_${characterIndex}_${role}`;
}

export async function cropCharsetFrames(project: Project | undefined, resourceId: string, characterIndex: number, roles: readonly CharsetAnyRole[] = CHARSET_FRAME_ROLES): Promise<CharsetFramePictures> {
  const url = resolveAssetResourceUrl(resourceId, project ? { project } : {});
  if (!url) throw new Error(`캐릭터셋 '${resourceId}' 의 그림을 찾을 수 없습니다.`);
  const sheet = keyOutCharset(await decodeImage(await fetchPictureDataUrl(url)));
  const frames: Record<string, { id: string; dataUrl: string }> = {};
  let width = 24, height = 32;
  for (const role of roles) {
    const source = charsetFrameSource({ characterIndex, ...ROLE_FRAMES[role] });
    if (source.x + source.width > sheet.width || source.y + source.height > sheet.height) {
      throw new Error(`캐릭터셋 '${resourceId}' 에 characterIndex ${characterIndex} 칸이 없습니다(시트 ${sheet.width}×${sheet.height}).`);
    }
    const cell = crop(sheet, source.x, source.y, source.width, source.height);
    width = cell.width; height = cell.height;
    frames[role] = { id: charsetPictureId(resourceId, characterIndex, role), dataUrl: await encodePng(cell) };
  }
  return { frames, width, height };
}
