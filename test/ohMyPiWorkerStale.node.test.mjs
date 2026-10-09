import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

// 저장소(자격 파일 경로)는 모듈 로드 시점에 정해지므로 env 가 import 보다 먼저다 — static import 는
// 모듈 본문보다 먼저 평가되니 동적 import 를 쓴다.
const dir = mkdtempSync(join(tmpdir(), "rpgzzu-worker-stale-"));
process.env.OPRN_OH_MY_PI_AUTH_PATH = join(dir, "auth.json");
process.env.OPRN_OH_MY_PI_TEST_STUB = "1";

// 기동 횟수를 세는 스텁 워커. 진짜 워커 대신 띄우므로 «새 프로세스가 떴는가» 만 관측한다 —
// 모델 호출은 이 테스트의 대상이 아니다.
const spawnLog = join(dir, "spawns.log");
const stubWorker = join(dir, "stub-worker.mjs");
writeFileSync(stubWorker, [
  'import { appendFileSync } from "node:fs";',
  'import { createServer } from "node:http";',
  `appendFileSync(${JSON.stringify(spawnLog)}, "spawn\\n");`,
  "const server = createServer((req, res) => {",
  '  req.on("data", () => {});',
  '  req.on("end", () => { res.setHeader("Content-Type", "application/json");',
  '    res.end(JSON.stringify({ provider: "stub", completion: { choices: [{ message: { content: "stub" } }] } })); });',
  "});",
  'server.listen(0, "127.0.0.1", () => { console.log(`READY ${server.address().port}`); });',
  "",
].join("\n"));
// `exec` 로 셸 자신을 대신시킨다: 셸을 남기면 kill 이 셸에만 닿아 자식이 살아남고, 그 자식이
// 물고 있는 stdio 파이프가 node 테스트 프로세스를 끝나지 않게 붙잡는다(실측: 테스트는 통과했는데
// 프로세스가 안 끝났다).
process.env.OPRN_OH_MY_PI_WORKER_COMMAND = `exec ${process.execPath} ${stubWorker}`;

const { createOhMyPiAdapters, markOhMyPiWorkerStale, stopOhMyPiWorker } = await import("../scripts/lib/ohMyPiPiAi.mjs");

function spawnCount() {
  try {
    return readFileSync(spawnLog, "utf8").split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

// Break: 워커는 모듈 그래프를 부팅 때 한 번 로드하는 오래 사는 자식 프로세스다. 코드가 바뀌어도
// 살아 있는 워커가 옛 판정·옛 병합을 계속 돌면, 픽스를 받은 편집기가 같은 오류를 그대로 재현한다.
// 실측(2026-09-14): 맵 묶음 병합 픽스 이후에도 `적용 실패(commit-rejected): 직렬화 왕복 실패:
// setSwitch: switchId가 존재하지 않습니다: sw_ev_battle_<uuid>_clear` 가 그대로 나왔다.
describe("oh-my-pi 워커 코드 갱신", () => {
  after(() => {
    stopOhMyPiWorker();
    delete process.env.OPRN_OH_MY_PI_TEST_STUB;
    delete process.env.OPRN_OH_MY_PI_WORKER_COMMAND;
    rmSync(dir, { recursive: true, force: true });
  });

  it("코드 변경 표시 뒤의 첫 요청만 워커를 새로 띄운다", async () => {
    const adapters = await createOhMyPiAdapters();
    const complete = () => adapters.complete("google-antigravity", { model: "m", messages: [{ role: "user", content: "hi" }] });

    const first = await complete();
    assert.equal(first.completion.choices[0].message.content, "stub");
    assert.equal(spawnCount(), 1, "첫 요청이 워커를 띄운다");

    // 살아 있는 워커는 재사용한다 — 매 요청마다 띄우면 모델 로딩을 요청마다 다시 한다.
    await complete();
    assert.equal(spawnCount(), 1, "바뀐 것이 없으면 같은 워커를 쓴다");

    markOhMyPiWorkerStale();
    await complete();
    assert.equal(spawnCount(), 2, "코드가 바뀌면 다음 요청이 새 코드로 돈다");

    // 표시는 한 번만 쓰인다 — 새 워커가 뜬 뒤의 다음 요청은 또 띄우지 않는다.
    await complete();
    assert.equal(spawnCount(), 2, "갱신 표시는 새 워커가 뜨면 사라진다");
  });
});
