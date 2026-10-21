# 유림 (grass gym leader) - chip: scarloxy-charset-people2 slot 1 (leafy green hair,
# green hooded jacket, cream striped shirt, olive trousers, dark green shoes, teal eyes)
PAL = {
    'K': '#13491c',  # outline
    'L': '#80af23', 'H': '#50982d', 'h': '#247132',  # hair / leaves / shoes
    'S': '#fef7d7', 's': '#feddb1', 'c': '#e29f7f', 'r': '#7b3d3a',  # skin
    'J': '#68a97a', 'j': '#38886d', 'q': '#2e7353',  # jacket
    'W': '#ebdba7', 'w': '#999c70', 'o': '#737650', 'O': '#505232',  # shirt / trousers
    'e': '#5ccfc4',  # eyes
}
HEAD = {
 4:  "29:K 35:K",
 5:  "28:KLK 34:KHK",
 6:  "24:KLLHHKLLHHKLHHhK",
 7:  "23:KLLHHHKLLHHHKLHHhhK",
 8:  "22:KLHHHHHKLHHHHHKHHhhK",
 9:  "21:KKHHHHHhKHHHHHhKHHhhKK",
 10: "21:KHHHHhhHHHHHhhHHHHhhhK",
 11: "22:KHhhKHHhKHHHhKHHhhhK",
 12: "22:KHhhK 27:sKhKssKHKs 37:KhHHK",
 13: "23:KHhK 27:ssssssssss 37:KhHK",
 14: "23:KhhK 27:sqqssssqqs 37:KhhK",
 15: "23:KHhK 27:seessssees 37:KhHK",
 16: "24:KhK 27:Sssssscssc 37:KhK",
 17: "27:SssssccssS",
 18: "28:rSsssscr",
 19: "29:rrrrrr",
}
HOOD = {y: "24:KJjjjjjjjjjjjjqK" for y in range(12, 22)}
HOOD[11] = "25:KKKKKKKKKKKKKK"
BODY = {
 22: "23:KJJJJJJKKJJJJJjK",
 23: "20:KK 22:KJJjjJJJKWWKJJJjjjqK 42:KK",
 24: "19:KJJj 23:KJjWWWWWWWWWWWWjqK 41:JjqK",
}
for y in range(25, 32):
    BODY[y] = "19:KJJj 23:KJjWwWWwWWwWWwWjqK 41:JjqK"
BODY.update({
 32: "19:KJJj 23:KKKKKKKKKKKKKKKKKK 41:JjqK",
 33: "19:KSsrJJJJJJJJJJJqJJJJJjjqqK",
 34: "19:KScrjJJJJJJJJJqJJJJJjrSsrK",
 35: "19:KrrrqjjjjjjjjKjjjjjjqrssrK",
 36: "20:KKKKKKKKKKKKKKKKKKKKKKKK",
 37: "24:KjWwWWwWWwWWwWjK",
 38: "24:KjWwWWwWWwWWwWjK",
 39: "24:KjWwWWwWWwWWwWjK",
 40: "24:KKwwwwwwwwwwwwKK",
 41: "24:KwooooooooooooOK",
 42: "24:KwooooooooooooOK",
 43: "24:KwooooOKKwooooOK",
})
for y in range(44, 57):
    BODY[y] = "24:KwoooOK 33:KwoooOK"
BODY[50] = "24:KwooOOK 33:KwooOOK"
BODY.update({
 57: "24:KKKKKKK 33:KKKKKKK",
 58: "23:KHHhhhhK 33:KHHhhhhK",
 59: "22:KHHHhhhhK 33:KHHHhhhhK",
 60: "21:KHLHHhhhhK 33:KHLHHhhhhK",
 61: "21:KhhhhhhhhK 33:KhhhhhhhhK",
 62: "21:KwwwwwwwwK 33:KwwwwwwwwK",
 63: "22:KKKKKKKK 34:KKKKKKKK",
})

def draw(Canvas):
    c = Canvas()
    c.layer(HOOD).layer(BODY).layer(HEAD)
    return c
