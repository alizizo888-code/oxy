from pathlib import Path
import base64
import gzip

root = Path(__file__).resolve().parent / "oxygen-ac-automation"
parts = sorted(root.glob("source-php.gz.b64.part*"))
if len(parts) != 4:
    raise SystemExit(f"Expected 4 PHP source parts, found {len(parts)}")

encoded = "".join(part.read_text(encoding="ascii").strip() for part in parts)
source = gzip.decompress(base64.b64decode(encoded))
out = root / "oxygen-ac-automation.php"
out.write_bytes(source)
print(f"Reconstructed plugin: {out} ({len(source)} bytes)")
