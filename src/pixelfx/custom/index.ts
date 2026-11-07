// 업스트림 벤더 밖에서 우리가 저작한 pixelfx 효과 표. sync-pixelfx.mjs 가 src/vendor 를 통째로 갈아 끼워도 이 폴더는 남는다.
// 손으로 두는 이유: 모듈 로더는 Vite 변수 동적 import 라 vendor 경로만 안다 — 커스텀은 정적 import 표로 정확히 잇는다.
import type { PixelFxModule } from "@/vendor/pixelfx/core/index.js";

export interface PixelFxCustomEntry {
  readonly id: string;
  readonly load: () => Promise<PixelFxModule>;
}

export const PIXEL_FX_CUSTOM: readonly PixelFxCustomEntry[] = [
  { id: "fallenstar/falling-star", load: () => import("./fallenstar/falling-star.js") },
  { id: "fallenstar/flame-sword", load: () => import("./fallenstar/flame-sword.js") },
  { id: "fallenstar/moonlight-breath", load: () => import("./fallenstar/moonlight-breath.js") },
];

const BY_ID = new Map(PIXEL_FX_CUSTOM.map((entry) => [entry.id, entry]));

export function loadCustomPixelFxModule(effectId: string): Promise<PixelFxModule> | undefined {
  return BY_ID.get(effectId)?.load();
}
