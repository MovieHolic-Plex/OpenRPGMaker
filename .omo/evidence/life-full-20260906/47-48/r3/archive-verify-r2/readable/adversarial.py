import run as r
import os,sys,subprocess,selectors,signal,json,hashlib,gzip
E=r.E
fifo=E/'owned-ready.fifo';os.mkfifo(fifo)
fd=os.open(fifo,os.O_RDWR|os.O_NONBLOCK);sel=selectors.DefaultSelector();sel.register(fd,selectors.EVENT_READ)
proc=None
try:
    code='import os,signal;f=os.open('+repr(str(fifo))+',os.O_WRONLY);os.write(f,b"INDEPENDENT_READY\\n");os.close(f);signal.pause()'
    invoke='import run,sys;sys.exit(run.run("interrupted",'+repr([sys.executable,'-c',code])+',60))'
    argv=[sys.executable,'-c',invoke]
    (E/'interruption.command.json').write_text(json.dumps(dict(argv=argv,cwd=str(E),subscription='FIFO registered before Popen',deadline=30)))
    with (E/'interruption.stdout').open('wb') as out,(E/'interruption.stderr').open('wb') as err:
        proc=subprocess.Popen(argv,cwd=E,stdout=out,stderr=err)
        assert sel.select(timeout=30)
        marker=os.read(fd,4096);assert marker==b'INDEPENDENT_READY\n',repr(marker)
        (E/'ready-signal.txt').write_bytes(marker);proc.send_signal(signal.SIGTERM);exit=proc.wait(timeout=30)
    (E/'interruption.exit').write_text(str(exit)+'\n');assert exit!=0
    assert json.loads((E/'interrupted.cleanup.json').read_text())['removed']
    assert r.run('misleading-failure',[sys.executable,'-c','import sys;print("ALL TESTS PASSED (intentional misleading stub)");print("independent explicit failure",file=sys.stderr);sys.exit(7)'],60)==7
    assert r.run('lock-released',['true'],10)==0
    results={}
    original=r.identity
    for mode in ['dirty','stale']:
        data=original();data['status' if mode=='dirty' else 'head']='INJECTED_BOUNDARY_VALUE'
        r.identity=lambda:data
        try:r.run('input-'+mode,['true'],10)
        except AssertionError:results[mode]='rejected before command/scratch creation'
        else:raise AssertionError('Bad input accepted')
        finally:r.identity=original
    try:r.run('tests',['true'],10)
    except AssertionError:results['existing-receipt']='overwrite rejected'
    else:raise AssertionError('Stale output overwritten')
    (E/'adversarial-results.json').write_text(json.dumps(results,indent=2))
finally:
    if proc is not None and proc.poll() is None:proc.send_signal(signal.SIGTERM);proc.wait(timeout=30)
    sel.close();os.close(fd);fifo.unlink()
    (E/'interruption.cleanup.json').write_text(json.dumps(dict(fifo_removed=not fifo.exists(),real_suite_interrupted=False)))
