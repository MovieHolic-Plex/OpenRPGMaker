// app:// 응답의 CSP 가 `script-src 'self' app:` 라 인라인 <script> 는 차단된다 — 이 파일은
// 별도 스크립트여야 한다. 인라인이던 2026-09-16 실측에서 버튼 셋 다 핸들러가 없고(onclick null)
// 최근 목록이 빈 채로 남았다.
const bridge = window.oprn;

async function openResult(result) {
  if (result && result.projectId) window.location.href = "/index.html";
}

async function renderRecent() {
  const list = document.getElementById("recent-list");
  let entries = [];
  try {
    entries = await bridge.start.recentProjects();
  } catch (error) {
    console.error("[start] 최근 프로젝트를 읽지 못했습니다:", error);
  }
  if (!entries || entries.length === 0) {
    list.innerHTML = '<p class="empty">최근 프로젝트가 없습니다.</p>';
    return;
  }
  list.innerHTML = "";
  for (const entry of entries) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "recent-item";
    item.textContent = entry.title || entry.projectDir;
    item.title = entry.projectDir;
    item.addEventListener("click", async () => {
      const result = await bridge.start.openRecent({ projectDir: entry.projectDir });
      if (!result) {
        item.classList.add("recent-missing");
        item.title = `${entry.projectDir} — 폴더를 찾을 수 없습니다`;
        return;
      }
      await openResult(result);
    });
    list.appendChild(item);
  }
}

document.getElementById("btn-new").addEventListener("click", async () => {
  await openResult(await bridge.start.createProject({ title: "새 프로젝트" }));
});

document.getElementById("btn-open").addEventListener("click", async () => {
  await openResult(await bridge.start.openFolder());
});

void renderRecent();
