# tileset-authoring — 타일셋 구현 하네스

테마 하나를 「손 도트 조각 → 자동 검사 → 사용자 고르기 → 시트 굽기 → 공용 번들 배선 → 검증」으로 구현한다.
버들항(`beodeul_city`)을 구현한 순서를 일반화한 것이다. 자세한 설명은 `openwiki/harnesses/tileset-authoring.md`.

```bash
npm run harness -- tileset-authoring status
npm run harness -- tileset-authoring spec  --theme pokemon-overworld
npm run harness -- tileset-authoring draw  --theme pokemon-overworld [--run v1]
```

폴더 규칙: 코드 `src/harnesses/tileset-authoring/`(`lib/px.py` 도트 도구·오토타일, `recipes/<테마>.py` 그리기, `harness.py` 단계),
계약 `harness-data/tileset-authoring/<테마>/seed.json`, 후보 산출물 `qa-runs/harnesses/tileset-authoring/<테마>/<run>/`(커밋 안 함).

## 통합 검수 자료

현재 배선은 `src/assets/monsterKit/index.json`의 run이다. `integ.sh`는 I6 일곱 시트를 같은 run으로 재생성한다.
제작 실패 시 중단하며, 전체 gates·Vitest·typecheck를 실행하는 명령이 아니다.

```bash
python3 src/harnesses/tileset-authoring/lib/integration_review.py --out verify-shots/tileset-i6
python3 src/harnesses/tileset-authoring/lib/viz_progress.py
```

그림 생성 후 직접 검수한 점수는 증거 폴더의 `assessment.json`, 근거는
`harness-data/tileset-authoring/integ-qa/QA-I6.md`에 남긴다. 새 그림에 옛 판정을 그대로 재사용하지 않는다.
페이지 생성기는 현재 번들·manifest·assessment의 run과 시트·견본 픽셀 해시 일치를 요구한다.
정상 54맵·전후 비교·모든 구조 킷·사용 소품·바닥 반복을 제공한다. 원작 학습 그림은 저장소에 넣지 않는다.
