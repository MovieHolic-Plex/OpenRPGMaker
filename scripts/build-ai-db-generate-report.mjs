import { readFile, writeFile, stat } from "node:fs/promises";

const SHOTS = "verify-shots/ai-db-generate";
const OUT = "reports/ai-db-generate-report.html";

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

async function embed(path) {
  try {
    const bytes = await readFile(path);
    const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
    return `data:${MIME[extension] ?? "image/png"};base64,${bytes.toString("base64")}`;
  } catch {
    return "";
  }
}

async function sizeOf(path) {
  try {
    const info = await stat(path);
    return info.size;
  } catch {
    return 0;
  }
}

function kb(bytes) {
  return `${Math.round(bytes / 1024).toLocaleString("ko-KR")} KB`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
}

async function figure(file, caption, note = "") {
  const src = await embed(`${SHOTS}/${file}`);
  if (!src) return "";
  return `<figure>
  <img src="${src}" alt="${escapeHtml(caption)}">
  <figcaption><strong>${escapeHtml(caption)}</strong>${note ? ` — ${escapeHtml(note)}` : ""}</figcaption>
</figure>`;
}

async function main() {
  const summary = JSON.parse(await readFile(`${SHOTS}/summary.json`, "utf8"));
  const artwork = JSON.parse(await readFile(`${SHOTS}/artwork-manifest.json`, "utf8"));

  const rawEnemy = await embed(`${SHOTS}/raw-enemy-frost-wolf.jpg`);
  const rawItem = await embed(`${SHOTS}/raw-item-hi-potion.jpg`);
  const enemyArt = artwork.find((entry) => entry.slug === "enemy-frost-wolf") ?? {};
  const itemArt = artwork.find((entry) => entry.slug === "item-hi-potion") ?? {};

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI로 몬스터·아이템 만들기 — 작업 보고서</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    background: #f6f7f9; color: #1c2024; margin: 0;
    font: 16px/1.7 "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif;
  }
  main { max-width: 1080px; margin: 0 auto; padding: 40px 24px 80px; }
  h1 { font-size: 30px; line-height: 1.35; margin: 0 0 8px; }
  h2 { font-size: 22px; margin: 48px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #dfe3e8; }
  h3 { font-size: 17px; margin: 28px 0 8px; }
  p { margin: 0 0 14px; }
  .lede { font-size: 18px; color: #3b4450; }
  .card { background: #fff; border: 1px solid #e2e6eb; border-radius: 10px; padding: 20px 22px; margin: 18px 0; }
  .ok { border-left: 5px solid #2e9e5b; }
  .warn { border-left: 5px solid #d99a2b; }
  figure { margin: 20px 0; }
  figure img {
    width: 100%; height: auto; display: block;
    border: 1px solid #d8dde3; border-radius: 8px; background: #fff;
  }
  figcaption { font-size: 14px; color: #5b6572; padding-top: 8px; }
  .pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
  .art { background: #fff; border: 1px solid #d8dde3; border-radius: 8px; padding: 14px; text-align: center; }
  .art img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; background: #fff; }
  th, td { border: 1px solid #dfe3e8; padding: 9px 11px; text-align: left; vertical-align: top; }
  th { background: #eef1f5; }
  code { background: #eceff3; border-radius: 4px; padding: 1px 5px; font-size: 13px; }
  .flow { font-size: 14px; line-height: 2; background: #fff; border: 1px solid #e2e6eb; border-radius: 8px; padding: 16px 20px; }
  ul { margin: 0 0 14px; padding-left: 22px; }
  .muted { color: #6b7480; font-size: 14px; }
</style>
</head>
<body>
<main>

<h1>AI로 몬스터·아이템 만들기</h1>
<p class="lede">데이터베이스에서 설명 한 줄만 쓰면, AI가 <strong>몬스터나 아이템의 값</strong>과 <strong>그림</strong>을 같이 만들어 바로 등록합니다.</p>

<div class="card ok">
<h3 style="margin-top:0">한 줄 요약</h3>
<p style="margin:0">아이템·몬스터 탭에 <code>AI로 생성</code> 버튼이 생겼습니다. 눌러서 “얼음 동굴에 사는 서슬 늑대”처럼 적으면 끝입니다.
스탯·가격 같은 값이 채워지고, 그림도 그려져서 목록 아이콘까지 붙습니다.</p>
</div>

<h2>1. 실제로 써 보면 이렇게 됩니다</h2>
<p>아래 화면은 모두 <strong>실제로 빌드한 편집기</strong>를 브라우저로 돌려 찍은 것입니다. 그림도 진짜 AI가 그린 것입니다.</p>

${await figure("enemy-1-toolbar.png", "① 몬스터 탭 아래에 생긴 「AI로 생성」 버튼", "추가·복제·삭제 옆에 자연스럽게 놓았습니다")}
${await figure("enemy-2-dialog.png", "② 만들고 싶은 걸 그냥 말로 적습니다", "‘그림도 함께 생성’은 기본으로 켜져 있습니다")}
${await figure("enemy-2b-inflight-cancel.png", "③ 만드는 동안 오른쪽 버튼이 「취소」로 바뀝니다", "그림은 1분 넘게 걸릴 수 있어서, 기다리다 그만두는 길을 항상 열어 둡니다. 취소하면 프로젝트에는 아무것도 쓰지 않습니다")}
${await figure("enemy-3-result.png", "④ 완료 — 값이 채워지고 그림이 붙었습니다", `상태줄: ${summary.enemy?.status ?? ""}`)}
${await figure("enemy-4-record.png", "⑤ 목록에도 그림이 달린 새 몬스터가 남습니다", "되돌리기 한 번으로 통째로 취소됩니다")}

<h3>아이템도 똑같습니다</h3>
${await figure("item-2-dialog.png", "⑤ 아이템 설명을 적습니다", "")}
${await figure("item-3-result.png", "⑥ 회복량·가격·설명까지 채워진 아이템", `상태줄: ${summary.item?.status ?? ""}`)}

<h2>2. AI가 그린 그림 (원본)</h2>
<p>편집기가 부른 그림 만들기 요청의 <strong>실제 응답</strong>입니다. 손을 대지 않은 원본입니다.</p>
<div class="pair">
  <div class="art">
    ${rawEnemy ? `<img src="${rawEnemy}" alt="AI가 그린 서슬 늑대">` : ""}
    <p class="muted" style="margin:10px 0 0">서슬 늑대 · ${kb(enemyArt.bytes ?? 0)} · ${escapeHtml(enemyArt.mimeType ?? "")}<br>${escapeHtml(enemyArt.model ?? "")} · ${Math.round((enemyArt.elapsedMs ?? 0) / 1000)}초</p>
  </div>
  <div class="art">
    ${rawItem ? `<img src="${rawItem}" alt="AI가 그린 상급 회복약">` : ""}
    <p class="muted" style="margin:10px 0 0">상급 회복약 · ${kb(itemArt.bytes ?? 0)} · ${escapeHtml(itemArt.mimeType ?? "")}<br>${escapeHtml(itemArt.model ?? "")} · ${Math.round((itemArt.elapsedMs ?? 0) / 1000)}초</p>
  </div>
</div>
<p>받은 그림은 흰 배경이라 그대로 쓰면 전투 화면에서 흰 네모가 보입니다. 그래서 <strong>테두리에서 이어진 흰 부분만 지워</strong> 투명하게 바꿔 저장합니다.
가운데 눈처럼 <em>안쪽에 갇힌</em> 흰색은 건드리지 않습니다.</p>

<h2>3. 어떻게 돌아가나 (짧게)</h2>
<div class="flow">
편집기 화면 → <code>/v1/images/generations</code> → 동반 서비스 → Bun 워커 → Antigravity(구독 로그인) → 그림<br>
편집기 화면 → <code>/v1/chat/completions</code> → 같은 길 → 몬스터·아이템 값(JSON)
</div>
<p>새로 만든 저장 경로는 <strong>없습니다.</strong> 이미 있던 <code>upsert_resource</code> → <code>upsert_item</code>/<code>upsert_enemy</code> 를 그대로 쓰고,
셋을 한 덩어리로 묶어서 <strong>되돌리기 한 번</strong>에 전부 취소되게 했습니다.</p>

<div class="card warn">
<h3 style="margin-top:0">그림은 왜 Antigravity 로만 가나</h3>
<p style="margin:0">편집기에 로그인되는 건 Codex 와 Antigravity 둘입니다. 그런데 지금 쓰는 전송 라이브러리(pi-ai)에는
<strong>Codex 쪽에 그림 그리기를 요청할 방법이 없습니다</strong>(하드툴 자리에 <code>computer</code> 하나만 있습니다).
그래서 대화는 고른 제공자로 하고 <strong>그림만 Antigravity 로 보냅니다.</strong> 모달에도 그 사실을 적어 둡니다.
Codex 가 열리면 바꿀 자리는 한 파일(<code>ohMyPiImageRuntime.ts</code>)입니다.</p>
</div>

<h2>4. 검증</h2>
<table>
<tr><th>무엇을</th><th>어떻게</th><th>결과</th></tr>
<tr><td>타입</td><td><code>npm run gates</code> · typecheck:app</td><td>오류 0</td></tr>
<tr><td>CSS · 표면</td><td><code>gates</code> css / surface</td><td>0 / 0</td></tr>
<tr><td>새·갱신 테스트</td><td>생성 로직·이미지 클라이언트·배경 지우기·지연 import</td><td>vitest 31건 통과</td></tr>
<tr><td>전송 계층 테스트</td><td>modality 주입 · inlineData 수확 · 자격 실패 401 · 워커 <code>/image</code></td><td><code>test:oh-my-pi</code> 통과</td></tr>
<tr><td>테스트 회귀</td><td>기준 커밋 정본 체크아웃과 같은 조건에서 대조</td><td><strong>없음</strong> (실패 7건이 양쪽에서 동일)</td></tr>
<tr><td>그림 만들기 (실제)</td><td>동반 서비스로 진짜 요청</td><td>2장 성공 (${kb((enemyArt.bytes ?? 0) + (itemArt.bytes ?? 0))})</td></tr>
<tr><td>출하 번들 부팅</td><td>빌드 후 정적 서버에서 실제 부팅</td><td>오류 0 (아래 참고)</td></tr>
<tr><td>화면 확인</td><td>빌드한 편집기로 전 과정 캡처</td><td>콘솔 오류 0건</td></tr>
</table>

<div class="card">
<h3 style="margin-top:0">중간에 잡은 실제 결함</h3>
<p style="margin:0 0 10px"><strong>출하 번들만 부팅이 깨졌습니다.</strong> 모달을 평소처럼 <code>import</code> 로 붙였더니
빌드는 통과하는데 실제 번들을 열면 <code>Cannot read properties of undefined (reading 'deprecated')</code> 로 죽었습니다.
모달이 툴 목록까지 끌어와 초기화 순서가 꼬인 것입니다.</p>
<p style="margin:0 0 10px">타입검사·단위테스트·CSS 게이트는 <strong>전부 초록</strong>이었습니다. 개발 서버와 테스트는 이 꼬임을 견디기 때문입니다.
기준 커밋을 따로 빌드해 부팅시켜 비교하고 나서야 “내가 만든 문제”라고 확정했습니다.</p>
<p style="margin:0">고친 방법은 <strong>버튼을 누를 때 모달을 불러오도록</strong> 바꾼 것이고, 같은 실수가 다시 들어오면 깨지는 테스트를 함께 넣었습니다.</p>
</div>

<div class="card">
<h3 style="margin-top:0">검토에서 고친 것 8가지</h3>
<p style="margin:0 0 10px" class="muted">엄격한 검토를 4번 돌렸습니다. 아래는 검토가 잡아낸 실제 결함이고, 전부 고친 뒤 승인받았습니다.</p>
<ul>
<li><strong>취소를 막고 있었습니다.</strong> 만드는 동안 닫기 버튼이 잠겨서, 1분 넘게 걸리는 요청을 그만둘 방법이 없었습니다 → 「취소」로 바꿔 항상 누를 수 있게 했습니다.</li>
<li><strong>취소를 “시간 초과”라고 알렸습니다.</strong> 사용자가 직접 취소한 것과 진짜 시간 초과를 구분해 다르게 씁니다.</li>
<li><strong>“취소하면 안 써진다”를 말로만 했습니다.</strong> 그림이 다 온 뒤에 취소한 경우까지 테스트로 고정했습니다.</li>
<li><strong>제일 위험한 코드에 테스트가 없었습니다.</strong> 그림 전송 부분(184줄)에 실제 pi-ai 를 태운 테스트를 붙였습니다.</li>
<li><strong>로그인 안 됐을 때 영어가 나왔습니다.</strong> <code>Use /login to re-authenticate.</code> 라는, 이 제품에 없는 명령을 안내하고 있었습니다 → 한국어로 <em>AI 설정 → Google Antigravity 로그인</em> 을 안내합니다.</li>
<li><strong>실패 종류를 잘못 짚었습니다.</strong> 그림이 안전 정책으로 막힌 경우까지 “로그인하세요”라고 잘못 안내했습니다 → 실제 서버 응답 상태로 구분합니다.</li>
<li><strong>한 줄이 사라져도 아무도 몰랐습니다.</strong> 그림 전송에 꼭 필요한 코드 한 줄을 지워도 테스트가 통과했습니다 → 지우면 빨갛게 죽는 테스트를 만들었습니다.</li>
<li><strong>한 번도 로그인 안 한 사람이 빠졌습니다.</strong> 가장 흔한 상태인데, 여기서만 다시 영어가 새어 나왔습니다 → 구조로 막았습니다.</li>
</ul>
</div>

<h2>5. 건드린 파일</h2>
<table>
<tr><th>파일</th><th>왜</th></tr>
<tr><td><code>scripts/lib/ohMyPiImageRuntime.ts</code></td><td>그림 만들기 본체 (새로 만듦)</td></tr>
<tr><td><code>scripts/lib/ohMyPiHttp.mjs</code> · <code>ohMyPiPiAi.mjs</code> · <code>oh-my-pi-worker.ts</code></td><td><code>/v1/images/generations</code> 길 연결</td></tr>
<tr><td><code>src/ai/imageGenerationClient.ts</code></td><td>브라우저에서 그림 요청</td></tr>
<tr><td><code>src/editor/aiDatabaseGeneration.ts</code></td><td>값 만들기 → 그림 → 등록까지 묶는 곳</td></tr>
<tr><td><code>src/assets/generatedArtworkAlpha.ts</code> · <code>src/editor/aiArtworkCanvas.ts</code></td><td>흰 배경 지우기</td></tr>
<tr><td><code>src/editor/panels/databaseAiGenerateDialog.ts</code></td><td>모달 화면</td></tr>
<tr><td><code>src/editor/panels/databaseRecordViews.ts</code></td><td><code>AI로 생성</code> 버튼</td></tr>
<tr><td><code>src/styles/database/enemies.part-1.css</code></td><td>모달 안 입력칸·미리보기 모양</td></tr>
<tr><td><code>openwiki/editor-database.md</code> · <code>editor-ai-tools.md</code></td><td>다음 사람이 읽을 기록</td></tr>
</table>

<p class="muted">보고서 생성 시각: ${new Date().toLocaleString("ko-KR")} · 화면 캡처 기준: <code>${escapeHtml(summary.base ?? "")}</code></p>

</main>
</body>
</html>
`;

  await writeFile(OUT, html, "utf8");
  console.log(`[report] ${OUT} (${kb(Buffer.byteLength(html))})`);
}

await main();
