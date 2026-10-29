# Mutqan WhatsApp Gateway (مجاني، ذاتي الاستضافة)

وسيط يربط عدة أرقام واتساب (عادي أو أعمال) بصورة QR أو كود اقتران، ويرسل الرسائل الواردة إلى إضافة ووردبريس
(`/wp-json/mutqan/v1/wa-hook`) ويستقبل أوامر الإرسال منها. لا يستخدم WhatsApp Cloud API ولا أي رصيد ذكاء اصطناعي.

> الربط غير رسمي (مكتبة Baileys). التزم بالرد على العملاء الذين راسلوك، وتجنب الإرسال الجماعي.
> الوسيط يضع فاصلًا عشوائيًا بين الرسائل وحدًا يوميًا لكل رقم (`SEND_DAILY_CAP`).

## التشغيل (سيرفر مجاني: Oracle Cloud Always Free أو أي VPS/جهاز يعمل 24 ساعة)
1. ثبّت Docker، ثم:
   ```bash
   git clone https://github.com/alizizo888-code/oxy.git && cd oxy/wa-gateway
   cp .env.example .env      # عدّل GATEWAY_TOKEN و WEBHOOK_SECRET
   docker build -t mutqan-wa .
   docker run -d --name mutqan-wa --restart always --env-file .env -p 127.0.0.1:8787:8787 -v mutqan-wa-data:/data mutqan-wa
   ```
2. ضع أمامه HTTPS (Caddy أو Cloudflare Tunnel المجاني) ليصبح مثل `https://wa.yourdomain.com`.
3. في التطبيق: الواتساب ← الأرقام ← «إعداد الوسيط»: الصق الرابط والمفتاح (GATEWAY_TOKEN)،
   ثم انسخ `WEBHOOK_URL` و`WEBHOOK_SECRET` الظاهرين هناك إلى ملف `.env` وأعد تشغيل الحاوية.
4. اضغط «ربط رقم جديد» وامسح QR أو أدخل كود الاقتران.

بدون Docker: `npm ci --omit=dev && node src/index.js` (Node 20+) مع المتغيرات نفسها، ويفضّل تشغيله عبر pm2/systemd.
بيانات الجلسات في `DATA_DIR` — احتفظ بنسخة احتياطية منها كي لا تعيد الربط.
