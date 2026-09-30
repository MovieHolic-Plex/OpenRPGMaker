#!/usr/bin/env python3
"""버들항 변형 20곳 — 3/4 재작업 BEFORE / AFTER 고르는 화면 (표준 라이브러리만). 포트 18304, 0.0.0.0.

BEFORE = 재작업 전 커밋에서 뽑아 둔 사본  ~/.local/share/oprn/beodeul-pick/before/var<n>/<장소>/{parts/*.png,render-*.png}
AFTER  = 각 워크트리의 현재 파일            ~/.t3/worktrees/rpg-zzu/beodeul-var<n>/tiledata/beodeul-variants/<장소>/...
정본   = ~/.local/share/oprn/beodeul-pick/picks.sqlite  (current: item_id → choice before|after|redo, note)
         events 표에 모든 선택을 쌓는다. 선택마다 picks.json 을 다시 쓴다(에이전트가 읽는 내보내기).

  python3 scripts/content/beodeul-pick/pick_server.py [--port 18304]
"""
import argparse, glob, hashlib, html, json, os, sqlite3, time, urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

HOME = os.path.expanduser('~')
DATA = os.path.join(HOME, '.local/share/oprn/beodeul-pick')
BEFORE = os.path.join(DATA, 'before')
WT = os.path.join(HOME, '.t3/worktrees/rpg-zzu')
DB = os.path.join(DATA, 'picks.sqlite')
VARS = {1: '마을', 2: '기후 마을', 3: '던전', 4: '특수 던전', 5: '필드'}


def db():
    c = sqlite3.connect(DB)
    c.execute('create table if not exists current(item_id text primary key, choice text, note text, ts real)')
    c.execute('create table if not exists events(id integer primary key, item_id text, choice text, note text, ts real)')
    return c


def after_root(n):
    return os.path.join(WT, f'beodeul-var{n}', 'tiledata', 'beodeul-variants')


def digest(p):
    try:
        with open(p, 'rb') as f: return hashlib.sha1(f.read()).hexdigest()
    except OSError: return None


def verdicts(n):
    out = {}
    p = f'/tmp/v34-var{n}.txt'
    if os.path.exists(p):
        for line in open(p, encoding='utf-8').read().splitlines()[1:]:
            parts = line.split()
            if len(parts) >= 6 and parts[0].endswith('.png'):
                out[os.path.basename(parts[0])] = parts[5]
    return out


def items():
    res = []
    for n in VARS:
        rels = set()
        for root in (os.path.join(BEFORE, f'var{n}'), after_root(n)):
            for p in glob.glob(os.path.join(root, '*', 'parts', '*.png')) + glob.glob(os.path.join(root, '*', 'render-1x.png')):
                rels.add(os.path.relpath(p, root))
        ver = verdicts(n)
        for rel in sorted(rels):
            place = rel.split('/')[0]
            if place.startswith('_'): continue
            b = os.path.join(BEFORE, f'var{n}', rel); a = os.path.join(after_root(n), rel)
            db_, da = digest(b), digest(a)
            state = 'new' if db_ is None else 'gone' if da is None else 'same' if db_ == da else 'changed'
            res.append(dict(id=f'var{n}/{rel}', var=n, place=place, name=os.path.basename(rel),
                            kind='map' if 'render' in rel else 'part', state=state, verdict=ver.get(os.path.basename(rel), '')))
    return res


PAGE = r'''<!doctype html><meta charset=utf-8><title>버들항 3/4 — BEFORE / AFTER 고르기</title>
<style>
body{background:#14161b;color:#ddd;font:13px system-ui,sans-serif;margin:0}
header{position:sticky;top:0;background:#1d2027;padding:10px 16px;border-bottom:1px solid #333;z-index:2}
header select,header label{margin-right:12px}
.g{display:flex;flex-wrap:wrap;gap:10px;padding:14px}
.c{background:#22252d;border:2px solid #3a3d46;border-radius:6px;padding:8px}
.c.pick-before{border-color:#4a8fe0}.c.pick-after{border-color:#4bb35a}.c.pick-redo{border-color:#d9534f}
.pair{display:flex;gap:8px;align-items:flex-end}.pair figure{margin:0;text-align:center}
.pair img{image-rendering:pixelated;background:#8a8f78;display:block}
figcaption{font-size:11px;color:#999;margin-top:2px}
.meta{margin:6px 0 4px;max-width:520px}.meta b{color:#fff}.st{color:#fc6}.v{color:#e88}
button{background:#2e323c;color:#ddd;border:1px solid #555;border-radius:4px;padding:4px 10px;cursor:pointer;margin-right:4px}
button.on{background:#3d6;color:#000}button.on.b{background:#4a8fe0}button.on.r{background:#d9534f;color:#fff}
input.note{width:260px;background:#15171c;color:#ddd;border:1px solid #444;border-radius:4px;padding:3px}
.none{padding:40px;color:#888}
</style>
<header>
<b>버들항 변형 3/4 — BEFORE / AFTER</b> &nbsp;
<select id=var><option value=0>전체 변형</option></select>
<select id=kind><option value=all>조각+맵</option><option value=part>조각만</option><option value=map>맵 전체만</option></select>
<select id=state><option value=changed>재작업된 것만</option><option value=all>전부</option><option value=same>아직 안 바뀐 것</option></select>
<label><input type=checkbox id=undec> 안 고른 것만</label>
<span id=count></span>
<div style="font-size:12px;color:#999;margin-top:4px">버튼: <b>BEFORE</b> = 원래 것이 낫다 · <b>AFTER</b> = 새 3/4 판 · <b>둘 다 별로</b> = 다시. 메모는 입력 뒤 Enter. 고른 것은 바로 저장된다(새로고침해도 남음).</div>
</header>
<div class=g id=g></div>
<script>
const V=%VARS%;let S={items:[],picks:{}};const LOADT=Date.now();
const sel=id=>document.getElementById(id);
for(const [k,v] of Object.entries(V)){const o=document.createElement('option');o.value=k;o.textContent=`${k} ${v}`;sel('var').appendChild(o)}
async function load(){const r=await fetch('/api/state');S=await r.json();draw()}
function scale(kind){return kind==='map'?1:3}
function draw(){const g=sel('g');g.innerHTML='';let n=0;
 const fv=+sel('var').value,fk=sel('kind').value,fs=sel('state').value,fu=sel('undec').checked;
 for(const it of S.items){
  if(fv&&it.var!==fv)continue;if(fk!=='all'&&it.kind!==fk)continue;
  if(fs==='changed'&&!(it.state==='changed'||it.state==='new'))continue;if(fs==='same'&&it.state!=='same')continue;
  const p=S.picks[it.id];if(fu&&p&&p.choice)continue;n++;
  const c=document.createElement('div');c.className='c'+(p&&p.choice?' pick-'+p.choice:'');
  const s=scale(it.kind),t=LOADT;
  const img=(w)=>`<img src="/img/${w}/${encodeURI(it.id)}?t=${t}" onload="this.width=this.naturalWidth*${s};this.style.maxWidth='${it.kind==='map'?'640px':'none'}'" onerror="this.replaceWith(Object.assign(document.createElement('div'),{textContent:'(없음)',style:'color:#777;padding:20px'}))">`;
  c.innerHTML=`<div class=pair><figure>${img('before')}<figcaption>BEFORE</figcaption></figure><figure>${img('after')}<figcaption>AFTER</figcaption></figure></div>
  <div class=meta>var${it.var} · ${it.place} · <b>${it.name}</b> <span class=st>${{changed:'재작업됨',same:'아직 그대로',new:'새로 생김',gone:'지워짐'}[it.state]}</span> ${it.verdict?`<span class=v>검사기(전): ${it.verdict}</span>`:''}</div>
  <div><button class="b ${p&&p.choice==='before'?'on':''}" data-c=before>BEFORE</button><button class="${p&&p.choice==='after'?'on':''}" data-c=after>AFTER</button><button class="r ${p&&p.choice==='redo'?'on':''}" data-c=redo>둘 다 별로</button>
  <input class=note placeholder="메모 (Enter)" value="${p&&p.note?p.note.replace(/"/g,'&quot;'):''}"></div>`;
  c.querySelectorAll('button').forEach(b=>b.onclick=()=>{const cur=(S.picks[it.id]||{}).choice;save(it.id,cur===b.dataset.c?null:b.dataset.c,c.querySelector('.note').value,c)});
  c.querySelector('.note').onkeydown=e=>{if(e.key==='Enter')save(it.id,(S.picks[it.id]||{}).choice||null,e.target.value,c)};
  g.appendChild(c)}
 const done=Object.values(S.picks).filter(p=>p.choice).length;
 sel('count').textContent=`표시 ${n} · 고름 ${done}`;if(!n)g.innerHTML='<div class=none>조건에 맞는 항목이 없습니다. (재작업이 끝난 것부터 나타납니다 — 「전부」로 바꿔 보세요)</div>'}
async function save(id,choice,note,card){const r=await fetch('/api/pick',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,choice,note})});
 if(!r.ok){alert('저장 실패 '+r.status);return}S.picks[id]={choice,note};
 // 다시 그리지 않는다 — 그 카드의 테두리·버튼만 제자리에서 바꾼다(스크롤·그림 유지)
 card.className='c'+(choice?' pick-'+choice:'');
 card.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.c===choice));
 const done=Object.values(S.picks).filter(p=>p.choice).length;sel('count').textContent=sel('count').textContent.replace(/고름 \d+/,'고름 '+done)}
['var','kind','state','undec'].forEach(i=>sel(i).onchange=draw);load();
</script>'''


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def send(self, code, body, ctype='application/json; charset=utf-8'):
        if isinstance(body, str): body = body.encode()
        self.send_response(code); self.send_header('content-type', ctype); self.send_header('cache-control', 'no-store')
        self.send_header('content-length', str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path); path = urllib.parse.unquote(u.path)
        if path == '/':
            return self.send(200, PAGE.replace('%VARS%', json.dumps(VARS, ensure_ascii=False)), 'text/html; charset=utf-8')
        if path == '/api/state':
            c = db(); picks = {r[0]: dict(choice=r[1], note=r[2]) for r in c.execute('select item_id, choice, note from current')}
            return self.send(200, json.dumps(dict(items=items(), picks=picks), ensure_ascii=False))
        if path.startswith('/img/'):
            _, _, which, rest = path.split('/', 3)
            if '..' in rest or not rest.startswith('var'): return self.send(400, '{}')
            n = int(rest[3]); rel = rest.split('/', 1)[1]
            root = os.path.join(BEFORE, f'var{n}') if which == 'before' else after_root(n)
            p = os.path.join(root, rel)
            if not os.path.isfile(p): return self.send(404, '{}')
            with open(p, 'rb') as f: return self.send(200, f.read(), 'image/png')
        self.send(404, '{}')

    def do_POST(self):
        if self.path != '/api/pick': return self.send(404, '{}')
        body = json.loads(self.rfile.read(int(self.headers.get('content-length', 0))) or b'{}')
        iid, choice, note = body.get('id'), body.get('choice'), (body.get('note') or '')[:500]
        if not iid or choice not in (None, 'before', 'after', 'redo'): return self.send(400, '{"error":"bad"}')
        c = db(); now = time.time()
        with c:
            c.execute('insert into events(item_id, choice, note, ts) values (?,?,?,?)', (iid, choice, note, now))
            c.execute('insert into current(item_id, choice, note, ts) values (?,?,?,?) on conflict(item_id) do update set choice=excluded.choice, note=excluded.note, ts=excluded.ts', (iid, choice, note, now))
        rows = {r[0]: dict(choice=r[1], note=r[2]) for r in c.execute('select item_id, choice, note from current')}
        with open(os.path.join(DATA, 'picks.json'), 'w', encoding='utf-8') as f: json.dump(rows, f, ensure_ascii=False, indent=1)
        self.send(200, '{"ok":true}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--port', type=int, default=18304); ap.add_argument('--host', default='0.0.0.0')
    a = ap.parse_args(); os.makedirs(DATA, exist_ok=True); db().close()
    ThreadingHTTPServer((a.host, a.port), H).serve_forever()
