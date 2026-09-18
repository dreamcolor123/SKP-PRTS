"""Build native MiSans subsets from the same pinned glyphs used by the Web UI.

Requires fonttools and brotli. The source files and MiSans license stay intact.
Unlisted application names fall back to Android's CJK font as normal.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
import hashlib
import json

project = Path(__file__).resolve().parents[3]
web = project / 'ui/rhine'
out = project / 'app/src/main/res/font'
work = project / 'app/build/native-fonts'
out.mkdir(parents=True, exist_ok=True)
work.mkdir(parents=True, exist_ok=True)
chars = set(range(32, 127))
for path in (project / 'app/src/main/java/com/linux/permissionmanager/ui').rglob('*.kt'):
    chars.update(ord(c) for c in path.read_text(encoding='utf-8') if ord(c) >= 32)
report = []
for weight in ('regular', 'demibold', 'bold'):
    mapping, metrics, outlines = {}, {}, {}
    pen = T2CharStringPen(1000, None)
    outlines['.notdef'] = pen.getCharString()
    metrics['.notdef'] = (1000, 0)
    upm, ascent, descent = 1000, 1000, -200
    for source in sorted((web / 'public/fonts/misans-webfont-4.3.1' / weight).glob('*.woff2')):
        font = TTFont(source)
        keep = chars.intersection(font.getBestCmap())
        if not keep:
            font.close()
            continue
        upm = font['head'].unitsPerEm
        ascent, descent = font['hhea'].ascent, font['hhea'].descent
        glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
        for cp in sorted(keep):
            name = f'uni{cp:04X}'
            original = cmap[cp]
            width, lsb = font['hmtx'][original]
            pen = T2CharStringPen(width, glyphs)
            glyphs[original].draw(pen)
            outlines[name] = pen.getCharString()
            metrics[name] = (width, lsb)
            mapping[cp] = name
        font.close()
    font = FontBuilder(upm, isTTF=False)
    font.setupGlyphOrder(list(outlines))
    font.setupCharacterMap(mapping)
    family = 'MiSans Native'
    font.setupCFF(f'MiSansNative-{weight}', {'FullName':f'{family} {weight}', 'FamilyName':family, 'Weight':weight}, outlines, {})
    font.setupHorizontalMetrics(metrics)
    font.setupHorizontalHeader(ascent=ascent, descent=descent)
    font.setupNameTable({'familyName':family, 'styleName':weight, 'fullName':f'{family} {weight}',
        'psName':f'MiSansNative-{weight}', 'copyright':'Copyright 2020-2023 Beijing Xiaomi Mobile Software Co.,Ltd. All Rights Reserved.'})
    font.setupOS2(sTypoAscender=ascent, sTypoDescender=descent, usWinAscent=max(0,ascent), usWinDescent=max(0,-descent), usWeightClass={'regular':400,'demibold':600,'bold':700}[weight])
    font.setupPost()
    target = out / f'skp_misans_{weight}.otf'
    font.save(target)
    report.append({'file': target.relative_to(project).as_posix(), 'glyphs': len(mapping),
                   'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'bytes': target.stat().st_size})
(web / 'NATIVE-FONTS.json').write_text(json.dumps({'source':'misans-webfont@4.3.1', 'fontVersion':'4.003',
    'operation':'glyph subsets merged into native sfnt; source outlines unchanged', 'files':report}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
