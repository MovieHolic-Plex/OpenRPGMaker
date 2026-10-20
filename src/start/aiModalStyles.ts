// 시작 화면(start-screen.html)에서 편집기의 AI 연결 창(aiConnectGate → AI 설정)을 띄울 때만 받는 스타일.
// 편집기는 이 규칙을 셸 계층(@layer shell)으로 이미 싣는다 — 편집기 쪽에서 이 모듈을 가져오면 계층 없는 사본이 셸 규칙을 이기므로
// 시작 화면 전용으로 둔다(startScreen.ts 의 ensureAiConnected 가 동적으로 가져온다).
import "@/styles/shell/dialogs/ai-modal-shell.css";
import "@/styles/shell/dialogs/ai-settings-modal.css";
