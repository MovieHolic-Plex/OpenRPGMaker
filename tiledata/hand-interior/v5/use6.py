"""가구별 쓰임(use)·바라보는 방향(facing)·상태 짝(states)과 보강 설명 — handInteriorSpec objects 에 실려 조수가 읽는다.

  use     게임에서 이 가구로 무엇을 하나(여럿 가능). 조수가 이벤트를 붙일지·어디에 둘지 정할 때 쓴다.
  facing  가구가 바라보는 쪽(N·S·E·W). 앉는 가구는 탁자·제단 쪽을 보게 놓는다. 이름에 방향이 없는 것은 남쪽(카메라 쪽)을 본다 → 비운다.
  states  같은 물건의 다른 상태 그림 {"group": 묶음 id, "state": 이 그림의 상태, "others": {상태: 다른 가구 id}}.
          예: 닫힌 보물상자 ↔ 열린 보물상자. 이벤트 1쪽은 닫힘, 연 뒤 2쪽은 열림 그림.
새 기물(new/items.json)은 항목에 use·facing·states 를 직접 적는다 — 여기 규칙보다 우선한다.
"""
import re

USE_KO = {
    'block': '막힘·놓아두기(장식)',
    'walk': '밟고 지나감',
    'sit': '앉기(의자 이벤트·대화 자리)',
    'sleep': '자기(여관·집 침대 — 휴식 이벤트)',
    'open': '열기(상자·관 — 아이템 이벤트, 연 뒤 열림 그림)',
    'search': '조사(서랍·옷장·통·책장 — 조사하면 아이템·글)',
    'read': '읽기(게시판·책·지도·칠판 — 글 이벤트)',
    'counter': '카운터(주인은 뒤, 플레이어는 앞에서 말 걸기 — 카운터 너머 대화)',
    'travel': '이동(계단·뚜껑문·문 — 이동 이벤트)',
    'light': '불빛(어두운 방의 빛 자리)',
    'save': '저장(세이브 지점)',
    'heal': '회복(HP·MP 회복 이벤트)',
    'switch': '장치(켬/끔 — 문·함정과 묶는 스위치)',
    'push': '밀기(퍼즐 — 밀어서 옮긴다)',
    'trap': '함정(밟으면 피해·상태 이상)',
    'key': '열쇠·보물 받침(조사하면 열쇠·보물)',
    'gate': '여닫는 문(스위치·열쇠로 연다)',
    'seal': '봉인(조건을 채우면 풀린다)',
}

# (정규식, 쓰임 목록) — 위에서부터 처음 맞는 것. id 는 영어 낱말.
RULES = [
    (r'^(chair|stool|bar stool|bench|pew|sofa|armchair|throne|stone throne|theater seat|choir stall)\b', ['sit']),
    (r'^(bed |double bed|canopy bed|straw bed|elven bed|prison cot|patient bed|hammock)', ['sleep']),
    (r'^(chest|royal chest|coffin|sarcophagus|safe)$', ['open']),
    (r'^(stairs |stairwell|spiral stair|trapdoor|round door)', ['travel']),
    (r'^(counter |bar counter)', ['counter']),
    (r'^(notice board|wall map|blackboard|hymn board|star chart|lectern|spellbook stand|music stand|picture|portrait large|globe)', ['read']),
    (r'^(wardrobe|cupboard|dresser|sideboard|nightstand|apothecary drawers|bookshelf|scroll rack|barrel|crate|sack|pot$|water jar|basket|cabinet|shelf|keg rack|weapon barrel|coal bin|powder kegs)', ['search']),
    (r'^(wall torch|wall sconce|hanging lantern|leaf lantern|candelabra|candle$|brazier|fireplace|long hearth|sanctuary lamp|paschal candle|votive stand|footlights)', ['light']),
    (r'^(magic circle)$', ['walk']),
]
DIR_RE = re.compile(r' ([NSEW])\d?$')
FACING_EXTRA = {'choir stall': 'S'}

# 60자보다 짧던 설명 보강(생김새 + 놓는 곳). 그 밖은 v5 메타의 요약을 쓴다.
DESC = {
    'chopping block': '칼이 꽂힌 굵은 통나무 도마 — 위에서 보이는 둥근 나이테 절단면에 칼 한 자루. 정육점·생선 손질터 작업대 옆.',
    'anvil': '검은 쇠모루(1칸) — 뿔 달린 윗면이 위에서 보이고 나무 받침 위에 선다. 대장간 용광로 앞, 옆에 담금질 통.',
    'grindstone': '나무 틀에 건 둥근 숫돌 바퀴와 발판·물받이. 대장간 작업장 바닥, 모루 근처.',
    'quench barrel': '물이 찬 쇠테 담금질 통 — 위에서 보이는 물 표면. 대장간 모루 바로 옆에 1개.',
    'weapon barrel': '칼·창 자루가 위로 삐죽 꽂힌 나무 통. 대장간·무기점 바닥 구석, 카운터 옆.',
    'piano': '짙은 나무 업라이트 피아노(2칸) — 건반 덮개 윗면이 보인다. 선술집·저택 홀 북쪽 벽, 앞에 스툴.',
    'lute': '벽에 비스듬히 건 류트(둥근 몸통·꺾인 목). 선술집·음유시인 집 벽면 윗줄.',
    'bar stool': '쇠다리 둥근 바 의자 — 둥근 좌판 윗면이 보인다. 바 카운터 남쪽에 줄로.',
    'pew': '남쪽을 보는 등받이 나무 긴의자(2칸) — 좌판이 위에서 보이고 등판은 뒤(북쪽). 예배당 통로 양쪽에 줄지어.',
    'armchair': '천을 씌운 푹신한 안락의자 — 방석 윗면과 팔걸이. 벽난로·찻상 옆, 거실·서재.',
    'sofa': '천 씌운 2인 소파(2칸) — 방석 윗면, 등받이는 뒤. 거실·응접실 벽 앞, 앞에 찻상.',
    'coat rack': '외투와 모자를 건 나무 옷걸이 기둥. 방·여관 입구 옆 구석.',
    'bathtub': '다리 달린 하얀 욕조(2칸) — 위에서 보이는 물 표면. 욕실·여관 욕실 바닥.',
    'kitchen sink': '펌프 손잡이 달린 돌 개수대 — 오목한 개수 칸이 위에서 보인다. 부엌 북쪽 벽 앞.',
    'water jar': '물이 찬 큰 오지독 — 둥근 입구로 물이 보인다. 부엌·작업장·마당 구석.',
    'crystal ball': '나무 받침 위의 둥근 수정구(빛이 어린다). 점술가 천막·마법사 방 탁자 옆.',
    'treasure pile': '금화·보석·잔이 쌓인 더미(2칸). 보물고·용의 둥지·마왕성 금고 바닥.',
    'royal chest': '금테 두른 붉은 칠 보물 상자 — 뚜껑 윗면이 보인다. 왕실 침실·보물고. 열면 아이템(열림 그림 없음).',
    'loom': '나무 베틀(2칸) — 걸린 날실과 앉는 자리. 재단사·직물 작업실 북쪽 벽 앞.',
    'fabric bolt rack': '색색 옷감 두루마리를 꽂은 나무 선반. 재단사·옷가게 벽 앞.',
    'wardrobe': '두 문 나무 옷장(키가 크다, 처마 그림자). 침실·여관 객실 북쪽 벽. 조사하면 옷·아이템.',
    'doormat': '출입문 안쪽의 거친 발깔개(밟을 수 있다). 문 바로 안 한 칸.',
    'desk 3x1': '짙은 나무 3칸 책상 — 넓은 상판이 위에서 보인다. 저택 서재 가운데, 뒤 북쪽 벽에 책장, 남쪽에 의자.',
    'desk 4x1': '짙은 나무 4칸 긴 책상. 필사실·관청 사무실 가운데, 남쪽 줄에 의자 2개.',
    'desk 2x2': '짙은 나무 2×2 넓은 책상. 집무실 가운데, 남쪽에 의자, 둘레에 책장.',
    'desk 3x2': '짙은 나무 3×2 큰 책상(지도·종이를 펼친다). 영주·학자 집무실 가운데.',
    'desk 4x2': '짙은 나무 4×2 회의 책상. 길드·회의실 가운데, 둘레에 의자.',
    'counter 3x1': '3칸 나무 가게 카운터 — 상판 윗면, 주인은 북쪽 뒤에 선다. 빵집·대장간·재단사 창구. 뒤 벽에 선반.',
    'counter 4x1': '4칸 긴 나무 카운터(바). 약국·선술집·여관 바, 주인은 뒤, 남쪽에 바 의자 2~3개.',
    'kcounter 4x1': '돌 상판 4칸 긴 조리대(도마·그릇). 성·여관 큰 부엌 북쪽 벽 앞.',
    'sideboard 4x1': '짙은 나무 4칸 긴 찬장(낮다, 위에 그릇). 연회장·큰 식당 북쪽 벽 앞.',
    'tea 3x1': '붉은 천을 덮은 3칸 긴 찻상. 응접실 소파 앞 가운데.',
    'tea 4x1': '붉은 천을 덮은 4칸 긴 찻상. 큰 응접실 가운데, 양옆 벤치·소파.',
    'tea 2x2': '붉은 천을 덮은 2×2 찻상. 거실 한가운데, 네 변에 안락의자.',
    'tea 3x2': '붉은 천을 덮은 3×2 찻상. 살롱 가운데, 둘레에 소파·안락의자.',
    'tea 4x2': '붉은 천을 덮은 4×2 큰 찻상. 귀족 응접실·연회 대기실 가운데.',
    'broom and bucket': '벽에 기댄 빗자루와 나무 물 양동이. 하녀 방·부엌·창고 구석.',
    'coal bin': '숯이 수북한 나무 통 — 위에서 숯이 보인다. 대장간 화로·용광로 바로 옆.',
    'pipe rack': '담뱃대 여러 개를 건 작은 나무 걸이(벽면 윗줄). 호빗 굴 복도·거실 벽.',
    'stage curtain': '무대 양끝에 드리운 붉은 막(키 큰 걸이). 극장 무대 양옆.',
    'pitchfork': '벽에 기대 건 쇠스랑(벽면 윗줄). 마구간 건초 더미 위 벽에 1~2개.',
    'altar E': '돌 독립 제단(2×2) — 흰 천 덮은 윗면에 촛대·성경·성작을 얹는다. 성단소 가운데, 사방으로 돌 수 있게.',
    'pulpit': '나무 설교단(4×3) — 계단으로 오르는 단상. 예배당 신랑 동쪽 끝 북쪽 기둥 곁.',
    'hymn board': '성가 번호판(벽면 윗줄, 나무 판에 숫자). 예배당 설교단 근처 벽.',
}


def notes_for(oid, o, kind):
    """(use, facing, states, desc 보강 또는 None). o 는 v5 메타 또는 새 기물 가짜 객체."""
    use = list(o.get('use') or [])
    if not use:
        for rx, u in RULES:
            if re.search(rx, oid): use = list(u); break
    if not use: use = ['walk'] if kind == 'flat' else ['block']
    unknown = [u for u in use if u not in USE_KO]
    if unknown: raise SystemExit(f'{oid}: 모르는 use {unknown} (use6.USE_KO)')
    m = DIR_RE.search(oid)
    facing = o.get('facing') or (m.group(1) if m else FACING_EXTRA.get(oid))
    states = o.get('states')
    return use, facing, states, DESC.get(oid)
