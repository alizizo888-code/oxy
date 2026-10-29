# تحويل Oxygen إلى WordPress — خطوات التثبيت

## ما الذي تغير في المستودع؟

- أُضيف قالب WordPress حقيقي باسم `oxygen-wp-theme`، ويعرض واجهة أكسجين الحالية ويدعم صفحات WordPress والمقالات.
- سير عمل نشر الإضافة يرفع الإضافة إلى `wp-content/plugins/oxygen-ac-automation/` ويزامن القالب إلى `wp-content/themes/oxygen-wp-theme/` في تثبيت WordPress نفسه.
- قواعد `.htaccess` بالمستودع تفضّل `index.php` الخاص بنواة WordPress ثم تعود إلى `index.html` كنسخة احتياطية إن لم يكن هناك WordPress front controller.
- الإضافة الحالية هي المسؤولة عن صفحة الناشر داخل لوحة WordPress.

## ما لا يستطيع GitHub وحده إصلاحه

المستودع لا يحتوي WordPress Core أو قاعدة بيانات أو ملف `wp-config.php`. لا تُنشأ مسارات `/wp-admin/` و`/wp-login.php` بإضافة قالب أو ملف `index.php` منفرد. يجب وجود تثبيت WordPress صالح في **Document Root** الذي يستخدمه كل دومين.

## التثبيت الآمن في Hostinger

1. أنشئ نسخة احتياطية من ملفات الموقع وقاعدة بياناته الحالية قبل تعديل مجلدات الجذر.
2. افتح hPanel → Websites. حدّد الموقع/الدومين المطلوب، وتحقق من Document Root الفعلي.
3. إن كان WordPress موجودًا بالفعل في مجلد آخر، وجّه الدومين إلى ذلك المجلد بدل تثبيت نسخة مكررة.
4. إن لم يوجد WordPress، ثبّته عبر Auto Installer في Hostinger في المجلد/الدومين المقصود مع قاعدة بيانات خاصة به. لا تكتب فوق ملفات الموقع الرئيسي أو قاعدة بيانات قائمة.
5. شغّل GitHub Actions → **Deploy Oxygen plugin to Hostinger** بعد ضبط أسرار FTP. يجب أن يشير `FTP_SERVER_DIR` إلى `.../wp-content/plugins/oxygen-ac-automation/`. يحسب سير العمل مسار القالب المقابل تلقائيًا.
6. من لوحة WordPress فعّل الإضافة **Oxygen AC Automation**، ثم فعّل قالب **Oxygen WordPress** من المظهر → قوالب إذا لم يكن هو القالب النشط.
7. من الإعدادات → الروابط الدائمة اضغط حفظ التغييرات بعد توافر نواة WordPress.
8. اختبر `/wp-login.php`, `/wp-admin/` و`/wp-json/` على كل دومين. يجب أن يرجع `/wp-json/` بيانات JSON. إذا استمر 404 على دومين واحد فقط، راجع Document Root لذلك الدومين.

## ملاحظة عن الدومينين

وجود القالب في المستودع لا يعني أن كلا الدومينين يستخدمان تثبيت WordPress نفسه. إذا كان `oxygen11.com` و`googl.oxygen11.com` لكل منهما مجلد جذر مستقل، فيلزم ضبط كل واحد منهما في Hostinger. لا يمكن لقواعد `.htaccess` في مجلد أن تصلح مجلدًا آخر غير مرتبط بها.
