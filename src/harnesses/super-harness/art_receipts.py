"""Refresh native adapter receipts after execution, before collecting images."""
import json
from pathlib import Path
import subprocess
import sys


def refresh(root, request):
    root=Path(root)
    if request['harness']!='modern-chipset': return
    seed=json.loads((root/request['data']/'seed.json').read_text())
    if not seed.get('classroomContract'): return
    # This is the prepared native adapter, using its real state and verdicts.
    script='''import json,sys
from pathlib import Path
root=Path(sys.argv[1]);sys.path.insert(0,str(root/'src/harnesses/modern-chipset'))
import classroom
rd=root/sys.argv[3]/sys.argv[4]
classroom.receipt(json.loads((rd/'state.json').read_text()),json.loads((root/sys.argv[2]/'seed.json').read_text()),root,rd)
'''
    subprocess.run([sys.executable,'-c',script,str(root),request['data'],request['runs'],request['round']],cwd=root,check=True)
