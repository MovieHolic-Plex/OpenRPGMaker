# Interaction probes

Shipping player.html / transient fixtures. 9개 조건의 fixed=true, page errors=0.

- input-auto: fixed=true; errors=0. 즉시 확인: input-auto-prompt.png, input-auto-auto.png
- combo-menu: fixed=true; errors=0. 즉시 확인: combo-menu-ready.png, combo-menu-reopened.png
- crosskind: fixed=true; errors=0. 즉시 확인: crosskind-after.png
- same-name: fixed=true; errors=0. 즉시 확인: same-name-after.png
- capture-cancel: fixed=true; errors=0. 즉시 확인: capture-cancel-root.png, capture-cancel-captured.png
- capture-accept: fixed=true; errors=0. 즉시 확인: capture-accept-root.png, capture-accept-captured.png
- enemy-crosskind: fixed=true; errors=0. 즉시 확인: enemy-crosskind-after.png
- enemy-special: fixed=true; errors=0. 즉시 확인: enemy-special-after.png
- input-active: fixed=true; errors=0. 즉시 확인: input-active-prompt.png, input-active-auto.png

Active 입력 사례는 1.8초 동안 적 게이지 세 개가 9%로 유지됨을 확인했다. 정상 포획은 DOM 제거 뒤 퇴장 reveal/결과 커밋까지 기다려 몬스터2/볼7을 확인했다.
초기 Active 입력 프로브는 적 행동 연출 중 확인키가 스킵으로 소비되어 프롬프트에 진입하지 못했다. 이후 busy=false에서 확인하고 프롬프트 진입을 확인하도록 조작을 수정해 재실행했다. 적 scan은 import 누락을 수정한 뒤 재실행했다.
