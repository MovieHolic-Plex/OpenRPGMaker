import sys,json,base64,urllib.request,time
prompt=open(sys.argv[1]).read().strip(); out=sys.argv[2]
body=json.dumps({"prompt":prompt,"size":sys.argv[3] if len(sys.argv)>3 else "1536x1024","return_base64":True}).encode()
for a in range(3):
  try:
    r=urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:8091/v1/generate/json",data=body,headers={"content-type":"application/json"}),timeout=900)
    j=json.loads(r.read())
    b=j.get("image_b64")
    if not b: print("noimg",str(j)[:300]); time.sleep(20); continue
    if "," in b[:100]: b=b.split(",",1)[1]
    open(out,"wb").write(base64.b64decode(b)); print("OK",out); sys.exit(0)
  except Exception as e:
    print("fail",a,str(e)[:300]); time.sleep(20)
sys.exit(1)
