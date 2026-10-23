"""Rebuild the original, opaque beta icon. Developer tool; requires Pillow."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / 'ScoreApp/Assets.xcassets'
icon = root / 'AppIcon.appiconset'
icon.mkdir(parents=True, exist_ok=True)
image = Image.new('RGB', (1024, 1024), '#285E79')
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((190, 136, 834, 888), radius=32, fill='#FFFFFF')
for y in range(330, 571, 60):
    draw.line((260, y, 760, y), fill='#63717B', width=9)
draw.ellipse((338, 475, 446, 548), fill='#18242C')
draw.line((438, 510, 438, 280), fill='#18242C', width=18)
draw.line((438, 280, 538, 319), fill='#18242C', width=22)
draw.line((290, 735, 712, 735), fill='#D59B2D', width=22)
draw.line((659, 683, 712, 735, 659, 787), fill='#D59B2D', width=22)
image.save(icon / 'AppIcon.png')
(root / 'Contents.json').write_text(json.dumps({'info':{'author':'xcode','version':1}}, indent=2)+'\n')
(icon / 'Contents.json').write_text(json.dumps({'images':[{'filename':'AppIcon.png',
    'idiom':'universal','platform':'ios','size':'1024x1024'}],
    'info':{'author':'xcode','version':1}}, indent=2)+'\n')
