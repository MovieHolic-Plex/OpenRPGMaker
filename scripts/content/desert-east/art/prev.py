import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import terrain as TR
from kit import contact
def show(reg, path, z=4, W=1800, ids=None, ground='sand'):
    g = TR.R.render(TR.R.by[ground]).img()
    ims = [(it['id'], reg.render(it).img()) for it in reg.items if not ids or it['id'] in ids]
    contact(ims, path, z=z, W=W, ground=g)
