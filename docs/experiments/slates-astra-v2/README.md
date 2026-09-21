# Slates 문서 전달 실험 2 — GPT 6 Astra / medium

## 목적과 통제

대화 맥락 없이 학습 파일만 전달받은 에이전트가 새 50×50 성곽 마을을 타일로 조립할 수 있는지 확인한다. 모델 `gpt-6-astra`, reasoning effort `medium`, `fork_context: false`로 실행한다. 격리된 OS 샌드박스는 아니며 아래 입력 제한은 에이전트 지시와 읽은 파일 자기 보고로 확인한다.

읽기 시작: `openwiki/slates-assembly-playbook.md`와 `openwiki/slates-agent-entry.md`. **새 지침 §2의 세 JSON 카탈로그와 선택 부품을 실제로 읽어야 한다.** 허용 입력은 이 문서와 `input-manifest.json`에 나열한 학습 문서·PNG·JSON·원본 칩셋이다. 문서에 링크되어 있어도 기존 생성 스크립트, 완성 프로젝트/맵 JSON, output/verify-shots의 이전 결과, 앱 코드, 외부 웹, 다른 대화는 저작 근거로 읽지 않는다. 저장소 AGENTS와 환경 지침은 운영 규칙이며 타일 배치 지식 입력과 구분한다. node 표준 라이브러리, 설치된 playwright의 Canvas, Python 표준 도구는 사용 가능하다. 허용 입력에 명시된 첫 실험 PNG는 실패 분석용이며 첫 실험의 코드/맵 JSON은 읽지 않는다. 학습 안내 HTML은 문서이며 그 생성 스크립트는 읽지 않는다.

감독자는 이미 Supabase `rpg-zzu-slates32-38e6` 연결과 최신 SHA를 확인했다. 저작 담당만 새 콘텐츠를 만들고 감독자는 그동안 읽기 전용으로 검토한다. 단계별 피드백 후에도 콘텐츠 작성자는 당신 한 명이다. 담당자는 DB/기존 프로젝트를 읽거나 쓰지 않는다. 산출물 제출 후 감독자가 순차적으로 병합·저장·재로드한다.

## 단계별 제출 — 현재는 1차 제출만

첫 응답의 완료 범위는 지침 §6의 1~3단계다. 집 한 채, 붙은 상점 두 채, 성벽 모서리와 열린 문을 각각 새 모듈로 조립한다. `verify-shots/slates-astra-v2/modules.json`, 각 모듈의 PNG, 부품/통행 그림, `stage1-report.md`를 제출하고 감독자의 그림 검토를 기다린다. 지정 카탈로그의 16/8px 소스 사각형을 해독해 사용한다. 문맥 스탬프를 그대로 놓지 말고 **실루엣/바닥/그림자/접점/충돌을 분리**한다. 문서에 남아 있는 오류를 발견하면 기록하고 고친다. 모듈 PNG를 직접 연 후 자체 수정한다.

감독자 후속 메시지를 받은 뒤에만 작은 거리→50×50 새 배치로 확장한다. `street.png`, `metrics.json`, 4가지 판정(구조/구성/통행/저장)을 추가한다. 표본 복원만 한 그림과 실제 지도용 분리 모듈의 그림을 구별한다.

## 저작 과제

Slates 원본 타일로 **새 배치의 50×50 성벽에 둘러싸인 마을**을 만든다. 문서의 건축·성곽·밀도·골목 연결 규칙을 스스로 적용한다. 관찰판을 그대로 늘어놓거나 기존 완성 맵을 복사하지 않는다. 검토 보류된 구조는 해결하거나 보수적인 대안을 저작하고 기록한다. 참고 스크린샷 픽셀은 사용할 수 없다.

## 쓰기 범위와 최종 제출 형식 (2차 제출 시)

쓰기 범위는 `scripts/content/build-slates-astra-v2.mjs`와 `verify-shots/slates-astra-v2/`뿐이다. 직접 생성기를 작성·실행하고 지도 PNG를 열어 보며 필요한 수정을 수행한다. 엔진 수정, 전체 테스트/게이트/typecheck, stash, 커밋/푸시, DB 쓰기 금지. 다른 에이전트를 호출하지 않는다.

`verify-shots/slates-astra-v2/bundle.json`:

```js
{
  map: {
    id: 'slates_astra_v2_walled_50', name: '스스로 지은 이름',
    width: 50, height: 50, tileSize: 32, tilesetId: 'slates_astra_v2_32',
    lowerTiles: [/* 2500개의 0-based ID */],
    upperTiles: [/* 2500개의 ID 또는 -1 */],
    events: [], bgm: {mode: 'none'}, encounters: []
  },
  tileset: {
    id: 'slates_astra_v2_32', kind: 'custom', name: 'Slates Astra v2',
    count: 1232, tileSize: 32, tilesPerRow: 56,
    image: {type: 'uploaded', id: 'slates_astra_v2_atlas'},
    terrain: [/* count개의 0 */],
    priority: [/* count개의 'lower' 또는 'upper' */],
    passability: [/* count개의 {up:boolean,down:boolean,left:boolean,right:boolean} */],
    tileMeta: [/* count개의 {label,description,source:'ai',origin:'ai'} — 배열 */],
    tileGroups: [], structureKits: []
  },
  asset: {
    id: 'slates_astra_v2_atlas', name: 'Slates Astra — Ivan Voirol CC BY 4.0',
    kind: 'tileset', dataUrl: 'data:image/png;base64,...',
    meta: {tileSize: 32, width: 1792, height: /* 실제 크기 */}
  },
  spawn: {x: /* 통행 가능 */, y: /* 통행 가능 */},
  landmarks: [/* {name,x,y}: 성문·광장·문 앞 접근 목표 */]
}
```

위 `kind`는 전달용이며 감독자가 저장소 스키마와 대조한다. 원본+파생 타일 count는 자유롭게 늘릴 수 있다. 파생 타일은 `recipes.json`에 원본 v1/v2와 source 사각형·destination·그리는 순서를 기록한다. 두 레이어와 한 칸 단위 통행이라는 엔진 제약을 지킨다. 같은 그림에 다른 통행이 필요하면 별도 ID를 만든다. 단순 Canvas 미리보기는 **lower 전체 → upper 전체** 순서로 그린다.

추가 제출:
- `map.png`: 1600×1600 이상 전체 미리보기, 실제 PNG 열람 후 결과 기록.
- `layout.json`: 구역·건물·문·성문·주요 통행 목표의 위치와 설계 이유.
- `REPORT.md`: 실제 읽은 파일, 적용한 문서 절, 독립적으로 결정한 내용, 시각 검토·통행 근거, 미해결 사항, 변경 파일 목록.
- `recipes.json`: 원본 출처. 원본에 없는 새 그림은 만들지 않는다.

완료 주장은 감독자의 저장·재로드와 실제 에디터 렌더까지 포함해 별도로 기록한다. 실험 성공 여부는 모델 이름만으로 판단하지 않는다.
