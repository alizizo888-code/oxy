from pathlib import Path
import base64
import gzip
import re

root = Path(__file__).resolve().parent / "oxygen-ac-automation"
asset_dir = root / "assets"

# Restore the page from its committed source chunks.
page_parts = sorted(asset_dir.glob("page-part-*.txt"))
if len(page_parts) != 6:
    raise SystemExit(f"Expected 6 HTML source parts, found {len(page_parts)}")
page_b64_source = "".join(part.read_text(encoding="ascii").strip() for part in page_parts)
page_text = gzip.decompress(base64.b64decode(page_b64_source)).decode("utf-8")
# Keep the designed in-page settings gate and modal. The supplied passcode
# is a convenience lock only; it is not server-side authentication.
page_text = re.sub(r"banks:\s*\[[\s\S]*?\n\s*\]", "banks: []", page_text, count=1)
page_text = re.sub(r"SA\\d{18,24}", "", page_text)
page_text = page_text.replace("علي طلعت محمد زيدان", "")
page_bytes = page_text.encode("utf-8")
page_b64 = base64.b64encode(gzip.compress(page_bytes, compresslevel=9, mtime=0)).decode("ascii")
(asset_dir / "oxygen-maintenance-home.html").write_bytes(page_bytes)
(asset_dir / "oxygen-maintenance-home.html.gz.b64").write_text(page_b64, encoding="ascii")

# The current WordPress plugin source is tracked directly at oxygen-ac-automation.php.
# Do not overwrite it with the legacy compressed source archive.
print("Sanitized frontend rebuilt; WordPress plugin source left untouched.")
