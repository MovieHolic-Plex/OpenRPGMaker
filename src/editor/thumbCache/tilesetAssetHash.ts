// 타일셋 그림의 내용 키 — 오브젝트 썸네일 키의 앞 절반.
//
// 칸 그림은 타일셋 그림 URL·한 줄 칸 수·칸 크기만으로 정해진다(kitRender drawTile).
// data: URL 은 그 자체가 내용이다. 번들 경로(/assets/...png)는 파일 이름에 내용 해시가 없으므로
// 앱 판본을 섞는다 — 새 판에서 같은 경로의 그림이 바뀌어도 옛 썸네일이 남지 않는다.
import { APP_VERSION } from "@/brand";
import { tilesetImageUrl } from "@/editor/tilesetImage";
import type { TilesetDef } from "@/project/types";
import { thumbContentHash } from "@/editor/thumbCache";

const memo = new WeakMap<TilesetDef, { readonly url: string; readonly hash: string }>();

export function tilesetAssetHash(tileset: TilesetDef): string {
  const url = tilesetImageUrl(tileset);
  const known = memo.get(tileset);
  if (known && known.url === url) return known.hash;
  const version = url.startsWith("data:") ? "" : APP_VERSION;
  const hash = thumbContentHash(`${url}|${tileset.tilesPerRow}|${tileset.tileSize}|${version}`);
  memo.set(tileset, { url, hash });
  return hash;
}
