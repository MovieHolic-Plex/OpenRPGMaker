import json, urllib.request
from pathlib import Path
OUT=Path(__file__).parent
PORT=json.loads((OUT/'browser-control.json').read_text())['port']
def command(**data):
 try:
  r=urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{PORT}',data=json.dumps(data).encode()),timeout=130)
  return json.loads(r.read()).get('value')
 except urllib.error.HTTPError as e: raise RuntimeError(e.read().decode()) from e
def ev(code):return command(op='eval',code=code)
def arm(predicate):
 return ev('''(() => {window.__visibilityPending = new Promise((resolve,reject)=>{const check=()=>{%s};let timer;const clean=()=>{observer.disconnect();clearTimeout(timer);for(const type of ['focusin','scroll','resize'])window.removeEventListener(type,finish,true)};const finish=()=>{if(check()){clean();resolve(true)}};const observer=new MutationObserver(finish);timer=setTimeout(()=>{clean();reject(new Error('Missing observed state'))},30000);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,characterData:true});for(const type of ['focusin','scroll','resize'])window.addEventListener(type,finish,true);finish();});window.__visibilityPending.catch(()=>{});return 'armed';})()''' % ('return ('+predicate+')'))
def done():return ev('window.__visibilityPending')
def key(k,predicate):
 arm(predicate);command(op='key',key=k);return done()
def shot(name):return command(op='shot',name=name)
def save(name,value): (OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2))
def settle():return ev("(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(e=>{if(e.name!=='AbortError')throw e})));return true})()")
def focus():return ev('document.activeElement?.dataset.testid')
