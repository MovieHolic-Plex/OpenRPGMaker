# 무영 (밤막회사 대표, boss) - chip: scarloxy-charset-people2 slot 0 (red swept flame hair,
# dark grey mask over the jaw, dark skin, red coat with yellow bands + gold epaulettes, slate trousers)
PAL = {
    'K': '#1d3340',  # outline
    'A': '#ec6e52', 'B': '#db3838', 'C': '#a82931', 'D': '#7b1c2c',  # hair + coat
    'Y': '#ecc552', 'y': '#db9138',  # gold bands
    'N': '#6c7e7d', 'M': '#4b5b5a', 'm': '#2f424a',  # mask, trousers, boots
    'S': '#eba06e', 's': '#c8885c', 'c': '#a2654a', 'n': '#793122',  # skin
    'W': '#ffffff',
}
HEAD = {
 4:  "37:D",
 5:  "32:D 36:DAD",
 6:  "29:D 31:DAD 35:DABD",
 7:  "27:DAD 30:DABBDABBBD",
 8:  "26:DABBDABBBBBBCD",
 9:  "25:DABBBBBBBBBBBCCD",
 10: "25:DBBBBBBBBBBBBBCD",
 11: "25:DB 27:DSssssssss 37:CBD",
 12: "25:Dn 27:sKssssssKc 37:nD",
 13: "26:nsSKKssKKscn",
 14: "26:nsWKssssKWcn",
 15: "26:nsBssssssBcn",
 16: "26:nMsssccsssMn",
 17: "26:KMMMmKKmMMmK",
 18: "26:KMMMNMMMMmmK",
 19: "27:KmMMMMMMmK",
 20: "28:KmmmmmmK",
 21: "30:KKKK",
}
COLLAR = {
 19: "24:DAD 36:DCD",
 20: "23:DABD 37:DBCD",
 21: "23:DABBD 36:DBBCD",
}
BODY = {
 22: "18:KYYYYD 24:DABBBBBBBBBBBBCD 40:DYYyyK",
 23: "17:KYYYyyD 24:ABBBBBBBBBBBBBCC 40:DYyyyyK",
 24: "17:KyKyKyD 24:ABBBBBBBBBBBBBCC 40:DyKyKyK",
}
TORSO = "24:ABBBBBBBBBBBBBCC"; BAND = "24:YYYYYYYYYYYYYYyy"
for y in range(25, 38):
    BODY[y] = BAND if y in (27, 30, 33) else TORSO
BODY[38] = "24:KKKKKKKYYKKKKKKK"
BODY[39] = "23:DABBBBBD 31:Mm 33:DBBBBBCD"
BODY[40] = "23:DABBBBBD 31:Mm 33:DBBBBBCD"
BODY.update({
 41: "22:DABBBBBD 30:MMmm 34:DBBBBBCD",
 42: "22:DABBBBBD 30:MMmm 34:DBBBBBCD",
 43: "21:DABBBBBD 29:NMMMmm 35:DBBBBBCD",
 44: "21:DABBBBBD 29:NMMMmm 35:DBBBBBCD",
 45: "20:DABBBBBD 28:NMMKKMmm 36:DBBBBBCD",
 46: "20:DABBBBBD 28:NMMKKMmm 36:DBBBBBCD",
 47: "19:DABBBBBBD 28:NMK 33:KMm 36:DBBBBBBCD",
 48: "19:DABBBBBBD 28:NMK 33:KMm 36:DBBBBBBCD",
 49: "19:DABBBBBBD 28:NMK 33:KMm 36:DBBBBBBCD",
 50: "18:DABBBBBBBD 28:NMK 33:KMm 36:DBBBBBBBCD",
 51: "18:DYYYYYYYYD 28:NMK 33:KMm 36:DYYYYYYyyD",
 52: "18:DDDDDDDDDD 28:NMK 33:KMm 36:DDDDDDDDDD",
 53: "26:KNMmK 33:KNMmK",
 54: "26:KNMmK 33:KNMmK",
 55: "26:KNMmK 33:KNMmK",
 56: "25:KNMMmK 33:KNMMmK",
 57: "24:KNNMMmK 33:KNMMMmK",
 58: "24:KNMMMmK 33:KNMMMmK",
 59: "23:KNMMMMmK 33:KNMMMMmK",
 60: "22:KNMMMMMmK 33:KNMMMMMmK",
 61: "21:KNNMMMMMmK 33:KNNMMMMMmK",
 62: "21:KmmmmmmmmK 33:KmmmmmmmmK",
 63: "22:KKKKKKKK 34:KKKKKKKK",
})
ARMS = {  # both fists on the hips, elbows out
 25: "18:DABBBD 40:DBBCCD",
 26: "17:DABBBD 41:DBBCCD",
 27: "16:DABBBD 42:DBBCCD",
 28: "15:DABBBD 43:DBBCCD",
 29: "15:DABBBD 43:DBBCCD",
 30: "14:DABBBD 44:DBBCCD",
 31: "14:DABBCD 44:DBBCCD",
 32: "14:DABBBBD 43:DBBBCCD",
 33: "15:DCBBBBD 42:DBBBCCD",
 34: "16:DCBBBBD 41:DBBBCCD",
 35: "17:DCCBYyD 40:DyYBCCD",
 36: "20:nSscn 39:nSscn",
 37: "20:nSsscn 38:nSsscn",
 38: "21:nnnn 39:nnnn",
}

def draw(Canvas):
    c = Canvas()
    c.layer(BODY).layer(ARMS).layer(HEAD).layer(COLLAR)
    return c
