// pixelfx 효과 모듈을 필요할 때만 불러온다. 효과 하나가 청크 하나(번들러의 변수 동적 import)라 쓰지 않는 효과는
// 내보낸 게임이 내려받지 않는다. 경로 패턴은 Vite 의 dynamic-import-vars 규칙(../ 시작, 확장자, 단계당 변수 하나)을 따른다.
import type { PixelFxModule } from "@/vendor/pixelfx/core/index.js";
import { isPixelFxEffectIdFormat } from "@/project/pixelFxSpec";

const pending = new Map<string, Promise<PixelFxModule | undefined>>();
const loaded = new Map<string, PixelFxModule>();

export function loadPixelFxModule(effectId: string): Promise<PixelFxModule | undefined> {
  const ready = loaded.get(effectId);
  if (ready) return Promise.resolve(ready);
  let promise = pending.get(effectId);
  if (promise) return promise;
  if (!isPixelFxEffectIdFormat(effectId)) return Promise.resolve(undefined);
  const [category, name] = effectId.split("/") as [string, string];
  // 밑줄로 시작하는 파일(_lib.js)은 효과가 아니라 분류 안의 공용 함수다.
  if (name.startsWith("_")) return Promise.resolve(undefined);
  promise = (import(`../vendor/pixelfx/fx/${category}/${name}.js`) as Promise<PixelFxModule>)
    .then((mod) => {
      if (!mod?.meta || (typeof mod.draw !== "function" && typeof mod.create !== "function")) return undefined;
      loaded.set(effectId, mod);
      return mod;
    })
    .catch(() => undefined);
  pending.set(effectId, promise);
  return promise;
}

/** 이미 불러온 모듈(동기). 아직이면 undefined — loadPixelFxModule 로 먼저 불러 둔다. */
export function loadedPixelFxModule(effectId: string): PixelFxModule | undefined {
  return loaded.get(effectId);
}
