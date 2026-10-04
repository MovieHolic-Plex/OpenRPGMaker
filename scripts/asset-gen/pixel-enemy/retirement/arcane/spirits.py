"""Eleven articulated ectoplasms: visible anatomy, hair/dress, cloud and wave."""
from common import *
GHOSTS={
'ghost-01':dict(s='385880',b='6e9cc4',l='b3d7eb',h='f4ffff',a='3c4a75'),
'spirit-01':dict(s='b3a0b7',b='e2ccd7',l='f9e9e4',h='fffcee',a='b594ac'),
'specter-01':dict(s='737386',b='a4a4b2',l='dad7dc',h='fff3df',a='555364'),
'wraith-dark':dict(s='383745',b='686274',l='a299ad',h='eee3eb',a='292936'),
'banshee-wail':dict(s='62799a',b='abbcd2',l='e2e5ed',h='fffef0',a='35476c'),
'spirit-wind':dict(s='a192be',b='d3cbe9',l='f6edfa',h='fffee9',a='857aa8'),
'spirit-light':dict(s='9babc1',b='dbe5ec',l='f4f8e9',h='fffbe3',a='97a5bb'),
'spirit-dark':dict(s='30313c',b='505261',l='9095a3',h='dae2e0',a='242631'),
'sylph-01':dict(s='5588b0',b='8bbad5',l='d3edf1',h='f5fff8',a='5b80a1'),
'sylph-air':dict(s='667ea7',b='a1c7df',l='deeff5',h='ffffee',a='547ba2'),
'undine-sea':dict(s='275782',b='4093bf',l='87cfdf',h='d8f9ea',e='a8f6a1',a='235675')}
def draw(slug,n):
    p=pen(48,GHOSTS[slug]);cloud=slug.startswith('sylph');wave=slug=='undine-sea';hair=slug in ('wraith-dark','banshee-wail') or wave
    if n=='dead':
        p.poly([(10,44),(15,41),(22,42),(27,39),(31,40),(38,44)],'s','o')
        p.line([(14,42),(23,43),(29,41),(33,42)],'l')
        p.poly([(24,36),(25,32),(29,33),(27,36)],'b','o')
        return finish(p,n,True)
    dx,dy,re,sw=POSE[n];x=22+dx;y=16+dy
    if slug=='spirit-light':y-=2
    if slug=='spirit-dark':y-=1
    if slug=='spirit-wind':x-=1
    # Smoke/water twists are independently hand-positioned vertices, no frozen sprite.
    tail=[(x-6,y+12),(x+7,y+11),(x+8,y+17),(x+2+sw,y+22),(x-7+sw,y+25),(x-13,y+23),(x-8,y+20),(x-12-sw,y+17),(x-8,y+16)]
    if wave:
        tail=[(x-5,y+13),(x+8,y+13),(x+7,y+19),(x+12,y+22),(x+7,y+24),(x-4,y+24),(x-9,y+22),(x-14,y+25),(x-10,y+20),(x-5,y+20)]
    if slug=='spirit-wind':
        tail=[(x-7,y+11),(x+6,y+11),(x+9,y+17),(x+2+sw,y+20),(x-12+sw,y+25),(x-17,y+23),(x-10,y+22),(x-15,y+18),(x-7,y+16)]
    if slug=='spirit-light':
        tail=[(x-5,y+12),(x+7,y+11),(x+5,y+18),(x-1+sw,y+23),(x-8+sw,y+27),(x-5,y+21),(x-9,y+18),(x-4,y+16)]
    if slug=='spirit-dark':
        tail=[(x-6,y+12),(x+7,y+11),(x+8,y+20),(x+4+sw,y+24),(x+1,y+19),(x-4+sw,y+27),(x-6,y+21),(x-14,y+26),(x-10,y+18)]
    if slug=='spirit-01':
        tail=[(x-7,y+12),(x+7,y+11),(x+6,y+19),(x+1+sw,y+24),(x-2,y+20),(x-8+sw,y+25),(x-10,y+20),(x-13,y+23),(x-10,y+17)]
    p.poly(tail,'s','o')
    p.poly([(x-4,y+12),(x+5,y+13),(x+3,y+17),(x-4+sw,y+21),(x-9,y+21),(x-5,y+17)],'b')
    p.line([(x-3,y+18),(x-7+sw,y+22),(x-11,y+23)],'l')
    # rear arm has its own elbow and hand silhouette.
    arm1=[(x-4,y+9),(x-10,y+9-re//2),(x-12+sw,y+4-re//2)]
    if slug=='spirit-wind':arm1=[(x-4,y+9),(x-12,y+8-sw),(x-17,y+4-sw)]
    if slug=='spirit-light':arm1=[(x-4,y+9),(x-9,y+13),(x-7,y+18+sw)]
    if slug=='spirit-dark':arm1=[(x-4,y+9),(x-12,y+12),(x-15,y+7-sw)]
    claw(p,arm1,3,'s')
    if hair:
        p.poly([(x-3,y-7),(x+4,y-7),(x+6,y-3),(x+1,y+4),(x-6,y+6),(x-11-sw,y+1),(x-9-sw,y-3),(x-12,y-2),(x-8,y-6)],'a','o')
        p.line([(x-5,y-5),(x-8-sw,y-1),(x-6,y+3)],'u')
        p.line([(x-7,y-4),(x-11,y-1)],'v')
    # Ribcage body or shaped female bodice.
    female=slug=='banshee-wail' or wave
    p.poly([(x-4,y+5),(x+3,y+4),(x+6,y+9),(x+4,y+15),(x-2,y+16),(x-6,y+12)],'b','o')
    p.line([(x-4,y+7),(x-3,y+12)],'l')
    if not female and not cloud and slug!='spirit-01':
        for k in range(3):p.line([(x-2,y+8+k*2),(x+2,y+9+k*2),(x+4,y+8+k*2)],'s')
        p.line([(x+1,y+7),(x+1,y+14)],'l')
    if slug=='banshee-wail':
        p.poly([(x-4,y+13),(x+4,y+13),(x+7,y+22),(x+3,y+21),(x+1,y+24),(x-2,y+21),(x-6,y+23),(x-9,y+20)],'b','o')
        p.line([(x-2,y+15),(x-5,y+21)],'l');p.line([(x+3,y+15),(x+4,y+20)],'s')
    # Right-facing head: jutting nose, open lower jaw, eye socket.
    p.poly([(x-2,y-5),(x+4,y-6),(x+7,y-3),(x+7,y),(x+10,y+1),(x+8,y+3),(x+8,y+6),(x+2,y+6),(x-2,y+2)],'b','o')
    p.line([(x-1,y-3),(x+1,y-4),(x+4,y-4)],'l')
    eye(p,x+3,y-1,'e' if wave else 'h',3)
    if not cloud and not wave:mouth(p,x+3,y+3,6,5 if n in ('attack','windup') else 3)
    elif wave:p.line([(x+4,y+4),(x+7,y+4)],'s')
    else:p.line([(x+4,y+4),(x+7,y+3)],'s')
    if slug in ('specter-01','wraith-dark','spirit-dark'):
        p.poly([(x,y-1),(x-5,y-5),(x-3,y+3)],'b','o');p.line([(x-4,y-3),(x-2,y+1)],'l')
    if slug=='spirit-light':
        p.poly([(x-1,y-4),(x-6,y-9),(x-3,y-12),(x,y-9),(x+2,y-7)],'b','o')
        p.line([(x-3,y-9),(x-1,y-6)],'h')
    if slug=='spirit-dark':
        p.poly([(x-3,y-4),(x-6,y-8),(x-10,y-6),(x-6,y-1)],'a','o')
    if cloud:
        # Lumpy hood, plus spiralling air arms, rather than a humanoid sheet hood.
        for xx,yy,r in [(x-4,y-5,5),(x+2,y-8,5),(x+7,y-5,4)]:blob(p,xx,yy,r,r-1)
        p.line([(x-4,y-8),(x-1,y-10),(x+3,y-10)],'h')
        cap(p,[(x-5,y+10),(x-10,y+13),(x-13,y+10),(x-10,y+7)],3,'b',lit='l',dark='s')
        p.line([(x-5,y+20),(x+3+sw,y+17),(x+5,y+20),(x+1,y+22)],'l',2)
        if slug=='sylph-air':
            cap(p,[(x-5,y+17),(x-14,y+18),(x-16,y+20),(x-10,y+22),(x-4,y+20)],2,'b',lit='l',dark='s')
            p.poly([(x-12,y+18),(x-17,y+16),(x-15,y+14),(x-9,y+15)],'l','o')
            p.line([(x-12,y+18),(x-6,y+18)],'b')
    # Forward arm: raised windup, straight strike, tucked hit; idle elbow flexes.
    if n=='windup':arm=[(x+3,y+8),(x+6,y+2),(x+8,y-6)]
    elif n=='attack':arm=[(x+3,y+8),(x+11,y+9),(x+15,y+10)]
    elif n=='hit':arm=[(x+2,y+8),(x+1,y+12),(x-4,y+9)]
    else:arm=[(x+3,y+8),(x+7,y+12+re//2),(x+10+re//2,y+9)]
    if wave or cloud:
        cap(p,arm,3,'b',lit='l',dark='s');ex,ey=arm[-1]
        p.line([(ex,ey),(ex+3,ey-2),(ex+4,ey),(ex+2,ey+2)],'l')
    else:claw(p,arm,3)
    if wave:
        p.poly([(x-2,y-6),(x+3,y-8),(x+6,y-5),(x-1,y-3),(x-8-sw,y+1),(x-12,y-1),(x-7,y-2)],'b','o')
        p.line([(x-4,y-4),(x-9-sw,y-1)],'h');p.line([(x-6,y+19),(x-10,y+22),(x-14,y+23)],'h')
    if n=='attack':p.line([(39,19),(43,20),(42,23)],'l',2)
    return finish(p,n,True)
