# 현재 RM2003 스킬과 새 효과 시안

기존 코드의 클래스 스킬 1,088개 / 효과 시트 키 895개를 확인한 뒤, 화염·빙결·번개·회복 네 가지를 비교했다. `current-contracts.json`은 실제 카탈로그와 타임라인에서 추출한다.

- `*-comparison.gif`: 같은 native 골렘, 정수 2배로 실제 **착탄 층만** 비교. 왼쪽은 현재 64px·8~10칸·60ms, 오른쪽은 미등록 96px·32칸·50ms 시안이다. 시전자/투사체/소리를 합성해 완성 스킬처럼 보이게 만들지 않았다.
- `runtime/skill-skill_mage_fireball.gif`: 실제 player.html에서 현재 스킬을 사용한 영상. 모든 네 스킬의 포즈·FX 층·소리 이벤트 계측은 `runtime/report.json`과 `SUMMARY.md`에 있다. GIF 자체는 무음이다.
- `study/render.mjs` / `study/sheets`: 저장소의 편집 가능한 효과 래스터에서 만든 원본 시안. 제품 등록 없음. 178~406 RGB색, 알파 32단계라 현재 ≤16색·0/255 도트 계약과 맞지 않는다.

결론: 기존 시전자 동작/투사체/레이어/효과음 체계를 유지하고, 부족한 효과를 같은 도트 계약으로 보강한다. 이 시안을 통째로 대체 적용하지 않았다.

재생성: `python3 verify-shots/legacy-monsters/skill-comparison/compare.py` (Pillow와 NanumGothic 폰트). 실제 칸/시간·원본 픽셀 분석은 `comparison-report.json`. 합성 GIF는 한 공통 팔레트로 양자화하므로 색 수/알파 비교는 GIF가 아닌 원본 PNG 기준이다.
