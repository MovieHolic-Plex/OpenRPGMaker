// 입장 화면 — 닉네임 입력 → enter 호출 → 세션 저장.

import { enter } from "@/api/game";
import { saveSession, type Session } from "@/session";
import { escapeXml as escapeHtml } from "@/render/escape";

export function bootEnter(container: HTMLElement): Promise<Session | null> {
  return new Promise((resolve) => {
    container.innerHTML = `
      <div class="enter-screen">
        <h1 class="enter-title">조선을 다시 위대하게</h1>
        <p class="enter-subtitle">Make Chosun Great Again</p>
        <div class="enter-card">
          <p class="enter-desc">
            동아시아 제국들 틈에서 조선을 부흥시켜라.<br/>
            AI 왕의 명을 받들되, 사약을 피하라.
          </p>
          <label class="enter-label" for="nickname-input">신하의 이름</label>
          <input id="nickname-input" class="enter-input" type="text"
            maxlength="12" placeholder="닉네임 (최대 12자)" autocomplete="off" />
          <button id="enter-btn" class="btn btn-primary" disabled>조선 입조</button>
          <p class="enter-hint">기본적으로 조선의 병조판서(또는 영의정) 자리를 받습니다.</p>
        </div>
      </div>
    `;

    const input = container.querySelector<HTMLInputElement>("#nickname-input")!;
    const btn = container.querySelector<HTMLButtonElement>("#enter-btn")!;
    const status = container.querySelector<HTMLElement>(".enter-desc")!;

    input.addEventListener("input", () => {
      btn.disabled = input.value.trim().length < 1;
    });
    input.focus();

    btn.addEventListener("click", async () => {
      const nickname = input.value.trim();
      if (!nickname) return;
      btn.disabled = true;
      btn.textContent = "입조 중…";
      try {
        const res = await enter(nickname);
        const session: Session = {
          nickname,
          user_id: res.user_id,
          subject: res.subject,
        };
        saveSession(session);
        resolve(session);
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "조선 입조";
        status.innerHTML = `<span class="enter-error">입조 실패: ${escapeHtml(String(e))}<br/>Supabase 연결을 확인하세요.</span>`;
      }
    });
  });
}
