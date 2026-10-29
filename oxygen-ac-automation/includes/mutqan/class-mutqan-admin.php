<?php
if (!defined('ABSPATH')) { exit; }

/** WordPress admin screen "متقن": owner account + free AI providers. Secrets are write-only (never echoed back). */
final class Mutqan_Admin {
    const PAGE = 'mutqan-admin';

    public static function boot() {
        add_action('admin_menu', [__CLASS__, 'menu'], 58);
        add_action('admin_post_mutqan_save_owner', [__CLASS__, 'save_owner']);
        add_action('admin_post_mutqan_save_ai', [__CLASS__, 'save_ai']);
        add_action('admin_post_mutqan_save_root', [__CLASS__, 'save_root']);
        add_action('admin_post_mutqan_test_ai', [__CLASS__, 'test_ai']);
    }

    public static function menu() {
        add_menu_page('تطبيق متقن', 'تطبيق متقن', 'manage_options', self::PAGE, [__CLASS__, 'page'], 'dashicons-hammer', 56);
    }

    private static function back($msg, $kind = 'success') {
        wp_safe_redirect(add_query_arg(['mutqan_msg' => rawurlencode($msg), 'mutqan_kind' => $kind], admin_url('admin.php?page=' . self::PAGE)));
        exit;
    }

    private static function post($k) { return isset($_POST[$k]) ? wp_unslash($_POST[$k]) : ''; }

    public static function save_owner() {
        if (!current_user_can('manage_options')) { wp_die('غير مصرح.'); }
        check_admin_referer('mutqan_save_owner');
        $pw = (string) self::post('password');
        if ($pw !== (string) self::post('password2')) { self::back('كلمتا المرور غير متطابقتين.', 'error'); }
        try {
            Mutqan_Store::maybe_install();
            Mutqan_Auth::set_owner(sanitize_text_field(self::post('handle')) ?: 'ali', sanitize_text_field(self::post('name')), $pw);
        } catch (Mutqan_Error $e) {
            self::back($e->getMessage(), 'error');
        }
        self::back('تم حفظ حساب المالك. سجّل الدخول من صفحة فريق العمل في التطبيق.');
    }

    public static function save_root() {
        if (!current_user_can('manage_options')) { wp_die('غير مصرح.'); }
        check_admin_referer('mutqan_save_root');
        update_option('mutqan_root_app', isset($_POST['root_app']) ? '1' : '0', false);
        self::back('تم حفظ إعداد الصفحة الرئيسية.');
    }

    public static function save_ai() {
        if (!current_user_can('manage_options')) { wp_die('غير مصرح.'); }
        check_admin_referer('mutqan_save_ai');
        $old = Mutqan_AI::settings();
        $new = $old;
        foreach (array_keys(Mutqan_AI::labels()) as $id) {
            $c = $old['providers'][$id];
            $c['enabled'] = isset($_POST['enabled'][$id]) ? 1 : 0;
            $key = trim(sanitize_text_field(wp_unslash($_POST['key'][$id] ?? '')));
            if (isset($_POST['clear'][$id])) { $c['key'] = ''; } elseif ($key !== '') { $c['key'] = $key; }
            $model = trim(sanitize_text_field(wp_unslash($_POST['model'][$id] ?? '')));
            if ($model !== '' && preg_match('/^[A-Za-z0-9@_.\/:-]{2,100}$/', $model)) { $c['model'] = $model; }
            if ($id === 'cloudflare') { $c['account'] = preg_replace('/[^a-zA-Z0-9]/', '', (string) ($_POST['account'] ?? $c['account'])); }
            $new['providers'][$id] = $c;
        }
        $order = array_values(array_intersect(array_map('trim', explode(',', (string) self::post('order'))), array_keys(Mutqan_AI::labels())));
        foreach (array_keys(Mutqan_AI::labels()) as $id) { if (!in_array($id, $order, true)) { $order[] = $id; } }
        $new['order'] = $order;
        $new['mask_pii'] = isset($_POST['mask_pii']) ? 1 : 0;
        $new['per_ip_10min'] = max(5, min(200, (int) self::post('per_ip_10min')));
        $new['per_ip_day'] = max(20, min(2000, (int) self::post('per_ip_day')));
        update_option(Mutqan_AI::OPT, $new, false);
        self::back('تم حفظ إعدادات الذكاء الاصطناعي.');
    }

    public static function test_ai() {
        if (!current_user_can('manage_options')) { wp_die('غير مصرح.'); }
        check_admin_referer('mutqan_test_ai');
        $out = [];
        foreach (Mutqan_AI::test_all() as $id => $r) { $out[] = Mutqan_AI::labels()[$id] . ': ' . $r; }
        self::back('نتيجة الاختبار — ' . implode(' | ', $out), 'info');
    }

    public static function page() {
        if (!current_user_can('manage_options')) { return; }
        Mutqan_Store::maybe_install();
        $msg = isset($_GET['mutqan_msg']) ? sanitize_text_field(wp_unslash($_GET['mutqan_msg'])) : '';
        $kind = isset($_GET['mutqan_kind']) && in_array($_GET['mutqan_kind'], ['success', 'error', 'info'], true) ? $_GET['mutqan_kind'] : 'success';
        $owner = Mutqan_Auth::owner_row();
        $ai = Mutqan_AI::settings();
        $cool = Mutqan_AI::cooldowns();
        $app = home_url('/app/');
        $built = is_readable(Mutqan_Rest::app_dir() . 'index.html');
        $links = ['groq' => 'https://console.groq.com/keys', 'gemini' => 'https://aistudio.google.com/apikey', 'cloudflare' => 'https://dash.cloudflare.com/profile/api-tokens', 'openrouter' => 'https://openrouter.ai/keys'];
        $notes = [
            'groq' => 'حد مجاني يومي بدون رصيد، الأسرع. الأفضل كمزود أول.',
            'gemini' => 'خطة مجانية؛ جوجل قد تراجع محتوى الخطة المجانية بشريًا، لذلك تُحجب الأرقام قبل الإرسال.',
            'cloudflare' => 'حصة يومية مجانية تتوقف عند انتهائها دون فواتير. يلزم Account ID وتوكن Workers AI.',
            'openrouter' => 'نماذج مجانية بحد يومي منخفض بدون شراء رصيد؛ احتياطي أخير.',
        ];
        ?>
        <div class="wrap" dir="rtl" style="max-width:980px">
            <h1>تطبيق متقن</h1>
            <?php if ($msg): ?><div class="notice notice-<?php echo esc_attr($kind === 'error' ? 'error' : ($kind === 'info' ? 'info' : 'success')); ?> is-dismissible"><p><?php echo esc_html($msg); ?></p></div><?php endif; ?>
            <p>رابط التطبيق: <a href="<?php echo esc_url($app); ?>" target="_blank" rel="noopener"><?php echo esc_html($app); ?></a>
                <?php if (!$built): ?> — <strong style="color:#b45309">لم يُرفع ملف الواجهة بعد (مجلد app داخل الإضافة).</strong><?php endif; ?></p>

            <h2>١) حساب المالك</h2>
            <?php if ($owner): ?>
                <p>المالك الحالي: <strong><?php echo esc_html($owner['display_name'] ?: $owner['handle']); ?></strong> (اسم الدخول: <code><?php echo esc_html($owner['handle']); ?></code>). يمكنك هنا إعادة تعيين كلمة المرور.</p>
            <?php else: ?>
                <div class="notice notice-warning inline"><p>لم يُنشأ حساب المالك بعد. أنشئه الآن؛ هو الحساب الوحيد المسجل في البداية، ومنه تضيف باقي الفريق والصلاحيات.</p></div>
            <?php endif; ?>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" autocomplete="off">
                <input type="hidden" name="action" value="mutqan_save_owner"><?php wp_nonce_field('mutqan_save_owner'); ?>
                <table class="form-table">
                    <tr><th><label for="mq_handle">اسم الدخول</label></th><td><input id="mq_handle" name="handle" type="text" dir="ltr" class="regular-text" value="<?php echo esc_attr($owner['handle'] ?? 'ali'); ?>" pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]{2,31}" required></td></tr>
                    <tr><th><label for="mq_name">الاسم الظاهر</label></th><td><input id="mq_name" name="name" type="text" class="regular-text" value="<?php echo esc_attr($owner['display_name'] ?? 'Ali'); ?>"></td></tr>
                    <tr><th><label for="mq_pw">كلمة المرور</label></th><td><input id="mq_pw" name="password" type="password" dir="ltr" class="regular-text" minlength="8" autocomplete="new-password" required><p class="description">8 أحرف على الأقل. يُفضّل خليط حروف وأرقام ورموز؛ الرقم المكوّن من تسعة أرقام فقط سهل التخمين. لا تُحفظ إلا مشفّرة في قاعدة بيانات الاستضافة.</p></td></tr>
                    <tr><th><label for="mq_pw2">تأكيد كلمة المرور</label></th><td><input id="mq_pw2" name="password2" type="password" dir="ltr" class="regular-text" minlength="8" autocomplete="new-password" required></td></tr>
                </table>
                <?php submit_button($owner ? 'تحديث حساب المالك' : 'إنشاء حساب المالك'); ?>
            </form>

            <h2>الصفحة الرئيسية للدومين</h2>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="mutqan_save_root"><?php wp_nonce_field('mutqan_save_root'); ?>
                <p><label><input type="checkbox" name="root_app" value="1" <?php checked(get_option('mutqan_root_app', '1') !== '0'); ?>> فتح التطبيق مباشرة عند زيارة <code><?php echo esc_html(home_url('/')); ?></code> (لعرض قالب ووردبريس بدلًا منه أضف <code>?site=wp</code> للرابط)</label></p>
                <?php submit_button('حفظ', 'secondary', 'submit', false); ?>
            </form>
            <h2>٢) مزودو الذكاء الاصطناعي المجانيون</h2>
            <p>يجرّب النظام المزودين بالترتيب، وإذا انتهى الحد المجاني لأحدهم ينتقل للتالي تلقائيًا. لا يوجد مزود مجاني بلا أي حد؛ الجمع بين أكثر من مزود هو ما يعطي سعة أكبر. أسماء النماذج المجانية تتغير، فتأكد منها من لوحة كل مزود.</p>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" autocomplete="off">
                <input type="hidden" name="action" value="mutqan_save_ai"><?php wp_nonce_field('mutqan_save_ai'); ?>
                <table class="widefat striped" style="margin-bottom:12px">
                    <thead><tr><th>المزود</th><th>مفعّل</th><th>المفتاح</th><th>النموذج</th><th>الحالة</th></tr></thead>
                    <tbody>
                    <?php foreach (Mutqan_AI::labels() as $id => $label): $c = $ai['providers'][$id]; $st = $ai['status'][$id] ?? null; ?>
                        <tr>
                            <td><strong><?php echo esc_html($label); ?></strong><br><a href="<?php echo esc_url($links[$id]); ?>" target="_blank" rel="noopener">إنشاء مفتاح مجاني</a><br><span class="description"><?php echo esc_html($notes[$id]); ?></span></td>
                            <td><input type="checkbox" name="enabled[<?php echo esc_attr($id); ?>]" value="1" <?php checked((int) $c['enabled'], 1); ?>></td>
                            <td>
                                <input type="password" dir="ltr" name="key[<?php echo esc_attr($id); ?>]" class="regular-text" autocomplete="new-password" placeholder="<?php echo $c['key'] !== '' ? 'محفوظ — اتركه فارغًا للإبقاء عليه' : 'الصق المفتاح هنا'; ?>">
                                <label><input type="checkbox" name="clear[<?php echo esc_attr($id); ?>]" value="1"> حذف المحفوظ</label>
                                <?php if ($id === 'cloudflare'): ?><br><input type="text" dir="ltr" name="account" class="regular-text" placeholder="Account ID" value="<?php echo esc_attr($c['account']); ?>"><?php endif; ?>
                            </td>
                            <td><input type="text" dir="ltr" name="model[<?php echo esc_attr($id); ?>]" class="regular-text" value="<?php echo esc_attr($c['model']); ?>"></td>
                            <td><?php
                                echo !empty($cool[$id]) ? '<span style="color:#b45309">في راحة مؤقتة (حد مجاني)</span><br>' : '';
                                echo $st ? esc_html($st['msg']) . '<br><small>' . esc_html($st['at']) . ' UTC</small>' : '—';
                            ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                <table class="form-table">
                    <tr><th><label for="mq_order">ترتيب التجربة</label></th><td><input id="mq_order" name="order" type="text" dir="ltr" class="regular-text" value="<?php echo esc_attr(implode(',', $ai['order'])); ?>"><p class="description">أسماء مفصولة بفاصلة: groq,gemini,cloudflare,openrouter</p></td></tr>
                    <tr><th>حماية الخصوصية</th><td><label><input type="checkbox" name="mask_pii" value="1" <?php checked((int) $ai['mask_pii'], 1); ?>> إخفاء أرقام الجوال والبريد من النص قبل إرساله للمزود</label></td></tr>
                    <tr><th>حدود الاستخدام لكل زائر</th><td>كل 10 دقائق: <input name="per_ip_10min" type="number" min="5" max="200" value="<?php echo (int) $ai['per_ip_10min']; ?>" class="small-text"> · في اليوم: <input name="per_ip_day" type="number" min="20" max="2000" value="<?php echo (int) $ai['per_ip_day']; ?>" class="small-text"><p class="description">تحمي حصتك المجانية من إساءة الاستخدام. موظفو الفريق غير خاضعين لها.</p></td></tr>
                </table>
                <?php submit_button('حفظ إعدادات الذكاء الاصطناعي'); ?>
            </form>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="mutqan_test_ai"><?php wp_nonce_field('mutqan_test_ai'); ?>
                <?php submit_button('اختبار الاتصال بالمزودين', 'secondary'); ?>
            </form>

            <h2>٣) واتساب</h2>
            <p>إشعار المالك بكل طلب جديد على واتساب يُضبط من <a href="<?php echo esc_url(admin_url('admin.php?page=oxygen-chat-orders')); ?>">الشات بوت والطلبات</a> (WhatsApp Cloud API).</p>
        </div>
        <?php
    }
}
