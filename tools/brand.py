#!/usr/bin/env python3
"""Derive the OXYGEN (أكسجين) tree from the MUTQAN (متقن) source tree — one code base, two brands, no hand-edited drift.

usage: brand.py <tree-root> oxygen        (rewrites the tree in place)

* Text: a fixed set of rules over the app source, the Mutqan PHP classes, bot data and tests.
* Assets: everything in brand/<brand>/ replaces the matching public/ file (icons, logo, SVG) and splash.html replaces the boot splash.
* Code, routes, REST namespace, option keys, collection names and file names are identical in both brands, so branches never collide.
"""
import os, re, sys, shutil

ROOT = os.path.abspath(sys.argv[1]); BRAND = sys.argv[2]
if BRAND != 'oxygen': sys.exit('only the oxygen overlay is defined (mutqan is the source)')
SCOPE_DIRS = ['mutqan-app/src', 'oxygen-ac-automation/includes/mutqan', 'tests/bot', 'tests/mutqan']
SCOPE_FILES = ['mutqan-app/index.html', 'mutqan-app/public/manifest.webmanifest']
SKIP = {'tests/mutqan/seo.php'}      # asserts BOTH brands, must stay as written
EXT = ('.css', '.js', '.jsx', '.php', '.json', '.mjs', '.html', '.webmanifest')
KEEP = ['MUTQAN AI']          # internal prompt persona name, never shown to customers

REV = [('#eff7f5', '#eef4fb'), ('#e8f5f2', '#eaf3fc'), ('background:#12a39a;color:#04121f', 'background:#38bdf8;color:#04121f'), ('background:#0a2a42', 'background:#071a33')]   # Mutqan skin colours -> original Oxygen look
SKIN = {'theme.js': 'mutqan-app/theme.js', 'skin.css': 'mutqan-app/src/skin.css'}

def rewrite(s):
    for a, b in REV: s = s.replace(a, b)
    for i, k in enumerate(KEEP): s = s.replace(k, f'\0{i}\0')
    s = re.sub(r'(?<![A-Za-z0-9_])MUTQAN(?![A-Za-z0-9_])', 'OXYGEN', s)   # visible brand word only, never identifiers (__MUTQAN__, MUTQAN_CFG)
    s = s.replace('متقن', 'أكسجين')      # plain متقن (a damma-marked «مُتقن» does not match and stays as the second name)
    s = s.replace('logo-mutqan', 'logo-oxygen')
    for i, k in enumerate(KEEP): s = s.replace(f'\0{i}\0', k)
    return s

def walk():
    for d in SCOPE_DIRS:
        for dp, _, fs in os.walk(os.path.join(ROOT, d)):
            for f in fs:
                if f.endswith(EXT) and 'node_modules' not in dp: yield os.path.join(dp, f)
    for f in SCOPE_FILES: yield os.path.join(ROOT, f)

n = 0
for p in walk():
    if not os.path.isfile(p) or os.path.relpath(p, ROOT) in SKIP: continue
    t = open(p, encoding='utf-8').read(); u = rewrite(t)
    if u != t: open(p, 'w', encoding='utf-8').write(u); n += 1
ov = os.path.join(ROOT, 'brand', BRAND)
pub = os.path.join(ROOT, 'mutqan-app/public')
for f in os.listdir(ov):
    if f == 'splash.html': continue
    if f.startswith('site-icon'):
        shutil.copyfile(os.path.join(ov, f), os.path.join(ROOT, 'oxygen-ac-automation/assets', f)); continue
    if f in SKIN:
        shutil.copyfile(os.path.join(ov, f), os.path.join(ROOT, SKIN[f])); continue
    shutil.copyfile(os.path.join(ov, f), os.path.join(pub, f))
old = os.path.join(pub, 'logo-mutqan.png')
if os.path.exists(old): os.remove(old)
idx = os.path.join(ROOT, 'mutqan-app/index.html')
h = open(idx, encoding='utf-8').read()
sp = open(os.path.join(ov, 'splash.html'), encoding='utf-8').read()
h = re.sub(r'<div id="boot-splash".*?<div class="bar"><i></i></div></div>', lambda m: sp, h, flags=re.S)
open(idx, 'w', encoding='utf-8').write(h)
print(f'branded {n} files -> {BRAND}')
