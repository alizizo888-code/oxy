<?php
if (!defined('ABSPATH')) { exit; }

/**
 * WhatsApp Cloud API bot: customers message the business number, the bot answers on the same chat
 * (customer-initiated => the 24h free window). Uses the free AI gateway when keys exist, otherwise a
 * built-in rules engine that quotes from the owner's AC price table. The owner stays in control:
 * on/off switch, "تحويل لموظف" pauses the bot for that customer, and the owner is notified on WhatsApp.
 */
final class Mutqan_Wabot {
    const OPT = 'mutqan_wabot';
    const NS = 'mutqan/v1';

    public static function boot() {
        add_action('rest_api_init', [__CLASS__, 'routes']);
        add_action('admin_post_mutqan_save_wabot', [__CLASS__, 'save']);
    }

    public static function defaults() {
        return [
            'enabled' => 0, 'verify_token' => '', 'app_secret' => '', 'use_ai' => 1,
            'greeting' => "هلا وغلا في أكسجين للتكييف والصيانة 👋\nقل لي وش تحتاج (غسيل مكيف، تركيب، صيانة…) وأعطيك السعر وأحجز لك فني.",
            'handoff_text' => 'أبشر، حوّلتك لأحد الزملاء وبيرد عليك بأقرب وقت 🙏',
            'extra' => '', 'takeover_hours' => 12,
        ];
    }
    public static function get() { return array_merge(self::defaults(), (array) get_option(self::OPT, [])); }
    public static function webhook_url() { return rest_url(self::NS . '/wa'); }

    public static function routes() {
        register_rest_route(self::NS, '/wa', [
            ['methods' => 'GET', 'permission_callback' => '__return_true', 'callback' => [__CLASS__, 'verify']],
            ['methods' => 'POST', 'permission_callback' => '__return_true', 'callback' => [__CLASS__, 'receive']],
        ]);
    }

    public static function verify($req) {
        $s = self::get();
        $ok = $s['verify_token'] !== '' && hash_equals($s['verify_token'], (string) $req->get_param('hub_verify_token'))
            && $req->get_param('hub_mode') === 'subscribe';
        if (!$ok) { return new WP_REST_Response('forbidden', 403); }
        header('Content-Type: text/plain');
        echo (string) $req->get_param('hub_challenge');
        exit;
    }

    public static function receive($req) {
        $s = self::get();
        $raw = (string) $req->get_body();
        if ($s['app_secret'] !== '') {
            $sig = (string) $req->get_header('x_hub_signature_256');
            $calc = 'sha256=' . hash_hmac('sha256', $raw, $s['app_secret']);
            if (!hash_equals($calc, $sig)) { return new WP_REST_Response('bad signature', 403); }
        }
        $body = json_decode($raw, true);
        if (!empty($s['enabled']) && is_array($body)) {
            foreach (($body['entry'] ?? []) as $e) {
                foreach (($e['changes'] ?? []) as $c) {
                    foreach (($c['value']['messages'] ?? []) as $m) {
                        $from = preg_replace('/\D/', '', (string) ($m['from'] ?? ''));
                        $mid = (string) ($m['id'] ?? '');
                        if ($from === '' || $mid === '' || get_transient('mq_wam_' . md5($mid))) { continue; }
                        set_transient('mq_wam_' . md5($mid), 1, 3600);
                        $text = (string) ($m['text']['body'] ?? '');
                        if ($text === '') { $text = ($m['type'] ?? '') === 'location' ? 'هذا موقعي' : ''; }
                        if ($text === '') { self::send($from, 'وصلتني رسالتك 🙏 اكتب لي طلبك نصاً وأخدمك.'); continue; }
                        try { self::handle($from, $text, $m, $s); } catch (Throwable $e2) { error_log('[mutqan-wabot] ' . $e2->getMessage()); }
                    }
                }
            }
        }
        return new WP_REST_Response('ok', 200); // always ack so Meta does not retry
    }

    /* ------------------------------------------------------------------ conversation */

    private static function state($from) { $v = get_transient('mq_wast_' . $from); return is_array($v) ? $v : ['h' => [], 'take' => 0]; }
    private static function save_state($from, $st) { set_transient('mq_wast_' . $from, $st, DAY_IN_SECONDS); }

    public static function handle($from, $text, $msg, $s) {
        $st = self::state($from);
        $first = empty($st['h']);
        $st['h'][] = ['u', mb_substr($text, 0, 600)];
        $st['h'] = array_slice($st['h'], -10);

        if (!empty($st['take']) && $st['take'] > time()) {      // human has this chat: bot stays silent, owner is pinged
            self::save_state($from, $st);
            self::notify_owner("💬 رسالة من +$from (بانتظار الموظف):\n" . mb_substr($text, 0, 300), $from);
            return;
        }
        $reply = ''; $handoff = false;
        if (preg_match('/موظف|انسان|مسؤول|مدير|كلمني|اكلم/u', $text)) { $handoff = true; $reply = $s['handoff_text']; }
        if (!$handoff) { list($reply, $handoff) = self::answer($from, $text, $st, $s, $first); }
        $st['h'][] = ['a', mb_substr($reply, 0, 600)];
        if ($handoff) { $st['take'] = time() + max(1, (int) $s['takeover_hours']) * HOUR_IN_SECONDS; }
        self::save_state($from, $st);
        self::send($from, $reply);
        self::lead($from, $text, $reply, $handoff);
        if ($handoff || $first) {
            self::notify_owner(($handoff ? '🙋 عميل يطلب موظف' : '🆕 محادثة جديدة') . " +$from:\n" . mb_substr($text, 0, 300) . "\nرد عليه: https://wa.me/$from", $from);
        }
    }

    private static function ac_ctx() {
        $row = Mutqan_Store::get_raw('pricing', 'ac_calc') ?: [];
        return $row;
    }

    /** @return array [reply, handoff] */
    private static function answer($from, $text, $st, $s, $first) {
        // 1) free LLM gateway, when the owner enabled any provider
        if (!empty($s['use_ai']) && Mutqan_AI::any_enabled()) {
            try {
                $sys = ['id' => 'system', 'role' => 'owner', 'powers' => ['read', 'write', 'manage'], 'kind' => 'user'];
                $r = Mutqan_AI::run(self::prompt($st, $s), ['json' => true], $sys);
                $j = $r['json'] ?? null;
                if (is_array($j) && !empty($j['reply'])) { return [mb_substr((string) $j['reply'], 0, 1500), !empty($j['handoff'])]; }
            } catch (Throwable $e) { /* fall through to rules */ }
        }
        // 2) built-in rules (no tokens, no keys)
        $t = self::norm($text);
        $q = self::parse_ac($t);
        if ($q) {
            $total = Mutqan_Policy::ac_total($q);
            $names = ['wash' => 'غسيل', 'install' => 'تركيب', 'maintenance' => 'صيانة'];
            if ($total <= 0) {
                $row = self::ac_ctx();
                $visit = (isset($row['visitFee']) && is_numeric($row['visitFee'])) ? (int) $row['visitFee'] : 50;
                return [$q['mode'] === 'maintenance'
                    ? "الصيانة نحدد سعرها بعد الفحص، والفحص مجاني لو عندك أكثر من مكيفين، وإلا الكشفية $visit ريال فقط. أرسل لي موقعك واليوم المناسب وأحجز لك."
                    : 'التركيب نسعّره بعد المعاينة. أرسل لي موقعك ونوع المكيف وأرتب لك فني يعاين.', false];
            }
            return ["{$names[$q['mode']]} {$q['qty']} " . ($q['type'] === 'سبليت' ? 'مكيف سبليت' : "مكيف {$q['type']}") . ': ' . (int) round($total) . " ريال شامل الضمان 15 يوم.\nتبغى أحجز لك؟ أرسل موقعك (📍) واليوم المناسب.", false];
        }
        if (preg_match('/موقع|حي |شارع|مكه|جده|الطايف/u', $text)) {
            return ['تمام وصلني. حدد لي اليوم والوقت المناسب وأأكد لك الطلب مع الفني.', false];
        }
        if (preg_match('/تمام|موافق|احجز|ابغي احجز|ابي احجز/u', $text)) {
            return ['أبشر! أرسل لي موقعك (📍) واليوم والوقت وأأكد الحجز.', false];
        }
        if ($first) { return [$s['greeting'], false]; }
        return ['ما فهمت طلبك تماماً. قل لي: غسيل مكيف؟ تركيب؟ صيانة؟ وكم عدد المكيفات؟ أو اكتب «موظف» وأحوّلك.', false];
    }

    private static function prompt($st, $s) {
        $c = self::ac_ctx();
        $g = function ($k, $d) use ($c) { return (isset($c[$k]) && is_numeric($c[$k])) ? (float) $c[$k] : $d; };
        $offers = '';
        foreach ((array) Mutqan_Store::select('offers', [], ['limit' => 20], ['id' => 'system', 'role' => 'owner', 'powers' => ['read', 'write', 'manage'], 'kind' => 'user'], false) as $o) {
            $d = $o['data'] ?? $o;
            if (!empty($d['acMode']) && ($d['active'] ?? true) !== false) { $offers .= '- ' . ($d['title'] ?? '') . ': ' . ($d['price'] ?? '') . " ريال\n"; }
        }
        $hist = '';
        foreach ($st['h'] as $h) { $hist .= ($h[0] === 'u' ? 'العميل' : 'أنت') . ': ' . $h[1] . "\n"; }
        return "أنت موظف مبيعات وخدمة عملاء في شركة أكسجين لخدمات المكيفات والصيانة بمكة وجدة، تتكلم عبر واتساب بلهجة سعودية بيضاء مهذبة ومختصرة (جملتان إلى ثلاث، سؤال واحد في كل رد).\n"
            . "ممنوع اختراع أسعار؛ استخدم هذا الجدول فقط (ريال):\n"
            . 'غسيل سبليت: ' . $g('split1', 100) . ' / ' . $g('split2', 140) . ' / ' . $g('split3', 200) . " لوحدة/وحدتين/ثلاث (ما زاد: ثلث سعر الثلاث لكل وحدة). داخلي فقط أرخص بـ " . $g('innerOff1', 10) . '/' . $g('innerOff2', 20) . '/' . $g('innerOff3', 40) . ".\n"
            . 'غسيل شباك: ' . $g('win1', 60) . ' / ' . $g('win2', 100) . ' / ' . $g('win3', 150) . ' (+' . $g('winExtra', 50) . " بعد الثالثة). باقي الأنواع " . $g('other1', 180) . " للوحدة.\n"
            . 'ضمان إضافي للوحدة: شهر +' . $g('w1', 10) . ' شهرين +' . $g('w2', 20) . ' 3 شهور +' . $g('w3', 30) . ". الضمان الذهبي 15 يوم مجاني. الضريبة " . $g('vatPct', 15) . "% عند الطلب.\n"
            . 'التركيب والصيانة تُسعَّر بعد المعاينة؛ الفحص مجاني لأكثر من مكيفين وإلا كشفية ' . $g('visitFee', 50) . " ريال.\n"
            . 'أقصى خصم تفاوض ' . $g('maxDiscountPct', 10) . "% ولا تنزل عنه أبدًا، وابدأ بإبراز المزايا (ضمان، سرعة، فني معتمد) قبل أي خصم.\n"
            . ($offers ? "العروض الحالية:\n$offers" : '')
            . ($s['extra'] !== '' ? "تعليمات المالك: {$s['extra']}\n" : '')
            . "الهدف: فهم الخدمة والعدد، إعطاء السعر، ثم طلب الموقع (📍) واليوم المناسب لتأكيد الحجز. إذا طلب موظفاً أو احتاج قراراً خارج صلاحيتك فاجعل handoff=true.\n"
            . "المحادثة:\n$hist"
            . 'أعد JSON فقط: {"reply":"نص الرد","handoff":false}';
    }

    /* ------------------------------------------------------------------ helpers */

    private static function norm($t) {
        $t = Mutqan_Auth::fold_digits(mb_strtolower((string) $t));
        $t = preg_replace('/[\x{064B}-\x{065F}\x{0640}]/u', '', $t);
        return strtr($t, ['أ' => 'ا', 'إ' => 'ا', 'آ' => 'ا', 'ى' => 'ي', 'ة' => 'ه']);
    }

    /** Parse "غسيل 3 مكيفات سبليت" style text into an acQuote array, or null if it is not an AC question. */
    public static function parse_ac($t) {
        if (!preg_match('/مكيف|تكييف|سبليت|سبلت|شباك|غسيل|غسل|تركيب|صيانه|داكت|كونسيلد|مركزي|باكيج|باكيدج|دولابي/u', $t)) { return null; }
        $mode = 'wash';
        if (preg_match('/تركيب|ركب|فك|نقل|تاسيس/u', $t)) { $mode = 'install'; }
        elseif (preg_match('/صيانه|عطل|ما يبرد|لا يبرد|مش بيبرد|فحص|يقطر|صوت/u', $t)) { $mode = 'maintenance'; }
        $type = 'سبليت';
        foreach (['شباك' => 'شباك', 'باكيدج' => 'باكيدج', 'باكيج' => 'باكيدج', 'كونسيلد' => 'كونسيلد', 'داكت' => 'داكت', 'مركزي' => 'مركزي', 'دولابي' => 'دولابي'] as $k => $v) { if (mb_strpos($t, $k) !== false) { $type = $v; break; } }
        $qty = 1;
        if (preg_match('/(\d{1,2})/u', $t, $m) && (int) $m[1] >= 1 && (int) $m[1] <= 50) { $qty = (int) $m[1]; }
        else { foreach (['مكيفين' => 2, 'اثنين' => 2, 'ثنتين' => 2, 'ثلاث' => 3, 'اربع' => 4, 'خمس' => 5, 'ست' => 6, 'سبع' => 7, 'ثمان' => 8, 'تسع' => 9, 'عشر' => 10] as $k => $n) { if (preg_match('/(^|\s)' . $k . '/u', $t)) { $qty = $n; break; } } }
        $offerKey = null;
        return ['mode' => $mode, 'type' => $type, 'qty' => $qty, 'full' => mb_strpos($t, 'داخلي فقط') === false, 'warranty' => 'بدون', 'vat' => false, 'offerKey' => $offerKey];
    }

    public static function send($to, $text) {
        if (!class_exists('Oxygen_Orders_Chat')) { return false; }
        $o = Oxygen_Orders_Chat::get();
        if ($o['wa_token'] === '' || $o['wa_phone_id'] === '') { return false; }
        $res = wp_remote_post('https://graph.facebook.com/v21.0/' . rawurlencode($o['wa_phone_id']) . '/messages', [
            'timeout' => 20,
            'headers' => ['Authorization' => 'Bearer ' . $o['wa_token'], 'Content-Type' => 'application/json'],
            'body' => wp_json_encode(['messaging_product' => 'whatsapp', 'to' => $to, 'type' => 'text', 'text' => ['preview_url' => false, 'body' => mb_substr($text, 0, 4000)]]),
        ]);
        return !is_wp_error($res) && (int) wp_remote_retrieve_response_code($res) < 300;
    }

    private static function notify_owner($text, $from) {
        $k = 'mq_wan_' . $from;
        if (get_transient($k)) { return; }               // at most one owner ping per customer per 5 minutes
        set_transient($k, 1, 300);
        if (class_exists('Oxygen_Orders_Chat') && method_exists('Oxygen_Orders_Chat', 'whatsapp_owner')) {
            try { Oxygen_Orders_Chat::whatsapp_owner($text); } catch (Throwable $e) { /* best effort */ }
        }
    }

    private static function lead($from, $text, $reply, $handoff) {
        try {
            $sys = ['id' => 'system', 'role' => 'owner', 'powers' => ['read', 'write', 'manage'], 'kind' => 'user'];
            Mutqan_Store::upsert('wa_leads', ['phone' => $from, 'last' => mb_substr($text, 0, 300), 'reply' => mb_substr($reply, 0, 300), 'handoff' => (bool) $handoff, 'at' => gmdate('c')], 'wa-' . $from, [], $sys);
        } catch (Throwable $e) { /* best effort */ }
    }

    /* ------------------------------------------------------------------ admin */

    public static function save() {
        if (!current_user_can('manage_options')) { wp_die('غير مصرح.'); }
        check_admin_referer('mutqan_save_wabot');
        $old = self::get();
        $p = function ($k) { return isset($_POST[$k]) ? wp_unslash($_POST[$k]) : ''; };
        $new = [
            'enabled' => !empty($_POST['enabled']) ? 1 : 0,
            'use_ai' => !empty($_POST['use_ai']) ? 1 : 0,
            'verify_token' => sanitize_text_field($p('verify_token')) ?: ($old['verify_token'] ?: wp_generate_password(24, false)),
            'app_secret' => trim($p('app_secret')) !== '' ? sanitize_text_field($p('app_secret')) : $old['app_secret'],
            'greeting' => sanitize_textarea_field($p('greeting')),
            'handoff_text' => sanitize_text_field($p('handoff_text')),
            'extra' => sanitize_textarea_field($p('extra')),
            'takeover_hours' => max(1, min(72, (int) $p('takeover_hours'))),
        ];
        update_option(self::OPT, $new, false);
        wp_safe_redirect(add_query_arg(['page' => 'mutqan-admin', 'mutqan_msg' => rawurlencode('تم حفظ إعدادات بوت الواتساب.')], admin_url('admin.php')));
        exit;
    }

    public static function render_admin() {
        $s = self::get();
        if ($s['verify_token'] === '') { $s['verify_token'] = wp_generate_password(24, false); }
        ?>
        <h2>٤) بوت واتساب (رد تلقائي على عملائك)</h2>
        <p>العميل يراسل رقم أكسجين، والبوت يرد في نفس المحادثة (رسائل العميل الواردة والرد خلال 24 ساعة بدون رسوم). يلزم Cloud API من Meta: ضع التوكن و Phone ID من صفحة «الشات بوت والطلبات»، ثم في Meta → WhatsApp → Configuration ضع:</p>
        <p>Callback URL: <code><?php echo esc_html(self::webhook_url()); ?></code> — Verify token: <code><?php echo esc_html($s['verify_token']); ?></code> — واشترك في حقل <code>messages</code>.</p>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" autocomplete="off">
            <input type="hidden" name="action" value="mutqan_save_wabot"><?php wp_nonce_field('mutqan_save_wabot'); ?>
            <input type="hidden" name="verify_token" value="<?php echo esc_attr($s['verify_token']); ?>">
            <table class="form-table">
                <tr><th>تشغيل البوت</th><td><label><input type="checkbox" name="enabled" value="1" <?php checked((int) $s['enabled'], 1); ?>> مفعّل</label></td></tr>
                <tr><th>استخدام الذكاء الاصطناعي المجاني</th><td><label><input type="checkbox" name="use_ai" value="1" <?php checked((int) $s['use_ai'], 1); ?>> إن توفر مفتاح (وإلا يعمل بالقواعد المحلية المجانية)</label></td></tr>
                <tr><th>App Secret (اختياري، للتحقق من التوقيع)</th><td><input type="password" name="app_secret" class="regular-text" dir="ltr" placeholder="<?php echo $s['app_secret'] !== '' ? '•••••• (محفوظ)' : ''; ?>"></td></tr>
                <tr><th>رسالة الترحيب</th><td><textarea name="greeting" rows="3" class="large-text"><?php echo esc_textarea($s['greeting']); ?></textarea></td></tr>
                <tr><th>رد التحويل للموظف</th><td><input name="handoff_text" class="large-text" value="<?php echo esc_attr($s['handoff_text']); ?>"></td></tr>
                <tr><th>تعليمات إضافية للبوت</th><td><textarea name="extra" rows="3" class="large-text" placeholder="مثال: لا نخدم خارج مكة وجدة. الدفع عند الإنجاز."><?php echo esc_textarea($s['extra']); ?></textarea></td></tr>
                <tr><th>إيقاف البوت بعد التحويل لموظف</th><td><input type="number" name="takeover_hours" min="1" max="72" value="<?php echo (int) $s['takeover_hours']; ?>"> ساعة (يصلك إشعار واتساب بكل رسالة خلالها)</td></tr>
            </table>
            <?php submit_button('حفظ إعدادات بوت واتساب'); ?>
        </form>
        <?php
    }
}
