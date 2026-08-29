// Grok CLI 로 이미지를 뽑을 때 필요한 배관. 전투 시트 생성기(gen-hero-battle-grok.mjs)와
// 뒷모습 생성기(gen-hero-back-grok.mjs)가 같은 코드를 본다.
//
// Grok 은 `image_gen` 툴을 갖고 있고(TUI 의 /imagine) 결과를 세션 디렉터리에 떨어뜨린다:
//   ~/.grok/sessions/<urlencoded-cwd>/<session-id>/images/<N>.jpg   (1024~1152px, 실측)
// 저장 위치를 인자로 지정할 수 없으므로 --session-id 를 우리가 정해 경로를 결정론적으로 만들고,
// 프롬프트로 "이 절대 경로에 원본을 그대로 복사하라" 고 지시해 파일 이름 추측을 없앤다.
import { spawn } from "node:child_process";
import { existsSync, readdirSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir, userInfo } from "node:os";
import { randomUUID } from "node:crypto";

const LOG = resolve(".omo/asset-gen.log");

// grok 은 자격증명을 `$HOME/.grok/auth.json` 에서 읽는다. 그런데 이 스크립트를 돌리는
// 에이전트 셸은 HOME 이 샌드박스 홈으로 바뀌어 있을 수 있다(실측: HOME=/home/main/.claude3-home
// 인데 실제 자격증명은 /home/main/.grok/auth.json 에 있었고, grok 은 "Not signed in" 만 반복했다.
// 토큰은 멀쩡했고 경로만 어긋난 것이었다).
//   - os.homedir() 는 HOME 을 따라간다 → 샌드박스 홈.
//   - os.userInfo().homedir 는 passwd 항목을 읽는다 → 실제 로그인 홈.
// 그래서 auth.json 이 실제로 있는 쪽을 골라 grok 자식 프로세스의 HOME 으로 넘긴다.
// GROK_HOME 으로 강제할 수 있다.
function resolveGrokHome() {
  const candidates = [process.env.GROK_HOME, homedir(), userInfo().homedir].filter(Boolean);
  for (const dir of candidates) {
    if (existsSync(join(dir, ".grok", "auth.json"))) return dir;
  }
  return homedir();
}

export const GROK_HOME = resolveGrokHome();
export const GROK_SESSIONS = join(GROK_HOME, ".grok", "sessions");

/** `--name=값` 형태의 인자를 읽는다. */
export function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

/** 태그를 붙여 콘솔과 .omo/asset-gen.log 에 같이 남긴다. */
export function makeLogger(tag) {
  return (line) => {
    const stamped = `${new Date().toISOString()} [${tag}] ${line}`;
    console.log(stamped);
    try {
      appendFileSync(LOG, `${stamped}\n`);
    } catch {
      /* 로그 실패가 생성을 막지는 않는다 */
    }
  };
}

/** cwd 는 세션 디렉터리 이름으로 URL 인코딩돼 들어간다(실측: %2Ftmp%2F...). */
export function sessionDir(cwd, sessionId) {
  return join(GROK_SESSIONS, encodeURIComponent(cwd), sessionId);
}

/**
 * 매번 새 UUID. grok 은 유효한 UUID 만 `--session-id` 로 받고, 그 플래그는 **신규 전용**이라
 * 이미 존재하는 id 를 주면 `Session ID ... is already in use` 로 죽는다(이어가려면 `--resume`).
 *
 * 예전에는 대상/태그의 해시로 결정론적 id 를 만들었는데, 그러면 **같은 태그로 재생성하는
 * 순간 100% 충돌한다**(실측: 약한 프레임 5장을 다시 뽑으려다 5장 전부 이 에러로 죽었다).
 * 로컬 cwd 를 지워도 안 풀린다 — 세션은 `~/.grok/sessions/<urlencoded-cwd>/<id>` 에 남는다.
 * 결정론은 얻는 게 없다: id 는 우리가 넘기는 값이라 어차피 알고 있고, 재시작 시 중복 생성은
 * 산출물 파일 캐시가 막는다.
 */
export function newSessionId() {
  return randomUUID();
}

export function runGrok(text, cwd, sessionId) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      "grok",
      ["--permission-mode", "bypassPermissions", "--session-id", sessionId, "--cwd", cwd, "-p", text],
      { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, HOME: GROK_HOME } },
    );
    let out = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 15 * 60 * 1000);
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { out += d.toString(); });
    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`grok exit ${code}: ${out.slice(-400)}`));
      else resolvePromise(out);
    });
  });
}

/** 세션 images/ 에서 가장 최근 파일. grok 은 저장 경로를 인자로 받지 않는다. */
export function newestImage(dir) {
  const images = join(dir, "images");
  if (!existsSync(images)) return null;
  const files = readdirSync(images)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .map((f) => join(images, f))
    .sort();
  return files.at(-1) ?? null;
}

/**
 * 인증 사전 점검. 미인증이면 N장이 각자 N번 실패하며 N분을 태운다. 한 번 물어보고 즉시 멈춘다
 * — grok 은 미인증이면 프롬프트를 실행하지 않고 "Not signed in" 만 낸다.
 */
export async function assertGrokReady(cwd, log) {
  log(`grok home=${GROK_HOME} (auth.json ${existsSync(join(GROK_HOME, ".grok", "auth.json")) ? "있음" : "없음"})`);
  const probe = await runGrok("Reply with exactly: PONG", cwd, newSessionId()).catch(
    (err) => `__FAILED__ ${err.message}`,
  );
  if (!probe.includes("PONG")) {
    throw new Error(
      [
        "grok 사전 점검 실패 — 생성을 시작하지 않고 멈춘다.",
        probe.slice(-300).trim(),
        "",
        `읽은 홈: ${GROK_HOME}/.grok`,
        "미인증이면 `HOME=<실제홈> grok login --device-code` 로 로그인하거나 XAI_API_KEY 를 설정한다.",
        "홈이 틀렸으면 GROK_HOME=<실제홈> 을 넘긴다.",
      ].join("\n"),
    );
  }
  log("사전 점검 통과 — grok 인증 정상");
}
