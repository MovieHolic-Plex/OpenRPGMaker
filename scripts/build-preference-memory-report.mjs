/**
 * 사람 성향 기억 보고서 생성. output/evidence/ai-preference-memory/ 의 실측 증거를 읽어
 * 자체 완결 HTML 한 파일로 굽는다(이미지 base64 인라인 — 외부 창에서 열어도 안 깨진다).
 *
 * 사용: node scripts/build-preference-memory-report.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const EV = "output/evidence/ai-preference-memory";
const OUT = "docs/2026-08-30-ai-preference-memory-report.html";

const evidence = JSON.parse(await readFile(path.join(EV, "evidence.json"), "utf8"));

async function img(name) {
  const buf = await readFile(path.join(EV, name));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

const esc = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const shots = {};
for (const name of [
  "01-editor-overview.png",
  "02-preference-empty.png",
  "03-preference-manual-added.png",
  "04-preference-two-tiers.png",
  "04b-preference-in-composer.png",
  "05-preference-pinned.png",
  "06-preference-deleted.png",
  "07-chat-memory-bubble.png",
  "07b-chat-panel-full.png",
  "08-preference-survives-new-project.png",
]) {
  shots[name] = await img(name);
}

const figure = (name, caption, note = "") => `
<figure class="shot">
  <img src="${shots[name]}" alt="${esc(caption)}">
  <figcaption><b>${esc(caption)}</b>${note ? ` <span class="note">${note}</span>` : ""}</figcaption>
</figure>`;

const CHANNEL_LABEL = [
  { match: "개발 어시스턴트", short: "채팅", label: "사람과 대화" },
  { match: "작업 성향을 정리하는 요약기", short: "성향 증류", label: "배경 작업" },
  { match: "tileset metadata", short: "타일셋 분석", label: "그림 분류" },
];

const rows = evidence.captured
  .map((c) => {
    const found = CHANNEL_LABEL.find((entry) => c.systemPromptHead.includes(entry.match));
    const url = new URL(c.url);
    return `<tr>
      <td class="chan-cell"><b>${esc(found?.short ?? "?")}</b><br><span class="muted">${esc(found?.label ?? "")}</span></td>
      <td><code>${esc(url.pathname)}</code></td>
      <td><code>${esc(c.headers["x-rpgzzu-provider"] ?? "—")}</code></td>
      <td>${c.headers.authorization ? '<span class="bad">있음</span>' : '<span class="ok">없음</span>'}</td>
      <td>${c.maxTokens ?? "—"}</td>
      <td>${c.temperature ?? "—"}</td>
      <td>${c.responseFormat ? `<code>${esc(c.responseFormat.type)}</code>` : "—"}</td>
      <td>${c.systemPromptChars.toLocaleString("ko-KR")}자</td>
      <td>${c.userContentKinds.map((k) => `<code>${esc(k)}</code>`).join("<br>")}</td>
    </tr>`;
  })
  .join("\n");

const signalRows = evidence.signals.scenarios
  .map(
    (s) => `<tr>
      <td><b>${esc(s.name)}</b></td>
      <td>${s.story.map((line) => esc(line)).join("<br>")}</td>
      <td>${s.counters.length ? s.counters.map((c) => `<code>${esc(c)}</code>`).join("<br>") : "<span class=\"muted\">변화 없음</span>"}</td>
      <td>${s.pending.length ? s.pending.map((p) => `<code>${esc(p)}</code>`).join("<br>") : "<span class=\"muted\">없음</span>"}</td>
    </tr>`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI 가 사람 성향을 기억한다 — 실측 보고서</title>
<style>
:root{
  --bg-base:#F7F8F8; --bg-raised:#FFFFFF; --bg-inset:#EEF1F4;
  --border-subtle:rgba(15,23,42,.08); --border-default:rgba(15,23,42,.127);
  --text-1:#0F172A; --text-2:#475569; --text-3:#626E89;
  --accent:#4A57D6; --accent-muted:rgba(74,87,214,.10); --accent-border:rgba(74,87,214,.45);
  --danger:#C6403D; --danger-muted:rgba(198,64,61,.10);
  --success:#18764F; --success-muted:rgba(24,118,79,.10);
  --warning:#8A5E00; --warning-muted:rgba(138,94,0,.10);
  --radius-s:6px; --radius-m:10px; --radius-l:14px;
  --shadow-pop:0 4px 12px rgba(15,23,42,.08),0 12px 32px rgba(15,23,42,.10);
  --font-ui:system-ui,"Pretendard","Apple SD Gothic Neo","Malgun Gothic",-apple-system,"Segoe UI",sans-serif;
  --font-mono:"JetBrains Mono","SFMono-Regular",Consolas,"Liberation Mono",monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg-inset);color:var(--text-1);font-family:var(--font-ui);
     font-size:15.5px;line-height:1.72;-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding:0 28px 120px}
header.doc{padding:60px 0 34px;border-bottom:1px solid var(--border-subtle)}
.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:700}
h1{font-size:36px;line-height:1.22;margin:14px 0 14px;letter-spacing:-.02em}
.lede{font-size:18px;color:var(--text-2);margin:0;max-width:74ch}
.meta{margin-top:26px;display:flex;flex-wrap:wrap;gap:8px}
.meta span{background:var(--bg-raised);border:1px solid var(--border-subtle);border-radius:999px;
           padding:5px 13px;font-size:12.5px;color:var(--text-3)}
.meta code{font-size:12px}
h2{font-size:25px;margin:58px 0 6px;letter-spacing:-.015em}
h2 .num{color:var(--accent);font-variant-numeric:tabular-nums;margin-right:10px}
h3{font-size:17.5px;margin:34px 0 8px}
p{margin:12px 0;max-width:78ch}
.sub{color:var(--text-2);margin-top:2px;max-width:78ch}
code{font-family:var(--font-mono);font-size:.875em;background:var(--bg-raised);
     border:1px solid var(--border-subtle);border-radius:5px;padding:1px 5px}
pre{background:#111827;color:#E5E7EB;border-radius:var(--radius-m);padding:18px 20px;
    overflow-x:auto;font-family:var(--font-mono);font-size:13.5px;line-height:1.62;margin:16px 0}
pre code{background:none;border:none;padding:0;color:inherit;font-size:inherit}
pre .hl{color:#FDE68A}
pre .dim{color:#9CA3AF}
table{width:100%;border-collapse:collapse;margin:18px 0;background:var(--bg-raised);
      border:1px solid var(--border-subtle);border-radius:var(--radius-m);overflow:hidden;font-size:14px}
th,td{text-align:left;padding:11px 13px;border-bottom:1px solid var(--border-subtle);vertical-align:top}
th{background:var(--bg-base);font-size:12.5px;color:var(--text-3);font-weight:700;white-space:nowrap}
tr:last-child td{border-bottom:none}
td code{font-size:12.5px;white-space:nowrap}
.scroll{overflow-x:auto;margin:18px 0}
.scroll table{margin:0;min-width:820px}
td.chan-cell{white-space:nowrap}
td.chan-cell .muted{font-size:12px}
figure.shot{margin:22px 0 26px;background:var(--bg-raised);border:1px solid var(--border-subtle);
            border-radius:var(--radius-l);padding:14px;box-shadow:var(--shadow-pop)}
figure.shot img{display:block;width:100%;height:auto;border-radius:var(--radius-s);
                border:1px solid var(--border-subtle)}
figure.shot figcaption{margin-top:12px;font-size:13.5px;color:var(--text-2);line-height:1.6}
figure.shot figcaption b{color:var(--text-1)}
figure.shot .note{color:var(--text-3)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:22px 0;align-items:start}
.grid2 > *{min-width:0}
.grid2 figure.shot{margin:0}
h4.chan{font-size:15px;margin:30px 0 0;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.tag{font-size:11.5px;font-weight:700;letter-spacing:.02em;border-radius:999px;padding:2px 9px}
.tag.on{background:var(--success-muted);color:var(--success)}
.tag.off{background:var(--bg-inset);color:var(--text-3)}
@media (max-width:820px){.grid2{grid-template-columns:1fr}}
.callout{border-left:3px solid var(--accent);background:var(--accent-muted);
         border-radius:0 var(--radius-m) var(--radius-m) 0;padding:14px 18px;margin:20px 0}
.callout.warn{border-left-color:var(--warning);background:var(--warning-muted)}
.callout.stop{border-left-color:var(--danger);background:var(--danger-muted)}
.callout p{margin:6px 0}
.callout p:first-child{margin-top:0}
.callout p:last-child{margin-bottom:0}
.ok{color:var(--success);font-weight:700}
.bad{color:var(--danger);font-weight:700}
.muted{color:var(--text-3)}
ul,ol{max-width:78ch;padding-left:22px}
li{margin:6px 0}
.ba{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--border-subtle);
    border-radius:var(--radius-m);overflow:hidden;margin:20px 0;background:var(--bg-raised)}
.ba > div{padding:18px 20px}
.ba > div:first-child{border-right:1px solid var(--border-subtle);background:var(--danger-muted)}
.ba > div:last-child{background:var(--success-muted)}
.ba h4{margin:0 0 10px;font-size:13px;letter-spacing:.08em;text-transform:uppercase}
.ba > div:first-child h4{color:var(--danger)}
.ba > div:last-child h4{color:var(--success)}
.ba p{margin:8px 0;font-size:14.5px}
@media (max-width:820px){.ba{grid-template-columns:1fr}.ba > div:first-child{border-right:none;border-bottom:1px solid var(--border-subtle)}}
footer.doc{margin-top:80px;padding-top:26px;border-top:1px solid var(--border-subtle);
           font-size:13px;color:var(--text-3)}
footer.doc code{font-size:12px}
</style>
</head>
<body>
<div class="wrap">

<header class="doc">
  <div class="eyebrow">RPG-ZZU · 에디터 AI</div>
  <h1>AI 가 사람의 성향을 기억한다</h1>
  <p class="lede">
    같은 말을 매번 다시 하지 않아도 되게 만들었다. 되돌리기·정정·직접 선언을 보고 취향을 익히고,
    그 취향을 모든 AI 창이 같은 자리에서 읽는다. 아래는 전부 실제로 돌려서 찍은 화면과 실제 요청 기록이다.
  </p>
  <div class="meta">
    <span>작성 2026-08-30</span>
    <span>브랜치 <code>rpg-zzu/ai</code></span>
    <span>기준 커밋 <code>8c025196</code></span>
    <span>스크린샷 10장 · 실제 요청 3건</span>
    <span>새 테스트 100건</span>
  </div>
</header>

<h2><span class="num">01</span>무엇이 불편했나</h2>
<p>두 가지 불만이 있었다. 하나는 <b>AI 창이 여러 군데 있는데 서로 딴 사람처럼 행동한다</b>는 것, 다른 하나는
<b>AI 가 내 취향을 하나도 기억하지 못한다</b>는 것이었다. 코드를 열어 보니 층이 다른 문제였다.</p>

<div class="ba">
  <div>
    <h4>전 — 기억 0건</h4>
    <p>AI 가 아는 것은 지금 프로젝트의 스냅샷과 <b>이번 대화</b>뿐이었다. 창을 닫으면 다 사라졌다.</p>
    <p>“마을 좀 작게”를 어제도 했고 오늘도 해야 했다. 되돌린 것도 기억하지 못해 같은 걸 또 만들었다.</p>
    <p>대화 기록은 남았지만 <b>다음 요청에 다시 들어가는 길이 아예 없었다.</b></p>
  </div>
  <div>
    <h4>후 — 관측해서 기억한다</h4>
    <p>되돌리기·정정 발화·명시 선언을 세어 두고, 근거가 쌓이면 한 문장으로 굳혀 저장한다.</p>
    <p>프로젝트를 바꿔도 사람 취향은 남고, 그 게임에서만 참인 사실은 그 게임에만 남는다.</p>
    <p>기억한 것은 <b>목록으로 보이고, 고정하거나 지울 수 있다.</b></p>
  </div>
</div>

<p>“통합된 라우트가 아니다”는 절반은 이미 해결돼 있었다. 실제 전송은 <code>chatCompletion</code> 함수 하나로 모여 있었고
빠져나간 파일이 딱 하나였다(타일셋 AI). 진짜로 갈라져 있던 건 <b>프롬프트</b>였다 — 독립 시스템 프롬프트가 5종 돌면서
UX 정책도 성향도 못 받고 있었다. 그래서 이번에 <b>봉투</b>를 하나 만들어 전부 그리로 통과시켰다.</p>

${figure("01-editor-overview.png", "작업한 에디터 전체 화면", "가운데 AI 채팅 패널. 성향 목록은 이 패널 하단 <code>⌾</code> 버튼에서 열린다. 여기서 아래 모든 화면이 나온다.")}

<h2><span class="num">02</span>AI 가 성향을 배우는 과정</h2>
<p>처음에는 아무것도 모른다. 빈 화면만 보여 주면 고장난 것처럼 읽히니까, <b>왜 비어 있는지</b>를 적었다.</p>

${figure("02-preference-empty.png", "아직 배운 게 없을 때", "“작업을 되돌리거나 <code>항상 ~로 해줘</code>처럼 말하면 AI 가 취향을 익힙니다” — 무엇을 하면 채워지는지 알려 준다.")}

<p>그 다음 채팅에 이렇게 한 줄 보냈다. <b>“앞으로 마을은 항상 집 4채 이하로 작게 만들어 줘”</b>.
<code>항상</code>·<code>앞으로</code> 같은 말은 “명시 선언”으로 잡히고, 이 경우엔 근거가 쌓이길 기다리지 않고
<b>바로</b> 성향으로 굳힌다. 그리고 조용히 배우지 않는다 — 배운 걸 한 줄로 알린다.</p>

${figure("07-chat-memory-bubble.png", "배운 즉시 알린다", "맨 아래 <code>성향 1건을 기억했습니다. (아래 ⌾ 버튼에서 확인·삭제 가능)</code>. 몰래 학습하면 사람이 통제 불가로 느낀다.")}

<div class="callout warn">
  <p><b>화면 속 “미이행” 경고에 대해.</b> 이 캡처는 자격증명 없이 돌리려고 LLM 응답을 가짜로 끼워 넣었다.
  가짜 응답이 툴 호출을 하나도 안 해서 완성도 린트가 “변경 0건”을 지적한 것이다. 성향 기억과는 무관한,
  스텁 때문에 생긴 부수 효과다.</p>
</div>

<h2><span class="num">03</span>기억한 성향은 두 층으로 나뉜다</h2>
<p>취향에는 두 종류가 있다. <b>사람의 습관</b>(어느 게임을 만들어도 같음)과 <b>이 게임에서만 참인 사실</b>(장르·톤)이다.
섞으면 호러 게임에서 배운 걸 동화 게임에 들이민다. 그래서 갈라 놨다.</p>

${figure("04-preference-two-tiers.png", "전역 3건 + 이 프로젝트 1건", "각 줄에 <b>강도</b>(강함/보통)와 <b>근거 수</b>가 붙는다. 왜 이 성향이 센지 알 수 있어야 지울지 말지 판단이 된다.")}

${figure("04b-preference-in-composer.png", "채팅창 안에서의 위치", "컴포저 액션 행의 <code>⌾</code> 버튼과 그 위로 열린 팝오버. 새 창을 만들지 않고 이미 있던 팝오버 기계에 한 종류를 더했다.")}

<h2><span class="num">04</span>무엇을 보고 배우나</h2>
<p>말투를 짐작하지 않는다. <b>실제로 일어난 일</b>을 센다. 채팅 제안은 자동 적용되니까 가장 센 부정 신호는
“거절”이 아니라 <b>되돌리기</b>다. 아래는 실제 모듈을 브라우저에서 돌려 찍은 결과다.</p>

<div class="scroll">
<table>
<thead><tr><th>상황</th><th>사람이 한 일</th><th>집계 변화</th><th>증류 대기줄</th></tr></thead>
<tbody>
${signalRows}
</tbody>
</table>
</div>

<p>읽는 법: <code>tool:author_house</code> 는 “집 짓는 툴”, <code>scale:large</code> 는 “크게 만들라는 축”이다.
되돌리면 <b>−3</b>, 말로만 정정하면 <b>−2</b>, 아무 불만 없이 지나가면 <b>+1</b>.
같은 턴을 되돌리고 또 불만을 말해도 <b>두 번 세지 않는다</b>(두 번째 줄).
정정은 <b>${evidence.signals.windowMs / 1000}초</b> 안에 한 말만 본다 — 한참 뒤의 “아니”는 다른 얘기다(마지막 줄).</p>

<p>대기줄이 <b>${evidence.signals.threshold}건</b> 차거나 명시 선언이 들어오면, 작은 모델을 한 번 불러
숫자 뭉치를 사람이 읽을 문장으로 바꾼다. 그 호출이 실패하면 조용히 넘어간다 — 숫자는 이미 저장돼 있으니 잃는 게 없다.</p>

<h3>정정으로 잡는 말</h3>
<p>${evidence.signals.cues.correction.map((c) => `<code>${esc(c)}</code>`).join(" · ")}</p>
<h3>명시 선언으로 잡는 말</h3>
<p>${evidence.signals.cues.stated.map((c) => `<code>${esc(c)}</code>`).join(" · ")}</p>

<h2><span class="num">05</span>기억한 성향이 실제로 요청에 실린다</h2>
<p>저장만 하고 안 쓰면 의미가 없다. 아래는 브라우저에서 실제 함수를 불러 받아 온
<b>진짜 프롬프트 블록</b>이다(${evidence.prompt.memorySectionChars}자).</p>

<pre><code>${esc(evidence.prompt.memorySection)}</code></pre>

<div class="callout">
  <p><b>둘째 줄이 제일 중요하다.</b> <span class="hl">“이번 지시와 충돌하면 <b>지시가 우선</b>한다”</span>
  가 없으면 과거 취향이 지금 시킨 일을 이긴다. “이번엔 크게 만들어 줘”라고 했는데 AI 가 “작게 하는 걸 좋아하시죠?”라고
  되묻는 상황 — 그게 기억 기능이 미움받는 방식이다. 이 문장은 선택이 아니라 필수로 박아 뒀고 테스트가 지킨다.</p>
</div>

<p>그리고 이 블록은 <b>글자 예산 밖</b>에 있다. 프롬프트가 길어지면 앱이 뒤에서부터 잘라내는데,
성향이 잘려 나가면 “기억을 못 한다”가 그대로 재발한다. 예산을 500자로 극단적으로 줄여도 살아남는지를 테스트가 확인한다.</p>

<h3>창마다 다른 것만 다르게 넣는다</h3>
<p>같은 봉투를 쓰지만 채널 성격에 맞게 켜고 끈다. 아래 두 개를 나란히 보면 규칙이 보인다.</p>

<h4 class="chan">이벤트 명령 변환 <span class="tag on">성향 넣음</span> <span class="tag off">말투 정책 끔</span></h4>
<pre><code>${esc(evidence.prompt.eventCommand)}</code></pre>
<p class="sub">사람에게 문장을 돌려주지 않는 변환 채널이라 말투 정책은 끈다. 취향은 결과물에 영향을 주니 넣는다.</p>

<h4 class="chan">타일셋 분석 <span class="tag off">성향 끔</span> <span class="tag off">말투 정책 끔</span></h4>
<pre><code>${esc(evidence.prompt.tileset)}</code></pre>
<p class="sub">결과가 스키마 고정 JSON 이다. 사람 취향이 타일 분류에 개입할 자리가 없고, 말투 규칙은 JSON 출력과 충돌한다.
봉투를 지났지만 <b>본문만 남는다</b> — 그게 “한 곳에서 조립한다”와 “아무데나 다 넣는다”의 차이다.</p>

<p class="sub">계획을 세우는 내부 모듈과 대화를 압축하는 요약기에는 <b>일부러 안 씌웠다</b>. 사람과 대화하지 않는 부품이고,
취향을 넣으면 계획과 요약이 취향으로 오염된다.</p>

<h2><span class="num">06</span>내가 지우고 고정할 수 있다</h2>
<p>관측으로 굳힌 것이라 사람이 명시적으로 입력한 적이 없다. 그래서 <b>보이고 되돌릴 수 있어야</b> 한다.</p>

<div class="grid2">
${figure("03-preference-manual-added.png", "직접 써서 넣기", "손으로 쓴 것은 <b>전역·강함·고정</b>으로 들어간다. 관측보다 세야 하고, 다음 증류가 지워 버리면 입력칸이 무의미해진다.")}
${figure("05-preference-pinned.png", "고정", "고정한 줄은 증류가 지우지 못하고 상한을 넘겨도 밀려나지 않는다. 버튼은 <code>aria-pressed</code> 로 상태를 알린다.")}
</div>

${figure("06-preference-deleted.png", "삭제", `삭제를 누르면 저장소에서 바로 사라지고 목록이 즉시 갱신된다(${evidence.rowsBeforeDelete}줄 → ${evidence.rowsAfterDelete}줄). 전체 비우기도 있다.`)}

<h2><span class="num">07</span>프로젝트가 섞이지 않는다</h2>
<p>다른 게임에서 배운 “이 게임 한정” 사실이 이 게임에 나타나면 그건 유출이다. 실제로 다른 프로젝트 키를 가진
성향을 하나 심어 놓고 확인했다 — 화면에 <b>나타나지 않았다</b>(<span class="ok">${esc(evidence.leakCheck)}</span>).</p>

<div class="scroll">
<table>
<thead><tr><th>조회 키</th><th>전역 (사람 취향)</th><th>이 프로젝트 한정</th></tr></thead>
<tbody>
<tr>
  <td><code>이 프로젝트</code></td>
  <td>${evidence.afterReload.sameProject.global.map((f) => esc(f)).join("<br>")}</td>
  <td>${evidence.afterReload.sameProject.project.map((f) => esc(f)).join("<br>")}</td>
</tr>
<tr>
  <td><code>다른 프로젝트</code></td>
  <td>${evidence.afterReload.otherProject.global.map((f) => esc(f)).join("<br>")}</td>
  <td>${evidence.afterReload.otherProject.project.map((f) => esc(f)).join("<br>")}</td>
</tr>
<tr>
  <td><code>키 없음</code></td>
  <td>${evidence.afterReload.noKey.global.map((f) => esc(f)).join("<br>")}</td>
  <td><span class="muted">없음 — 모르면 안 보여 준다</span></td>
</tr>
</tbody>
</table>
</div>

<p>왼쪽 칸은 세 줄이 똑같고 오른쪽 칸만 갈린다. 그게 “사람 전역 + 프로젝트 오버레이” 2층 구조가 맞게 도는 모습이다.</p>

${figure("08-preference-survives-new-project.png", "새 세션에서 다시 열었을 때", `브라우저를 새로 띄우고 다시 열어도 그대로 있다. 첫 줄 <b>근거가 4에서 5로</b> 올라간 것은, 위 채팅 턴에서 배운 같은 취향이 새 줄을 만들지 않고 기존 줄의 근거를 보탰기 때문이다.`)}

<h2><span class="num">08</span>AI 창이 전부 같은 길로 나간다</h2>
<p>“통합된 라우트가 아닌 것 같다”가 원래 불만이었다. 확인 방법은 하나다 — 실제로 나가는 요청을 잡아서 비교하는 것.
성격이 완전히 다른 세 채널을 각각 한 번씩 돌리고 요청을 그대로 기록했다.</p>

<div class="scroll">
<table>
<thead><tr>
  <th>채널</th><th>주소</th><th>제공자 헤더</th><th>인증 헤더</th>
  <th>토큰 상한</th><th>온도</th><th>응답 형식</th>
  <th>프롬프트 길이</th><th>본문 종류</th>
</tr></thead>
<tbody>
${rows}
</tbody>
</table>
</div>

<p>왼쪽 네 칸이 세 줄 모두 같다 — 같은 주소, 같은 제공자 헤더, 같은 인증 방식(구독 로그인이라 인증 헤더가 없는 것이
정상이다), 모델도 셋 다 <code>${esc(evidence.captured[0]?.model ?? "—")}</code> 하나다. 다른 것은 그 채널이
<b>의도적으로</b> 다르게 요청한 값뿐이다 — 타일셋만 토큰 상한 <code>8192</code>(매핑 JSON 이 길어서),
온도 <code>0.2</code>(분류라 흔들리면 안 돼서), 그림을 같이 보내니 본문에 <code>image_url</code> 이 붙는다.</p>

<div class="callout">
  <p><b>왜 이게 중요한가.</b> 이 타일셋 파일은 예전에 자기 손으로 헤더를 조립하고 있었다.
  그래서 에디터 AI 가 로그인 방식을 바꿨을 때 <b>여기만 갱신에서 빠져 무증상으로 죽어 있었다</b>(2026-08-21 실측).
  이번에 사본을 다 지우고 공용 전송으로 넘겼다. 덤으로 자동 재시도 1회, 타임아웃, 전송 건강 보고가 따라붙었고,
  실패 문구도 <code>HTTP 400 …</code> 덤프 대신 “무엇을 하라”는 안내로 바뀐다.</p>
</div>

<h2><span class="num">09</span>지금 못 하는 것</h2>
<div class="callout stop">
  <p><b>기기를 옮기면 따라오지 않는다.</b> 성향은 이 브라우저에만 저장된다.
  서버에 두려면 새 테이블이 필요한데, 지금 브라우저는 익명 키만 갖고 있어서 새 테이블에 쓸 수 없다
  (그리고 그 제약을 강제하는 테스트가 있다). 로그인 기능이 붙는 다음 단계에서 다뤄야 한다. 문서에 한 줄 남겼다.</p>
</div>
<ul>
  <li><b>상한이 있다.</b> 전역 16건, 프로젝트 8건. 넘치면 고정한 것 빼고 약한 순서로 밀려난다.</li>
  <li><b>프롬프트에는 12줄·1,200자까지만</b> 들어간다. 무한히 늘어나 다른 정보를 밀어내지 않게.</li>
  <li><b>상태 칩에서 열면 전역만 보인다.</b> 그 진입점은 프로젝트 키를 넘기지 않는다. 없는 것보다 낫고 거짓말도 아니다.</li>
</ul>

<h2><span class="num">10</span>어떻게 확인했나</h2>
<table>
<thead><tr><th>확인</th><th>결과</th></tr></thead>
<tbody>
<tr><td>새 단위 테스트 5개 파일</td><td><span class="ok">100건 통과</span> — 저장소 · 신호 집계 · 봉투 · 증류 · 설정 UI</td></tr>
<tr><td>기존 테스트 확장 3개 파일</td><td><span class="ok">통과</span> — 예산 잘림 방어, 정책 문장 보존, 전송 전환</td></tr>
<tr><td>열거 실행 11개 파일</td><td><span class="ok">190건 통과</span></td></tr>
<tr><td>타입 검사 (<code>typecheck:app</code>)</td><td><span class="ok">통과</span></td></tr>
<tr><td>노드 테스트 (익명 권한 게이트 포함)</td><td><span class="ok">138/138</span> — 새 마이그레이션 없음 확인</td></tr>
<tr><td>CSS 예산 게이트</td><td><span class="ok">통과</span> — 파일 수 유지(새 파일 안 만들고 기존 스타일시트에 붙임)</td></tr>
<tr><td>실제 브라우저 캡처</td><td><span class="ok">스크린샷 10장 · 실제 요청 3건</span> — 이 보고서의 모든 그림</td></tr>
<tr><td>실제 자격증명으로 타일셋 분석 1회</td><td><span class="bad">아직 안 함</span> — 전송 전환의 마지막 실전 관문</td></tr>
</tbody>
</table>

<div class="callout warn">
  <p><b>솔직히 적어 둘 것.</b> <code>aiChatPanelUxRepairs</code> 테스트 파일에 실패 4건이 남아 있다.
  3건은 지금 코드에 없는 버튼 이름을 찾고 있어(원래 커밋에도 없다) 낡은 단정이고,
  1건은 혼자 돌리면 통과하니 같은 파일 안에서 앞 테스트가 남긴 상태 때문이다. 이번 변경이 만든 실패는 아니지만,
  그 파일 하나는 원본 대조를 따로 찍지 않았다.</p>
</div>

<h2><span class="num">11</span>다시 만들어 보는 법</h2>
<pre><code><span class="dim"># 1) dev 서버 (다른 세션 서버를 잡지 않게 포트를 직접 지정한다)</span>
npm run dev -- --host 127.0.0.1 --port 9761 --strictPort

<span class="dim"># 2) 증거 캡처 — 스크린샷 10장 + 요청 기록</span>
RPG_ZZU_URL=http://127.0.0.1:9761 node scripts/screenshot-preference-memory.mjs

<span class="dim"># 3) 이 보고서 다시 굽기</span>
node scripts/build-preference-memory-report.mjs

<span class="dim"># 4) 테스트</span>
node scripts/run-vitest.mjs run \\
  test/preferenceMemory.test.ts test/preferenceSignals.test.ts \\
  test/systemPromptEnvelope.test.ts test/preferenceDistiller.test.ts \\
  test/aiPreferenceMemorySettings.test.ts test/contextBuilder.test.ts \\
  test/agentUxPolicyPrompt.test.ts test/tilesetAiCpenClient.test.ts \\
  --configLoader bundle</code></pre>

<p class="sub">캡처 스크립트는 자격증명을 쓰지 않는다. <code>/v1/chat/completions</code> 를 가로채서 응답만 가짜로 만들고,
<b>요청은 앱이 만든 그대로</b> 기록한다. 그래서 위 08절의 표가 실물 증거가 된다.</p>

<footer class="doc">
  생성 2026-08-30 · 증거 원본 <code>output/evidence/ai-preference-memory/</code> ·
  캡처 <code>scripts/screenshot-preference-memory.mjs</code> ·
  보고서 <code>scripts/build-preference-memory-report.mjs</code><br>
  새 코드 <code>src/ai/systemPromptEnvelope.ts</code> · <code>src/ai/preferenceMemory.ts</code> ·
  <code>src/ai/preferenceSignals.ts</code> · <code>src/ai/preferenceDistiller.ts</code> ·
  <code>src/editor/panels/aiPreferenceMemorySettings.ts</code>
</footer>

</div>
</body>
</html>
`;

await writeFile(OUT, html);
console.log("report →", path.resolve(OUT));
console.log("size", (html.length / 1024).toFixed(0), "KB");
