# 주인공 back view + throw frames - chip: ScarloxyPeople14 slot 2 (teal cap with red brim,
# brown hair, navy jacket, orange-yellow backpack, teal trousers, red-white shoes)
PAL = {
    'K': '#141b33',  # outline
    'T': '#56cbb4', 't': '#03a897', 'U': '#046f60', 'V': '#04453c',  # cap + trousers, orb
    'R': '#f05545', 'X': '#7b3d3a',  # brim/shoes red, red shade + skin line
    'H': '#9b665c', 'h': '#79504c',  # hair (h doubles as pack shade)
    'N': '#2e3d6c', 'n': '#1f2a4e',  # jacket
    'Y': '#f2d05c', 'O': '#db9138',  # backpack
    'S': '#feddb1', 'W': '#f4fefa',
}
o = 'h'  # backpack shade shares the hair brown
HEAD = {
 4:  "27:KKKKKKKKKK",
 5:  "25:KKtTTTttttttKK",
 6:  "24:KtTTTTttttttttUK",
 7:  "23:KtTTTttttttttttUUK",
 8:  "22:KtTTttttttttttttUUUK",
 9:  "22:KtTtttttttttttttUUUK",
 10: "22:KtttttttttttttttUUVK 42:KK",
 11: "22:KUUUUUUUUUUUUUUUUVVK 42:RRRRK",
 12: "21:KHHHhHHHHhHHHHhHHhhhK 42:XXXXK",
 13: "21:KHHHhHHHhHHHHhHHhhhhhK",
 14: "21:KhHHhhHHhhHHhHHhhhhhK",
 15: "21:KhHhhHhhHhhhHhhK",
 16: "21:KhhKhhhKhhhKhhhK",
 17: "20:KK 23:KhK 27:KhK 31:KhK 35:KhK",
 18: "24:K 28:K 32:K 36:K",
}
JACKET = {
 17: "24:KNNNNNNNNNNNNNNK",
 18: "22:KKNNNNNNNNNNNNNNNNKK",
 19: "21:K" + "N" * 19 + "nK",
}
for y in range(20, 31):
    JACKET[y] = "21:K" + "N" * 18 + "nnK"
for y in range(31, 38):
    JACKET[y] = "22:K" + "N" * 17 + "nK"
JACKET[38] = "22:K" + "n" * 18 + "K"
JACKET[39] = "23:" + "K" * 18
_PACK = {
 21: "25:KhK 36:KhK",
 22: "26:KKKKKKKKKKKK",
 23: "25:KYYYYYOOOOOOhK",
 24: "24:KYYYYYOOOOOOOhhK",
 25: "24:KYYOOOOOOOOOOhhK",
 26: "24:KYOOOOOOOOOOOhhK",
 27: "24:KYOOOOOOOOOOOhhK",
 28: "24:KhhhhhhhYhhhhhhK",
 29: "24:KOOOOOOOOOOOOhhK",
 30: "24:KOOKKKKKKKKKOhhK",
 31: "24:KOOKYOOOOOhKOhhK",
 32: "24:KOOKOOOOOOhKOhhK",
 33: "24:KOOKOOOOOOhKOhhK",
 34: "24:KOOKKKKKKKKKOhhK",
 35: "24:KOOOOOOOOOOOOhhK",
 36: "24:KhhhhhhhhhhhhhhK",
 37: "25:KKKKKKKKKKKKKK",
}
PACK = {y - 2: s for y, s in _PACK.items()}
LEGS = {
 40: "23:KtUUUUUUUUUUUUUUUVK",
 41: "23:KtUUUUUUUUUUUUUUUVK",
 42: "23:KtUUUUUUKKUUUUUUUVK",
}
for i, y in enumerate(range(43, 57)):
    s = i // 4
    LEGS[y] = f"{23 - s}:KtUUUUVK {33 + s}:KtUUUUVK"
SHOES = {
 57: "20:KWRRRRRK 36:KWRRRRRK",
 58: "19:KRRRRRRXK 36:KRRRRRRXK",
 59: "19:KRRRRRRXK 36:KRRRRRRXK",
 60: "19:KWWWWWWWK 36:KWWWWWWWK",
 61: "19:KKKKKKKKK 36:KKKKKKKKK",
}
L_ARM = {19: "19:KK", 20: "18:KNNK"}
for y in range(21, 32):
    L_ARM[y] = "17:KNNnK"
L_ARM.update({32: "17:KnnnK", 33: "17:XSSSX", 34: "17:XSSSX", 35: "18:XXX"})

R_READY = {  # fist raised beside the head, orb in hand
 7:  "46:KKK",
 8:  "45:KWTtK",
 9:  "45:KTttK",
 10: "46:KKK",
 11: "45:XSSSX",
 12: "45:XSSSX",
 13: "45:KXXXK",
 14: "45:KNNnK", 15: "45:KNNnK", 16: "45:KNNnK", 17: "45:KNNnK", 18: "45:KNNnK",
 19: "42:K 45:KNNnK",
 20: "42:NNNNNNnK",
 21: "42:NNNNNnnK",
 22: "42:nnnnnnK",
 23: "42:KKKKKK",
}

R_WINDUP = {  # arm pulled down and back beside the hip, orb in hand
 19: "42:K", 20: "42:NNNK", 21: "42:NNNnK",
 22: "42:KNNnK", 23: "42:KNNnK", 24: "43:KNNnK", 25: "43:KNNnK",
 26: "43:KNNnK", 27: "43:KNNnK", 28: "43:KNNnK", 29: "43:KnnnK",
 30: "43:XSSSX", 31: "43:XSSSX", 32: "43:KTtUK", 33: "44:KKK",
}
R_UP = {  # arm raised high, orb above the cap
 2: "48:KKK", 3: "47:KWTtK", 4: "47:KTtUK", 5: "47:XSSSX", 6: "47:XSSSX", 7: "47:KnnnK",
 8: "47:KNNnK", 9: "47:KNNnK", 10: "46:KNNnK", 11: "46:KNNnK", 12: "46:KNNnK",
 13: "45:KNNnK", 14: "45:KNNnK", 15: "45:KNNnK", 16: "44:KNNnK", 17: "44:KNNnK",
 18: "43:KNNnK", 19: "43:KNNnK", 20: "42:NNNnK", 21: "42:NNnK",
}
R_RELEASE = {  # arm flung forward to the upper right, orb leaving the hand
 7: "58:KKK", 8: "57:KWTtK", 9: "57:KTtUK", 10: "58:KKK",
 11: "55:tT",
 13: "53:XXX",
 14: "49:KKKXSSSX",
 15: "46:KKKNNNXSSSSX",
 16: "44:KKNNNNNnXSSSX",
 17: "43:KNNNNNNnnKXXX",
 18: "42:KNNNNNNnnK",
 19: "42:NNNNnnnK",
 20: "42:NNnnK",
 21: "42:nnK",
}
R_FOLLOW = {  # follow-through: arm swept down and forward, hand empty
 20: "42:NNNK", 21: "42:NNNNK",
 22: "43:KNNNnK", 23: "44:KNNNnK", 24: "45:KNNnK", 25: "45:KNNnK",
 26: "46:KNNnK", 27: "46:KNNnK", 28: "47:KnnnK",
 29: "47:XSSSX", 30: "47:XSSSX", 31: "48:XXX",
}
FRAMES = {'back': R_READY, 'windup': R_WINDUP, 'up': R_UP, 'release': R_RELEASE, 'follow': R_FOLLOW}
THROW = ['windup', 'up', 'release', 'follow']
LEAN = {'back': 0, 'windup': -1, 'up': 0, 'release': 1, 'follow': 1}

def draw(Canvas, frame='back'):
    dx = LEAN[frame]
    c = Canvas()
    c.layer(LEGS).layer(SHOES)
    for part in (JACKET, PACK, HEAD, L_ARM, FRAMES[frame]):
        c.layer(part, dx=dx)
    g = Canvas(); g.g = [[None] * 64 for _ in range(2)] + c.g[:62]  # feet down to row 63
    return g
