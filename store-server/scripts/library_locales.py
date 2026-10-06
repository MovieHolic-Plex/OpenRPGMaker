"""OPRN 공식 상품의 다국어 글(한·영·일·중 간체). refresh_library.py 와 seed_library.py 가 같이 쓴다.

키는 상품의 한국어 제목이다. 값은 언어마다 {title, summary, description}.
한국어판은 원문 그대로 넣는다 — 상품 화면의 「지원 언어」가 이 키들로 정해진다.
"""
from __future__ import annotations

LANGS = ("en", "ja", "zh")

EXPRESSIONS = {
    "en": "neutral, smile, happy, pleased, surprised, flustered, doubtful, serious, annoyed, angry, sad, crying, worried, determined, shy, wink",
    "ja": "通常・にっこり・喜び・満足・驚き・焦り・疑い・真剣・苛立ち・怒り・悲しみ・泣き・心配・決意・照れ・ウインク",
    "zh": "普通、微笑、开心、满意、惊讶、慌张、怀疑、认真、烦躁、愤怒、悲伤、哭泣、担心、坚定、害羞、眨眼",
}

# 묶음 이름과 대표 인물 여섯(+「외」). 순서는 seed_library.GROUPS 와 같다.
GROUPS = {
    "모험가 1": {
        "en": ("Adventurers 1", "brown-haired hero with headband, blue-haired traveler, helmeted soldier, blonde helmeted knight, blue-haired fighter with headband, purple-haired mage and more"),
        "ja": ("冒険者 1", "鉢巻の茶髪の少年、青髪の旅人、兜の兵士、金髪の兜の騎士、鉢巻の青髪の剣士、紫髪の魔法使い ほか"),
        "zh": ("冒险者 1", "系头带的棕发少年、蓝发旅人、戴盔士兵、金发戴盔骑士、系头带的蓝发剑士、紫发魔法师等"),
    },
    "모험가 2": {
        "en": ("Adventurers 2", "red-helmed knight, bearded warrior, masked warrior, woman with white headband, blonde woman, teal-haired woman and more"),
        "ja": ("冒険者 2", "赤い兜の騎士、ひげの戦士、覆面の戦士、白い鉢巻の女性、金髪の女性、青緑髪の女性 ほか"),
        "zh": ("冒险者 2", "红盔骑士、大胡子战士、蒙面战士、白头带女性、金发女性、青绿发女性等"),
    },
    "마을 사람 1": {
        "en": ("Villagers 1", "boy, girl, blue-haired man, blonde woman, mustached man, village woman and more"),
        "ja": ("村人 1", "少年、少女、青髪の男性、金髪の女性、口ひげの男性、村の女性 ほか"),
        "zh": ("村民 1", "少年、少女、蓝发男性、金发女性、八字胡男性、村妇等"),
    },
    "마을 사람 2": {
        "en": ("Villagers 2", "king, blue-haired woman, auburn-haired man, curly blonde, white-haired elder, blue-haired girl with ribbon and more"),
        "ja": ("村人 2", "王、青髪の女性、赤茶髪の男性、金髪の巻き毛、白髪の長老、リボンの青髪の少女 ほか"),
        "zh": ("村民 2", "国王、蓝发女性、红褐发男性、金色卷发、白发长老、系蝴蝶结的蓝发少女等"),
    },
    "몬스터·짐승": {
        "en": ("Monsters & Beasts", "slime, red demon, pig, ghost, skeleton, scarred green-skinned man and more"),
        "ja": ("モンスター・獣", "スライム、赤い悪魔、ブタ、幽霊、ガイコツ、傷のある緑肌の男 ほか"),
        "zh": ("怪物与野兽", "史莱姆、红色恶魔、猪、幽灵、骷髅、带疤的绿皮人等"),
    },
}


def _short(lang: str, people: str) -> str:
    """영어는 길어서 요약에는 셋만 넣는다(요약 160자 상한). 전체 명단은 설명에 있다."""
    if lang != "en":
        return people
    return ", ".join(people.removesuffix(" and more").split(", ")[:3]) + " and more"


def _face(lang: str, group: str, count: int) -> dict:
    name, people = GROUPS[group][lang]
    expressions = EXPRESSIONS[lang]
    if lang == "en":
        return {
            "title": f"16-Expression Faces — {name} ({count} characters)",
            "summary": f"48×48 dialogue faces, 16 expressions each. Includes {_short(lang, people)}.",
            "description": f"Dialogue faces for the {count} characters of {name}: {people}. Every character comes with 16 separate expressions ({expressions}).\n"
                           "Once added to a project they show up right away in the face picker and in dialogue face switching. Bust and full-body art of the same characters are in the “16-Expression Busts” and “16-Expression Full-Body” items.",
        }
    if lang == "ja":
        return {
            "title": f"顔グラ 16表情 — {name}（{count}人）",
            "summary": f"会話ウィンドウ用 48×48 の顔グラ。一人につき喜び・悲しみ・怒り・驚きなど 16 表情。{people}",
            "description": f"{name}の {count} 人分の会話用顔グラです。一人ごとに 16 表情（{expressions}）が一枚ずつ入っています。\n"
                           "プロジェクトに追加すると、データベースの顔グラ選択や台詞の表情切り替えにすぐ表示されます。同じキャラクターのバストアップ・立ち絵は「バストアップ 16表情」「立ち絵 16表情」にあります。",
        }
    return {
        "title": f"16 表情头像 — {name}（{count} 人）",
        "summary": f"对话框用 48×48 头像，每人有开心、悲伤、愤怒、惊讶等 16 种表情。{people}",
        "description": f"{name}共 {count} 人的对话头像。每人 16 种表情（{expressions}）各为一张图。\n"
                       "加入项目后，可直接在数据库的头像选择和台词表情切换中使用。同一角色的半身像和立绘在“16 表情半身像”“16 表情立绘”中。",
    }


def _portrait(lang: str, group: str, count: int, mode: str) -> dict:
    name, people = GROUPS[group][lang]
    if lang == "en":
        label = "Busts" if mode == "bust" else "Full-Body"
        shape = "bust" if mode == "bust" else "full-body"
        return {
            "title": f"16-Expression {label} — {name} ({count} characters)",
            "summary": f"{shape.capitalize()} dialogue art matching the 16-expression faces. Includes {_short(lang, people)}.",
            "description": f"{shape.capitalize()} dialogue art for the {count} characters of {name} ({people}), with the same 16 expressions as the face item.\n"
                           f"Pick one in a dialogue line's face slot and the message window switches to the {shape} layout (the editor recognises the “{mode}” in the file name).\n"
                           "Busts and full-body art were drawn with an AI image tool and matched to each character's walking sprite and face for outfit and hair.",
        }
    if lang == "ja":
        label = "バストアップ" if mode == "bust" else "立ち絵"
        return {
            "title": f"{label} 16表情 — {name}（{count}人）",
            "summary": f"会話ウィンドウ用の{label}。顔グラ 16 表情と同じキャラクター・同じ表情。{people}",
            "description": f"{name}の {count} 人分の会話用{label}です。顔グラと同じキャラクター、同じ 16 表情です。\n"
                           f"台詞の顔グラ欄で選ぶと、会話ウィンドウが{label}の形に切り替わります（ファイル名の「{mode}」でエディターが判別します）。\n"
                           "バストアップ・立ち絵は AI 画像ツールで描き、一人ずつ対応する歩行グラフィックと顔グラに合わせて服と髪を揃えました。",
        }
    label = "半身像" if mode == "bust" else "立绘"
    return {
        "title": f"16 表情{label} — {name}（{count} 人）",
        "summary": f"对话框用{label}，与 16 表情头像是同一角色、同样的表情。{people}",
        "description": f"{name}共 {count} 人的对话{label}，与头像素材是同一角色、同样的 16 种表情。\n"
                       f"在台词的头像栏中选择后，对话框会切换为{label}样式（编辑器通过文件名中的“{mode}”识别）。\n"
                       "半身像和立绘由 AI 图像工具绘制，并按每个角色的行走图和头像统一了服装与发型。",
    }


PEOPLE_26 = {
    "en": "wandering fortune-teller, shadow assassin, flower-shop girl, black-haired noblewoman, brown-haired farmer, page in green, market auntie, girl with twin tails in navy, noble young lady, old gardener, pink-haired dancer, red-haired apprentice, silver-haired sorcerer, elf archer, innkeeper, squire boy, travelling merchant, thief boy, phoenix shrine maiden, emperor of the east, nursing sister, bob-haired scribe, country girl with braids, farm boy in a checked shirt, long-haired scholar, tea-house girl with double buns",
    "ja": "さすらいの占い師、影の暗殺者、花屋の少女、黒髪の貴婦人、茶髪の農夫、緑の服の小姓、市場のおばさん、紺の服のツインテール少女、貴族のお嬢様、年老いた庭師、ピンク髪の踊り子、赤髪の見習い、銀髪の魔導士、エルフの弓使い、宿屋の主人、見習い騎士の少年、旅の商人、盗賊の少年、不死鳥の巫女、東方の皇帝、看護の修道女、ボブヘアの書記官、三つ編みの村娘、チェックシャツの農家の少年、長髪の学者、お団子頭の茶屋の娘",
    "zh": "流浪占卜师、暗影刺客、花店少女、黑发贵妇、棕发农夫、绿衣侍童、市场大婶、藏青衣双马尾少女、贵族千金、老园丁、粉发舞女、红发学徒、银发魔导士、精灵弓手、旅店老板、见习骑士少年、行商大叔、盗贼少年、不死鸟巫女、东方皇帝、护理修女、短发书记官、麻花辫村姑、格子衫农家少年、长发学者、双髻茶馆姑娘",
}

FIXED: dict[str, dict[str, dict]] = {
    "걷기 칩 — 새 마을 사람·모험가 26명": {
        "en": {
            "title": "Walking Sprites — 26 New Villagers & Adventurers",
            "summary": "RM2000-format walking sprites (24×32, 4 directions × 3 steps). Fortune-teller, assassin, dancer, nun, emperor and more new characters.",
            "description": "Walking sprites newly drawn with the OPRN character harness. A person reviewed each one and only the keepers are included.\n"
                           "Packed as four RM2000/2003 charset sheets (288×256, 8 characters per sheet). Once added to a project you can pick them as event and actor graphics.\n"
                           "Characters: " + PEOPLE_26["en"],
        },
        "ja": {
            "title": "歩行グラフィック — 新しい村人・冒険者 26人",
            "summary": "RM2000 規格の歩行グラフィック（24×32、4方向×3歩）。占い師・暗殺者・踊り子・修道女・皇帝など新キャラクター。",
            "description": "OPRN キャラクターハーネスで新しく描いた歩行グラフィックです。人が一体ずつ確認し、残したものだけを収録しています。\n"
                           "RM2000/2003 のキャラセット（288×256、1枚に8人）4枚にまとめています。プロジェクトに追加すると、イベントやアクターのグラフィックとして選べます。\n"
                           "収録キャラクター：" + PEOPLE_26["ja"],
        },
        "zh": {
            "title": "行走图 — 26 位新村民与冒险者",
            "summary": "RM2000 规格行走图（24×32，4 方向 × 3 步）。占卜师、刺客、舞女、修女、皇帝等新角色。",
            "description": "用 OPRN 角色流水线新绘制的行走图。每一个都经人工查看，只收录保留下来的。\n"
                           "打包为 4 张 RM2000/2003 行走图表（288×256，每张 8 人）。加入项目后，可在事件和角色的图像中选用。\n"
                           "收录角色：" + PEOPLE_26["zh"],
        },
    },
    "걷기 칩 — OPRN 몬스터 24종": {
        "en": {
            "title": "Walking Sprites — 24 OPRN Monsters",
            "summary": "Forest spirits and yokai, cursed objects, legendary beasts. Three RM2000-format monster charset sheets.",
            "description": "Monster walking sprites hand-plotted pixel by pixel by OPRN (Monster4–6, eight monsters per sheet).\n"
                           "Use them as event graphics for enemies and monster companions roaming the field.",
        },
        "ja": {
            "title": "歩行グラフィック — OPRN モンスター 24種",
            "summary": "森の精・妖怪、呪われた品、伝説の魔獣。RM2000 規格のモンスター歩行グラフィック 3 枚。",
            "description": "OPRN が座標ドットで直接打ったモンスターの歩行グラフィックです（Monster4〜6、1枚に8体）。\n"
                           "フィールドを歩き回る敵や仲間モンスターのイベントグラフィックに使えます。",
        },
        "zh": {
            "title": "行走图 — OPRN 怪物 24 种",
            "summary": "森林精怪与妖怪、受诅咒的物品、传说中的魔兽。3 张 RM2000 规格的怪物行走图。",
            "description": "由 OPRN 按坐标逐点绘制的怪物行走图（Monster4～6，每张 8 只）。\n"
                           "可用作在地图上游荡的敌人或伙伴怪物的事件图像。",
        },
    },
    "일본 도시 — 상가·주택·역·신사": {
        "en": {
            "title": "Japanese City — Shops, Houses, Station & Shrine",
            "summary": "Pixel chipset for modern Japanese streets: residential blocks, a train station, parks and a shrine.",
            "description": "A 3/4-view tileset of a modern Japanese city. Includes building exteriors, props and floor tiles, plus assembly reference docs.",
        },
        "ja": {
            "title": "日本の街 — 商店街・住宅・駅・神社",
            "summary": "現代日本の住宅街・駅・公園・神社を描くドットチップセット。",
            "description": "3/4 視点の現代日本の街タイルセットです。建物の外観・小物・床タイルと、組み立て用の参考資料が入っています。",
        },
        "zh": {
            "title": "日本城市 — 商店街、住宅、车站与神社",
            "summary": "描绘现代日本住宅区、车站、公园和神社的像素图块。",
            "description": "3/4 视角的现代日本城市图块。包含建筑外观、小物件、地面图块以及拼装参考文档。",
        },
    },
    "손 도트 실내 v5": {
        "en": {
            "title": "Hand-Pixeled Interiors v5",
            "summary": "3/4-view furniture chipset for bakeries, inns, homes and shops.",
            "description": "Hand-pixeled interior furniture in 3/4 view, showing both the top and the front. Includes layout reference docs for each room type.",
        },
        "ja": {
            "title": "手打ちドット室内 v5",
            "summary": "パン屋・宿屋・民家・お店の室内を飾る 3/4 視点の家具チップセット。",
            "description": "上面と正面が同時に見える 3/4 視点の手打ちドット室内家具です。部屋の種類ごとの配置参考資料が入っています。",
        },
        "zh": {
            "title": "手绘像素室内 v5",
            "summary": "用于面包店、旅店、民宅和商店室内的 3/4 视角家具图块。",
            "description": "同时看得到顶面和正面的 3/4 视角手绘像素室内家具。附有按房间类型分类的摆放参考文档。",
        },
    },
    "조선 — 바람의나라풍 마을": {
        "en": {
            "title": "Joseon — Classic Korean MMO-Style Village",
            "summary": "Hand-pixeled Joseon-era chipset: tiled-roof houses, thatched huts, city gates, hunting grounds and caves.",
            "description": "A single baked chipset of Joseon-style 16px pieces plotted in code. Passability and layers are baked into every tile, and reference docs for assembling villages, the royal fortress and interiors are included.",
        },
        "ja": {
            "title": "朝鮮 — 風の王国風の村",
            "summary": "瓦屋根の家・草葺きの家・城門・狩り場・洞窟まで揃った朝鮮風の手打ちドットチップセット。",
            "description": "コードで打った朝鮮風 16px のパーツを一枚に焼き込んだチップセットです。マスごとに通行・レイヤーが設定済みで、村・国内城・室内の組み立て参考資料も入っています。",
        },
        "zh": {
            "title": "朝鲜 — 风之国度风格村庄",
            "summary": "包含瓦房、草屋、城门、狩猎场和洞穴的朝鲜风手绘像素图块。",
            "description": "把用代码绘制的朝鲜风 16px 部件烘焙成一张的图块集。每格都已设定通行与图层，并附有村庄、国内城和室内的拼装参考文档。",
        },
    },
    "버들항 — 로마풍 항구 도시": {
        "en": {
            "title": "Beodeul Harbor — Roman-Style Port City",
            "summary": "Hand-pixeled 16px port city with 120 district, building and prop kits plus assembly reference docs.",
            "description": "A 16px hand-pixeled tileset for building plazas, markets, harbors, city walls and residential streets tile by tile.\n"
                           "Reference docs (Markdown per use case, with correct and incorrect examples) are included, so the editor assistant can build a city with these tiles right away.",
        },
        "ja": {
            "title": "ブドゥル港 — ローマ風の港町",
            "summary": "手打ちドット 16px の港町。区画・建物・小物のキット 120 種と組み立て参考資料入り。",
            "description": "広場・市場・港・城壁・住宅街をマス単位で組み立てる 16px 手打ちドットのタイルセットです。\n"
                           "参考資料（用途別の MD と正しい例・間違った例の絵）が入っているので、エディターのアシスタントがすぐにこのタイルで街を作れます。",
        },
        "zh": {
            "title": "柳港 — 罗马风港口城市",
            "summary": "手绘 16px 像素港口城市。含 120 种街区、建筑与小物件套件以及拼装参考文档。",
            "description": "以格为单位拼出广场、市场、港口、城墙和住宅街的 16px 手绘像素图块。\n"
                           "附有参考文档（按用途分类的 MD 与正确/错误示例图），编辑器助手可以直接用这些图块搭建城市。",
        },
    },
}


def locales_for(title: str, summary: str, description: str) -> dict | None:
    """한국어 제목으로 네 언어판을 만든다. 모르는 상품이면 None."""
    out: dict[str, dict] = {"ko": {"title": title, "summary": summary, "description": description}}
    if title in FIXED:
        out.update(FIXED[title])
        return out
    for mode, prefix in (("face", "얼굴 16표정 — "), ("bust", "흉상 16표정 — "), ("full", "전신 16표정 — ")):
        if not title.startswith(prefix):
            continue
        rest = title[len(prefix):]
        group, _, count_text = rest.rpartition(" (")
        if group not in GROUPS:
            return None
        count = int(count_text.rstrip("명)"))
        for lang in LANGS:
            out[lang] = _face(lang, group, count) if mode == "face" else _portrait(lang, group, count, mode)
        return out
    return None
