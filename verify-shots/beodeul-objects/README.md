# 버들항 이야기 기물 굽기 증거 (2026-11-12)

그림은 **3/4 관문 미통과 — 오너 면제(fable-oneshot-2026-11-12)**. 모델 호출 없이 만든 증거다.

- `probe-jrpg-v1.json` · `existing-jrpg-v1-haesol-16-placed-1x.png`(128색 사본) — 저장된 프로젝트 사본(해솔 마을 44×46)에서 정규화 → 저장 → 다시 열기, 낱말 → 킷, v2 `place_object` 로 16종 놓기, 1배 그림.
- `probe-jrpg-x1.json` · `existing-jrpg-x1-planks-on-water-1x.png` — 다른 저장본(물안개 마을)의 강 위에 널빤지 길 여덟 칸.
- `save-compat.txt` — `check-bundle-save-compat.mts` 저장본 40개(통과 38 · 굽기 전에도 안 열리던 2).
- 만든 명령: `bun scripts/content/beodeul-objects/probe.mts <저장본 폴더> <outDir> [맵 id]`.
- 자료집 화면(참고문서 탭) 캡처는 없다 — 참고문서 용도가 새 프로젝트·기존 저장본(정규화 뒤·다시 연 뒤)에 있는지는 probe 의 `references*` 값으로만 확인했다.
