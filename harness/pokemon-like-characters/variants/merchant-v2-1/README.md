# 상인 v2.1 — 등 위의 검은 줄 수정

v2에서 두건 끈을 옷 위로 내린 어두운 청록색 픽셀이 등에 검은 줄처럼 보였다.
위 방향 3포즈의 등판에서 그 픽셀을 지우고, 좌우 포즈에서도 매듭을 머리 뒤에서 끝냈다.
`repair.json`은 실제 수정한 프레임·행과 이전/이후 픽셀을 기록한다.
`before-after.gif`: 위 수정 전 / 아래 수정 후. `decoded.png`: 최종 GIF 4프레임.

```bash
node cli.mjs render --draft variants/merchant-v2-1 --out /path/to/new-output
```

원작 발 행은 유지했고, 등록 시 구조·출처 재현·실제 GIF 픽셀 검사를 통과했다.
실제 디코딩한 모든 걷기 프레임에서 등판의 줄 제거를 확인했다. 사용자 승인은 대기 중이다.
