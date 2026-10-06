"""Explicit second folded leg and hook foot in the fallen pose."""
from pathlib import Path
p=Path(__file__).resolve().parent/'authored_rows.txt'
s=p.read_text();before,rest=s.split('[dead]\n',1);dead,after=rest.split('[skill_a]\n',1)
# These are independent pixel spans at the actual fallen anatomy coordinates.
additional='''82 10 OSPPLLPPSS
83 9 OSPPLLLPPSSO
84 8 OSPPLLLLPPSSO
85 8 OSPPLLLPPPSSO
86 8 OSPPLLPPSSO
87 8 OGgKKggGGO
88 7 OGgKKKggGGO
89 7 OGgKKKKggggGGO
90 7 OGgKKKKggggGGggGO
91 8 OGGggggGGGGOOGKGO
92 9 OOOOOOOOOOO...OOO
'''
# The original row remains, and the chosen foreground spans overwrite only these pixels.
p.write_text(before+'[dead]\n'+dead+additional+'[skill_a]\n'+after)
