import json, urllib.request
from pathlib import Path
OUT=Path(__file__).parent
PORT=json.loads((OUT/'browser-control.json').read_text())['port']
def command(**data):
 r=urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{PORT}',data=json.dumps(data).encode()),timeout=130)
 return json.loads(r.read()).get('value')
def ev(code):return command(op='eval',code=code)
def arm(predicate):
 return ev('''(() => {window.__livePending = new Promise((resolve,reject)=>{const check=()=>{%s};const finish=()=>{if(check()){observer.disconnect();clearTimeout(timer);resolve(true)}};const observer=new MutationObserver(finish);const timer=setTimeout(()=>{observer.disconnect();reject(new Error('Missing observed state'))},120000);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,characterData:true});finish();});return 'armed';})()''' % ('return ('+predicate+')'))
def done():return ev('window.__livePending')
def key(k,predicate):
 arm(predicate);command(op='key',key=k);return done()
def shot(name):return command(op='shot',name=name)
if __name__=='__main__':
 print(key('Enter','window.__oprnDebug && document.querySelector("[data-testid=runtime-state-json]") && !document.querySelector("[data-testid=play-loading-overlay]")'))
 print(ev('JSON.stringify({state:window.__oprnDebug.readState(),sprites:window.__oprnCharacterSprites?.(),testids:[...document.querySelectorAll("[data-testid]")].map(e=>e.dataset.testid)})'))
 shot('01-canonical-field.png')
