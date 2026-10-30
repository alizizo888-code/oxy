<?php
if (!defined('ABSPATH')) { exit; }

/**
 * Used-AC shop: price negotiation. The public catalogue lives in collection `used_ac` (readable by everyone);
 * the owner's private floor price lives in `used_ac_private` (staff only) and NEVER leaves the server.
 * A customer's offer is answered by a short ladder (counter-offers, then the floor) and every offer is stored in
 * `used_offers` and pushed to the admins, so the team can close the deal by phone / WhatsApp.
 */
final class Mutqan_Shop {
    private static function sys() { return ['id' => 'system', 'role' => 'owner', 'powers' => ['read', 'write', 'manage'], 'kind' => 'user']; }
    private static function r5($n) { return (int) (round($n / 5) * 5); }

    public static function handle($in, $p) {
        $op = (string) ($in['op'] ?? '');
        if ($op === 'offer') { return self::offer($in); }
        if ($op === 'seal') { return self::seal($in); }
        if ($op === 'load') { return self::load(); }
        if (strpos($op, 'pay_') === 0) { return self::pay_op($op, $in, $p); }
        throw new Mutqan_Error('bad_op', 'عملية غير معروفة.', 400);
    }

    /** Ladder: offer >= floor -> accepted; otherwise counter 1 (60% towards the list price), counter 2 (25%), then the floor. */
    public static function ladder_reply($price, $floor, $offer, $attempt) {
        if ($offer >= $price) { return ['accepted', $price]; }
        if ($offer >= $floor) { return ['accepted', $offer]; }
        $span = max(0, $price - $floor);
        if ($attempt <= 1) { return ['counter', max($floor, self::r5($floor + $span * 0.6))]; }
        if ($attempt === 2) { return ['counter', max($floor, self::r5($floor + $span * 0.25))]; }
        return ['final', $floor];
    }

    private static function offer($in) {
        Mutqan_Limiter::hit('shop_offer', 30, 3600);
        $uid = (string) ($in['unitId'] ?? '');
        if (!preg_match('/^[A-Za-z0-9_.:@-]{1,64}$/', $uid)) { throw new Mutqan_Error('bad_id', 'جهاز غير صالح.', 400); }
        $offer = isset($in['price']) && is_numeric($in['price']) ? (int) round((float) $in['price']) : 0;
        if ($offer < 50 || $offer > 200000) { throw new Mutqan_Error('bad_price', 'اكتب سعراً صحيحاً.', 400); }
        $name = trim(mb_substr(wp_strip_all_tags((string) ($in['name'] ?? '')), 0, 60));
        $phone = preg_replace('/\D/', '', (string) ($in['phone'] ?? ''));
        if (!preg_match('/^(?:966|0)?5\d{8}$/', $phone)) { throw new Mutqan_Error('bad_phone', 'اكتب رقم جوال سعودي صحيح (05xxxxxxxx).', 400); }
        $phone = '966' . substr($phone, -9);

        $unit = Mutqan_Store::get_raw('used_ac', $uid);
        if (!$unit) { throw new Mutqan_Error('not_found', 'الجهاز غير موجود.', 404); }
        if (($unit['status'] ?? 'available') !== 'available') { throw new Mutqan_Error('unavailable', 'الجهاز غير متاح حالياً (محجوز أو مباع).', 409); }
        $price = (int) ($unit['price'] ?? 0);
        if ($price <= 0) { throw new Mutqan_Error('no_price', 'السعر يحدده فريقنا — تواصل معنا مباشرة.', 409); }
        $priv = Mutqan_Store::get_raw('used_ac_private', $uid) ?: [];
        $floor = isset($priv['floor']) && is_numeric($priv['floor']) && (int) $priv['floor'] > 0 ? min((int) $priv['floor'], $price) : self::r5($price * 0.9);

        $sid = 'o' . substr(md5($uid . '|' . $phone), 0, 24);
        $prev = Mutqan_Store::get_raw('used_offers', $sid) ?: [];
        $attempt = (int) ($prev['attempts'] ?? 0) + 1;
        list($status, $val) = self::ladder_reply($price, $floor, $offer, $attempt);
        $history = (array) ($prev['history'] ?? []);
        $history[] = ['offer' => $offer, 'reply' => $status, 'price' => $val, 'at' => gmdate('c')];
        $doc = [
            'unitId' => $uid, 'unitTitle' => (string) ($unit['title'] ?? ''), 'name' => $name, 'phone' => $phone,
            'listPrice' => $price, 'lastOffer' => $offer, 'lastReply' => $status, 'lastPrice' => $val,
            'attempts' => $attempt, 'history' => array_slice($history, -12), 'state' => $status === 'accepted' ? 'accepted' : 'open',
            'updatedAt' => gmdate('c'),
        ];
        Mutqan_Store::upsert('used_offers', $doc, $sid, ['groupId' => 'admins', 'writableBy' => 'admins'], self::sys());
        $title = ($status === 'accepted' ? '✅ عرض مقبول على جهاز مستعمل' : '🛒 عرض سعر على جهاز مستعمل');
        Mutqan_REST::admin_alert($title, trim(($name ?: 'عميل') . ' — ' . ($unit['title'] ?? '') . ' — عرض ' . $offer . ' ر.س (السعر ' . $price . ')'), '/staff/used-ac', 'used_offer', $status === 'accepted' ? 'high' : 'normal');

        if ($status === 'accepted') {
            $msg = 'اتفقنا مبدئياً على ' . $val . ' ر.س ✅ فريقنا يتواصل معك على جوالك لتأكيد الحجز والمعاينة. ولا تقلق، ما يتأكد البيع إلا بعد موافقتك.';
        } elseif ($status === 'counter') {
            $msg = 'تقدير لعرضك 🙏 أقدر أوصل لك لـ ' . $val . ' ر.س. إذا تناسبك اضغط «أوافق»، وإلا اكتب لي سعرك الجديد.';
        } else {
            $msg = 'هذا أقل سعر نقدر ننزل له: ' . $val . ' ر.س ولا نقدر بعده. تحب أثبّت لك الجهاز؟ وإذا حبيت تتفاهم مع فريقنا مباشرة اضغط «تواصل واتساب».';
        }
        return ['status' => $status, 'price' => $val, 'attempt' => $attempt, 'message' => $msg];
    }

    /* ---------------------------------------------------------------- order seal (verification link) */

    private static function seal_fields($in) {
        $c = function ($k, $n) use ($in) { return trim(mb_substr(wp_strip_all_tags((string) ($in[$k] ?? '')), 0, $n)); };
        $price = isset($in['price']) && is_numeric($in['price']) ? (int) round((float) $in['price']) : 0;
        return ['service' => $c('service', 120), 'price' => max(0, min(1000000, $price)), 'time' => $c('time', 80), 'address' => $c('address', 200), 'ref' => $c('ref', 24)];
    }
    private static function seal_chk($code, $f) {
        return substr(hash_hmac('sha256', $code . '|' . wp_json_encode($f, JSON_UNESCAPED_UNICODE), wp_salt('auth')), 0, 6);
    }
    /** Store the order's key facts and return the short verification link that goes into the WhatsApp message. */
    private static function seal($in) {
        Mutqan_Limiter::hit('order_seal', 40, 3600);
        $f = self::seal_fields($in);
        if ($f['service'] === '') { throw new Mutqan_Error('bad_order', 'بيانات الطلب ناقصة.', 400); }
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $code = ''; for ($i = 0; $i < 8; $i++) { $code .= $alphabet[random_int(0, strlen($alphabet) - 1)]; }
        $f['at'] = Mutqan_Store::iso(Mutqan_Store::now());
        Mutqan_Store::upsert('order_seals', $f, $code, ['groupId' => 'admins', 'writableBy' => 'admins'], self::sys());
        $chk = self::seal_chk($code, $f);
        return ['code' => $code, 'url' => home_url('/v/' . $code . '-' . $chk)];
    }
    /** @return array [status(verified|invalid|missing), fields|null] */
    public static function seal_check($token) {
        if (!preg_match('/^([A-Z0-9]{8})(?:-([a-f0-9]{6}))?$/', (string) $token, $m)) { return ['missing', null]; }
        $f = Mutqan_Store::get_raw('order_seals', $m[1]);
        if (!$f) { return ['missing', null]; }
        $stored = $f; unset($stored['at']);
        $ok = isset($m[2]) && hash_equals(self::seal_chk($m[1], $f), $m[2]);
        if (!$ok) { $ok2 = isset($m[2]) && hash_equals(self::seal_chk($m[1], $stored), $m[2]); $ok = $ok2; }
        return [$ok ? 'verified' : 'invalid', $f];
    }
    public static function seal_page($token) {
        Mutqan_Limiter::hit('seal_view', 120, 3600);
        list($st, $f) = self::seal_check($token);
        $map = ['verified' => ['✅ طلب موثّق', '#0a7d3b', 'بيانات الطلب مطابقة لما سُجّل في النظام.'], 'invalid' => ['⚠️ طلب غير مطابق (غلط)', '#b3261e', 'الرابط لا يطابق بيانات الطلب المسجّلة. لا تعتمد على الرسالة.'], 'missing' => ['❌ طلب غير موجود', '#6b6b6b', 'لا يوجد طلب بهذا الكود.']];
        $m = $map[$st];
        $rows = '';
        if ($f) {
            $L = ['service' => 'الخدمة', 'price' => 'السعر', 'time' => 'الموعد', 'address' => 'الموقع', 'ref' => 'رقم الطلب'];
            foreach ($L as $k => $lab) {
                if (!isset($f[$k]) || $f[$k] === '' || ($k === 'price' && !$f[$k])) { continue; }
                $v = $k === 'price' ? $f[$k] . ' ر.س' : $f[$k];
                $rows .= '<tr><td>' . esc_html($lab) . '</td><td><b>' . esc_html($v) . '</b></td></tr>';
            }
        }
        nocache_headers();
        header('Content-Type: text/html; charset=utf-8');
        header('X-Robots-Tag: noindex');
        echo '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>توثيق الطلب</title>'
            . '<body style="font-family:Tahoma,sans-serif;background:#eef4fb;margin:0;padding:24px"><div style="max-width:440px;margin:auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 4px 18px #0002;border-top:8px solid ' . $m[1] . '">'
            . '<h1 style="margin:0 0 8px;color:' . $m[1] . ';font-size:24px">' . $m[0] . '</h1><p style="color:#444">' . $m[2] . '</p>'
            . ($rows ? '<table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:15px">' . str_replace('<td>', '<td style="padding:8px;border-bottom:1px solid #eee">', $rows) . '</table>' : '')
            . '</div></body></html>';
        exit;
    }

    /* ------------------------------------------------------------------ payment links
     * One short link per payment: /pay/CODE. The page lists the owner's own methods (bank transfer, wallets, card via the owner's
     * licensed gateway link). No card number ever touches this site: card payments happen on the gateway's own hosted page.
     * "Paid" is only ever set by the team after they see the money (gateway dashboard / bank statement). */
    const PAY_STATUS = ['open', 'claimed', 'paid', 'cancelled'];
    private static function pay_staff($p) {
        if (!Mutqan_Policy::is_staff($p) || ($p['role'] ?? '') === 'technician') { throw new Mutqan_Error('forbidden', 'للفريق الإداري فقط.', 403); }
    }
    private static function pay_op($op, $in, $p) {
        if ($op === 'pay_claim') { return self::pay_claim($in); }
        self::pay_staff($p);
        $sys = self::sys();
        if ($op === 'pay_create') {
            $amount = isset($in['amount']) && is_numeric($in['amount']) ? round((float) $in['amount'], 2) : 0;
            if ($amount < 1 || $amount > 200000) { throw new Mutqan_Error('bad_amount', 'المبلغ غير صحيح.', 400); }
            $c = function ($k, $n) use ($in) { return trim(mb_substr(wp_strip_all_tags((string) ($in[$k] ?? '')), 0, $n)); };
            $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; $code = '';
            for ($i = 0; $i < 8; $i++) { $code .= $alphabet[random_int(0, strlen($alphabet) - 1)]; }
            $days = max(1, min(60, (int) ($in['days'] ?? 7)));
            $doc = ['amount' => $amount, 'desc' => $c('desc', 140), 'client' => $c('client', 60), 'orderId' => $c('orderId', 64), 'status' => 'open',
                'by' => (string) ($p['id'] ?? ''), 'at' => gmdate('c'), 'expires' => gmdate('c', time() + $days * 86400)];
            Mutqan_Store::upsert('pay_links', $doc, $code, ['groupId' => 'admins', 'writableBy' => 'admins'], $sys);
            return ['code' => $code, 'url' => home_url('/pay/' . $code), 'doc' => $doc];
        }
        if ($op === 'pay_list') {
            $rows = Mutqan_Store::select('pay_links', [], ['limit' => 200, 'order' => '-updatedAt'], $sys);
            return ['rows' => array_map(function ($r) { $r['url'] = home_url('/pay/' . ($r['id'] ?? '')); return $r; }, is_array($rows) ? $rows : [])];
        }
        $code = strtoupper((string) ($in['code'] ?? ''));
        $d = preg_match('/^[A-Z0-9]{8}$/', $code) ? Mutqan_Store::get_raw('pay_links', $code) : null;
        if (!$d) { throw new Mutqan_Error('not_found', 'رابط الدفع غير موجود.', 404); }
        if ($op === 'pay_cancel') { Mutqan_Store::update('pay_links', $code, ['status' => 'cancelled'], $sys); return ['ok' => true]; }
        if ($op === 'pay_mark') {   // the team confirms the money arrived
            $patch = ['status' => 'paid', 'paidAt' => gmdate('c'), 'paidBy' => (string) ($p['id'] ?? ''), 'paidMethod' => mb_substr(wp_strip_all_tags((string) ($in['method'] ?? ($d['claim']['method'] ?? ''))), 0, 40)];
            Mutqan_Store::update('pay_links', $code, $patch, $sys);
            if (!empty($d['orderId']) && Mutqan_Store::peek_doc('orders', $d['orderId'])) {
                try { Mutqan_Store::update('orders', $d['orderId'], ['paymentStatus' => 'paid', 'paymentMethod' => $patch['paidMethod'] ?: 'pay_link', 'paidAt' => $patch['paidAt']], $sys); } catch (Throwable $e) { error_log('[mutqan] pay_mark order: ' . $e->getMessage()); }
            }
            return ['ok' => true];
        }
        throw new Mutqan_Error('bad_op', 'عملية غير معروفة.', 400);
    }
    /** The customer says "I paid" (transfer reference / wallet). Never marks anything paid. */
    private static function pay_claim($in) {
        Mutqan_Limiter::hit('pay_claim', 20, 3600);
        $code = strtoupper((string) ($in['code'] ?? ''));
        $d = preg_match('/^[A-Z0-9]{8}$/', $code) ? Mutqan_Store::get_raw('pay_links', $code) : null;
        if (!$d || in_array($d['status'] ?? '', ['paid', 'cancelled'], true)) { throw new Mutqan_Error('not_open', 'الرابط غير متاح.', 400); }
        $c = function ($k, $n) use ($in) { return trim(mb_substr(wp_strip_all_tags((string) ($in[$k] ?? '')), 0, $n)); };
        $claim = ['name' => $c('name', 60), 'ref' => $c('ref', 60), 'method' => $c('method', 40), 'phone' => $c('phone', 20), 'at' => gmdate('c')];
        if ($claim['ref'] === '' && $claim['name'] === '') { throw new Mutqan_Error('bad_claim', 'اكتب اسمك أو رقم عملية التحويل.', 400); }
        Mutqan_Store::update('pay_links', $code, ['status' => 'claimed', 'claim' => $claim], self::sys());
        Mutqan_REST::admin_alert('💳 عميل أبلغ بالدفع', ($claim['name'] ?: 'عميل') . ' — ' . $d['amount'] . ' ر.س — ' . ($claim['method'] ?: 'طريقة غير محددة') . ($claim['ref'] ? ' — مرجع: ' . $claim['ref'] : ''), '/staff/pay-links', 'pay_claim', 'high', $d['orderId'] ?: null);
        return ['ok' => true];
    }
    public static function pay_page($code) {
        Mutqan_Limiter::hit('pay_view', 120, 3600);
        $code = strtoupper((string) $code);
        $d = preg_match('/^[A-Z0-9]{8}$/', $code) ? Mutqan_Store::get_raw('pay_links', $code) : null;
        nocache_headers(); header('Content-Type: text/html; charset=utf-8'); header('X-Robots-Tag: noindex, nofollow');
        $brand = esc_html(get_option('oxygen_seo_brand') ?: (strpos((string) wp_parse_url(home_url('/'), PHP_URL_HOST), 'mutqan') !== false ? 'متقن' : 'أكسجين'));
        $head = '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>الدفع — ' . $brand . '</title>'
            . '<style>body{font-family:Tahoma,sans-serif;background:#eef2f6;margin:0;padding:18px;color:#1b2430}.c{max-width:460px;margin:auto;background:#fff;border-radius:18px;padding:22px;box-shadow:0 6px 24px #0002}h1{margin:0 0 4px;font-size:20px}.amt{font-size:36px;font-weight:900;margin:8px 0}.m{border:1px solid #dde4ec;border-radius:14px;padding:12px;margin:10px 0}.m b{display:block;margin-bottom:4px}.btn{display:block;text-align:center;background:#0e8f88;color:#fff;border-radius:12px;padding:12px;text-decoration:none;font-weight:700;border:0;width:100%;font-size:15px;cursor:pointer}input{width:100%;box-sizing:border-box;padding:11px;border:1px solid #cfd8e2;border-radius:10px;margin:5px 0;font-size:15px}code{direction:ltr;display:inline-block;background:#f2f5f8;padding:3px 7px;border-radius:6px;user-select:all}.s{padding:10px;border-radius:12px;font-weight:700;text-align:center;margin:10px 0}</style><body><div class="c">';
        if (!$d) { echo $head . '<h1>❌ رابط الدفع غير موجود</h1><p>تأكد من الرابط الذي وصلك.</p></div></body></html>'; exit; }
        $expired = !empty($d['expires']) && strtotime($d['expires']) < time() && ($d['status'] ?? '') === 'open';
        $st = $d['status'] ?? 'open';
        $out = $head . '<h1>طلب دفع — ' . $brand . '</h1>' . ($d['desc'] ? '<p style="margin:2px 0;color:#445">' . esc_html($d['desc']) . '</p>' : '')
            . '<div class="amt">' . esc_html(rtrim(rtrim(number_format((float) $d['amount'], 2, '.', ''), '0'), '.')) . ' <small style="font-size:16px">ر.س</small></div>';
        if ($st === 'paid') { echo $out . '<div class="s" style="background:#e6f6ec;color:#0a7d3b">✅ تم استلام الدفع — شكرًا لك</div></div></body></html>'; exit; }
        if ($st === 'cancelled' || $expired) { echo $out . '<div class="s" style="background:#f3f3f3;color:#555">هذا الرابط ' . ($expired ? 'انتهت صلاحيته' : 'أُلغي') . ' — تواصل معنا للحصول على رابط جديد.</div></div></body></html>'; exit; }
        if ($st === 'claimed') { $out .= '<div class="s" style="background:#fff6df;color:#8a5a00">وصلنا إبلاغك بالدفع — سنؤكده خلال وقت قصير.</div>'; }
        $rows = Mutqan_Store::select('payment_methods', [], ['limit' => 50], self::sys());
        $methods = '';
        foreach (is_array($rows) ? $rows : [] as $m) {
            if (empty($m['enabled']) || !empty($m['deleted']) || in_array($m['type'] ?? '', ['cash', 'card_on_site', 'online'], true)) { continue; }
            $name = esc_html($m['name'] ?? ''); $t = $m['type'] ?? '';
            $body = '';
            if (!empty($m['instructions'])) { $body .= '<div>' . esc_html($m['instructions']) . '</div>'; }
            if ($t === 'bank_transfer') {
                if (!empty($m['bankName'])) { $body .= '<div>البنك: <b style="display:inline">' . esc_html($m['bankName']) . '</b></div>'; }
                if (!empty($m['accountHolder'])) { $body .= '<div>باسم: <b style="display:inline">' . esc_html($m['accountHolder']) . '</b></div>'; }
                if (!empty($m['iban'])) { $body .= '<div>الآيبان: <code>' . esc_html($m['iban']) . '</code></div>'; }
            }
            $url = !empty($m['payUrl']) ? Mutqan_Policy::clean_pay_url(str_replace(['{amount}', '{order}'], [rawurlencode((string) $d['amount']), rawurlencode($code)], $m['payUrl'])) : null;
            if ($url) { $body .= '<a class="btn" style="margin-top:8px" rel="noopener" href="' . esc_url($url) . '">ادفع الآن ← ' . $name . '</a>'; }
            if ($body === '') { continue; }
            $methods .= '<div class="m"><b>' . ($t === 'bank_transfer' ? '🏦 ' : ($url ? '💳 ' : '📱 ')) . $name . '</b>' . $body . '</div>';
        }
        $out .= $methods ?: '<p>لم تُضَف طرق دفع بعد — تواصل معنا.</p>';
        $api = esc_url(rest_url('mutqan/v1/shop'));
        $out .= '<div class="m"><b>✅ دفعت؟ أبلغنا</b><input id="n" placeholder="الاسم" maxlength="60"><input id="r" placeholder="رقم عملية التحويل / آخر 4 أرقام" maxlength="60"><input id="p" placeholder="جوالك (اختياري)" maxlength="20" inputmode="tel"><button class="btn" id="go">إرسال</button><div id="msg" style="margin-top:8px"></div></div>'
            . '<script>document.getElementById("go").onclick=function(){var m=document.getElementById("msg");fetch(' . wp_json_encode($api) . ',{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({op:"pay_claim",code:' . wp_json_encode($code) . ',name:document.getElementById("n").value,ref:document.getElementById("r").value,phone:document.getElementById("p").value,method:"transfer"})}).then(function(r){return r.json()}).then(function(j){m.textContent=(j&&j.error)?(j.error.message||"تعذر الإرسال"):"وصلنا إبلاغك — سنؤكد الدفع قريبًا ✅"}).catch(function(){m.textContent="تعذر الإرسال، حاول لاحقًا"})}</script>'
            . '<p style="color:#778;font-size:12px;margin-top:14px">الدفع بالبطاقة (مدى / فيزا) يتم على صفحة مزود الدفع الآمنة وليس على هذا الموقع.</p></div></body></html>';
        echo $out; exit;
    }

    /** Appointment load for the scheduler: only the booked times (no names, phones or addresses). */
    private static function load() {
        Mutqan_Limiter::hit('sched_load', 240, 3600);
        $rows = Mutqan_Store::select('orders', ['appointmentAt' => ['gte' => gmdate('Y-m-d')]], ['limit' => 500], self::sys());
        $times = [];
        foreach ($rows as $o) {
            if (in_array($o['status'] ?? '', ['cancelled', 'completed', 'done', 'closed'], true)) { continue; }
            if (!empty($o['appointmentAt']) && strtotime((string) $o['appointmentAt'])) { $times[] = gmdate('c', strtotime((string) $o['appointmentAt'])); }
        }
        return ['times' => $times, 'now' => Mutqan_Store::iso(Mutqan_Store::now())];
    }
}
