from pathlib import Path
import base64
import gzip
import re
import math

root = Path(__file__).resolve().parent / "oxygen-ac-automation"
asset_dir = root / "assets"
page_path = asset_dir / "oxygen-maintenance-home.html"

# The full, reviewed HTML asset is canonical. This avoids rebuilding the live page
# from stale compressed chunks and silently losing the in-page settings modal.
if page_path.is_file() and page_path.stat().st_size > 50000:
    page_text = page_path.read_text(encoding="utf-8")
else:
    # Recover from committed chunks only when the full HTML asset is unavailable.
    page_parts = sorted(asset_dir.glob("page-part-*.txt"))
    if not page_parts:
        raise SystemExit("No homepage HTML asset or source parts found")
    page_b64_source = "".join(part.read_text(encoding="ascii").strip() for part in page_parts)
    page_text = gzip.decompress(base64.b64decode(page_b64_source)).decode("utf-8")

# Preserve the designed in-page password gate and settings modal.
# The browser-side passcode is a convenience lock, not server-side security.
page_text = re.sub(r"banks:\s*\[[\s\S]*?\n\s*\]", "banks: []", page_text, count=1)
page_text = re.sub(r"SA\d{18,24}", "", page_text)
page_text = page_text.replace("علي طلعت محمد زيدان", "")

page_bytes = page_text.encode("utf-8")
page_b64 = base64.b64encode(gzip.compress(page_bytes, compresslevel=9, mtime=0)).decode("ascii")
page_path.write_bytes(page_bytes)
(asset_dir / "oxygen-maintenance-home.html.gz.b64").write_text(page_b64, encoding="ascii")

# Keep fallback chunks synchronized with the canonical HTML. The frontend reads
# all numbered chunks dynamically from this list in index.html.
chunk_size = 5000
chunks = [page_b64[i:i + chunk_size] for i in range(0, len(page_b64), chunk_size)]
for index, chunk in enumerate(chunks, start=1):
    (asset_dir / f"page-part-{index:02}.txt").write_text(chunk, encoding="ascii")

# Remove any obsolete numbered chunks left over from an older, shorter page.
valid_names = {f"page-part-{index:02}.txt" for index in range(1, len(chunks) + 1)}
for old_part in asset_dir.glob("page-part-*.txt"):
    if old_part.name not in valid_names:
        old_part.unlink()

if "ADMIN_PASS" not in page_text or "admin-settings-modal" not in page_text or "function openAdminGate" not in page_text:
    raise SystemExit("Homepage validation failed: in-page settings gate/modal is missing")

print(f"Homepage rebuilt: {len(page_bytes)} bytes; {len(chunks)} fallback chunks; in-page settings modal preserved.")
