# Buduje com.ulanzi.halamp.ulanziPlugin/images/icons.pack:
# maski alfa wszystkich ikon Material Design Icons (120x120) + glify czcionki Inter Bold do napisów.
# Wymaga: rsvg-convert, Pillow, katalogu z plikami SVG MDI (np. z pakietu @mdi/svg) i pliku Inter-Bold.otf.
# Użycie:
#   mkdir png && for f in <mdi>/svg/*.svg; do rsvg-convert -w 120 -h 120 "$f" -o png/$(basename "$f" .svg).png; done
#   python3 tools/build_icons_pack.py
import os, json, zlib, struct
from PIL import Image, ImageFont, ImageDraw
src='png'; out='com.ulanzi.halamp.ulanziPlugin/images/icons.pack'
idx={'iconSize':120,'icons':{},'glyphs':{}}
blobs=[]; off=0
def add(raw):
    global off
    c=zlib.compress(raw,9); blobs.append(c); r=[off,len(c)]; off+=len(c); return r
for f in sorted(os.listdir(src)):
    a=Image.open(os.path.join(src,f)).convert('RGBA').getchannel('A')
    assert a.size==(120,120)
    idx['icons'][f[:-4]]=add(a.tobytes())
font=ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Bold.otf',72)
asc,desc=font.getmetrics(); H=asc+desc
idx['glyphH']=H; idx['ascent']=asc
chars=[chr(c) for c in range(32,127)]+list('ąćęłńóśźżĄĆĘŁŃÓŚŹŻ°µ²³·–…−äöüÄÖÜß×')
for ch in chars:
    adv=font.getlength(ch); w=max(1,int(round(adv)))
    im=Image.new('L',(w+8,H),0); ImageDraw.Draw(im).text((4,0),ch,font=font,fill=255)
    # keep overhang: store with 4px padding left/right
    idx['glyphs'][str(ord(ch))]=add(im.tobytes())+[w+8,adv]
j=json.dumps(idx,separators=(',',':')).encode()
with open(out,'wb') as fo:
    fo.write(b'HAIP1'); fo.write(struct.pack('<I',len(j))); fo.write(j)
    for b in blobs: fo.write(b)
print(os.path.getsize(out)/1e6,'MB', len(idx['icons']),'icons', H)
