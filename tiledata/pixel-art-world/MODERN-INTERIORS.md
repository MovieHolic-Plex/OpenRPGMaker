# 현대 일본 실내 6용도·8맵

`modern-interiors-layout.json`이 청사진, `modern-interiors-compiled.json`이 현재 번호로 된
전체 lower/upper 배열과 조립·접근 좌표다. 실제 그림은 사용자 로컬 전용이며 Git에 싣지 않는다.
380개 다운로드 범위를 늘리지 않고 설치된 원본 8종과 기존 천장 47변형을 재사용한다.

| 실제 맵 ID | 크기 | 구획 |
|---|---|---|
| paw-sento-neighborhood | 21×32 | 접수/신발장, 독립 탈의실2, 독립 욕탕2 |
| paw-ramen-counter | 15×19 | 조리실, 바6석, 2인 테이블3개 |
| paw-apartment-1k | 11×21 | 현관, 독립 주방, 생활실, 욕실, WC/세탁 |
| paw-apartment-1dk | 13×21 | 현관, 주방/식사실, 독립 침실, 욕실, WC/세탁 |
| paw-apartment-work | 14×18 | 현관, 주방/세탁, 업무/생활실, 욕실, WC |
| paw-ryokan-three-rooms | 22×19 | 개인 객실3, 2칸 복도, 작은 접수 |
| paw-clinic-separated | 17×21 | 독립 진찰실/처치실/WC, 접수와 대기8석 |
| paw-table-tennis-club | 20×25 | 탁구대2, 접수, 탈의, 보관 |

공용 장소 ID는 맵 ID의 `-`를 `_`로 바꾸고 `shared_`를 앞에 붙인다.
공용 타일셋은 `shared_paw_modern_interiors`, 정본의 원래 타일셋은 `paw-modern-interiors`다.
`list_shared_scenes` → `inspect_shared_scene` → 장소 참고문서 전체 →
`build_shared_scene(links: reject)` 순서로 재현한다. 반환된 ID mapping을 사용한다.
문턱은 열린 통로다. 문 개폐, 도시 왕복 전이, 판매·입욕·진료·경기 이벤트는 별도 저작한다.

## 원본과 현재 번호

준비 전에 정본의 다음 타일셋 참고문서와 실제 정상/오류 이미지를 읽는다.
`paw-japanese-public-bath`, `paw-home-bath`, `paw-school-gym`,
`paw-personal-room-male`, `paw-personal-room-female`, `paw-washitu`,
`paw-izakaya`, `paw-clinic-interior`.

준비기는 각 원본 PNG의 catalog SHA256과 canonical portable 영수증을 확인한다.
사용하는 객체와 바닥/벽/천장 칸만 사용자 로컬 32px·8열 합성 아틀라스로 복사한다.
모든 복사 칸의 RGBA를 원본과 비교한다. 원본 번호를 합성 번호로 사용하면 안 된다.
같은 그림도 floor/object처럼 통행 속성이 다르면 별도 칸으로 보관한다.
천장은 기존 `paw-izakaya`의480..526을 `paw-wall-a01` 연결 그룹 전체로 재매핑한다.

타일셋 소유 참고문서 `modern-source-map`에는 출처 파일/SHA, materials,
cells(배열 위치=현재 번호, n=원본 native atlas 번호), 전체 variantMap이 있다.
`parts-*` 용도에는 사용한 객체의 원본/현재 배열·지지칸·방향·정상/하단 조각 누락 이미지가 있다.
각 structureKit도 같은 개별 문서를 소유한다. `assembled-<mapId>` 용도에는
전체 맵 배열·부품 원점·통로·폐쇄 검사 구획 및 실제 정상/오류 그림이 있다.
공용 게시기는 이 합성 타일셋의 객체 kits를 보존하고 장면 문서도 공용 장소에 복사한다.

## 배치 계약

- 천장부터 연결한 뒤 노출된 남쪽 끝 아래 벽 전부를 넣고 가구를 놓는다.
  목재/의원 벽2행, 센토/체육관 벽3행이다. 남쪽 외곽과 내벽 끝도 동일하다.
- standing 가구 밑동은 바닥, wall-mounted 전체 받침은 벽이어야 한다.
  전체 객체 사각을 보존하며 upper끼리 덮어쓰거나 부분 절단하지 않는다.
- 수납장·주방·세면대·세탁기·냉장고·약장 등의 남쪽 조작면에 접근 가능 칸을 둔다.
  의자 뒤와 카운터 양쪽도 실제 엔진 통행으로 검사한다.
- 사적인 방은 출입구를 닫으면 다른 방으로 새지 않아야 한다. 여관 다다미는
  각6×6 독립 객실 안에 2×3 원본 패턴을 온전히 반복한다. 열린 홀은 개인실이 아니다.
- 탁구대 원본 네트가 남북으로 서 있으므로 선수는 동서에서 마주 본다.
  각 끝3칸을 비우고 서비스실은 남쪽 벽으로 분리한다. 경기 공간은 장식으로 채우지 않는다.
- 넓은 공간에 소품을 흩뿌리지 않는다. 센토/의원 폭과 여관 접수 범위를 줄인 현재 평면을
  기준으로 삼는다. 면적 확장은 좌석·작업면·활동 범위가 실제로 필요할 때만 한다.

## 준비·저장·로컬 공용

```bash
node scripts/content/read-pixel-art-world-host.mjs HOST PRIVATE/source
node scripts/content/export-tileset-references.mjs PRIVATE/source/current-portable.json TILESET PRIVATE/refs/TILESET
node scripts/content/prepare-pixel-art-world-modern-interiors.mjs PRIVATE/source/current-portable.json USER_PNG_DIR PRIVATE/prepared
node scripts/content/save-pixel-art-world-host-patch.mjs HOST PRIVATE/prepared/patch.json PRIVATE/saved
node scripts/content/publish-pixel-art-world-local-library.mjs RELOADED_PORTABLE RELOADED_PROOF PRIVATE/shared --publish-local
```

대형 프로젝트는 호스트 RPC의 타임아웃을 충분히 길게 잡아야 한다.
저장은 공식 CAS/백업/asset API만 사용한다. 실행 중인 SQLite에 직접 쓰지 않는다.
`RELOADED_PORTABLE`은 저장 후 공식 load 결과이며 asset ref의 SHA를 대조해 로컬 그림을 해석한다.
준비 JSON만으로 저장을 증명하지 않는다. 공용도 공식 로컬 DB를 다시 읽어 비교한다.

준비 검사는 실제 `canMove`/autotile/tileset shape 구현을 메모리 번들로 실행한다.
8개 맵의 접근 목표120개, 방 폐쇄22개, 모든 빈 바닥의 도달 가능성, 조작면,
탁구 여유 칸, 천장 아래 벽/가구 접지를 검사한다. 벽을 지우고 출구를 막은 반례도 실패해야 한다.
전체 테스트/게이트와 별개인 콘텐츠 검사다. 증거는 로컬 `output/paw-modern-interiors/`.
신규/기존 프로젝트 공용 투영 및 실제 장면 복사 도구 확인은 결정론적 재현이며,
새 LLM이 임의의 평면을 설계하는 성공률 실험은 아니다.
