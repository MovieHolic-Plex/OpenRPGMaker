"""Give already-produced spaces a finish lane before admitting more discovery work."""
import json
import store

# Installation is handled by its dedicated adapter; no fake done state here.
RANK = {'bake':0, 'probe':1, 'review':2, 'art-context-review':3,
        'art-demo':4, 'build':5, 'art-layout-review':6, 'art':7}


def focus():
    try: return json.loads(store.setting('completion_priority') or '[]')
    except ValueError: return []


def waiting():
    ids=set(focus())
    return sorted((c for c in store.concepts() if c['id'] in ids and c['stage'] in RANK
                   and c['status']=='queued'),key=lambda c:(RANK[c['stage']],c['updated']))


def reason(c):
    ahead=waiting()
    if not ahead: return None
    # Only the next ready finishing stage may reserve the next empty slot.
    if c['id']!=ahead[0]['id']:return 'completion-priority'
    return None


def order(ids):
    ranks={c['id']:i for i,c in enumerate(waiting())}
    return sorted(ids,key=lambda cid:ranks.get(cid,len(ranks)))


from contextlib import contextmanager
import fcntl
from pathlib import Path


@contextmanager
def admissions():
    """Serialize the slot check + launch across scoped supervisor processes."""
    with (Path(store.DATA)/'space-admission.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try: yield
        finally: fcntl.flock(lock, fcntl.LOCK_UN)
