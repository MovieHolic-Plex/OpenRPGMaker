

# ================================================================ 3. 전투 배경 · 비교 시트
if __name__ == '__main__':
    import mb_battle, mb_compare
    bg = mb_battle.build(); bg.save(os.path.join(HERE, 'battle-bg.png')); mb_battle.overlay(bg).save(os.path.join(HERE, 'check-overlay.png'))
    mb_compare.build()
    print('battle-bg + compare-ref ok')
