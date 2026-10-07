"""공용 번들과 일치하는 품질 검수 페이지 — 자체완결 PNG·전후 비교·전체 견본.

python3 src/harnesses/tileset-authoring/lib/viz_progress.py
기본: verify-shots/tileset-i6 → ~/claude-viz/pokemon-tiles-progress.html
--evidence / --out 으로 경로를 바꿀 수 있다. 판정은 assessment.json에서 읽는다.
원작 학습 그림은 이 페이지에 넣지 않는다.
"""
import argparse
import base64
import html
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
SHEETS = [
    ('overworld', '본 시트', '마을·길·동굴·센터·마트'),
    ('rooms', '실내', '연구소·백화점·박물관·학교·배·리그'),
    ('coast', '해안', '항구·해변·해안 도시·물체 도감'),
    ('climate', '기후', '눈 마을·재 마을·사막·빙판 길'),
    ('dungeon', '던전', '용암굴·얼음굴·바다굴·유적·유령 탑·아지트'),
    ('gyms', '체육관', '8개 테마와 퍼즐 전·후'),
    ('wild', '야생', '숲 미로·산·강·늪·정원'),
]
# I2–I5는 당시 기록. I6는 아래에서 현재 assessment와 합친다.
ROUNDS = {
    'overworld': ['합격', '화단 울타리·굴 벽 반복', '건물 비례', '공터·장치 주머니'],
    'rooms': ['합격', '합격', '합격', '합격'],
    'coast': ['나무 조각 손상', '합격', '합격', '합격'],
    'climate': ['눈 벼랑 화풍', '모래찜질·고원 바위', '사막 단·눈 지붕', '고원 모서리·빈 땅'],
    'dungeon': ['향로 오독', '합격', '용암 격자', '용암 테·옆벽 점선'],
    'gyms': ['회전 축·금 오독', '레인 줄·깨진 판', '그림자·김·벽', '용암 테'],
    'wild': ['합격', '합격', '둥근 조각 공유', '고원 모서리'],
}
FIXES = [
    ('마을을 네 채의 크기에 맞춤', '30×22에서 22×20으로 줄였다. 네 문 앞 길·남북 출구를 잇고, 남은 땅을 연못·나무·화단으로 나눴다.', 'overworld-map-before-after.png'),
    ('장치 뒤의 벽과 목적지를 보이게 함', '줄기 줄을 수관으로 채웠다. 밀기 바위와 자르기 나무 뒤에 작은 보상 캡슐 자리를 놓았다.', 'overworld-route-before-after.png'),
    ('2칸 용암 수로에 표면 자국을 넣음', '뜨거운 테를 피한 성긴 기포·물결을 넣고, 곧은 변 세 벌을 섞었다. 던전과 체육관은 같은 그림 함수를 쓴다.', 'gyms-gym_dragon-before-after.png'),
    ('굴 옆벽의 밝은 점선을 낮춤', '바다굴·용암굴 윗면 램프의 밝기 비를 본 굴과 맞췄다. 돌 덩이가 어두운 바위 면으로 읽힌다.', 'dungeon-sea_cave-before-after.png'),
    ('고원 옆벽과 앞면의 끊김을 고침', '윗면·옆벽에 붙은 어깨와 오목 모서리는 원래 앞면을 유지한다. 열린 발끝은 둥글게 남겼다.', 'wild-river-before-after.png'),
    ('재 마을의 빈 땅을 다시 배치함', '센터를 길 옆으로 옮기고 벼랑 아래에 나무 무리를 더했다. 문 앞 길과 출구가 이어진다.', 'climate-ash_town-before-after.png'),
]


def uri(path):
    with Image.open(path) as source:
        im = source.convert('RGBA')
        buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
        return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode(), im.size


def pixel_hash(path):
    with Image.open(path) as im:
        return hashlib.sha256(im.convert('RGBA').tobytes()).hexdigest()


def fig(path, caption, scale=1):
    u, (w, _h) = uri(path)
    cap = html.escape(caption)
    return (f'<figure><button class="image-button" aria-label="{cap} 확대" data-width="{w}">'
            f'<img loading="lazy" src="{u}" alt="{cap}" style="width:{w * scale}px;max-width:100%">'
            f'</button><figcaption>{cap}</figcaption></figure>')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--evidence', type=Path, default=ROOT / 'verify-shots/tileset-i6')
    ap.add_argument('--out', type=Path, default=Path.home() / 'claude-viz/pokemon-tiles-progress.html')
    args = ap.parse_args(); ev = args.evidence.resolve()
    assessment = json.loads((ev / 'assessment.json').read_text())
    manifest = json.loads((ev / 'manifest.json').read_text())
    index = json.loads((ROOT / 'src/assets/monsterKit/index.json').read_text())
    for row in index:
        key = row['theme'].removeprefix('monster-')
        if row['run'] != manifest['sheets'][key]['run'] or row['run'] != assessment['sheets'][key]['run']:
            raise ValueError(f'{key}: 번들과 검수 자료의 run이 다름 — 자료를 다시 만들고 검수해야 한다')
        expected = assessment['sheets'][key]['sheet_sha256']
        if expected != manifest['sheets'][key]['sheet_sha256'] or expected != pixel_hash(ROOT / f'public/assets/monster-kit/monster-{key}.png'):
            raise ValueError(f'{key}: 검수한 시트와 현재 번들의 픽셀이 다름')
        for sample in assessment['sheets'][key]['maps']:
            name, expected = sample['name'], sample['image_sha256']
            if (expected != manifest['sheets'][key]['map_sha256'][name]
                    or expected != pixel_hash(ev / key / f'{name}.png')
                    or expected != pixel_hash(ROOT / f'public/assets/monster-kit/references/monster-{key}/{name}.png')):
                raise ValueError(f'{key}:{name}: 검수한 견본과 현재 번들의 픽셀이 다름')
    total = sum(len(s['maps']) for s in assessment['sheets'].values())
    diffs = sum(len(p['different']) for p in manifest['same_names'])
    pairs = sum(p['shared'] for p in manifest['same_names'])
    minimum = min(m['score'] for s in assessment['sheets'].values() for m in s['maps'])
    passed = assessment['pass']
    h = ['''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>포켓몬풍 타일 7장 · 6차 검수</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{font-family:system-ui,"Noto Sans KR",sans-serif;background:#16181d;color:#e6e6e6;margin:0;line-height:1.6}main{max-width:1180px;margin:auto;padding:28px 24px 64px}h1{font-size:28px;line-height:1.3;margin:8px 0}h2{font-size:21px;margin:34px 0 14px}h3{font-size:17px;margin:12px 0 6px}.sub,figcaption{color:#a7b0bf;font-size:13px}.box,.card,.fix{background:#20242c;border:1px solid #343b48;border-radius:10px;padding:16px 18px}.box{margin:16px 0}.cards,.fixes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.cards{grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}.badge{display:inline-block;background:#235b3b;color:#b0efc5;border-radius:4px;padding:2px 9px;font-size:12px;margin-left:8px}.badge.fail{background:#76352a;color:#ffd0c7}.stats{display:flex;gap:32px;flex-wrap:wrap;margin:16px 0 0}.stats b{display:block;font-size:27px;color:#b0efc5}.stats span{font-size:13px;color:#b5becb}.card .sub{margin:6px 0}.run{font-family:ui-monospace,monospace;color:#a6bedf;font-size:12px}figure{margin:12px 0 0}.image-button{border:0;padding:0;background:transparent;display:block;cursor:zoom-in;max-width:100%}img{display:block;height:auto;image-rendering:pixelated;border:1px solid #414652}figcaption{margin-top:5px}table{border-collapse:collapse;font-size:13px;width:100%}td,th{border:1px solid #3b424f;padding:9px 10px;text-align:left}th{background:#232b35}.table-scroll{overflow:auto}.okay{color:#a3e6b9}.filters{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}button.filter,dialog button{border:1px solid #475362;border-radius:6px;background:#232b35;color:#e6e6e6;padding:7px 12px;cursor:pointer}button.filter[aria-pressed=true]{background:#315c47;border-color:#8dbc9c}.gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.sample{min-width:0}.sample[hidden]{display:none}.sample figure{margin-top:0}.sample .reason{color:#b7c0cf;font-size:13px;max-width:520px}a{color:#b6d4ff}details{margin:20px 0}summary{cursor:pointer;color:#c4d2e4}dialog{max-width:96vw;max-height:94vh;border:1px solid #566070;background:#20242c;padding:16px;color:#eee}dialog::backdrop{background:#000c}.dialog-bar{display:flex;gap:8px;align-items:center;position:sticky;top:0;background:#20242c;padding:0 0 10px}#zoom-title{flex:1}#zoom-image{max-width:none}@media(max-width:700px){main{padding:20px 14px}.fixes,.gallery{grid-template-columns:1fr}.stats{gap:20px}h1{font-size:24px}}
</style></head><body><main>''']
    badge = '자체 검수 합격' if passed else '수정 필요'
    h.append(f'<div class="sub">{assessment["date"]} · 공용 번들 기준 · {assessment["reviewer"]}</div>')
    h.append(f'<h1>포켓몬풍 16px 타일 7장 <span class="badge{(" fail" if not passed else "")}">{badge}</span></h1>')
    h.append(f'<p>I5에서 남은 배치·용암·굴 벽·고원 모서리를 수정하고 6차 검수를 마쳤다.</p><div class="stats"><div><b>{total}</b><span>정상 견본 맵</span></div><div><b>{minimum}/10</b><span>견본 최저 점수</span></div><div><b>{assessment["critical"]} · {assessment["medium"]}</b><span>남은 치명 · 중 결함</span></div><div><b>{diffs}</b><span>같은 이름 칸의 그림 차이</span></div></div>')
    h.append('<div class="box"><b>이번 회차는 자체 시각 검수다.</b> 정상 맵·물체 조립·3×3 바닥 반복을 직접 확대해 8점 기준으로 판정했다. 원작과 세부 밀도·완성도 차이가 있어 9~10점으로 평가하지 않았다.</div>')
    h.append(fig(ev / 'overworld/map.png', '6차 본 마을 · 22×20칸 · 네 문·남북 출구·화단 연결', scale=2))
    h.append('<h2>1. 시트별 결과</h2><div class="cards">')
    for key, name, desc in SHEETS:
        d = assessment['sheets'][key]
        low = min(m['score'] for m in d['maps'])
        status = '합격' if d['pass'] else '수정 필요'
        h.append(f'<div class="card"><b>{name}</b><span class="badge">{status}</span><div class="sub">{desc}</div><div>{len(d["maps"])}개 견본 · 최저 {low}/10</div><div class="run">monster-{key} / {d["run"]}</div></div>')
    h.append(f'<div class="card"><b>같은 게임 대조</b><span class="badge">{diffs}건 차이</span><div class="sub">7시트의 21쌍 · 중복 포함 {pairs:,}칸 대조. 색이 다른 지역 재료는 형태와 빛 방향도 나란히 확인했다.</div></div></div>')
    h.append('<h2>2. 이번 수정 · 왼쪽 I5 / 오른쪽 I6</h2><div class="fixes">')
    for title, txt, filename in FIXES:
        h.append(f'<section class="fix"><h3>{title}</h3><div class="sub">{txt}</div>')
        h.append(fig(ev / filename, title + ' · 전후 비교'))
        h.append('</section>')
    h.append('</div><details><summary>눈·사막 고원 모서리도 보기</summary>')
    for filename, title in [('climate-ice_route-before-after.png', '눈 고원'), ('climate-desert-before-after.png', '사막 고원')]:
        h.append(fig(ev / filename, title + ' · 왼쪽 I5 / 오른쪽 I6'))
    h.append('</details><h2>3. 품질 루프 기록</h2><div class="table-scroll"><table><tr><th>시트</th><th>2차</th><th>3차</th><th>4차</th><th>5차</th><th>6차 자체 검수</th></tr>')
    for key, name, _desc in SHEETS:
        row = f'<tr><th>{name}</th>'
        for note in ROUNDS[key]:
            row += f'<td class="{("okay" if note == "합격" else "")}">{note}</td>'
        row += '<td class="okay">합격 · 8점</td>' if assessment['sheets'][key]['pass'] else '<td>수정 필요</td>'
        h.append(row + '</tr>')
    h.append('</table></div>')
    h.append('<h2>4. 검수 범위와 남은 한계</h2><div class="box"><ul><li>정상 54맵의 전체 모습과 4배 격자 조각. 구조 킷 437개와 사용 중 소품을 조립해 픽셀 중복을 합친 422개 그림 확인.</li><li>607개 바닥·벽·액체 반복 그림을 3×3으로 붙임. 중복 제거한 397개를 확대 확인. 줄눈·판자 등 의도된 무늬는 용도를 함께 판단.</li><li>제작 단계 draw → bake → showcase → wire와 7시트 배선 확인 완료. 본 시트 통행 확인 337건, 실패 0. 전체 gates·Vitest·typecheck는 실행하지 않았다.</li><li>고원 어깨에 각진 픽셀이 일부 남고, 용암 자국은 유한한 변형이다. 같은 자연 칸을 연속 반복하지 말고 견본처럼 섞는다.</li><li>캡슐·체육관 장치는 이벤트를 올릴 타일 자리다. 그림과 배치 문법을 제공한다.</li></ul></div>')
    h.append('<h2>5. 현재 견본 54장</h2><div class="sub">16px 칸을 2배로 표시. 그림을 누르면 확대해서 볼 수 있다.</div><div class="filters"><button class="filter" data-theme="all" aria-pressed="true">전체</button>')
    for key, name, _desc in SHEETS:
        h.append(f'<button class="filter" data-theme="{key}" aria-pressed="false">{name}</button>')
    h.append('</div><div class="gallery">')
    for key, name, _desc in SHEETS:
        for sample in assessment['sheets'][key]['maps']:
            path = ev / key / f'{sample["name"]}.png'
            with Image.open(path) as im: w, height = im.size
            cap = f'{name} · {sample["name"]} · {w // 16}×{height // 16}칸 · {sample["score"]}/10'
            h.append(f'<article class="sample" data-theme="{key}">' + fig(path, cap, scale=2))
            h.append(f'<p class="reason">{html.escape(sample["reason"])}</p></article>')
    h.append('''</div></main><dialog id="zoom"><div class="dialog-bar"><span id="zoom-title"></span><button id="zoom-less" aria-label="축소">−</button><button id="zoom-more" aria-label="확대">+</button><button id="zoom-close">닫기</button></div><img id="zoom-image" alt=""></dialog>
<script>
const dialog=document.querySelector('#zoom'),img=document.querySelector('#zoom-image');let baseWidth=0,scale=2;
function resize(){img.style.width=(baseWidth*scale)+'px'}
document.querySelectorAll('.image-button').forEach(button=>button.addEventListener('click',()=>{const source=button.querySelector('img');img.src=source.src;img.alt=source.alt;document.querySelector('#zoom-title').textContent=source.alt;baseWidth=Number(button.dataset.width);scale=2;resize();dialog.showModal()}));
document.querySelector('#zoom-less').addEventListener('click',()=>{scale=Math.max(1,scale-1);resize()});document.querySelector('#zoom-more').addEventListener('click',()=>{scale=Math.min(8,scale+1);resize()});document.querySelector('#zoom-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelectorAll('.sample').forEach(sample=>sample.hidden=button.dataset.theme!=='all'&&sample.dataset.theme!==button.dataset.theme)}));
</script></body></html>''')
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text('\n'.join(h))
    print(args.out, args.out.stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
