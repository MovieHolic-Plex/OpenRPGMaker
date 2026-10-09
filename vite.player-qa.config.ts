// 런타임 QA 전용 dev 서버 설정.
//
// 출하 빌드 설정(vite.player.config.ts)은 **건드리지 않는다** — 그 파일은 내보내기
// 플레이어의 빌드 계약이고, 동시에 도는 워크트리들이 공유한다. dev 전용 관심사만
// 여기에 격리한다. cacheDir 은 vite CLI 플래그가 없어서 설정 파일이 불가피하다.
//
// 설계: docs/superpowers/specs/2026-08-28-runtime-vision-qa-design.md
import { readdirSync, realpathSync, type Dirent } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, mergeConfig } from "vite";
import playerConfig from "./vite.player.config";

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

/**
 * 워크트리는 node_modules 를 메인 레포로 심볼릭 링크해 쓴다 — @fs 실경로가 원본
 * 저장소로 풀리므로 기본 allow(워크스페이스 루트)만으로는 403 이 난다.
 * vite.config.ts:372 와 같은 근거이며, 링크 대상을 실경로로 직접 넓힌다.
 */
function fsAllowRoots(): string[] {
  const roots = new Set([here("./")]);
  const modules = here("./node_modules");
  try {
    roots.add(realpathSync(modules));
  } catch {
    // 링크가 없으면(정상 체크아웃) 추가할 것이 없다.
  }
  // 워크트리의 node_modules 는 **디렉터리 자체가 실물**이고 그 안의 패키지가 하나씩
  // 메인 레포로 링크된 형태일 수 있다(실측 2026-08-30). 그러면 위의 realpath 는 자기
  // 자신으로 풀려 아무것도 넓히지 못하고, `/@fs/…/node_modules/phaser/dist/phaser.min.js`
  // 가 403 으로 죽는다 — 게임이 통째로 안 뜨므로 시나리오 전체가 훅 없음으로 실패한다.
  // 그래서 링크 **대상**의 부모까지 넓힌다. 스코프 패키지는 한 단계 더 들어간다.
  for (const scope of [modules, ...scopeDirs(modules)]) {
    for (const target of symlinkTargets(scope)) roots.add(dirname(target));
  }
  return [...roots];
}

function scopeDirs(modules: string): string[] {
  return entries(modules)
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("@"))
    .map((entry) => join(modules, entry.name));
}

function symlinkTargets(dir: string): string[] {
  const targets: string[] = [];
  for (const entry of entries(dir)) {
    if (!entry.isSymbolicLink()) continue;
    try {
      targets.push(realpathSync(join(dir, entry.name)));
    } catch {
      // 끊긴 링크는 넓힐 대상이 없다.
    }
  }
  return targets;
}

function entries(dir: string): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

export default mergeConfig(
  playerConfig,
  defineConfig({
    // 출하 빌드는 publicDir:false 가 맞다 — export 파이프라인이 참조된 애셋만 복사한다.
    // 그러나 dev QA 는 번들 텍스처를 상대 URL(assets/easyrpg-*.png)로 실제 fetch 한다.
    // 끄고 두면 전부 404 가 나고 게임이 아무것도 그리지 않는다(= 조용한 검은 스크린샷).
    publicDir: here("./public"),
    // 워크트리끼리 node_modules/.vite 를 공유해 서로의 최적화 캐시를 재생성하다
    // "Failed to scan for dependencies" 로 서버가 죽는다(vite.config.ts:350-354, 실측 3회).
    cacheDir: process.env.VITE_CACHE_DIR ?? here("./.vite-cache/player-qa"),
    server: {
      host: "127.0.0.1",
      // 포트는 하네스가 빈 포트를 잡아 --port 로 넘긴다. strictPort 로 충돌 시
      // 조용히 다른 포트로 흐르지 않고 크게 죽인다(남의 워크트리 서버에 붙는 사고 방지).
      strictPort: true,
      open: false,
      // 파일 감시는 기본으로 끈다. QA 실행 중에는 소스가 바뀌지 않아 HMR 이 필요 없고,
      // public/assets 의 수만 개 파일을 감시하면 여러 워크트리가 동시에 돌 때 호스트 inotify
      // 한도를 넘겨 `ENOSPC: System limit for number of file watchers reached` 로 서버 기동
      // 자체가 실패한다(실측). 사람이 HMR 을 쓰려면 PLAYER_QA_WATCH=1 로 켠다.
      hmr: process.env.PLAYER_QA_WATCH === "1" ? undefined : false,
      watch: process.env.PLAYER_QA_WATCH === "1" ? undefined : null,
      fs: { allow: fsAllowRoots() },
    },
  }),
);
