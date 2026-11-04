from pathlib import Path
import sys

sys.path.insert(0, "/tmp/singloop-poster-deps")
from PIL import Image, ImageDraw, ImageFont
import qrcode

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "assets"
OUT.mkdir(parents=True, exist_ok=True)

FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
FONT_B = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"

def font(size, bold=False):
    return ImageFont.truetype(FONT_B if bold else FONT, size)

def rounded(draw, box, radius=20, fill="white", outline=None, width=1):
    draw.rounded_rectangle(box, radius, fill=fill, outline=outline, width=width)

def text(draw, xy, value, size, color="#182433", bold=False, anchor=None):
    draw.text(xy, value, font=font(size, bold), fill=color, anchor=anchor)

def qr(url, size):
    code = qrcode.QRCode(version=None, box_size=10, border=2)
    code.add_data(url); code.make(fit=True)
    return code.make_image(fill_color="#182433", back_color="white").convert("RGB").resize((size, size))

def product_shot():
    im = Image.new("RGB", (1360, 940), "#f7f9fc")
    d = ImageDraw.Draw(im)
    rounded(d, (24, 24, 1336, 916), 24, "#ffffff", "#dce4ec", 2)
    d.rectangle((24, 24, 1336, 88), fill="#ffffff")
    d.line((24, 88, 1336, 88), fill="#e7edf3", width=2)
    for i, c in enumerate(["#ff6b6b", "#ffd166", "#69d19d"]): d.ellipse((48+i*28, 50, 62+i*28, 64), fill=c)
    text(d, (675, 56), "SingLoop · 英语歌曲陪练", 18, "#758395", anchor="mm")
    text(d, (60, 125), "SingLoop", 28, "#182433", True)
    text(d, (1130, 126), "ENGLISH PRACTICE", 13, "#7994b5", True)
    text(d, (60, 177), "跟着一首歌，练好一句英语。", 38, "#182433", True)
    text(d, (60, 222), "陪练式交互原型 · 本地导入歌曲与同步歌词", 17, "#788696")
    rounded(d, (60, 270, 800, 845), 18, "#ffffff", "#dfe6ed", 2)
    text(d, (88, 304), "LYRICS  ·  逐句练习", 18, "#182433", True)
    lyrics = [
        "Take a breath and start again", "Every small step counts today",
        "If you miss a word, just stay", "Listen close and find your way",
        "Let the rhythm lead you through", "Keep moving, you are breaking through"
    ]
    for i, line in enumerate(lyrics):
        y = 353 + i*62
        if i == 1:
            rounded(d, (82, y-13, 774, y+42), 10, "#edf4fb")
            d.rectangle((82, y-13, 87, y+42), fill="#7297c4")
        text(d, (102, y+4), f"0{i+1}", 13, "#a0acb8")
        text(d, (148, y), line, 19, "#284667" if i == 1 else "#647386", i == 1)
        if i == 1: d.ellipse((740, y+2, 750, y+12), fill="#7297c4")
    d.line((84, 738, 774, 738), fill="#e6ecf2", width=2)
    rounded(d, (100, 764, 260, 817), 10, "#ffffff", "#dbe4ed")
    text(d, (180, 791), "↺ 重新开始", 15, "#687789", anchor="mm")
    rounded(d, (278, 764, 473, 817), 10, "#eaf2fa", "#d4e1ee")
    text(d, (375, 791), "Ⅱ  暂停", 15, "#46698e", True, "mm")
    rounded(d, (491, 764, 650, 817), 10, "#ffffff", "#dbe4ed")
    text(d, (570, 791), "循环本句", 15, "#687789", anchor="mm")
    rounded(d, (824, 270, 1300, 845), 18, "#fbfcfe", "#dfe6ed", 2)
    text(d, (852, 304), "YOUR TURN  ·  跟读这一句", 18, "#182433", True)
    rounded(d, (850, 350, 1274, 445), 10, "#edf4fb")
    d.rectangle((850, 350, 855, 445), fill="#7297c4")
    text(d, (875, 373), "Every small step counts today", 20, "#284667", True)
    text(d, (875, 413), "今天的每一小步都算数", 15, "#728297")
    text(d, (852, 488), "重点词与发音", 14, "#8997a6", True)
    text(d, (852, 526), "small step", 17, "#4e739b", True)
    text(d, (1000, 526), "小步子 · 连读 small_step", 14, "#758396")
    text(d, (852, 568), "counts", 17, "#4e739b", True)
    text(d, (1000, 568), "重要、有价值 · 结尾 s 要发音", 14, "#758396")
    rounded(d, (850, 622, 1058, 678), 10, "#7699c4")
    text(d, (954, 650), "🎙 开始跟读", 16, "white", True, "mm")
    rounded(d, (1075, 622, 1274, 678), 10, "white", "#dbe4ed")
    text(d, (1175, 650), "提交录音", 16, "#657487", anchor="mm")
    rounded(d, (850, 710, 1274, 810), 10, "#f1f8f3", "#d9eadc")
    text(d, (872, 737), "很棒，继续保持节奏！", 16, "#45694f", True)
    text(d, (872, 772), "再听一遍并留意： counts", 15, "#5b7863")
    return im

shot = product_shot()
shot.save(OUT / "singloop-product.png", quality=96)

experience = "https://stackblitz.com/github/cantaloupeham/yuni-chorus/tree/work"
source = "https://github.com/cantaloupeham/yuni-chorus/tree/work"
qr_exp, qr_src = qr(experience, 190), qr(source, 150)

# Vertical hackathon poster
poster = Image.new("RGB", (1600, 2400), "#f7f9fc")
d = ImageDraw.Draw(poster)
d.rectangle((0, 0, 1600, 275), fill="#ffffff")
text(d, (90, 72), "Singalong", 70, "#172334", True)
text(d, (90, 164), "AI 陪伴交互", 30, "#6d8fb8", True)
rounded(d, (1180, 75, 1510, 132), 28, "#edf4fb")
text(d, (1345, 103), "陪练式交互原型", 20, "#53769e", True, "mm")
text(d, (90, 227), "用一首歌，把“听懂”变成“说得出、记得住”", 26, "#687789")

text(d, (90, 330), "喜欢用歌学外语，却常常", 28, "#738294")
text(d, (90, 377), "听不清 · 看懂后不会说 · 练过又忘", 38, "#1c2d40", True)

rounded(d, (70, 455, 1530, 1510), 28, "#ffffff", "#dce5ee", 2)
text(d, (110, 500), "真实产品界面", 20, "#7b8999", True)
text(d, (110, 540), "歌词高亮与跟读反馈", 34, "#1b2b3e", True)
scaled = shot.resize((1300, 898))
poster.paste(scaled, (110, 590))
rounded(d, (1185, 1260, 1480, 1470), 18, "#ffffff", "#d7e1eb", 2)
poster.paste(qr_exp.resize((160, 160)), (1252, 1273))
text(d, (1332, 1450), "扫码打开体验", 16, "#3f6288", True, "mm")

text(d, (90, 1580), "四步完成一次歌曲陪练", 32, "#1a2a3c", True)
steps = [("01", "导入歌曲与同步歌词"), ("02", "逐句听和理解"), ("03", "跟读反馈"), ("04", "复习薄弱句")]
for i, (num, label) in enumerate(steps):
    x = 90 + i*370
    rounded(d, (x, 1640, x+330, 1750), 18, "#ffffff", "#dfe6ed")
    text(d, (x+25, 1670), num, 18, "#7898bd", True)
    text(d, (x+25, 1712), label, 18, "#26384d", True)
    if i < 3: text(d, (x+346, 1694), "→", 25, "#9aabba", anchor="mm")

rounded(d, (70, 1815, 980, 2270), 24, "#ffffff", "#dfe6ed")
text(d, (110, 1860), "已实现", 25, "#466e58", True)
done = ["本地导入 MP3 / WAV / M4A", "LRC 时间轴解析与歌词高亮", "点击跳转与单句循环", "浏览器跟读识别与单词比对", "中文释义、重点词与学习进度"]
for i, item in enumerate(done):
    text(d, (115, 1922+i*56), "✓", 18, "#6ea081", True)
    text(d, (150, 1920+i*56), item, 19, "#506174")
text(d, (535, 1860), "开发中", 25, "#9b734d", True)
todo = ["实时 AI 个性化反馈", "薄弱句智能复习计划", "原创音频课程扩充"]
for i, item in enumerate(todo):
    text(d, (540, 1922+i*56), "○", 18, "#c39a70", True)
    text(d, (575, 1920+i*56), item, 19, "#506174")

rounded(d, (1035, 1815, 1530, 2270), 24, "#eef4fa")
text(d, (1282, 1870), "SOURCE CODE", 17, "#7591ae", True, "mm")
poster.paste(qr_src, (1207, 1915))
text(d, (1282, 2090), "GitHub 源码", 24, "#22374d", True, "mm")
text(d, (1282, 2140), "cantaloupeham / Singalong", 16, "#63758a", anchor="mm")
text(d, (1282, 2200), "React · Vite · Web Speech API", 15, "#8291a1", anchor="mm")
text(d, (90, 2340), "SINGALONG  ·  HACKATHON DEMO", 16, "#94a1ae", True)
text(d, (1510, 2340), "AI 陪伴交互", 16, "#94a1ae", True, "ra")
poster.save(OUT / "singalong-hackathon-poster.png", quality=96)

# Landscape cover
cover = Image.new("RGB", (1600, 900), "#f7f9fc")
d = ImageDraw.Draw(cover)
rounded(d, (55, 55, 1545, 845), 34, "#ffffff", "#dce5ee", 2)
text(d, (110, 116), "SINGALONG", 22, "#7594b8", True)
text(d, (110, 182), "Singalong", 74, "#172334", True)
text(d, (110, 282), "AI 陪伴交互", 37, "#6f91ba", True)
text(d, (110, 355), "陪练式交互原型", 25, "#273b52", True)
text(d, (110, 407), "把喜欢的歌，变成可以反复练习的英语课。", 22, "#68798b")
rounded(d, (110, 505, 500, 582), 14, "#eaf2fa")
text(d, (305, 543), "导入歌曲 → 逐句理解 → 跟读反馈", 18, "#456b94", True, "mm")
text(d, (110, 670), "AI TRACK", 16, "#8a98a8", True)
text(d, (110, 707), "AI 陪伴交互", 21, "#31465e", True)
shot_crop = shot.crop((40, 90, 1320, 870)).resize((880, 536))
rounded(d, (620, 160, 1510, 750), 24, "#e9eff5")
cover.paste(shot_crop, (625, 186))
rounded(d, (1290, 646, 1480, 808), 16, "#ffffff", "#d5e0ea", 2)
small_qr = qr(experience, 130)
cover.paste(small_qr.resize((112, 112)), (1329, 659))
text(d, (1385, 794), "打开体验", 13, "#3f638a", True, "mm")
cover.save(OUT / "singalong-hackathon-cover.png", quality=96)

print(OUT / "singalong-hackathon-poster.png")
print(OUT / "singalong-hackathon-cover.png")
