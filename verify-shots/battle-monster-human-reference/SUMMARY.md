# 실제 64×64 참고를 보고 다시 만든 인간형 — 2026-10-05

## 즉시 확인

- `human-before-after.png`: 이전 검객(Deny) / 새 reference-v3(미선택)의 대기 자세.
- `live-human-comparison.png`: 실제 대시보드의 대기·공격·피격·쓰러짐·스킬·독·기절·수면,
  이전/수정 후 GIF 16개를 동시에 표시.
- `poses-1x-3x.png`: 실제 native18자세의 1배/최근접3배 검사판.

## 실제 웹 참고

- [LordNeo — Swordsman static64×64](https://opengameart.org/content/swordsman-static-64x64):
  실제64px 그림을 열어 넓은 몸통, 겹치는 앞/옆 면, 손-칼 연결, 두 발로 지지하는 자세를 관찰.
- [SolaarNoble — 64×64 Side View Battlers](https://solaarnoble.itch.io/64x64-side-view):
  공개256px 확대 미리보기를 열어 머리, 어깨-팔꿈치-손목, 골반 아래 두 발의 연결을 관찰.
  제작자가64px 칸으로 설명한 자료이며 내려받은 미리보기 자체가64px라는 주장은 하지 않는다.

참고 그림은 저작 모델에 실제 첨부했다. 코드를 통해 트레이싱/추출/축소하지 않고 원본
팔레트 격자를 직접 저작했다. 연구용 외부 그림 바이트는 커밋·게시·배포 팩에 포함하지 않았다.
후보의 reference-study.json에 출처·관찰·이미지 해시를 남겼다.

## 새 후보

`wandering-swordsman/reference-v3`: native64,18직접 저작 자세,18색 이내,8GIF.
머리 약14×13, 어깨/소매 약23px, 전체 높이49px. 양쪽 눈이 보이는 얼굴, 남색 소매,
넓은 바지와 장화, 칼자루에 이어진 손으로 이전의 뾰족한 옆얼굴/좁은 어깨를 교정했다.
공격 준비·내딛기·접촉·회수, 수평으로 누운 쓰러짐, 검기를 동반한 스킬3자세를 따로 만들었다.

기존 후보의 실제 Deny는 보존했다. 새 후보는 pending이며 감독자가 대신 Allow하지 않았다.
독립 GPT6.1sol/high는 실제 portrait/light/dark/checker를 보고 rework를 권했다. 짧은 칼,
검집-칼의 관계, 기본 seed의 옷색과 수정 의도의 차이 등이 남은 검토 사항이다. 추천은 사용자 선택이 아니다.
이 미리보기는 실제 전투 HP/스킬 피해/상태 효과나 정본 게임 설치의 증거가 아니다.

## 근거

- `source-proof.json`:18격자 계약,현재 suite binding,실제 독립 검수 출처,옛 Deny/새 pending.
- `gif-proof.json`:8GIF 전 프레임의 nativeRGBA/시간을 직접 저작 원본과 다시 대조.
- `browser-proof.json`:실제 HTTP 화면16GIF,정지/재생,320/375px에서 오류/가로넘침0.
- 커밋된 원본: `harness-data/battle-monster/authored/20261005/wandering-swordsman/reference-v3/`.

전체 gates/Vitest/typecheck는 실행하지 않았다.
