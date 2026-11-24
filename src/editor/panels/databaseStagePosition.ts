// 도트 미리보기 무대(스킬 탭·도트 연출 탭·몬스터 스킬) 안의 스프라이트 위치.
//
// 무대는 매 프레임 배우·이펙트·숫자 수십 개를 옮긴다. left/top 으로 옮기면 프레임마다 레이아웃이 다시 돌아
// 자료집 전체가 다시 배치됐다(qa1124 항목 5: 3초에 Layout 1.9초). translate 는 레이아웃을 건드리지 않는다.
// left/top 은 0 으로 한 번 고정하고 위치는 translate 로만 준다. CSS 의 transform(뒤집기·scale)과는 따로 합성된다.

export function placeStageNode(node: HTMLElement, x: number, y: number): void {
  if (node.style.left !== "0px") node.style.left = "0px";
  if (node.style.top !== "0px") node.style.top = "0px";
  node.style.translate = `${x}px ${y}px`;
}
