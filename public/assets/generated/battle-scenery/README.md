# 측면 전투용 겹 배경

자체 생성 원화: OpenAI image_gen, 2026-09-28. 지형마다 한 번 생성했다.
프롬프트는 `prompts.json`, 후처리 입력은 각 지형의 `source.png`(320×720 네 단 원화)다.
원본 생성 응답을 320 도트로 정규화한 시트를 보존하므로 외부 서비스 없이 재현할 수 있다.

```sh
node scripts/asset-gen/gen-battle-scenery.mjs
```

Python 3 + Pillow 필요. 최초 새 원화는 `--source-dir DIR`로 반입한다
(DIR 안에 plains.png, forest.png, cave.png, snow.png, desert.png 네 단 원화).
AI 원화 재생성은 확률적이며, 보존된 source.png에서의 후처리는 결정적이다.

## 소비 계약

- URL: `/assets/generated/battle-scenery/<biome>/<layer>.png`.
- biome: plains, forest, cave, snow, desert.
- 뒤→앞 순서: sky → far → mid → ground. 모두 같은 640×360 영역에 정렬한다.
- sky는 불투명. 나머지는 알파 0/255만 사용한다. 320×180을 nearest로 두 배 확대했다.
- sky/far는 가로 반복. 좌우 32px 교차 혼합 뒤 재양자화했고 양끝 열이 완전히 같다.
- mid는 가장자리 소품. 중앙 x=192..448은 투명하다. mid/ground는 가로 반복을 전제로 하지 않는다.
- ground는 y=160부터 하단까지 완전히 불투명하다. y=230..330 중앙이 접지 공간이다.
- sky/far만 수평 이동하고 mid/ground는 고정한다. 이음매 보정 띠는 양 가장자리 32px이다.
- preview.png는 같은 순서의 정적 합성 검토용. source.png와 preview.png는 런타임에서 불러오지 않는다.
- 런타임 DOM/CSS 연결 및 웹 내보내기 자산 등록은 통합 담당자의 쓰기 범위다.

## 검증

생성기는 저장한 PNG를 다시 열어 규격, 최대 48색, 이진 알파, 2×2 도트 격자,
200KiB 미만, sky/far 양끝 열 일치, ground 접지면 불투명을 검사한다.
manifest.json에 각 파일 크기와 레이어 SHA-256을 기록한다.
보존 시트로 재생성한 manifest가 최초 생성과 같음을 확인했고 다섯 preview를 직접 열어 검토했다.

현재 골격 브랜치의 출하 플레이어 QA 1회: 런타임 오류 없음, 5비트 중 4통과/1실패.
새 겹 배경 연결 전이라 기존 붉은 배경이 표시됐다. 실패는 적들의 접지 띠 이탈과
enemy-2의 필드 상단 34px 잘림이다. 새 배경을 적용한 통합 QA는 별도로 필요하다.
로컬 근거: `.omo/retro-art-qa/SUMMARY.md`, `04-battle-intro.png`.
