# jp-city 출처·라이선스

`jp_shopstreet16`(번들 `jp_city` 의 기반 시트)은 코드로 그린 손 도트다. 외부 그림 소재를 가져오지 않았다.

| 항목 | 출처 | 상태 |
|---|---|---|
| 건물·거리·소품·부착물 그림 | `scripts/content/jp-city/lib/` 의 페이퍼(paint·parts_*·v2*·jp*), 팔레트 `tiledata/atlas-pick/palette/modern3.pal` | 자체 제작. 외부 소재 없음 |
| 일본어 글자(가나·한자·전각 영숫자 122자) | X11 misc 글꼴 **jiskan16** (JIS X 0208 16×16 비트맵). **퍼블릭 도메인** | 쓰는 글자만 `glyphs.json` 으로 구워 커밋. 런타임에 시스템 글꼴을 읽지 않는다. 추가·검증은 `lib/glyph_tool.py` (`--verify` 로 PCF 와 일치 확인) |
| 참고 팩 "Osaka City" | 화풍 비교용 | **눈으로만 참고했고 저장소에 반입하지 않았다** |
| 행인(Actor1 `person.0~39`) | RPG Maker Actor1 캐릭터셋 | **번들에서 제외.** 코드(`actor1_people.py`)·`Actor1.png`·행인 칸 그림 모두 저장소에 없다. 시트에서 그 자리 155칸(851~1005)은 투명 빈 칸으로 남겨 칸 번호를 유지한다(`people-reserve.json`) |

지구 6장(`districts/`)은 행인 없이 조립한 것이다. `districts/people-boxes.json` 은 원본(행인 포함) PNG 와 비교할 때 행인 스프라이트 위치를 가리는 검증용 좌표일 뿐 그림이 아니다.
