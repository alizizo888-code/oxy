#!/usr/bin/env python3
"""Generate and publish small, validated batches of static Arabic maintenance articles.

The script uses only the Python standard library. It refuses to publish when the
OpenAI API key is missing or when generated content fails validation.
"""
from __future__ import annotations

import argparse
import base64
import html
import json
import os
import re
import shutil
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ARTICLES_DIR = ROOT / "articles"
CATALOG_PATH = ARTICLES_DIR / "catalog.json"
try:
    _SITE = json.loads((ARTICLES_DIR / "site.json").read_text())
except Exception:
    _SITE = {}
SITE_URL = os.getenv("SITE_URL", _SITE.get("site_url", "https://oxygen11.com")).rstrip("/")
SLUG_EPOCH = int(_SITE.get("epoch", 0))
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
ALLOWED_TAGS = {"p", "h2", "h3", "ul", "ol", "li", "strong", "em", "blockquote", "br", "hr", "a"}
VOID_TAGS = {"br", "hr"}

TOPICS = [
    {"slug": "duct-airflow", "keyword": "ضعف تدفق الهواء من المكيف", "category": "تشخيص الأعطال", "brief": "أسباب ضعف الهواء الخارج من المكيف وكيفية التمييز بين العوائق البسيطة والأعطال التي تحتاج إلى فني."},
    {"slug": "ac-water-leak", "keyword": "تسرب الماء من المكيف", "category": "تشخيص الأعطال", "brief": "أسباب ظهور الماء حول الوحدة الداخلية، وما يمكن للمستخدم ملاحظته بأمان، ومتى ينبغي إيقاف الجهاز."},
    {"slug": "ac-unusual-noise", "keyword": "صوت المكيف غير الطبيعي", "category": "تشخيص الأعطال", "brief": "الفرق بين الأصوات المعتادة والأصوات التي تستدعي فحصًا، مع خطوات توثيق المشكلة من دون فتح الجهاز."},
    {"slug": "thermostat-settings", "keyword": "ضبط درجة حرارة المكيف", "category": "العناية بالمكيف", "brief": "فهم أوضاع التبريد والمروحة وإزالة الرطوبة وإعدادات التحكم من دون تقديم وعود بتوفير محدد للطاقة."},
    {"slug": "refrigerant-safety", "keyword": "فحص غاز التبريد للمكيف", "category": "السلامة", "brief": "لماذا لا يكفي ضعف التبريد للحكم على نقص الغاز، وما الذي يجب أن يفحصه فني مؤهل قبل أي شحن."},
    {"slug": "seasonal-ac-checklist", "keyword": "قائمة فحص المكيف قبل موسم الاستخدام", "category": "الصيانة الدورية", "brief": "قائمة تجهيز للمستخدم قبل تشغيل المكيف لفترات طويلة، مع فصل واضح بين الفحص البسيط والعمل المهني."},
    {"slug": "filter-replacement", "keyword": "متى يتم تغيير فلتر المكيف", "category": "العناية بالمكيف", "brief": "علامات تلف الفلتر والعوامل المؤثرة في مدة استخدامه، مع التأكيد على اتباع دليل الشركة المصنعة."},
    {"slug": "ac-energy-use", "keyword": "ترشيد استهلاك المكيف", "category": "كفاءة التشغيل", "brief": "عادات تشغيل عملية مثل إغلاق الفتحات وصيانة الفلاتر وضبط الإعدادات، من دون ادعاءات رقمية غير موثقة."},
    {"slug": "window-ac-care", "keyword": "العناية بمكيف الشباك", "category": "العناية بالمكيف", "brief": "الفحوص الخارجية الآمنة لمكيف الشباك وكيفية التعامل مع تدفق الهواء والضوضاء والتسرب."},
    {"slug": "split-ac-service", "keyword": "صيانة مكيف السبليت", "category": "الصيانة الدورية", "brief": "ماذا تشمل زيارة صيانة مكيف السبليت، وما المعلومات التي يستفيد منها الفني قبل الزيارة وبعدها."},
    {"slug": "condensate-drain", "keyword": "انسداد تصريف مياه المكيف", "category": "تشخيص الأعطال", "brief": "علامات مشكلة التصريف، وحماية المكان من الماء، ومتى يلزم فني لإزالة الانسداد والتحقق من السبب."},
    {"slug": "indoor-unit-smell", "keyword": "رائحة غير معتادة من المكيف", "category": "تشخيص الأعطال", "brief": "كيفية وصف الرائحة ومتى يلزم إيقاف الجهاز، مع تجنب اقتراح مواد كيميائية أو تنظيف داخلي غير آمن."},
    {"slug": "central-ac-logs", "keyword": "سجل صيانة التكييف المركزي", "category": "إدارة الصيانة", "brief": "حقول سجل الصيانة التي تساعد مدير المنشأة على تتبع الأعطال والزيارات وقطع الغيار وقرارات الإصلاح."},
    {"slug": "duct-cleaning-signs", "keyword": "متى تحتاج مجاري الهواء إلى تنظيف", "category": "الصيانة الدورية", "brief": "مؤشرات تستدعي تقييم مجاري الهواء، ولماذا يجب تحديد نطاق التنظيف بعد فحص مناسب."},
    {"slug": "maintenance-visit-prep", "keyword": "الاستعداد لزيارة فني المكيفات", "category": "خدمات الصيانة", "brief": "المعلومات والصور التي يمكن تجهيزها قبل الزيارة، وكيف تسأل عن نطاق العمل والتكلفة والضمان دون افتراضات."},
    {"slug": "commercial-ac-plan", "keyword": "خطة صيانة التكييف للمنشآت", "category": "إدارة الصيانة", "brief": "خطوات بناء خطة صيانة للمكاتب والمحلات والمنشآت اعتمادًا على الاستخدام والسجل وتوصيات المصنع."},
    {"slug": "chiller-service-basics", "keyword": "أساسيات صيانة الشيلر", "category": "أنظمة التبريد", "brief": "ما الذي ينبغي توثيقه ومراجعته مع الفني عند صيانة الشيلر، مع تجنب أي تعليمات تشغيل خطرة."},
    {"slug": "ac-ice-build-up", "keyword": "تكوّن الثلج على المكيف", "category": "تشخيص الأعطال", "brief": "أسباب محتملة لتكوّن الثلج، والخطوات الآمنة عند ظهوره، ولماذا لا ينبغي كسره أو مواصلة التشغيل."},
    {"slug": "multi-room-cooling", "keyword": "اختلاف التبريد بين الغرف", "category": "تشخيص الأعطال", "brief": "كيفية تدوين اختلاف درجات الحرارة بين الغرف ومراجعة فتحات الهواء والأبواب قبل الفحص الفني."},
    {"slug": "maintenance-estimate", "keyword": "مقارنة عروض صيانة المكيفات", "category": "اختيار الخدمة", "brief": "بنود يجب التأكد منها في عرض الصيانة: نطاق العمل والعمالة والمواد والاختبار والضمان، بلا ادعاءات أسعار."},
    {"slug": "ac-after-power-cut", "keyword": "المكيف بعد انقطاع الكهرباء", "category": "السلامة", "brief": "ما يجب ملاحظته بعد عودة الكهرباء، ومتى يكون فصل القاطع أو الرائحة أو صوت غير المعتاد سببًا لإيقاف التشغيل."},
    {"slug": "indoor-airflow", "keyword": "تحسين تدفق الهواء داخل الغرفة", "category": "كفاءة التشغيل", "brief": "ترتيب الأثاث والستائر ومخارج الهواء، وحدود ما يمكن تحسينه من دون تعديل مجاري الهواء أو فتح الوحدة."},
    {"slug": "maintenance-record", "keyword": "توثيق أعطال المكيف", "category": "إدارة الصيانة", "brief": "قالب معلومات يسجل الأعراض والتوقيت والأكواد والإجراءات السابقة لتسهيل التشخيص وتقليل تكرار البلاغات."},
    {"slug": "ac-filter-vs-service", "keyword": "الفرق بين تنظيف الفلتر وصيانة المكيف", "category": "العناية بالمكيف", "brief": "الفرق بين العناية البسيطة بالفلتر والصيانة التي تستلزم أدوات وفنيًا متخصصًا."},
]


class SafeHTML(HTMLParser):
    """Small allow-list sanitizer; retains only article markup and same-site links."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.stack: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag not in ALLOWED_TAGS:
            return
        if tag == "a":
            href = next((v for k, v in attrs if k.lower() == "href" and v), "")
            href = href or ""
            if href.startswith("/") and not href.startswith("//"):
                self.parts.append(f'<a href="{html.escape(href, quote=True)}">')
                self.stack.append(tag)
            else:
                self.parts.append("<a>")
                self.stack.append(tag)
            return
        self.parts.append(f"<{tag}>")
        if tag not in VOID_TAGS:
            self.stack.append(tag)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag not in ALLOWED_TAGS or tag in VOID_TAGS or tag not in self.stack:
            return
        while self.stack:
            top = self.stack.pop()
            self.parts.append(f"</{top}>")
            if top == tag:
                break

    def handle_data(self, data: str) -> None:
        self.parts.append(html.escape(data, quote=False))

    def finish(self) -> str:
        while self.stack:
            self.parts.append(f"</{self.stack.pop()}>")
        return "".join(self.parts).strip()


def sanitize_body(value: str) -> str:
    parser = SafeHTML()
    parser.feed(value or "")
    return parser.finish()


def plain_text(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value))).strip()


def word_count(value: str) -> int:
    return len(re.findall(r"[\w\u0600-\u06FF]+", plain_text(value), flags=re.UNICODE))


def load_catalog() -> list[dict[str, str]]:
    if not CATALOG_PATH.exists():
        return []
    data = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("articles/catalog.json must be a JSON array")
    return data


def openai_json(topic: dict[str, str], recent_titles: list[str], day: str, attempt: int) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("Missing OPENAI_API_KEY. Add it in GitHub Settings → Secrets and variables → Actions → Secrets.")
    prompt = f"""اكتب مقالًا عربيًا أصيلًا لموقع متخصص في صيانة المكيفات والتبريد ويخدم العملاء في مكة المكرمة وجدة.
موضوع هذا المقال: {topic['brief']}
الكلمة البحثية الأساسية: {topic['keyword']}
القسم التحريري: {topic['category']}
تاريخ النشر المخطط: {day}
العناوين المنشورة مؤخرًا التي يجب ألا تكررها أو تعيد صياغتها: {json.dumps(recent_titles[-30:], ensure_ascii=False)}
المحاولة: {attempt}

متطلبات الجودة:
- اكتب 600 إلى 700 كلمة عربية مفيدة، لا مجرد مقدمة عامة أو قائمة حشو.
- ابدأ بإجابة واضحة عن سؤال القارئ، ثم عناوين H2/H3، وخطوات عملية، وأسئلة شائعة إذا أضافت قيمة.
- استخدم الكلمة الأساسية طبيعيًا دون تكرار مصطنع أو فقرة بعنوان "عبارات البحث ذات الصلة".
- لا تخترع أسعارًا أو ضمانات أو أرقام توفير أو معايير رسمية أو أسماء عملاء أو معلومات محلية غير موثقة.
- لا توجّه القارئ إلى فتح الكهرباء أو العبث بدائرة التبريد أو شحن الغاز بنفسه. وضّح متى يجب إيقاف الجهاز والاستعانة بفني مؤهل.
- لا تضف روابط خارجية أو صورًا أو JavaScript. لا تستخدم H1 داخل body_html لأن العنوان سيعرض منفصلًا.
- لا تكرر فقرات من العناوين السابقة؛ زاوية المقال يجب أن تناسب الموضوع المحدد.

أرجع JSON صالحًا فقط بالحقول:
{{"title":"عنوان عربي واضح","description":"وصف فريد بين 110 و165 حرفًا تقريبًا","body_html":"محتوى HTML عربي يتضمن فقرات وعناوين","focus_keyword":"{topic['keyword']}"}}
"""
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "أنت محرر تقني عربي دقيق لموقع خدمات صيانة. الأولوية للفائدة والسلامة والأصالة، وليس تكرار الكلمات المفتاحية."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.55,
        "max_tokens": 3000,
        "response_format": {"type": "json_object"},
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:900]
        raise RuntimeError(f"OpenAI API returned HTTP {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not reach OpenAI API: {exc.reason}") from exc
    text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
    try:
        return json.loads(text)
    except (TypeError, json.JSONDecodeError) as exc:
        raise RuntimeError("OpenAI response was not valid JSON") from exc


def maybe_generate_ai_image(title: str, description: str, slug: str) -> str:
    """Generate an editorial illustration only when explicitly enabled in Actions."""
    if os.getenv("OPENAI_GENERATE_IMAGES", "").strip().lower() not in {"1", "true", "yes"}:
        return ""
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_GENERATE_IMAGES is enabled but OPENAI_API_KEY is missing.")
    prompt = ("Create a clean, realistic editorial illustration for an Arabic HVAC maintenance guide. "
              "Show a technician inspecting an air conditioner safely, no visible brand logos, no written text, "
              "no watermarks, no unsafe exposed electrical work. " + f"Article topic: {title}. Context: {description}. Wide 3:2 composition.")
    payload = {"model": os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1"), "prompt": prompt, "size": "1536x1024", "quality": "medium", "output_format": "png", "n": 1}
    request = urllib.request.Request("https://api.openai.com/v1/images/generations", data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            result = json.loads(response.read().decode("utf-8"))
        encoded = result.get("data", [{}])[0].get("b64_json", "")
        if not encoded:
            raise RuntimeError("Image API response did not include b64_json.")
        image_bytes = base64.b64decode(encoded, validate=True)
    except (urllib.error.HTTPError, urllib.error.URLError, ValueError, IndexError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"AI image generation failed for {slug}: {exc}") from exc
    media_dir = ARTICLES_DIR / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    (media_dir / f"{slug}.png").write_bytes(image_bytes)
    return f"/articles/media/{slug}.png"


def article_html(item: dict[str, str]) -> str:
    url = f"{SITE_URL}/articles/{item['slug']}/"
    schema = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": item["title"],
        "description": item["description"],
        "datePublished": item["published_at"],
        "dateModified": item["published_at"],
        "keywords": item["keyword"],
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
        "author": {"@type": "Organization", "name": "OXYGEN"},
        "publisher": {"@type": "Organization", "name": "OXYGEN"},
    }
    title = html.escape(item["title"], quote=True)
    description = html.escape(item["description"], quote=True)
    category = html.escape(item["category"], quote=True)
    body = item["body_html"]
    image_url = str(item.get("image_url", "")).strip()
    safe_image_url = html.escape(SITE_URL + image_url, quote=True) if image_url.startswith("/articles/media/") and ".." not in image_url else ""
    image_block = ""
    og_image_tag = ""
    if safe_image_url:
        image_block = '<figure class="article-hero"><img src="' + safe_image_url + '" alt="' + title + '" width="1200" height="800" fetchpriority="high"><figcaption>صورة توضيحية للمقال</figcaption></figure>'
        og_image_tag = '<meta property="og:image" content="' + safe_image_url + '">';
        schema["image"] = safe_image_url
    return f"""<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} | أكسجين</title><meta name="description" content="{description}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article"><meta property="og:site_name" content="OXYGEN">
<meta property="og:title" content="{title}"><meta property="og:description" content="{description}">
<meta property="og:url" content="{url}">{og_image_tag}<meta property="article:published_time" content="{item['published_at']}">
<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>
<style>
*{{box-sizing:border-box}}body{{margin:0;background:#f5f9fc;color:#1e293b;font-family:Tahoma,Arial,sans-serif;line-height:1.95}}
header{{background:#fff;border-bottom:1px solid #dbe5ef;padding:14px 20px}}header .bar{{max-width:980px;margin:auto;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}}
a{{color:#0369a1}}.brand{{font-weight:900;color:#075985;text-decoration:none;font-size:18px}}nav a{{text-decoration:none}}main{{max-width:900px;margin:28px auto;padding:0 16px}}.article-hero{{margin:20px 0 26px}}.article-hero img{{display:block;width:100%;height:auto;max-height:560px;object-fit:contain;background:#f8fafc;border-radius:14px}}.article-hero figcaption{{font-size:12px;color:#64748b;margin-top:6px}}
.crumb{{font-size:13px;color:#64748b;margin-bottom:12px}}article{{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:clamp(20px,4vw,44px);box-shadow:0 8px 30px #0f172a08}}
h1{{font-size:clamp(26px,4.5vw,38px);line-height:1.5;color:#0f3d5e;margin:8px 0 12px}}h2{{font-size:24px;color:#0f3d5e;margin:30px 0 10px}}h3{{font-size:19px;color:#14532d;margin:22px 0 7px}}
.lead{{font-size:18px;color:#475569}}.meta{{font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:16px;margin-bottom:22px}}
li{{margin:8px 0}}strong{{color:#0f3d5e}}.cta{{margin-top:32px;padding:18px;border-radius:14px;background:#eaf6ff;border:1px solid #cfe7f7}}
footer{{text-align:center;padding:26px 16px;color:#64748b;font-size:13px}}footer a{{margin:0 7px}}@media(max-width:600px){{header{{padding:12px}}article{{padding:20px 16px;border-radius:12px}}h2{{font-size:21px}}}}
</style></head><body><div class="mainsite" style="background:#0ea5e9;color:#fff;text-align:center;padding:8px 12px;font-weight:700;font-size:14px"><a href="https://oxygen11.com/" style="color:#fff;text-decoration:none">← الموقع الرئيسي لأكسجين · oxygen11.com</a></div>
<header><div class="bar"><a class="brand" href="/">أكسجين | OXYGEN</a><nav><a href="/articles/">كل المقالات</a> · <a href="/">الرئيسية والخدمات</a></nav></div></header>
<main><div class="crumb"><a href="/">الرئيسية</a> ← <a href="/articles/">مقالات الصيانة</a> ← {category}</div>
<article><h1>{title}</h1><p class="lead">{description}</p>
<div class="meta">القسم: {category} · تاريخ النشر: {item['published_at']}</div>
{image_block}
{body}
<div class="cta"><strong>معلومات وخدمات الصيانة</strong><p>راجع <a href="/">موقع أكسجين الرئيسي</a> لمعرفة الخدمات المتاحة وطرق التواصل.</p></div>
</article></main><footer>© {item['published_at'][:4]} OXYGEN · <a href="/">الرئيسية</a> · <a href="/articles/">مقالات الصيانة</a> · <a href="https://oxygen11.com/">الموقع الرئيسي</a></footer>
</body></html>"""


def render_listing(catalog: list[dict[str, str]]) -> str:
    cards = []
    for item in sorted(catalog, key=lambda x: (x.get("published_at", ""), x.get("slug", "")), reverse=True)[:120]:
        title = html.escape(item["title"])
        description = html.escape(item["description"])
        category = html.escape(item["category"])
        slug = html.escape(item["slug"], quote=True)
        day = html.escape(item["published_at"])
        cards.append(f'<section class="card"><div class="tag">{category} · {day}</div><h2><a href="/articles/{slug}/">{title}</a></h2><p>{description}</p><a href="/articles/{slug}/">اقرأ الدليل ←</a></section>')
    return f"""<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>مقالات صيانة المكيفات | أكسجين OXYGEN</title><meta name="description" content="أدلة عملية للعناية بالمكيفات وتشخيص مشكلات التبريد وصيانة أنظمة التكييف.">
<meta name="robots" content="index,follow"><link rel="canonical" href="{SITE_URL}/articles/">
<style>body{{margin:0;background:#f5f9fc;color:#1e293b;font-family:Tahoma,Arial,sans-serif;line-height:1.9}}header{{background:#fff;border-bottom:1px solid #dbe5ef;padding:14px 20px}}.bar,main{{max-width:980px;margin:auto}}.bar{{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center}}.brand{{font-weight:900;color:#075985;text-decoration:none;font-size:18px}}a{{color:#0369a1}}main{{padding:28px 16px}}h1{{font-size:clamp(28px,5vw,38px);color:#0f3d5e}}.intro{{color:#475569;font-size:17px;max-width:760px}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:24px}}.card{{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:22px;box-shadow:0 8px 25px #0f172a08}}.card h2{{font-size:21px;line-height:1.6;color:#0f3d5e;margin:4px 0 10px}}.tag{{font-size:12px;color:#64748b}}footer{{text-align:center;padding:26px;color:#64748b;font-size:13px}}</style></head>
<body><div class="mainsite" style="background:#0ea5e9;color:#fff;text-align:center;padding:8px 12px;font-weight:700;font-size:14px"><a href="https://oxygen11.com/" style="color:#fff;text-decoration:none">← الموقع الرئيسي لأكسجين · oxygen11.com</a></div><header><div class="bar"><a class="brand" href="/">أكسجين | OXYGEN</a><a href="/">الرئيسية والخدمات</a></div></header>
<main><h1>مقالات صيانة المكيفات</h1><p class="intro">أدلة عملية لفهم مشكلات التبريد، والعناية الآمنة بالمكيف، وتنظيم الصيانة الدورية. الأعمال الكهربائية ودائرة التبريد من اختصاص فني مؤهل.</p>
<div class="grid">{''.join(cards)}</div></main><footer>© {datetime.now(timezone.utc).year} OXYGEN · <a href="/">الرئيسية</a> · <a href="https://oxygen11.com/">الموقع الرئيسي</a></footer></body></html>"""


def update_sitemap(catalog: list[dict[str, str]]) -> None:
    entries = [
        (f"{SITE_URL}/", datetime.now(timezone.utc).date().isoformat(), "1.0"),
        (f"{SITE_URL}/articles/", datetime.now(timezone.utc).date().isoformat(), "0.8"),
    ]
    entries.extend((f"{SITE_URL}/articles/{x['slug']}/", x["published_at"], "0.7") for x in catalog)
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    xml += "".join(f"  <url><loc>{loc}</loc><lastmod>{day}</lastmod><priority>{priority}</priority></url>\n" for loc, day, priority in entries)
    xml += "</urlset>\n"
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")


def validate_site(catalog: list[dict[str, str]]) -> None:
    seen_slugs: set[str] = set()
    seen_titles: set[str] = set()
    listing = (ARTICLES_DIR / "index.html").read_text(encoding="utf-8")
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    if not (ROOT / "robots.txt").exists():
        raise ValueError("robots.txt is missing")
    for item in catalog:
        slug, title = item.get("slug", ""), item.get("title", "")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
            raise ValueError(f"Invalid article slug: {slug}")
        if slug in seen_slugs or title.casefold() in seen_titles:
            raise ValueError(f"Duplicate article slug or title: {slug} / {title}")
        seen_slugs.add(slug)
        seen_titles.add(title.casefold())
        page = ARTICLES_DIR / slug / "index.html"
        if not page.exists():
            raise ValueError(f"Article page missing: {page.relative_to(ROOT)}")
        source = page.read_text(encoding="utf-8")
        if "</html>" not in source.lower() or "<h1" not in source.lower() or f"/articles/{slug}/" not in source:
            raise ValueError(f"Article page is incomplete: {slug}")
        if f"/articles/{slug}/" not in listing or f"/articles/{slug}/" not in sitemap:
            raise ValueError(f"Article listing or sitemap is missing {slug}")
        canonical = f'<link rel="canonical" href="{SITE_URL}/articles/{slug}/">'
        if canonical not in source:
            raise ValueError(f"Article canonical URL is missing or incorrect: {slug}")

    pending_dir = ROOT / ".github" / "article-queue" / "pending"
    for queued_path in sorted(pending_dir.glob("*.json")) if pending_dir.exists() else []:
        try:
            queued = json.loads(queued_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ValueError(f"Invalid queued article JSON: {queued_path.name}") from exc
        queued_slug = str(queued.get("slug", "")).strip()
        queued_title = str(queued.get("title", "")).strip()
        queued_description = str(queued.get("description", "")).strip()
        queued_keyword = str(queued.get("keyword", "")).strip()
        queued_body = sanitize_body(str(queued.get("body_html", "")))
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", queued_slug):
            raise ValueError(f"Invalid queued article slug: {queued_path.name}")
        if queued_slug in seen_slugs or queued_title.casefold() in seen_titles:
            raise ValueError(f"Queued article duplicates published content: {queued_path.name}")
        if not queued_title or len(queued_title) < 18 or len(queued_title) > 100:
            raise ValueError(f"Queued article title failed validation: {queued_path.name}")
        if not 80 <= len(queued_description) <= 200:
            raise ValueError(f"Queued article description failed validation: {queued_path.name}")
        if len(queued_keyword) < 3 or not 350 <= word_count(queued_body) <= 700:
            raise ValueError(f"Queued article content failed validation: {queued_path.name}")
        if "<h2" not in queued_body.lower() or "<p" not in queued_body.lower() or "<script" in queued_body.lower():
            raise ValueError(f"Queued article HTML failed validation: {queued_path.name}")
        if len(re.findall(re.escape(queued_keyword), plain_text(queued_body), flags=re.IGNORECASE)) > 8:
            raise ValueError(f"Queued article keyword stuffing check failed: {queued_path.name}")
        seen_slugs.add(queued_slug)
        seen_titles.add(queued_title.casefold())

    print(f"Validated {len(catalog)} published article pages and {sum(1 for _ in pending_dir.glob('*.json')) if pending_dir.exists() else 0} queued drafts, listing, sitemap and robots.txt.")


def generate(count: int) -> None:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("Missing OPENAI_API_KEY. Daily static publishing is not active until this GitHub secret is added.")
    today = datetime.now(timezone.utc).date().isoformat()
    catalog = load_catalog()
    titles = [x["title"] for x in catalog]
    existing_slugs = {x["slug"] for x in catalog}
    new_items: list[dict[str, str]] = []
    for i in range(count):
        topic = TOPICS[(len(catalog) + i) % len(TOPICS)]
        slug = f"{topic['slug']}-{today.replace('-', '')}-{i + 1:02d}" + (f"-d{SLUG_EPOCH}" if SLUG_EPOCH else "")
        if slug in existing_slugs:
            continue
        data = openai_json(topic, titles, today, i + 1)
        title = str(data.get("title", "")).strip()
        description = str(data.get("description", "")).strip()
        raw_body = str(data.get("body_html", "")).strip()
        body = sanitize_body(raw_body)
        count_words = word_count(body)
        if not title or len(title) < 18 or len(title) > 100:
            raise ValueError(f"Generated title failed validation for {slug}")
        if title.casefold() in {x.casefold() for x in titles}:
            raise ValueError(f"Generated duplicate title refused: {title}")
        if len(description) < 80 or len(description) > 200:
            raise ValueError(f"Meta description length must be 80–200 chars for {slug}; got {len(description)}")
        if not 600 <= count_words <= 700:
            raise ValueError(f"Article rejected: only {count_words} words in {slug}; required range is 600–700")
        if "<h2" not in body.lower() or "<p" not in body.lower() or "<script" in body.lower():
            raise ValueError(f"Article HTML failed structure/safety validation: {slug}")
        if len(re.findall(re.escape(topic["keyword"]), plain_text(body), flags=re.IGNORECASE)) > 8:
            raise ValueError(f"Keyword stuffing guard rejected {slug}")
        item = {
            "image_url": maybe_generate_ai_image(title, description, slug),
            "slug": slug,
            "title": title,
            "description": description,
            "keyword": topic["keyword"],
            "category": topic["category"],
            "published_at": today,
            "body_html": body,
        }
        page_path = ARTICLES_DIR / slug / "index.html"
        page_path.parent.mkdir(parents=True, exist_ok=True)
        page_path.write_text(article_html(item), encoding="utf-8")
        new_items.append(item)
        titles.append(title)
        existing_slugs.add(slug)

    if not new_items:
        print("No new articles were generated (all selected slugs already exist).")
        return
    # Keep the internal content catalog in the repository so later runs can deduplicate and rotate topics.
    catalog.extend(new_items)
    catalog.sort(key=lambda x: (x.get("published_at", ""), x.get("slug", "")), reverse=True)
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ARTICLES_DIR / "index.html").write_text(render_listing(catalog), encoding="utf-8")
    update_sitemap(catalog)
    validate_site(catalog)
    print("Generated and staged article pages:")
    for item in new_items:
        print(f"- {item['title']} ({SITE_URL}/articles/{item['slug']}/)")


def publish_queued(count: int, fallback_count: int) -> None:
    """Publish already-reviewed article drafts first; use OpenAI after the queue is empty."""
    pending_dir = ROOT / ".github" / "article-queue" / "pending"
    archive_dir = ROOT / ".github" / "article-queue" / "archive"
    queue_files = sorted(pending_dir.glob("*.json")) if pending_dir.exists() else []
    if not queue_files:
        if os.getenv("OPENAI_API_KEY", "").strip():
            print("Curated queue is empty; using OpenAI to generate the next validated batch.")
            generate(fallback_count)
        else:
            raise RuntimeError("Curated article queue is empty. Add OPENAI_API_KEY as a GitHub Actions secret to continue generating fresh articles daily.")
        return

    today = datetime.now(timezone.utc).date().isoformat()
    catalog = load_catalog()
    existing_slugs = {str(x.get("slug", "")) for x in catalog}
    existing_titles = {str(x.get("title", "")).strip().casefold() for x in catalog}
    new_items: list[dict[str, str]] = []
    consumed: list[Path] = []

    for queue_file in queue_files[:count]:
        try:
            raw = json.loads(queue_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ValueError(f"Could not read queued article {queue_file.name}: {exc}") from exc
        slug = str(raw.get("slug", "")).strip()
        title = str(raw.get("title", "")).strip()
        description = str(raw.get("description", "")).strip()
        keyword = str(raw.get("keyword", "")).strip()
        category = str(raw.get("category", "دليل صيانة")).strip()
        body = sanitize_body(str(raw.get("body_html", "")))
        words = word_count(body)

        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
            raise ValueError(f"Queued article has invalid slug: {queue_file.name}")
        if slug in existing_slugs:
            raise ValueError(f"Queued article slug already published; remove or rename it: {slug}")
        if not title or len(title) < 18 or len(title) > 100:
            raise ValueError(f"Queued article title failed validation: {queue_file.name}")
        if title.casefold() in existing_titles:
            raise ValueError(f"Duplicate queued title refused: {title}")
        if len(description) < 80 or len(description) > 200:
            raise ValueError(f"Queued article meta description must be 80–200 chars: {queue_file.name}")
        if len(keyword) < 3 or words < 350:
            raise ValueError(f"Queued article content/keyword failed validation: {queue_file.name} ({words} words)")
        if "<h2" not in body.lower() or "<p" not in body.lower() or "<script" in body.lower():
            raise ValueError(f"Queued article HTML structure/safety validation failed: {queue_file.name}")
        if len(re.findall(re.escape(keyword), plain_text(body), flags=re.IGNORECASE)) > 8:
            raise ValueError(f"Keyword stuffing guard rejected queued article: {slug}")
        if ARTICLES_DIR.joinpath(slug, "index.html").exists():
            raise ValueError(f"Article path already exists; refusing to overwrite: {slug}")

        item = {
            "slug": slug,
            "title": title,
            "description": description,
            "keyword": keyword,
            "category": category,
            "published_at": today,
            "body_html": body,
        }
        page_path = ARTICLES_DIR / slug / "index.html"
        page_path.parent.mkdir(parents=True, exist_ok=True)
        page_path.write_text(article_html(item), encoding="utf-8")
        new_items.append(item)
        existing_slugs.add(slug)
        existing_titles.add(title.casefold())
        consumed.append(queue_file)

    if not new_items:
        print("No queued articles were eligible for publication.")
        return

    catalog.extend(new_items)
    catalog.sort(key=lambda x: (x.get("published_at", ""), x.get("slug", "")), reverse=True)
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ARTICLES_DIR / "index.html").write_text(render_listing(catalog), encoding="utf-8")
    update_sitemap(catalog)

    archive_dir.mkdir(parents=True, exist_ok=True)
    for queue_file in consumed:
        archived = archive_dir / queue_file.name
        if archived.exists():
            raise FileExistsError(f"Article queue archive path already exists: {archived.name}")
        shutil.move(str(queue_file), str(archived))

    validate_site(catalog)
    print(f"Published {len(new_items)} queued article(s):")
    for item in new_items:
        print(f"- {item['title']} ({SITE_URL}/articles/{item['slug']}/)")

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=1, help="Number of articles to generate with OpenAI when the queue is empty (1–5).")
    parser.add_argument("--publish-queued", type=int, default=0, help="Publish this many reviewed articles from the repository queue first (0–5).")
    parser.add_argument("--validate-only", action="store_true", help="Validate current static content without calling OpenAI.")
    args = parser.parse_args()
    if args.count < 1 or args.count > 5:
        parser.error("--count must be between 1 and 5")
    if args.publish_queued < 0 or args.publish_queued > 5:
        parser.error("--publish-queued must be between 0 and 5")
    try:
        catalog = load_catalog()
        if args.validate_only:
            validate_site(catalog)
            return 0
        if args.publish_queued:
            publish_queued(args.publish_queued, args.count)
        else:
            generate(args.count)
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
