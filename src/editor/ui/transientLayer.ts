/**
 * 떠 있는 층(메뉴·팝오버)은 한 번에 하나만.
 *
 * 2026-09-24 visual QA: 도구 메뉴가 열린 채 Ctrl+K 팔레트가 떠서 메뉴가 입력칸을 덮었고,
 * 진행(≡) 팝오버는 도움말·AI 설정을 열어도 그 위에 계속 남았다. 각 팝오버가 자기 바깥 클릭만
 * 들어서 키보드로 연 다른 층이나 모달과는 서로를 몰랐다. 여기서 「지금 떠 있는 하나」를 들고,
 * 새 층이 뜨면(또는 모달이 등록되면 — modalStack 이 부른다) 이전 층을 닫는다.
 */

type TransientLayer = { readonly owner: object; readonly close: () => void };

let active: TransientLayer | null = null;

/** owner 의 층이 떴다 — 다른 층이 떠 있으면 닫는다. */
export function claimTransientLayer(owner: object, close: () => void): void {
  if (active && active.owner !== owner) {
    const previous = active;
    active = null;
    previous.close();
  }
  active = { owner, close };
}

/** owner 의 층이 스스로 닫혔다. */
export function releaseTransientLayer(owner: object): void {
  if (active?.owner === owner) active = null;
}

/** 모달처럼 화면을 차지하는 층이 뜰 때 — 떠 있던 팝오버를 치운다. */
export function closeTransientLayers(): void {
  const previous = active;
  active = null;
  previous?.close();
}
