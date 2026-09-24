# Rasak Modern Tileset — 비공식 지원 (그림 없음)

- 팩: Rasak Modern Tileset — https://rasak.itch.io/rasak-modern (작가 Rasak)
- 라이선스 요지: 사용·수정 가능(크레딧 필수), **원본·수정본 그림의 재배포 금지**, 링크는 허용.
- 그래서 저장소에는 **이름·좌표·해시와 코드만** 있다: `src/project/rpgmakerMv/packs/rasakModernCity.ts`.
  팩 PNG, 구운 아틀라스, 참고문서 그림, 맵 캡처는 저장소에 넣지 않는다(작업물은 `~/rasak-modern/`).
- 게임에 쓸 때 크레딧: `Tileset: Rasak Modern Tileset by Rasak (https://rasak.itch.io/rasak-modern)`

## 쓰는 법 (사용자)

1. itch.io 에서 팩을 받아 푼다(RAR5 — 7-Zip 23+ 또는 unrar).
2. 편집기 → 소재 → 리소스 관리자 → 칩셋 → 가져오기 → `Tilesets/City` 폴더의 PNG 17장을 **한꺼번에** 고른다(끌어놓기도 된다).
3. 「Rasak Modern · 도시 야외」 타일셋이 생긴다. 맵에 적용하고 AI 조수에게 도시를 부탁하면 된다.

판본이 다른 시트(해시 불일치)는 알림에 적힌다 — 칸 이름이 어긋날 수 있다.

## 쓰는 법 (개발·시험)

```sh
bun scripts/content/mv-pack/build-project.mts --pack ~/rasak-modern/extracted/Rasaks_Modern_Tileset \
  --preset rasak-modern-city --out ~/rasak-modern/preset --map city:40x30
bun scripts/pi-agent.mts --project ~/rasak-modern/preset/project.json --maps city --current city \
  --task "city 맵에 현대 도시 교차로 한 블록을 만들어 줘" --out /tmp/r.json --report /tmp/r-report.json
```

구현·규칙은 `openwiki/teaching-assistant-tilesets.md` 「MV/MZ 팩 프리셋 — 구현」.

## 범위와 남은 일

- 범위: City 폴더 17장. 오토타일 208종 이름, A5 평타일 16칸, 물체 80개(거리·상가·공원·건물 부속).
- 남은 일: 실내·공공건물·자연 폴더 프리셋, 애니 물(지금 첫 프레임), 한 칸 세 겹(MZ 4층 작업 뒤), 이름 없는 물체(Garbage·Slums·대중교통 시트).
