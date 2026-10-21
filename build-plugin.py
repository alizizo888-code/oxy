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
# Never ship the original browser-only admin pass. This old UI stores its
# controls in localStorage and is not a server-side administration surface.
page_text = re.sub(r"^\s*const ADMIN_PASS\s*=\s*[^;]+;\s*$", "// Frontend settings are local to this browser; use the authenticated WordPress publisher dashboard.", page_text, flags=re.M)
old_gate = '''        function openAdminGate() {
            const pass = prompt("أدخل الرمز السري لقفل الإعدادات:");
            if (pass === ADMIN_PASS) {
                populateAdminPanel();
                document.getElementById('admin-settings-modal').classList.add('active');
            } else if (pass !== null) showToast("❌ الرمز السري غير صحيح");
        }'''
new_gate = '''        function openAdminGate() {
            showToast("إعدادات الناشر الدائمة متاحة من لوحة ووردبريس؛ إعدادات الواجهة هنا محلية لهذا المتصفح فقط.");
        }'''
page_text = page_text.replace(old_gate, new_gate)
page_bytes = page_text.encode("utf-8")
page_b64 = base64.b64encode(gzip.compress(page_bytes, compresslevel=9, mtime=0)).decode("ascii")
(asset_dir / "oxygen-maintenance-home.html").write_bytes(page_bytes)
(asset_dir / "oxygen-maintenance-home.html.gz.b64").write_text(page_b64, encoding="ascii")

# Restore the WordPress plugin from four compressed PHP chunks.
php_parts = sorted(root.glob("source-php.gz.b64.part*"))
if len(php_parts) != 4:
    raise SystemExit(f"Expected 4 PHP source parts, found {len(php_parts)}")
php_b64 = "".join(part.read_text(encoding="ascii").strip() for part in php_parts)
php_source = gzip.decompress(base64.b64decode(php_b64))
out = root / "oxygen-ac-automation.php"
out.write_bytes(php_source)
print(f"Reconstructed sanitized page: {len(page_bytes)} bytes")
print(f"Reconstructed plugin: {out} ({len(php_source)} bytes)")
