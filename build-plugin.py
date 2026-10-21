from pathlib import Path
import base64
import gzip

root = Path(__file__).resolve().parent / "oxygen-ac-automation"
asset_dir = root / "assets"

# Restore the sanitized maintenance page from its six committed chunks.
page_parts = sorted(asset_dir.glob("page-part-*.txt"))
if len(page_parts) != 6:
    raise SystemExit(f"Expected 6 HTML source parts, found {len(page_parts)}")
page_b64 = "".join(part.read_text(encoding="ascii").strip() for part in page_parts)
page_bytes = gzip.decompress(base64.b64decode(page_b64))
(asset_dir / "oxygen-maintenance-home.html").write_bytes(page_bytes)
(asset_dir / "oxygen-maintenance-home.html.gz.b64").write_text(page_b64, encoding="ascii")

# Restore the WordPress plugin from its four compressed PHP chunks.
php_parts = sorted(root.glob("source-php.gz.b64.part*"))
if len(php_parts) != 4:
    raise SystemExit(f"Expected 4 PHP source parts, found {len(php_parts)}")
php_b64 = "".join(part.read_text(encoding="ascii").strip() for part in php_parts)
php_source = gzip.decompress(base64.b64decode(php_b64))
out = root / "oxygen-ac-automation.php"
out.write_bytes(php_source)
print(f"Reconstructed sanitized page: {len(page_bytes)} bytes")
print(f"Reconstructed plugin: {out} ({len(php_source)} bytes)")
