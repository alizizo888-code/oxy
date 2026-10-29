# إصلاح 404 لبوابة WordPress وWPVibe على Hostinger

## نتيجة التشخيص (2026-10-24)

فحص GitHub Actions للنطاق `googl.oxygen11.com` وجد أن المسارات التالية ترجع HTTP 404:
- `/wp-login.php`
- `/wp-admin/`
- `/wp-json/`
- `/wp-admin/admin.php?page=oxygen-ac-automation`
- `/oxygen-admin/`

كما أن طلبات WPVibe لواجهة REST على هذا المضيف أعادت HTML واجهة أكسجين بدل JSON من WordPress. هذا دليل على أن المضيف لا يقدّم تثبيت WordPress المتوقع من جذر هذا النطاق الفرعي؛ وليس دليلًا كافيًا على أن بيانات WPVibe المخزنة خاطئة.

## ما تم إصلاحه في المستودع

- زر القفل وروابط إعدادات الناشر في الواجهة توجّه الآن إلى المسار القياسي:
  `https://googl.oxygen11.com/wp-admin/admin.php?page=oxygen-ac-automation`
- إضافة Oxygen تنفّذ تحديثًا واحدًا لقواعد الروابط الدائمة بعد تشغيلها، بدل الاعتماد على أن صفحة `/oxygen-admin/` تعمل وحدها.
- ملف `.htaccess` الجذري يطلب من مضيف `googl.oxygen11.com` فتح `index.php` بدل إظهار ملف HTML الساكن، مع الإبقاء على `index.html` لموقع `oxygen11.com`.
- أضيف فحص تشخيص لمسارات WordPress في سير عمل GitHub.

هذه تغييرات مستودع. نجاحها لا يعني أن ملف `.htaccess` وصل إلى مجلد الجذر الخاص بالنطاق الفرعي؛ هذا يعتمد على إعداد مجلد النطاق في Hostinger.

## إصلاح Hostinger المطلوب

1. افتح Hostinger hPanel → Websites، واختر الموقع/النطاق الفرعي `googl.oxygen11.com`، ثم File Manager.
2. من إعدادات النطاق الفرعي أو معلومات الاستضافة، تحقق من **Document Root** الفعلي لذلك النطاق. لا تفترض أن مجلد `public_html` الرئيسي هو مجلد النطاق الفرعي.
3. افتح **مجلد WordPress الموجود أصلًا**. يجب أن يحتوي على الملفات/المجلدات الأساسية مثل `wp-admin/`, `wp-content/`, `wp-includes/`, `wp-login.php` و`index.php`. لا تنشئ تثبيتًا جديدًا ولا تحذف ملفات أو قاعدة البيانات الموجودة.
4. إذا كانت ملفات WordPress محفوظة في مجلد مختلف، صحّح Document Root للنطاق الفرعي ليشير إلى المجلد الصحيح؛ أو أصلح توجيه النطاق الفرعي من إعدادات Domains/Subdomains في hPanel. لا تنقل الملفات ولا تستبدل جذر الموقع الرئيسي دون نسخة احتياطية.
5. تأكد أن ملف `.htaccess` الخاص **بجذر تثبيت WordPress نفسه** يحتوي قواعد WordPress القياسية، ولا تضع قواعد جذر الموقع الساكن داخل مجلد WordPress بالخطأ. إذا كان النطاقان يشتركان فعلًا في مجلد ملفات واحد، احتفظ بالقواعد الشرطية بحسب المضيف حتى يبقى `oxygen11.com` ساكنًا وتُمرر طلبات `googl.oxygen11.com` إلى WordPress.
6. بعد تصحيح Document Root، اختبر هذه المسارات في المتصفح:
   - `https://googl.oxygen11.com/wp-login.php` يجب أن يعرض نموذج دخول WordPress.
   - `https://googl.oxygen11.com/wp-json/` يجب أن يعرض JSON، وليس صفحة HTML.
   - `https://googl.oxygen11.com/wp-admin/` يجب أن يعرض لوحة WordPress أو يحوّل إلى صفحة الدخول.
7. عندما تعمل هذه المسارات، افتح لوحة WordPress، ثم الإعدادات → الروابط الدائمة واضغط **حفظ التغييرات** مرة واحدة. بعد ذلك يمكن لـ WPVibe أن يقرأ بيانات الموقع ويشغّل ناشر Oxygen.

## تمييز موقع الواجهة عن موقع WordPress

- الواجهة الثابتة والمقالات العامة: `https://oxygen11.com`
- بوابة WordPress/ناشر Oxygen المتوقعة: `https://googl.oxygen11.com/wp-admin/admin.php?page=oxygen-ac-automation`

لا تُعد تثبيت WordPress ولا تعطّل إضافات الحماية اعتمادًا على 404 وحده. توصي وثائق Hostinger بالتحقق من أن WordPress مثبت في المسار الصحيح، ومن إعدادات النطاق الفرعي وملف `.htaccess` والروابط الدائمة. راجع:
- https://support.hostinger.com/en/articles/5016706-how-to-find-your-wordpress-login-url-at-hostinger
- https://support.hostinger.com/en/articles/2425385-how-to-fix-the-404-error
- https://support.hostinger.com/en/articles/10476636-troubleshooting-issues-accessing-wordpress-admin-page-via-hpanel
