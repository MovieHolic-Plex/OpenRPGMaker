import sys,os; sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import mc_imap as IM, mc_inside as MI, mc_props as MP
S=dict(grand_stair=MI.grand_stair(),stair_arch_wide=IM.stair_arch_wide(),bust_pedestal_in=MP.bust_pedestal(),grandfather_clock=MI.grandfather_clock(),candelabra=MI.candelabra(),
 wall_painting_landscape=MI.wall_painting(0),wall_painting_sea=MI.wall_painting(1),wall_painting_still=MI.wall_painting(2),wall_painting_abstract=MI.wall_painting(3),wall_painting_night=MI.wall_painting(4),
 rug_persian=MI.rug_persian(),fireplace=MI.fireplace(),sofa=MI.sofa(),tea_table=MI.tea_table(),armchair_back=MI.armchair('n'),armchair=MI.armchair('s'),mirror_gilt=MI.mirror_gilt(),
 bookcase=MI.bookcase(0),bookcase_b=MI.bookcase(1),reading_desk=MI.reading_desk(),globe=MI.globe(),dining_table=MI.dining_table(4),dining_chair_n=MI.dining_chair('n'),dining_chair_s=MI.dining_chair('s'),
 sideboard=MI.sideboard(),china_cabinet=MI.china_cabinet(),urn_flowers=MP.urn_flowers())
m,marks,BAD=IM.build(S)
im=m.render(); im.save('_qa/int.png'); im.resize((im.width*2,im.height*2),0).save('_qa/int2.png')
print('BAD',BAD)
for k,v in marks.items(): print(k, v, bool(m.bfs(marks['entrance'],v)))
print('comps',[len(c) for c in m.components()][:5])
