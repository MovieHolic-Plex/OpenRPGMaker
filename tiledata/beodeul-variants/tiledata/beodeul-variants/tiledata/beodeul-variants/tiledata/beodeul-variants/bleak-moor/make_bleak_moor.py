

# ================================================================ 2. 데모 맵
def build_map(pp):
    import mb_map as M
    s = M.build(pp.imgs)
    samples = {n: pp.imgs[n] for (n, *_r) in G.GROUNDS}
    sheets = {'track': pp.imgs['autotile-mud-track'], 'heather': pp.imgs['autotile-heather'], 'bog': pp.imgs['autotile-bog-pool'], 'fog': pp.imgs['autotile-moor-fog']}
    img = s.render(samples, sheets)
    img.convert('RGB').save(os.path.join(HERE, 'render-1x.png'))
    img.resize((img.width * 2, img.height * 2), Image.NEAREST).convert('RGB').save(os.path.join(HERE, 'render-2x.png'))
    g = s.walk_grid()
    start = (int(round(30 + 2.4 * math.sin(47 / 7.0) + 0.8 * math.sin(47 / 3.1))), 47)
    seen = s.bfs(start)
    goals = {'north': None, 'west': (0, 17), 'east': (63, 30)}
    north = [(x, 0) for x in range(s.W) if (x, 0) in s.auto['track']]
    rep = {k: (v in seen) for k, v in s.marks.items() if isinstance(v, tuple) and len(v) == 2 and isinstance(v[0], int)}
    rep['exit_north'] = any(c in seen for c in north); rep['exit_west'] = (0, 17) in seen or (0, 18) in seen; rep['exit_east'] = (63, 30) in seen
    json.dump({'w': s.W, 'h': s.H, 'legend': '. 걷기  # 막힘', 'rows': [''.join('.' if g[y, x] else '#' for x in range(s.W)) for y in range(s.H)],
               'start': start, 'reach': rep}, open(os.path.join(HERE, 'grid.json'), 'w'), ensure_ascii=False, indent=0)
    return s, rep


if __name__ == '__main__':
    s, rep = build_map(pp)
    print('reach', rep); print('warn', s.warn); print('empty(20x15 worst)', s.empty_ratio()); print(dict(s.count))
