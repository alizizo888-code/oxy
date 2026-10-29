#!/usr/bin/env python3
"""Move the static articles to a new domain.

  python3 tools/rebrand-domain.py https://new-domain.com [--old https://oxygen11.com]

* rewrites every link/canonical/sitemap/catalog/workflow reference to the new domain
* renumbers article slugs with a -dN suffix (N = how many times the domain moved) so URLs
  never collide with articles already living on the new site; folders and links follow
* stores the state in articles/site.json (the publisher reads it)
"""
import json, re, sys, argparse
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "articles"
cfg_path = A / "site.json"
ap = argparse.ArgumentParser(); ap.add_argument("new"); ap.add_argument("--old")
ap.add_argument("--dry", action="store_true")
a = ap.parse_args()
new = a.new.rstrip("/")
cfg = json.loads(cfg_path.read_text()) if cfg_path.exists() else {"site_url": "https://oxygen11.com", "epoch": 0}
old = (a.old or cfg["site_url"]).rstrip("/")
if old == new:
    print("same domain, nothing to do"); sys.exit(0)
epoch = cfg.get("epoch", 0) + 1
cat = json.loads((A / "catalog.json").read_text())
ren = {}
for it in cat:
    base = re.sub(r"-d\d+$", "", it["slug"])
    ren[it["slug"]] = f"{base}-d{epoch}"
oldhost = re.sub(r"^https?://", "", old); newhost = re.sub(r"^https?://", "", new)
files = [p for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.parts and "node_modules" not in p.parts
         and "app" not in p.parts[:2] and "dist" not in p.parts
         and p.suffix in {".html", ".xml", ".json", ".yml", ".md", ".py", ".txt"}
         and (p.parts[len(ROOT.parts)] in {"articles", ".github", "scripts"} or p.name in {"sitemap.xml", "README.md", "robots.txt"})]
n = 0
for p in files:
    try: t = p.read_text(encoding="utf-8")
    except Exception: continue
    o = t
    for s_old, s_new in ren.items():
        t = t.replace(f"/articles/{s_old}/", f"/articles/{s_new}/")
    t = t.replace(old, new).replace(oldhost, newhost) if oldhost in t else t
    if t != o:
        n += 1
        if not a.dry: p.write_text(t, encoding="utf-8")
for s_old, s_new in ren.items():
    d = A / s_old
    if d.is_dir() and not a.dry: d.rename(A / s_new)
if not a.dry:
    c = json.loads((A / "catalog.json").read_text())
    for it in c: it["slug"] = ren.get(it["slug"], it["slug"])
    (A / "catalog.json").write_text(json.dumps(c, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    cfg_path.write_text(json.dumps({"site_url": new, "epoch": epoch}, indent=2) + "\n")
print(f"{'would update' if a.dry else 'updated'} {n} files, {len(ren)} articles renumbered to -d{epoch}, domain {old} -> {new}")
