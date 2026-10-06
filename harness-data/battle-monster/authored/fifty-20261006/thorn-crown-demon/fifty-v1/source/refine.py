"""One scoped pass of manually chosen replacement spans. No pose copying."""
from pathlib import Path
p=Path(__file__).resolve().parent/'authored_rows.txt'
s=p.read_text()
sections={}
order=[]
for line in s.splitlines():
    if line.startswith('['):
        name=line[1:-1];order.append(name);sections[name]=[]
    elif line and not line.startswith('#'): sections[name].append(line)
# Full replacement row strings; both knees now have deliberate rounded volumes.
replacements={
'move': '''78 27 OSPPPPLLLLLPPPSSO............OSSPPPLLLLLPPSSO
79 26 OSPPPPLLLLPPPSSO.................OSPPPLLLLPPSSO
80 25 OSPPPLLLLPPPSSO....................OSPPPLLLPPSSO
81 24 OSPPPLLLPPPSSO.....................OSPPPLLLPPSSO
82 23 OSPPLLLLPPSSO......................OSPPPLLPPSSO
83 22 OSPPLLLPPPSSO.......................OGgKKKgggGGO
84 21 OSPPLLLPPSSO........................OGgKKKKgggGGO
85 20 OSPPLLLPPSSO........................OGgKKKKKggggGGO
86 19 OSPPLLLPPSSO........................OGgKKKKKggggGGggGO
87 19 OSPPLLPPSSO..........................OGGggggGGGGOOGKGO
88 18 OGgKKKKggggGGO.........................OOOOOOOOOO...OOO''',
'attack': '''80 28 OSPPPPPLLLLLPPPSSO........OSSPPPLLLLLLPPSSO
81 27 OSPPPPLLLLLPPPSSO............OSSPPPLLLLLPPSSO
82 26 OSPPPPLLLLPPPSSO.................OSPPPLLLLPPSSO
83 25 OSPPPLLLLPPPSSO....................OSPPPLLLPPSSO
84 24 OSPPPLLLPPPSSO.....................OSPPPLLLPPSSO
85 23 OSPPLLLLPPSSO......................OSPPPLLPPSSO
86 22 OSPPLLLPPPSSO.......................OSPPPLLPPSSO
87 21 OSPPLLLPPSSO........................OGgKKKKgggGGO
88 20 OSPPLLLPPSSO........................OGgKKKKKggggGGO
89 19 OGgKKKKggggGGO......................OGgKKKKKggggggGGO
90 19 OGgKKKKKggggggGGO...................OGGggKKggggggGGggGO
91 18 OGGggggggGGGGGOOGKGO.................OGGgggggGGGGOOGKGO
92 19 OOOOOOOOOOOOO...OOO...................OOOOOOOOOOOO...OOO'''
}
for name,block in replacements.items():
    yy={int(line.split()[0]) for line in block.splitlines()}
    sections[name]=[line for line in sections[name] if int(line.split()[0]) not in yy]+block.splitlines()
# Detached preparation stem becomes a fingertip charge instead of a floating ray.
remove={'60 77 SV','61 76 SLVP','62 75 SLVPP','63 74 SLVPS','64 73 SLVPS','65 72 SLVPS','66 71 SLVPS','67 70 SLVPS','68 69 SLVPS','69 70 SVP'}
sections['skill_a']=[line for line in sections['skill_a'] if line not in remove]
sections['skill_a'] += ['67 62 SLVP','68 62 SLVPS','69 61 SLVPS','70 61 SVPS']
# Thorn tips and shaded side barbs, each placed on the current stem.
sections['skill_b'] += ['30 89 SV','31 88 SVP','32 87 SLVPS','33 86 SLVPS','34 85 SLVPS','38 74 SV','39 75 SVP','40 76 SLVP','41 77 SLVPS','65 85 SV','66 83 SLVP','67 82 SLVPS','68 81 SLVPS','73 73 SV','74 74 SLVP','75 75 SLVPS']
p.write_text('# Explicit native row spans. Transparent padding is the only assembly operation.\n'+''.join('['+n+']\n'+'\n'.join(sections[n])+'\n' for n in order))
