/**
 * 단일 HTML(스탠드얼론) 빌드용 Phaser 런타임.
 *
 * 기본 구현(phaserRuntime.ts)은 `import.meta.url` 로 주소를 만들어 `<script>` 를 꽂는다.
 * 단일 파일 번들에는 그 주소가 없고, `file://` 에서는 외부 스크립트가 CORS 로 막힌다.
 * 그래서 스탠드얼론 빌드는 이 모듈로 바꿔치기해 Phaser 를 번들 안에 넣는다
 * (vite.standalone.config.ts 의 alias).
 *
 * API 는 원본과 같아야 한다 — 호출부는 어느 쪽이 붙었는지 몰라야 한다.
 */
import Phaser from "phaser";

declare global {
  interface Window {
    Phaser?: typeof Phaser;
  }
}

// 일부 코드가 window.Phaser 를 직접 읽는다 — 주입식과 같은 모양을 유지한다.
window.Phaser = Phaser;

export function ensurePhaser(): Promise<typeof Phaser> {
  return Promise.resolve(Phaser);
}

export function getLoadedPhaser(): typeof Phaser {
  return Phaser;
}
