"""Keep the human Allow/Deny log under version control and backed up. Not part of the gate profile
(queue.py / visual_gate.py / native_author.py are), so editing this file never invalidates a receipt.

  export   review.sqlite -> harness-data/beodeul-building-review/decisions.json (append-only log, committed)
  restore  decisions.json -> review.sqlite, only into an EMPTY decisions table (never overwrites a human log)
  backup   consistent sqlite copy of the whole review db into ~/backups/beodeul-review/ (keeps the newest 14)
  status   counts and whether the committed log is behind the database
"""
import argparse, json, os, sqlite3, sys, time
from pathlib import Path

ROOT=Path(__file__).resolve().parents[4]
SOURCE=ROOT/'harness-data/beodeul-building-review'
DATA=Path(os.environ.get('BEODEUL_BUILDING_REVIEW_DATA',str(Path.home()/'.local/share/oprn/beodeul-building-review')))
LOG=SOURCE/'decisions.json'
BACKUPS=Path(os.environ.get('BEODEUL_REVIEW_BACKUP_DIR',str(Path.home()/'backups/beodeul-review')))
KEYS=('seq','item','sha','decision','note','at')

def rows():
    with sqlite3.connect(DATA/'review.sqlite') as c:
        return [dict(zip(KEYS,r)) for r in c.execute('select seq,item,sha,decision,note,at from decisions order by seq')]
def effective(log):
    """Latest decision per (item, sha): the only thing the review screen and the installer act on."""
    last={}
    for r in log:last[(r['item'],r['sha'])]=r
    return list(last.values())
def export():
    log=rows()
    if LOG.exists():
        old=json.loads(LOG.read_text())['log']
        # append-only: the committed log must be a prefix of the database log
        if log[:len(old)]!=old:raise SystemExit('REFUSED: committed decisions.json is not a prefix of review.sqlite (history rewritten or wrong database).')
    eff=effective(log)
    out={'schema':'beodeul-building-review-decisions/1','exportedAt':time.strftime('%Y-%m-%dT%H:%M:%S%z'),
         'counts':{k:sum(e['decision']==k for e in eff) for k in ('allow','deny','pending')},'log':log}
    LOG.write_text(json.dumps(out,ensure_ascii=False,indent=1)+'\n');print(json.dumps(out['counts']),len(log),'log rows ->',LOG)
def restore():
    log=json.loads(LOG.read_text())['log']
    DATA.mkdir(parents=True,exist_ok=True)
    with sqlite3.connect(DATA/'review.sqlite') as c:
        c.execute('create table if not exists decisions(seq integer primary key, item text, sha text, decision text, note text, at text)')
        if c.execute('select count(*) from decisions').fetchone()[0]:raise SystemExit('REFUSED: decisions table is not empty; restore never overwrites a human log.')
        c.executemany('insert into decisions values(?,?,?,?,?,?)',[tuple(r[k] for k in KEYS) for r in log]);c.commit()
    print('restored',len(log),'rows into',DATA/'review.sqlite')
def backup():
    BACKUPS.mkdir(parents=True,exist_ok=True);target=BACKUPS/('review-'+time.strftime('%Y%m%dT%H%M%S')+'.sqlite')
    src=sqlite3.connect(DATA/'review.sqlite');dst=sqlite3.connect(target);src.backup(dst);dst.close();src.close()
    for old in sorted(BACKUPS.glob('review-*.sqlite'))[:-14]:old.unlink()
    print(target,target.stat().st_size,'bytes')
def status():
    log=rows();eff=effective(log);committed=json.loads(LOG.read_text())['log'] if LOG.exists() else []
    print(json.dumps({'dbRows':len(log),'committedRows':len(committed),'behind':len(log)-len(committed),
        'allow':sum(e['decision']=='allow' for e in eff),'deny':sum(e['decision']=='deny' for e in eff),'backups':len(list(BACKUPS.glob('review-*.sqlite')))}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('cmd',choices=['export','restore','backup','status']);a=p.parse_args()
    {'export':export,'restore':restore,'backup':backup,'status':status}[a.cmd]()
