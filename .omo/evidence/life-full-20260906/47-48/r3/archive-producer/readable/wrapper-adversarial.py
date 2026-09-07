"""Owned exact-ready-signal stub; never interrupt a real suite."""
import receipt as r
import os,sys,subprocess,tempfile,pathlib,selectors,signal,json,shutil
S=pathlib.Path(tempfile.mkdtemp(prefix='st_01a079b9-signal-',dir='/dev/shm'))
fifo=S/'ready';os.mkfifo(fifo)
fd=os.open(fifo,os.O_RDWR|os.O_NONBLOCK)
selector=selectors.DefaultSelector();selector.register(fd,selectors.EVENT_READ)
proc=None
try:
    code='import os,signal; f=os.open('+repr(str(fifo))+',os.O_WRONLY); os.write(f,b"R3_OWNED_STUB_READY\\n"); os.close(f); signal.pause()'
    argv=[sys.executable,str(r.E/'receipt.py'),'wrapper-interrupted','heavy','60',sys.executable,'-c',code]
    (r.E/'wrapper-interruption.command.json').write_text(json.dumps({'argv':argv,'cwd':str(r.W),'trigger':'exact R3_OWNED_STUB_READY newline from owned FIFO subscribed before launch','deadline_seconds':30},indent=2))
    with (r.E/'wrapper-interruption.stdout').open('wb') as out,(r.E/'wrapper-interruption.stderr').open('wb') as err:
        proc=subprocess.Popen(argv,cwd=r.W,stdout=out,stderr=err)
        assert selector.select(timeout=30), 'Owned stub never became ready'
        marker=os.read(fd,4096);assert marker==b'R3_OWNED_STUB_READY\n',repr(marker)
        (r.E/'wrapper-ready-signal.txt').write_bytes(marker)
        proc.send_signal(signal.SIGTERM)
        direct=proc.wait(timeout=30)
    (r.E/'wrapper-interruption.exit').write_text(str(direct)+'\n')
    assert direct!=0
    interrupted=json.loads((r.E/'wrapper-interrupted.cleanup.json').read_text())
    assert interrupted['scratch_removed'] and interrupted['source_bytes_unchanged']
    assert r.run('wrapper-failure',[sys.executable,'-c','import sys; print("R3 owned failure stdout"); print("R3 owned failure stderr",file=sys.stderr); sys.exit(7)'],seconds=60,heavy=True)==7
    failed=json.loads((r.E/'wrapper-failure.cleanup.json').read_text());assert failed['scratch_removed'] and failed['source_bytes_unchanged']
    assert r.run('wrapper-lock-release',['flock','--timeout','1',r.LOCK,'true'],seconds=10)==0
    (r.E/'wrapper-adversarial-results.json').write_text(json.dumps({'interruption_direct_exit':direct,'interruption_capture':interrupted,'failure_capture':failed,'evidence_survived':True,'real_suite_interrupted':False,'ready_signal':'R3_OWNED_STUB_READY','lock_released':True},indent=2))
finally:
    if proc is not None and proc.poll() is None:
        proc.send_signal(signal.SIGTERM);proc.wait(timeout=30)
    selector.close();os.close(fd);shutil.rmtree(S)
    (r.E/'wrapper-signal-cleanup.json').write_text(json.dumps({'owned_fifo_removed':not S.exists()}))
