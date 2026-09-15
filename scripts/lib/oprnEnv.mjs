// 옛 환경 변수 이름 호환 심 — RPG_ZZU_* / RPGZZU_* → OPRN_*.
//
// 2026-09 제품명 스윕에서 저장소 안의 식별자는 전부 oprn 으로 바뀌었지만, 환경 변수는
// 저장소 **밖**에서 온다: 사용자 systemd 유닛(rpg-zzu.service), 각자의 .env.local, CI 시크릿.
// 그것들은 우리가 고칠 수 없으므로 한 릴리스 동안 옛 이름을 새 이름으로 옮겨 읽어 준다.
//
// 규칙:
//   · 새 이름(OPRN_X)이 이미 있으면 옛 이름은 무시한다 — 빈 문자열도 '있는 값'이다.
//   · 옛 이름만 있으면 새 이름으로 복사한다. 옛 키는 지우지 않는다(옛 코드가 도는 자식 프로세스가
//     아직 옛 이름을 읽을 수 있다).
//   · 경고는 이름마다 한 프로세스에 한 번, stderr 로 낸다(stdout 을 파싱하는 스크립트를 더럽히지 않는다).
//
// 호출 위치: 값을 처음 읽기 전에 부른다. 프로세스 진입점(vite.config.ts, playwright.config.ts,
// vitest.config.ts, scripts/run-vitest.mjs, 각 스크립트)과 여러 진입점이 공유하는 라이브러리
// (ohMyPiAuthStore.mjs, aiAuthRuntime.ts, bgmInstall.ts …)가 부른다. 멱등이라 여러 번 불러도 된다.
// process.env 가 아니라 Vite loadEnv 가 돌려준 객체처럼 **다른 env 객체**에도 쓸 수 있다.
//
// 목록을 손으로 들지 않고 접두사로 판정한다 — 이름 하나가 빠져 조용히 기본값으로 떨어지는 사고를
// 막기 위해서다. 새 이름을 새로 만들 때는 OPRN_ 접두사만 쓰면 된다.

const LEGACY_PREFIXES = ["RPG_ZZU_", "RPGZZU_"];
const NEXT_PREFIX = "OPRN_";

/** 이미 경고한 옛 이름 — 프로세스당 한 번만 알린다. */
const warned = new Set();

function defaultWarn(message) {
  process.stderr.write(`${message}\n`);
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @param {(message: string) => void} [warn]
 * @returns {Array<{ legacy: string; next: string }>} 이번 호출에서 실제로 복사한 쌍
 */
export function applyLegacyEnvAliases(env = process.env, warn = defaultWarn) {
  const applied = [];
  for (const legacy of Object.keys(env)) {
    const prefix = LEGACY_PREFIXES.find((candidate) => legacy.startsWith(candidate) && legacy.length > candidate.length);
    if (!prefix) continue;
    const value = env[legacy];
    if (value === undefined) continue;
    const next = `${NEXT_PREFIX}${legacy.slice(prefix.length)}`;
    if (env[next] !== undefined) continue;
    env[next] = value;
    applied.push({ legacy, next });
    if (warned.has(legacy)) continue;
    warned.add(legacy);
    warn(`[oprn] 환경 변수 ${legacy} 는 옛 이름입니다. ${next} 로 바꿔 주세요 — 옛 이름은 이번 릴리스까지만 읽습니다.`);
  }
  return applied;
}
