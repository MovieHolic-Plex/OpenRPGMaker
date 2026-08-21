"""placed.json → 한국어 라벨/카테고리/검색태그 + 감독 청취용 오디션 페이지.

원칙: 나는 소리를 들을 수 없다. 라벨 근거는 (1) 원본 파일명 의미 (2) 원본 팩의 폴더 분류
(3) 측정값(길이/피크/RMS) 뿐이다. 음색 형용사를 지어내지 않는다 — 그건 감독이 듣고 채운다.
"""
import argparse, json, os, re, sys, html

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
_ap = argparse.ArgumentParser()
_ap.add_argument('--staging', default=os.path.join(REPO, 'dist', 'se-staging'))
HERE = os.path.abspath(_ap.parse_args().staging)
# 오디션 페이지의 오디오 경로는 이 스테이징 디렉터리에서 public/ 로 가는 상대 경로다.
# 서버 없이 file:// 로 열려야 하므로 절대 URL 을 쓰지 않는다.
AUDIO_PREFIX = os.path.relpath(os.path.join(REPO, 'public'), HERE).replace(os.sep, '/') + '/'

CUR_SEL   = 'UI · 커서 · 선택'
CUR_OK    = 'UI · 결정 · 취소'
CUR_WIN   = 'UI · 창 · 토글'
CUR_WARN  = 'UI · 경고 · 알림'
CUR_TEX   = 'UI · 질감'
BTL_HIT   = '전투 · 타격'
BTL_MAG   = '전투 · 마법'
MON       = '몬스터 · 음성'
ITEM      = '아이템 · 인벤토리'
DOOR      = '문 · 자물쇠 · 상자'
FOLEY     = '환경 · 폴리'
JINGLE    = '징글 (ME)'

# (정규식, 카테고리, 한국어 기본명, 추가 태그)  — 첫 일치 우선. \1 은 변형 번호.
RULES = [
    # ── kenney-interface (의미 있는 이름 100개) ──────────────────────────
    (r'^kenney-interface/select_(\d+)$',       CUR_SEL,  '커서 이동',      ['커서', '선택', 'select']),
    (r'^kenney-interface/click_(\d+)$',        CUR_SEL,  'UI 클릭',        ['클릭', '커서', 'click']),
    (r'^kenney-interface/tick_(\d+)$',         CUR_SEL,  'UI 틱',          ['틱', '커서', '짧은', 'tick']),
    (r'^kenney-interface/confirmation_(\d+)$', CUR_OK,   '결정',           ['결정', '확인', '확정', 'confirm']),
    (r'^kenney-interface/back_(\d+)$',         CUR_OK,   '뒤로',           ['뒤로', '취소', 'back']),
    (r'^kenney-interface/error_(\d+)$',        CUR_WARN, '오류',           ['오류', '실패', '버저', 'error', 'buzzer']),
    (r'^kenney-interface/question_(\d+)$',     CUR_WARN, '질문',           ['질문', '확인창', 'question']),
    (r'^kenney-interface/bong_(\d+)$',         CUR_WARN, '알림 종',        ['알림', '종', 'bong']),
    (r'^kenney-interface/open_(\d+)$',         CUR_WIN,  '창 열기',        ['열기', '메뉴', 'open']),
    (r'^kenney-interface/close_(\d+)$',        CUR_WIN,  '창 닫기',        ['닫기', '메뉴', 'close']),
    (r'^kenney-interface/maximize_(\d+)$',     CUR_WIN,  '확대',           ['확대', '펼치기', 'maximize']),
    (r'^kenney-interface/minimize_(\d+)$',     CUR_WIN,  '축소',           ['축소', '접기', 'minimize']),
    (r'^kenney-interface/toggle_(\d+)$',       CUR_WIN,  '토글',           ['토글', '체크', 'toggle']),
    (r'^kenney-interface/switch_(\d+)$',       CUR_WIN,  '스위치',         ['스위치', '전환', 'switch']),
    (r'^kenney-interface/scroll_(\d+)$',       CUR_WIN,  '스크롤',         ['스크롤', '목록', 'scroll']),
    (r'^kenney-interface/drop_(\d+)$',         CUR_TEX,  '놓기',           ['놓기', '드래그', 'drop']),
    (r'^kenney-interface/glass_(\d+)$',        CUR_TEX,  'UI 유리',        ['유리', 'glass']),
    (r'^kenney-interface/pluck_(\d+)$',        CUR_TEX,  'UI 플럭',        ['플럭', '현', 'pluck']),
    (r'^kenney-interface/scratch_(\d+)$',      CUR_TEX,  'UI 스크래치',    ['스크래치', 'scratch']),
    (r'^kenney-interface/glitch_(\d+)$',       CUR_TEX,  'UI 글리치',      ['글리치', '전자음', 'glitch']),
    # ── kenney-ui (의미 있는 13개만 채택) ───────────────────────────────
    (r'^kenney-ui/click(\d+)$',                CUR_SEL,  '마우스 클릭',    ['클릭', '마우스', 'click']),
    (r'^kenney-ui/rollover(\d+)$',             CUR_SEL,  '롤오버',         ['롤오버', '호버', 'rollover']),
    (r'^kenney-ui/mouseclick(\d+)$',           CUR_SEL,  '마우스 누름',    ['마우스', '누름', 'mouseclick']),
    (r'^kenney-ui/mouserelease(\d+)$',         CUR_SEL,  '마우스 뗌',      ['마우스', '뗌', 'mouserelease']),
    # ── kenney-jingles (이름은 번호뿐, 폴더가 음색을 준다) ──────────────
    (r'^kenney-jingles/8-bit-jingles/jingles_nes(\d+)$',       JINGLE, '8비트 징글',   ['징글', '8비트', 'ME', 'nes']),
    (r'^kenney-jingles/hit-jingles/jingles_hit(\d+)$',         JINGLE, '히트 징글',    ['징글', '타격', 'ME', 'hit']),
    (r'^kenney-jingles/pizzicato-jingles/jingles_pizzi(\d+)$', JINGLE, '피치카토 징글', ['징글', '피치카토', '현', 'ME']),
    (r'^kenney-jingles/sax-jingles/jingles_sax(\d+)$',         JINGLE, '색소폰 징글',  ['징글', '색소폰', 'ME', 'sax']),
    (r'^kenney-jingles/steel-jingles/jingles_steel(\d+)$',     JINGLE, '스틸드럼 징글', ['징글', '스틸드럼', 'ME', 'steel']),
    # ── oga-rpg-pack (폴더가 곧 카테고리) ───────────────────────────────
    (r'^oga-rpg-pack/battle/swing(\d*)$',              BTL_HIT, '무기 휘두르기', ['휘두르기', '공격', '검', 'swing']),
    (r'^oga-rpg-pack/battle/sword-unsheathe(\d*)$',    BTL_HIT, '검 뽑기',       ['검', '발도', '전투 시작', 'unsheathe']),
    (r'^oga-rpg-pack/battle/magic(\d*)$',              BTL_MAG, '마법 발동',     ['마법', '주문', 'magic']),
    (r'^oga-rpg-pack/battle/spell$',                   BTL_MAG, '주문 시전(긴)', ['마법', '주문', '긴', 'spell']),
    (r'^oga-rpg-pack/interface/interface(\d+)$',       CUR_SEL, 'RPG UI 조작',   ['UI', '메뉴', 'interface']),
    (r'^oga-rpg-pack/inventory/armor-light$',          ITEM, '가벼운 갑옷',      ['갑옷', '장비', 'armor']),
    (r'^oga-rpg-pack/inventory/beads$',                ITEM, '구슬',             ['구슬', 'beads']),
    (r'^oga-rpg-pack/inventory/bottle$',               ITEM, '유리병',           ['병', '포션', 'bottle']),
    (r'^oga-rpg-pack/inventory/bubble(\d*)$',          ITEM, '물방울',           ['물방울', '포션', 'bubble']),
    (r'^oga-rpg-pack/inventory/chainmail(\d+)$',       ITEM, '사슬갑옷',         ['사슬갑옷', '장비', 'chainmail']),
    (r'^oga-rpg-pack/inventory/cloth-heavy$',          ITEM, '두꺼운 천',        ['천', '장비', 'cloth']),
    (r'^oga-rpg-pack/inventory/cloth$',                ITEM, '천',               ['천', '장비', 'cloth']),
    (r'^oga-rpg-pack/inventory/coin(\d*)$',            ITEM, '동전',             ['동전', '골드', '구매', 'coin']),
    (r'^oga-rpg-pack/inventory/metal-ringing$',        ITEM, '금속 울림',        ['금속', 'metal']),
    (r'^oga-rpg-pack/inventory/metal-small(\d+)$',     ITEM, '작은 금속',        ['금속', 'metal']),
    (r'^oga-rpg-pack/inventory/wood-small$',           ITEM, '작은 나무',        ['나무', 'wood']),
    (r'^oga-rpg-pack/misc/burp$',                      FOLEY, '트림',            ['트림', 'burp']),
    (r'^oga-rpg-pack/misc/random(\d+)$',               FOLEY, '기타 효과',       ['기타', 'random']),
    (r'^oga-rpg-pack/npc/beetle/bite-small(\d*)$',     MON, '벌레 물기',         ['벌레', '물기', '몬스터', 'beetle']),
    (r'^oga-rpg-pack/npc/giant/giant(\d+)$',           MON, '거인 목소리',       ['거인', '몬스터', 'giant']),
    (r'^oga-rpg-pack/npc/gutteral-beast/mnstr(\d+)$',  MON, '괴수 그르렁',       ['괴수', '몬스터', '으르렁', 'monster']),
    (r'^oga-rpg-pack/npc/misc/wolfman$',               MON, '늑대인간',          ['늑대인간', '몬스터', 'wolf']),
    (r'^oga-rpg-pack/npc/ogre/ogre(\d+)$',             MON, '오거 목소리',       ['오거', '몬스터', 'ogre']),
    (r'^oga-rpg-pack/npc/shade/shade(\d+)$',           MON, '망령 목소리',       ['망령', '유령', '몬스터', 'shade']),
    (r'^oga-rpg-pack/npc/slime/slime(\d+)$',           MON, '슬라임',            ['슬라임', '몬스터', 'slime']),
    (r'^oga-rpg-pack/world/door$',                     DOOR, '문 여닫기',        ['문', 'door']),
    # ── oga-rpg-sfx (접두사가 곧 카테고리) ──────────────────────────────
    (r'^oga-rpg-sfx/blade_(\d+)$',           BTL_HIT, '칼날',          ['칼날', '베기', 'blade']),
    (r'^oga-rpg-sfx/metal_(\d+)$',           BTL_HIT, '금속 충격',     ['금속', '타격', 'metal']),
    (r'^oga-rpg-sfx/spell_fire_(\d+)$',      BTL_MAG, '화염 주문',     ['화염', '불', '마법', 'fire']),
    (r'^oga-rpg-sfx/spell_(\d+)$',           BTL_MAG, '주문',          ['마법', '주문', 'spell']),
    (r'^oga-rpg-sfx/creature_die_(\d+)$',    MON, '크리처 사망',       ['사망', '죽음', '몬스터', 'die']),
    (r'^oga-rpg-sfx/creature_hurt_(\d+)$',   MON, '크리처 피격',       ['피격', '아픔', '몬스터', 'hurt']),
    (r'^oga-rpg-sfx/creature_roar_(\d+)$',   MON, '크리처 포효',       ['포효', '울음', '몬스터', 'roar']),
    (r'^oga-rpg-sfx/creature_slime_(\d+)$',  MON, '슬라임',            ['슬라임', '몬스터', 'slime']),
    (r'^oga-rpg-sfx/creature_monster_(\d+)$', MON, '몬스터 소리',      ['몬스터', 'monster']),
    (r'^oga-rpg-sfx/creature_misc_(\d+)$',   MON, '크리처 기타',       ['몬스터', '기타', 'creature']),
    (r'^oga-rpg-sfx/item_coins_(\d+)$',      ITEM, '동전',             ['동전', '골드', '구매', 'coins']),
    (r'^oga-rpg-sfx/item_gem_(\d+)$',        ITEM, '보석',             ['보석', '획득', 'gem']),
    (r'^oga-rpg-sfx/item_stone_(\d+)$',      ITEM, '돌 아이템',        ['돌', '아이템', 'stone']),
    (r'^oga-rpg-sfx/item_wood_(\d+)$',       ITEM, '나무 아이템',      ['나무', '아이템', 'wood']),
    (r'^oga-rpg-sfx/item_misc_(\d+)$',       ITEM, '아이템 기타',      ['아이템', '기타', 'item']),
    (r'^oga-rpg-sfx/lock_(\d+)$',            DOOR, '자물쇠',           ['자물쇠', '잠금', 'lock']),
    (r'^oga-rpg-sfx/book_(\d+)$',            FOLEY, '책장 넘김',       ['책', '종이', 'book']),
    (r'^oga-rpg-sfx/chain_(\d+)$',           FOLEY, '사슬',            ['사슬', 'chain']),
    (r'^oga-rpg-sfx/stones_(\d+)$',          FOLEY, '돌',              ['돌', 'stone']),
    (r'^oga-rpg-sfx/wood_(\d+)$',            FOLEY, '나무',            ['나무', 'wood']),
    (r'^oga-rpg-sfx/misc_(\d+)$',            FOLEY, '기타',            ['기타', 'misc']),
    # ── oga-sfx (생활 폴리) ─────────────────────────────────────────────
    (r'^oga-sfx/door_close_(\d+)$',          DOOR, '문 닫기',          ['문', '닫기', 'door']),
    (r'^oga-sfx/door_open$',                 DOOR, '문 열기',          ['문', '열기', 'door']),
    (r'^oga-sfx/door_(\d+)$',                DOOR, '문 여닫기',        ['문', 'door']),
    (r'^oga-sfx/key_open_(\d+)$',            DOOR, '열쇠',             ['열쇠', '자물쇠', 'key']),
    (r'^oga-sfx/wooded_box_open$',           DOOR, '나무 상자 열기',   ['상자', '보물', 'chest', 'box']),
    (r'^oga-sfx/hit_(\d+)$',                 BTL_HIT, '타격',          ['타격', '히트', 'hit']),
    (r'^oga-sfx/shot_(\d+)$',                BTL_HIT, '발사',          ['발사', '총', 'shot']),
    (r'^oga-sfx/explosion$',                 BTL_HIT, '폭발',          ['폭발', 'explosion']),
    (r'^oga-sfx/bell_(\d+)$',                CUR_WARN, '종',           ['종', '알림', 'bell']),
    (r'^oga-sfx/gong_(\d+)$',                CUR_WARN, '공',           ['공', '징', 'gong']),
    (r'^oga-sfx/switch_(\d+)$',              CUR_WIN, '스위치',        ['스위치', '레버', 'switch']),
    (r'^oga-sfx/glass_(\d+)$',               FOLEY, '유리',            ['유리', 'glass']),
    (r'^oga-sfx/metal_(\d+)$',               FOLEY, '금속',            ['금속', 'metal']),
    (r'^oga-sfx/paper_(\d+)$',               FOLEY, '종이',            ['종이', 'paper']),
    (r'^oga-sfx/plop_(\d+)$',                FOLEY, '퐁',              ['퐁', '물', 'plop']),
    (r'^oga-sfx/pot_(\d+)$',                 FOLEY, '냄비',            ['냄비', '그릇', 'pot']),
    (r'^oga-sfx/dishes_(\d+)$',              FOLEY, '그릇',            ['그릇', '식기', 'dishes']),
    (r'^oga-sfx/slam_(\d+)$',                FOLEY, '쾅 닫기',         ['쾅', '닫기', 'slam']),
    (r'^oga-sfx/splash_(\d+)$',              FOLEY, '물 튀김',         ['물', '첨벙', 'splash']),
    (r'^oga-sfx/spring_(\d+)$',              FOLEY, '스프링',          ['스프링', '탄성', 'spring']),
    (r'^oga-sfx/tools_(\d+)$',               FOLEY, '공구',            ['공구', '작업', 'tools']),
    (r'^oga-sfx/machine_(\d+)$',             FOLEY, '기계',            ['기계', 'machine']),
    (r'^oga-sfx/wooden_(\d+)$',              FOLEY, '나무',            ['나무', 'wooden']),
]
# place.py 가 파일명을 슬러그화해 '_' 를 '-' 로 바꾼다. 규칙은 '_' 로 쓰여 있으니
# 매칭 직전에 양쪽을 '_' 한 표기로 정규화한다(패턴에 문자 클래스용 '-' 는 없다).
COMPILED = [(re.compile(p.replace('-', '_')), c, n, t) for p, c, n, t in RULES]

PACK_SOURCE = {
    'kenney_interface-sounds': 'Kenney — Interface Sounds (CC0)',
    'kenney_ui-audio':         'Kenney — UI Audio (CC0)',
    'kenney_music-jingles':    'Kenney — Music Jingles (CC0)',
    'rpg_sound_pack':          'artisticdude — RPG Sound Pack (OpenGameArt, CC0)',
    '80-CC0-RPG-SFX':          'rubberduck — 80 CC0 RPG SFX (OpenGameArt, CC0)',
    '100-CC0-SFX':             'rubberduck — 100 CC0 SFX (OpenGameArt, CC0)',
}

data = json.load(open(os.path.join(HERE, 'placed.json'), encoding='utf-8'))
placed = data['placed']

labeled, unmatched = [], []
for p in placed:
    key = p['path'][len('assets/se/'):]
    key = os.path.splitext(key)[0].replace('-', '_')
    for rx, cat, base, tags in COMPILED:
        m = rx.match(key)
        if not m:
            continue
        variant = m.group(1) if m.groups() and m.group(1) else ''
        num = int(variant) if variant.isdigit() else None
        title = base if num is None else '%s %02d' % (base, num)
        labeled.append(dict(
            id=p['id'], path=p['path'], category=cat, title=title, baseName=base,
            variant=num, seconds=p['seconds'], bytes=p['bytes'], sha256=p['sha256'],
            codec=p['codec'], sampleRate=p['sampleRate'], channels=p['channels'],
            peak=p['peak'], rms=p['rms'],
            sourceName=PACK_SOURCE[p['sourcePack']], sourceRel=p['sourceRel'],
            tags=sorted(set(['se', 'cc0'] + tags + [p['stem'].lower()])),
        ))
        break
    else:
        unmatched.append(key)

json.dump(labeled, open(os.path.join(HERE, 'labels.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

CAT_ORDER = [CUR_SEL, CUR_OK, CUR_WIN, CUR_WARN, CUR_TEX, BTL_HIT, BTL_MAG, MON, ITEM, DOOR, FOLEY, JINGLE]
print('라벨 %d개 / 미매칭 %d개' % (len(labeled), len(unmatched)))
for c in CAT_ORDER:
    rs = [x for x in labeled if x['category'] == c]
    print('  %-20s %4d개' % (c, len(rs)))
if unmatched:
    print('\n미매칭(규칙 누락):')
    for u in unmatched[:40]:
        print('   ' + u)

# ── 감독 청취용 오디션 페이지 ─────────────────────────────────────────────
rows_html = []
for c in CAT_ORDER:
    rs = sorted([x for x in labeled if x['category'] == c],
                key=lambda x: (x['baseName'], x['variant'] if x['variant'] is not None else -1))
    if not rs:
        continue
    rows_html.append('<h2>%s <small>%d개</small></h2><table>' % (html.escape(c), len(rs)))
    rows_html.append('<tr><th></th><th>제안 라벨</th><th>길이</th><th>원본 파일</th><th>출처</th><th>메모</th></tr>')
    for x in rs:
        rows_html.append(
            '<tr data-id="%s">'
            '<td><button onclick="p(this)" data-src="%s%s">▶</button></td>'
            '<td class="t">%s</td><td class="n">%.2fs</td>'
            '<td class="f">%s</td><td class="s">%s</td>'
            '<td><input placeholder="고칠 라벨 / 슬롯"></td></tr>'
            % (html.escape(x['id']), AUDIO_PREFIX, html.escape(x['path']),
               html.escape(x['title']), x['seconds'],
               html.escape(x['sourceRel']), html.escape(x['sourceName'])))
    rows_html.append('</table>')

page = """<!doctype html><meta charset="utf-8"><title>CC0 SE 오디션 — 456개</title>
<style>
 body{font:14px/1.5 system-ui,sans-serif;margin:0;padding:24px;background:#12141a;color:#e6e8ee}
 h1{font-size:20px} h2{margin:28px 0 8px;font-size:15px;color:#8ab4f8;border-bottom:1px solid #2a2f3a;padding-bottom:6px}
 h2 small{color:#6b7280;font-weight:400}
 table{border-collapse:collapse;width:100%%} td,th{padding:3px 8px;text-align:left;vertical-align:middle}
 th{color:#6b7280;font-weight:500;font-size:12px}
 tr:hover{background:#1a1e27} .t{font-weight:600} .n{color:#9aa4b2;font-variant-numeric:tabular-nums}
 .f{color:#6b7280;font-family:ui-monospace,monospace;font-size:12px} .s{color:#4b5563;font-size:11px}
 button{background:#2563eb;color:#fff;border:0;border-radius:4px;width:28px;height:24px;cursor:pointer}
 button:hover{background:#3b82f6} button.on{background:#16a34a}
 input{background:#0b0d12;border:1px solid #2a2f3a;color:#e6e8ee;border-radius:4px;padding:2px 6px;width:100%%}
 .note{background:#1a1e27;border-left:3px solid #f59e0b;padding:10px 14px;margin:16px 0;color:#d1d5db}
 .bar{position:sticky;top:0;background:#12141a;padding:10px 0;border-bottom:1px solid #2a2f3a;z-index:9}
 #q{width:320px}
</style>
<h1>CC0 효과음 오디션 — 456개</h1>
<div class="note"><b>라벨은 제안이다.</b> 파일명 의미 + 원본 팩 분류 + 측정한 길이만 근거로 붙였다
 (AI 는 소리를 못 듣는다). 실제 소리와 안 맞는 건 오른쪽 메모 칸에 고쳐 적어라 —
 그 내용으로 카탈로그를 재생성한다. 슬롯 배정(커서/결정/취소/레벨업 등)도 여기 적으면 된다.</div>
<div class="bar">검색 <input id="q" placeholder="라벨·파일명으로 필터" oninput="flt()">
 <button onclick="dump()" style="width:auto;padding:0 10px">메모 내보내기</button></div>
%s
<script>
let cur=null,curBtn=null;
function p(b){ if(cur){cur.pause();} if(curBtn)curBtn.classList.remove('on');
 cur=new Audio(b.dataset.src); curBtn=b; b.classList.add('on');
 cur.onended=()=>b.classList.remove('on'); cur.play().catch(e=>{b.textContent='!';}); }
function flt(){ const q=document.getElementById('q').value.toLowerCase();
 document.querySelectorAll('tr[data-id]').forEach(tr=>{
  tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none'; }); }
function dump(){ const out=[];
 document.querySelectorAll('tr[data-id]').forEach(tr=>{ const v=tr.querySelector('input').value.trim();
  if(v) out.push({id:tr.dataset.id, was:tr.querySelector('.t').textContent, fix:v}); });
 const t=JSON.stringify(out,null,1); navigator.clipboard.writeText(t);
 alert(out.length+'건 클립보드에 복사했다.\\n\\n'+t.slice(0,600)); }
</script>
""" % ('\n'.join(rows_html))

open(os.path.join(HERE, 'audition.html'), 'w', encoding='utf-8').write(page)
print('\n오디션 페이지: dist/se-staging/audition.html')
