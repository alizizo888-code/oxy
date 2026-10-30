<?php
if (!defined('ABSPATH')) { exit; }

/**
 * Oxygen business control center.
 * Settings are stored in wp_options; public output never receives API secrets.
 */
final class Oxygen_Business_Control {
    const OPT = 'oxygen_business_control';
    const MENU = 'oxygen-business-control';

    public static function boot() {
        add_action('admin_menu', [__CLASS__, 'menu'], 59);
        add_action('admin_post_oxygen_business_save', [__CLASS__, 'save']);
        add_action('admin_post_oxygen_business_test_gsc', [__CLASS__, 'test_gsc']);
        add_filter('oxygen_ac_home_html', [__CLASS__, 'inject_public_settings'], 20);
        add_filter('comments_open', [__CLASS__, 'comments_open'], 20, 2);
        add_filter('pings_open', [__CLASS__, 'comments_open'], 20, 2);
        add_action('admin_enqueue_scripts', [__CLASS__, 'media_assets']);
    }

    public static function defaults() {
        return [
            'company_name' => self::brand_name(),
            'phone' => self::shared_contact('phone'),
            'whatsapp' => self::shared_contact('whatsapp'),
            'email' => get_option('admin_email'),
            'city' => 'مكة المكرمة وجدة',
            'services' => "1|صيانة وتركيب وغسيل المكيفات\n1|التكييف المركزي والدكت\n1|الكهرباء والإنارة\n1|السباكة وكشف التسربات\n1|الأقفال والأقفال الذكية\n1|الأجهزة المنزلية\n1|الساتلايت والدش\n1|الدهان والديكور\n1|التبليط والترميم والعزل\n1|كاميرات المراقبة\n1|صيانة الثلاجات والتبريد\n1|التنظيف والتعقيم\n1|مكافحة الحشرات\n1|تنظيف وعزل خزانات المياه\n1|نقل الأثاث\n1|الطاقة الشمسية\n1|خدمات وعقود صيانة الشركات والمنشآت\n1|الصيانة العامة\n1|المقاولات العامة والإشراف الهندسي",
            'price_rules' => '',
            'offers' => '',
            'banner_text' => self::brand_name() . ' — صيانة ومقاولات عامة في مكة المكرمة وجدة. اطلب خدمتك وتابعها من التطبيق.',
            'banner_image' => '',
            'banner_video' => '',
            'gallery_urls' => '',
            'payment_methods' => "تحويل بنكي\nمدى\nالدفع عند إتمام الخدمة\nرابط دفع إلكتروني",
            'comments_enabled' => 0,
            'registration_enabled' => 1,
            'ai_enabled' => 0,
            'ai_instructions' => "أنت مساعد خدمة العملاء لـ" . self::brand_name() . ". تحدّث بالعربية بأدب واختصار وسؤال واحد في كل رد.\nالخدمات: صيانة وتكييف، كهرباء، سباكة، أقفال ذكية، أجهزة منزلية، ساتلايت، دهان وديكور، تبليط وترميم، كاميرات، تبريد، تنظيف، مكافحة حشرات، خزانات، نقل أثاث، طاقة شمسية، شركات، صيانة عامة، مقاولات.\nالتغطية: مكة المكرمة وجدة فقط.\nلا تذكر سعرًا أو خصمًا أو مدة ضمان أو وقت وصول من عندك؛ هذه تأتي من نظام الأسعار والضمان والتتبع فقط، وعند عدم توفرها حوّل العميل لموظف.\nاجمع: نوع الخدمة، وصف المشكلة، الحي، الوقت المناسب، ثم جهّز الطلب.\nعند الشكوى أو الاسترداد أو الخطر (كهرباء، غاز، تسريب) ابدأ بخطوة السلامة ثم حوّل لموظف.\nلا تطلب كلمات مرور أو بيانات بطاقات.",
            'gsc_property' => '',
            'gsc_verification' => '',
            'google_client_id' => '',
            'google_client_secret' => '',
            'google_refresh_token' => '',
            'gsc_last_status' => '',
            'gsc_last_check' => '',
            'cache_enabled' => 1,
            'cache_ttl' => 900,
            'last_saved' => '',
        ];
    }

    /** Group brand shown in the admin and public config; follows the site (OXYGEN vs MUTQAN). */
    public static function brand_name() {
        $b = class_exists('Oxygen_SEO_Engine') ? Oxygen_SEO_Engine::brand() : 'أكسجين';
        return $b === 'متقن' ? 'متقن للصيانة والمقاولات العامة' : 'مجموعة أكسجين للصيانة والمقاولات العامة';
    }

    private static function shared_contact($k) {
        if (!class_exists('Mutqan_Store')) { return ''; }
        try { $d = Mutqan_Store::peek_doc('pricing', 'contact_numbers'); return is_array($d) ? (string) ($d[$k] ?? '') : ''; } catch (Throwable $e) { return ''; }
    }

    public static function settings() {
        $o = (array) get_option(self::OPT, []);
        if (get_option('oxygen_bc_fill_v1') !== '1') {
            // One-time fill: complete every empty field with the group defaults (company, services, payment, AI instructions, banner) — never overwrites typed values.
            $d = self::defaults();
            foreach (['company_name', 'city', 'services', 'payment_methods', 'banner_text', 'ai_instructions'] as $k) {
                if (!isset($o[$k]) || trim((string) $o[$k]) === '' || ($k === 'company_name' && $o[$k] === 'أكسجين للصيانة والتبريد') || ($k === 'city' && $o[$k] === 'مكة المكرمة') || ($k === 'services' && substr_count((string) $o[$k], "\n") < 8)) { $o[$k] = $d[$k]; }
            }
            update_option(self::OPT, $o, false); update_option('oxygen_bc_fill_v1', '1', false);
        }
        return wp_parse_args($o, self::defaults());
    }

    public static function menu() {
        add_menu_page(
            'إدارة المؤسسة',
            'إدارة المؤسسة',
            'manage_options',
            self::MENU,
            [__CLASS__, 'page'],
            'dashicons-admin-generic',
            59
        );
    }

    public static function media_assets($hook) {
        if (strpos((string) $hook, self::MENU) === false) return;
        wp_enqueue_media();
        wp_add_inline_script('jquery', "jQuery(function(\$){\$(document).on('click','.oxygen-pick-media',function(e){e.preventDefault();var target=\$(\$(this).data('target'));var frame=wp.media({title:'اختيار صورة أو فيديو',button:{text:'استخدام الملف'},multiple:false});frame.on('select',function(){var a=frame.state().get('selection').first().toJSON();target.val(a.url).trigger('change');});frame.open();});});");
    }

    private static function field($label, $name, $value, $type = 'text', $help = '') {
        echo '<tr><th scope="row"><label for="obc_' . esc_attr($name) . '">' . esc_html($label) . '</label></th><td>';
        if ($type === 'textarea') {
            echo '<textarea class="large-text" rows="4" id="obc_' . esc_attr($name) . '" name="' . esc_attr($name) . '">' . esc_textarea($value) . '</textarea>';
        } elseif ($type === 'password') {
            echo '<input class="regular-text" type="password" autocomplete="new-password" id="obc_' . esc_attr($name) . '" name="' . esc_attr($name) . '" value="" placeholder="' . esc_attr($value !== '' ? 'اتركه فارغًا للاحتفاظ بالقيمة المحفوظة' : 'أدخل القيمة إذا كانت متاحة') . '">';
        } else {
            echo '<input class="regular-text" type="' . esc_attr($type) . '" id="obc_' . esc_attr($name) . '" name="' . esc_attr($name) . '" value="' . esc_attr($value) . '">';
        }
        if ($help !== '') echo '<p class="description">' . esc_html($help) . '</p>';
        echo '</td></tr>';
    }

    private static function checkbox($label, $name, $checked, $help = '') {
        echo '<tr><th scope="row">' . esc_html($label) . '</th><td><label><input type="checkbox" name="' . esc_attr($name) . '" value="1" ' . checked((int) $checked, 1, false) . '> مفعّل</label>';
        if ($help !== '') echo '<p class="description">' . esc_html($help) . '</p>';
        echo '</td></tr>';
    }

    public static function page() {
        if (!current_user_can('manage_options')) return;
        $s = self::settings();
        echo '<div class="wrap" dir="rtl" style="max-width:1100px"><h1>مركز التحكم — ' . esc_html(self::brand_name()) . '</h1>';
        echo '<p>إعدادات المؤسسة محفوظة في قاعدة بيانات WordPress. التغييرات العامة لا تتضمن مفاتيح Google أو بيانات الدخول.</p>';
        if (!empty($_GET['obc_message'])) echo '<div class="notice notice-info is-dismissible"><p>' . esc_html(sanitize_text_field(wp_unslash($_GET['obc_message'])) ) . '</p></div>';
        echo '<div class="notice notice-warning"><p><strong>مهم:</strong> هذه الصفحة تربط إعدادات عامة بعناصر واجهة قابلة للتعرف عليها، وتضيف شريط معلومات وبانر قابلين للتحكم. بعض أقسام التصميم الأصلي قد تحتاج ربطًا خاصًا حسب بنية HTML؛ راجع المعاينة بعد الحفظ.</p></div>';
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '"><input type="hidden" name="action" value="oxygen_business_save">';
        wp_nonce_field('oxygen_business_save');
        echo '<h2>1. بيانات المؤسسة والاتصال</h2><table class="form-table">';
        self::field('اسم المؤسسة', 'company_name', $s['company_name']);
        self::field('رقم الهاتف الرئيسي', 'phone', $s['phone'], 'text', 'يستخدم في روابط الاتصال tel: وعناصر الاتصال التي يمكن التعرف عليها.');
        self::field('رقم واتساب مع مفتاح الدولة', 'whatsapp', $s['whatsapp'], 'text', 'مثال: 9665xxxxxxxx من دون علامة + أو مسافات.');
        self::field('البريد الإلكتروني', 'email', $s['email'], 'email');
        self::field('المدينة / نطاق الخدمة', 'city', $s['city']);
        self::checkbox('تسجيل طلبات الخدمات', 'registration_enabled', $s['registration_enabled'], 'هذا المفتاح متاح لربطه بنماذج الطلبات؛ لا ينشئ نموذج حجز مستقلًا إذا لم يكن موجودًا في الواجهة.');
        self::checkbox('تشغيل مساعد الذكاء الاصطناعي', 'ai_enabled', $s['ai_enabled'], 'يغيّر حالة التفعيل المحفوظة؛ تشغيل محادثة فعلية يتطلب ربط واجهة المساعد بمزود API.');
        self::field('تعليمات المساعد الذكي', 'ai_instructions', $s['ai_instructions'], 'textarea', 'تعليمات سلوكية للمساعد عند ربطه بمزود الذكاء الاصطناعي.');
        echo '</table><h2>2. الخدمات والأسعار والعروض</h2><table class="form-table">';
        self::field('الخدمات (سطر لكل خدمة)', 'services', $s['services'], 'textarea', 'الصيغة الاختيارية: 1|اسم الخدمة أو 0|اسم الخدمة. الرقم 1 للتفعيل و0 للإيقاف.');
        self::field('قواعد تعديل نصوص الأسعار', 'price_rules', $s['price_rules'], 'textarea', 'كل سطر: النص الحالي الظاهر|النص الجديد. استخدم نصًا دقيقًا؛ لا تضف أسعارًا غير معتمدة.');
        self::field('العروض', 'offers', $s['offers'], 'textarea', 'سطر لكل عرض؛ لا تضع عرضًا أو خصمًا غير معتمد.');
        echo '</table><h2>3. البنرات والمعرض والوسائط</h2><table class="form-table">';
        self::field('نص البانر', 'banner_text', $s['banner_text'], 'textarea');
        self::field('رابط صورة البانر', 'banner_image', $s['banner_image'], 'url');
        echo '<tr><th>اختيار صورة من مكتبة الوسائط</th><td><button class="button oxygen-pick-media" data-target="#obc_banner_image">اختيار صورة</button></td></tr>';
        self::field('رابط فيديو البانر (اختياري)', 'banner_video', $s['banner_video'], 'url');
        echo '<tr><th>اختيار فيديو من مكتبة الوسائط</th><td><button class="button oxygen-pick-media" data-target="#obc_banner_video">اختيار فيديو</button></td></tr>';
        self::field('روابط صور المعرض (سطر لكل رابط)', 'gallery_urls', $s['gallery_urls'], 'textarea', 'يمكن اختيار الصور ورفعها من مكتبة الوسائط ثم نسخ رابط كل صورة هنا.');
        echo '</table><h2 id="payment-settings">4. الدفع والتعليقات</h2><table class="form-table">';
        self::field('طرق الدفع والتحويل المعروضة للعميل', 'payment_methods', $s['payment_methods'], 'textarea', 'أسماء طرق الدفع فقط. لا تضع بيانات حساب أو أرقام بطاقات حساسة في نص عام.');
        self::checkbox('السماح بالتعليقات', 'comments_enabled', $s['comments_enabled'], 'يؤثر على فتح التعليقات في WordPress؛ قد يحتاج قالب الواجهة إلى ربط إضافي لعرضها.');
        echo '</table><h2>5. Google Search Console</h2><table class="form-table">';
        self::field('رابط خاصية Search Console', 'gsc_property', $s['gsc_property'], 'url', 'أدخل رابط الخاصية كما يظهر في Search Console، مثل https://example.com/.');
        self::field('رمز تحقق الموقع (اختياري)', 'gsc_verification', $s['gsc_verification'], 'text', 'يضاف كوسم تحقق meta في واجهة الموقع.');
        self::field('Google OAuth Client ID', 'google_client_id', $s['google_client_id']);
        self::field('Google OAuth Client Secret', 'google_client_secret', $s['google_client_secret'], 'password');
        self::field('Google OAuth Refresh Token', 'google_refresh_token', $s['google_refresh_token'], 'password', 'يُستخدم للوصول المصرح به إلى Search Console API. لا تتم مشاركة هذه القيمة مع الزوار.');
        echo '</table><h2>6. التخزين المؤقت</h2><table class="form-table">';
        self::checkbox('تفعيل ذاكرة مؤقتة للإعدادات العامة', 'cache_enabled', $s['cache_enabled'], 'يستخدم WordPress Transients API؛ ليس بديلًا عن كاش Hostinger أو LiteSpeed.');
        self::field('مدة التخزين المؤقت بالثواني', 'cache_ttl', (string) $s['cache_ttl'], 'number', 'من 60 إلى 86400 ثانية.');
        echo '</table>';
        submit_button('حفظ إعدادات المؤسسة');
        echo '</form><hr><h2>اختبار اتصال Google Search Console</h2>';
        echo '<p>حالة آخر اختبار: <strong>' . esc_html($s['gsc_last_status'] ?: 'لم يتم الاختبار') . '</strong> — ' . esc_html($s['gsc_last_check'] ?: 'لا يوجد تاريخ') . '</p>';
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '"><input type="hidden" name="action" value="oxygen_business_test_gsc">';
        wp_nonce_field('oxygen_business_test_gsc'); submit_button('اختبار الاتصال الآن', 'secondary'); echo '</form>';
        echo '<p>خريطة الموقع الافتراضية: <a target="_blank" rel="noopener" href="' . esc_url(home_url('/wp-sitemap.xml')) . '">' . esc_html(home_url('/wp-sitemap.xml')) . '</a></p>';
        echo '<p>الوسائط: <a href="' . esc_url(admin_url('upload.php')) . '">فتح مكتبة الصور والفيديو</a> · التعليقات: <a href="' . esc_url(admin_url('edit-comments.php')) . '">إدارة التعليقات</a> · المستخدمون والصلاحيات: <a href="' . esc_url(admin_url('users.php')) . '">إدارة المستخدمين</a></p></div>';
    }

    public static function save() {
        if (!current_user_can('manage_options')) wp_die('غير مصرح.');
        check_admin_referer('oxygen_business_save');
        $old = self::settings();
        $text_fields = ['company_name','phone','whatsapp','city','services','price_rules','offers','banner_text','payment_methods','gallery_urls','ai_instructions','gsc_property','gsc_verification'];
        $s = $old;
        foreach ($text_fields as $key) {
            $raw = isset($_POST[$key]) ? wp_unslash($_POST[$key]) : '';
            $s[$key] = in_array($key, ['services','price_rules','offers','banner_text','payment_methods','gallery_urls','ai_instructions'], true)
                ? sanitize_textarea_field($raw) : sanitize_text_field($raw);
        }
        $s['email'] = sanitize_email(wp_unslash($_POST['email'] ?? ''));
        foreach (['banner_image','banner_video'] as $key) {
            $url = esc_url_raw(wp_unslash($_POST[$key] ?? ''));
            $s[$key] = $url;
        }
        foreach (['google_client_id','google_client_secret','google_refresh_token'] as $key) {
            $value = trim(sanitize_text_field(wp_unslash($_POST[$key] ?? '')));
            if ($value !== '') $s[$key] = $value;
        }
        foreach (['comments_enabled','registration_enabled','ai_enabled','cache_enabled'] as $key) $s[$key] = isset($_POST[$key]) ? 1 : 0;
        $s['cache_ttl'] = max(60, min(86400, absint($_POST['cache_ttl'] ?? 900)));
        $s['last_saved'] = current_time('mysql');
        update_option(self::OPT, $s, false);
        delete_transient('oxygen_business_public_config');
        wp_cache_delete('oxygen_business_public_config', 'oxygen');
        // Invalidate only this plugin's cache; avoid flushing the host's entire object cache.
        wp_safe_redirect(add_query_arg('obc_message', rawurlencode('تم حفظ الإعدادات وتحديث الذاكرة المؤقتة.'), admin_url('admin.php?page=' . self::MENU)));
        exit;
    }

    public static function comments_open($open, $post_id = 0) {
        $s = self::settings();
        return empty($s['comments_enabled']) ? false : (get_post_status($post_id) === 'publish');
    }

    private static function public_config() {
        $s = self::settings();
        if (!empty($s['cache_enabled'])) {
            $cached = get_transient('oxygen_business_public_config');
            if (is_array($cached)) { unset($cached['payment_methods']); return $cached; }
        }
        $services = [];
        foreach (preg_split('/\r\n|\r|\n/', (string) $s['services']) as $line) {
            $parts = explode('|', $line, 2);
            $enabled = count($parts) === 2 ? trim($parts[0]) !== '0' : true;
            $name = trim(count($parts) === 2 ? $parts[1] : $parts[0]);
            if ($name !== '') $services[] = ['enabled' => $enabled, 'name' => $name];
        }
        $prices = [];
        foreach (preg_split('/\r\n|\r|\n/', (string) $s['price_rules']) as $line) {
            $parts = explode('|', $line, 2);
            if (count($parts) === 2 && trim($parts[0]) !== '') $prices[] = ['old' => trim($parts[0]), 'new' => trim($parts[1])];
        }
        $config = [
            'company_name' => $s['company_name'], 'phone' => preg_replace('/[^0-9+]/', '', $s['phone']),
            'whatsapp' => preg_replace('/[^0-9]/', '', $s['whatsapp']), 'email' => $s['email'], 'city' => $s['city'],
            'services' => $services, 'prices' => $prices,
            'offers' => array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', (string) $s['offers'])))),
            'banner_text' => $s['banner_text'], 'banner_image' => $s['banner_image'], 'banner_video' => $s['banner_video'],
            'gallery_urls' => array_values(array_filter(array_map('esc_url_raw', preg_split('/\r\n|\r|\n/', (string) $s['gallery_urls'])))),
            // Payment configuration stays server-side until a real payment gateway is connected.
            'registration_enabled' => (bool) $s['registration_enabled'], 'ai_enabled' => (bool) $s['ai_enabled'],
            'last_saved' => $s['last_saved'],
        ];
        if (!empty($s['cache_enabled'])) set_transient('oxygen_business_public_config', $config, (int) $s['cache_ttl']);
        return $config;
    }

    public static function inject_public_settings($html) {
        if (!is_string($html) || $html === '') return $html;
        $s = self::settings();
        $config = self::public_config();
        $json = wp_json_encode($config, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);
        $verification = trim((string) $s['gsc_verification']);
        $meta = $verification !== '' ? '<meta name="google-site-verification" content="' . esc_attr($verification) . '">' : '';
        $snippet = $meta . '<script id="oxygen-business-config">window.OXYGEN_BUSINESS_CONFIG=' . $json . ';</script><script id="oxygen-business-runtime">(function(){var c=window.OXYGEN_BUSINESS_CONFIG||{};function text(n){return (n&&n.textContent||"").trim()}function el(tag,attrs,content){var n=document.createElement(tag);Object.keys(attrs||{}).forEach(function(k){if(k==="class")n.className=attrs[k];else if(k==="style")n.setAttribute("style",attrs[k]);else n.setAttribute(k,attrs[k])});if(content!==undefined)n.textContent=content;return n}function run(){var body=document.body;if(!body||body.dataset.oxygenBusinessApplied)return;body.dataset.oxygenBusinessApplied="1";document.querySelectorAll("[data-oxygen-setting]").forEach(function(n){var k=n.getAttribute("data-oxygen-setting");if(k==="company_name"&&c.company_name)n.textContent=c.company_name;if(k==="phone"&&c.phone)n.textContent=c.phone;if(k==="city"&&c.city)n.textContent=c.city});if(c.company_name){document.querySelectorAll("a[href^=\"tel:\"]").forEach(function(a){if(c.phone){a.href="tel:"+c.phone;a.textContent=c.phone}});document.querySelectorAll("a[href*=\"wa.me/\"],a[href*=\"api.whatsapp.com/send\"]").forEach(function(a){if(c.whatsapp){a.href="https://wa.me/"+c.whatsapp}})}if(c.company_name){var walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT);var nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(function(n){if(!n.parentElement||/SCRIPT|STYLE|TEXTAREA|INPUT/.test(n.parentElement.tagName))return;var t=n.nodeValue;if(/أكسجين للصيانة والتبريد|مؤسسة أكسجين|شركة أكسجين/.test(t))n.nodeValue=t.replace(/أكسجين للصيانة والتبريد|مؤسسة أكسجين|شركة أكسجين/g,c.company_name)})}if(c.prices&&c.prices.length){var w=document.createTreeWalker(body,NodeFilter.SHOW_TEXT);var ns=[];while(w.nextNode())ns.push(w.currentNode);ns.forEach(function(n){if(!n.parentElement||/SCRIPT|STYLE|TEXTAREA|INPUT/.test(n.parentElement.tagName))return;c.prices.forEach(function(p){if(p.old)n.nodeValue=n.nodeValue.split(p.old).join(p.new)})})}if(c.services){var off=c.services.filter(function(x){return !x.enabled}).map(function(x){return x.name});document.querySelectorAll(".service-card,.service-item,.service-box,[data-service],article").forEach(function(n){var t=n.innerText||n.textContent||"";if(off.some(function(x){return x&&t.indexOf(x)!==-1}))n.hidden=true})}var style=el("style",{},".oxygen-managed-banner{margin:12px auto;max-width:1180px;padding:16px;border-radius:16px;background:#e0f2fe;color:#0f3d5e;text-align:center;font:16px/1.8 Tahoma,Arial,sans-serif}.oxygen-managed-banner img,.oxygen-managed-banner video{max-width:100%;max-height:320px;border-radius:12px;display:block;margin:10px auto}.oxygen-managed-panel{max-width:1180px;margin:12px auto;padding:14px;border:1px solid #dbeafe;border-radius:14px;background:#fff;color:#0f172a;font:14px/1.8 Tahoma,Arial,sans-serif}.oxygen-managed-panel ul{display:flex;gap:8px;flex-wrap:wrap;list-style:none;padding:0}.oxygen-managed-panel li{padding:6px 10px;background:#f0f9ff;border-radius:8px}.oxygen-managed-gallery{display:flex;gap:10px;flex-wrap:wrap}.oxygen-managed-gallery img{width:150px;height:110px;object-fit:cover;border-radius:10px}");document.head.appendChild(style);var anchor=body.querySelector("header")||body.firstElementChild;if(c.banner_text||c.banner_image||c.banner_video){var b=el("section",{class:"oxygen-managed-banner","aria-label":"عروض أكسجين"});if(c.banner_text)b.appendChild(el("div",{},c.banner_text));if(c.banner_image){var im=el("img",{src:c.banner_image,alt:c.banner_text||c.company_name,loading:"lazy"});b.appendChild(im)}if(c.banner_video){var v=el("video",{src:c.banner_video,controls:"controls",preload:"metadata"});b.appendChild(v)}if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(b,anchor.nextSibling);else body.insertBefore(b,body.firstChild)}var panel=el("section",{class:"oxygen-managed-panel","aria-label":"بيانات خدمات أكسجين"});if(c.company_name)panel.appendChild(el("h2",{},c.company_name));if(c.city)panel.appendChild(el("p",{},"نطاق الخدمة: "+c.city));if(c.phone){var p=el("p",{},"اتصال: "+c.phone);panel.appendChild(p)}if(c.email)panel.appendChild(el("p",{},"البريد: "+c.email));if(c.services&&c.services.some(function(x){return x.enabled})){panel.appendChild(el("h3",{},"الخدمات"));var ul=el("ul",{});c.services.filter(function(x){return x.enabled}).forEach(function(x){ul.appendChild(el("li",{},x.name))});panel.appendChild(ul)}if(c.offers&&c.offers.length){panel.appendChild(el("h3",{},"العروض"));var ou=el("ul",{});c.offers.forEach(function(x){ou.appendChild(el("li",{},x))});panel.appendChild(ou)}/* Payment methods intentionally remain hidden from visitors until the smart payment gateway is implemented; admins can configure them in the protected WordPress control panel. */if(c.gallery_urls&&c.gallery_urls.length){panel.appendChild(el("h3",{},"معرض الأعمال"));var gal=el("div",{class:"oxygen-managed-gallery"});c.gallery_urls.forEach(function(x){gal.appendChild(el("img",{src:x,alt:"من أعمال "+(c.company_name||"أكسجين"),loading:"lazy"}))});panel.appendChild(gal)}if(c.registration_enabled===false){document.querySelectorAll("form[data-oxygen-service-registration],.oxygen-service-registration").forEach(function(n){n.hidden=true});document.querySelectorAll("form").forEach(function(n){var t=(n.innerText||n.textContent||"");if(/طلب صيانة|طلب خدمة|حجز خدمة|تسجيل طلب|اطلب الخدمة/.test(t))n.hidden=true})}if(c.ai_enabled===false){document.querySelectorAll("[data-oxygen-ai],.oxygen-ai-assistant").forEach(function(n){n.hidden=true})}if(panel.children.length&&anchor&&anchor.parentNode)anchor.parentNode.insertBefore(panel,anchor.nextSibling);if(c.registration_enabled===true){document.querySelectorAll("[data-oxygen-service-registration],.oxygen-service-registration").forEach(function(n){n.hidden=false})}if(c.ai_enabled===true){document.querySelectorAll("[data-oxygen-ai],.oxygen-ai-assistant").forEach(function(n){n.hidden=false})}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);else run()})();</script>';
        if (stripos($html, '</head>') !== false) $html = preg_replace('/<\/head>/i', $snippet . '</head>', $html, 1);
        else $html = $snippet . $html;
        return $html;
    }

    public static function test_gsc() {
        if (!current_user_can('manage_options')) wp_die('غير مصرح.');
        check_admin_referer('oxygen_business_test_gsc');
        $s = self::settings();
        $status = 'لم يكتمل الاختبار';
        $message = '';
        if (empty($s['google_client_id']) || empty($s['google_client_secret']) || empty($s['google_refresh_token']) || empty($s['gsc_property'])) {
            $status = 'بيانات الربط غير مكتملة';
            $message = 'أدخل Property URL وOAuth Client ID وClient Secret وRefresh Token ثم احفظ الإعدادات.';
        } else {
            $token = wp_remote_post('https://oauth2.googleapis.com/token', [
                'timeout' => 20,
                'headers' => ['Content-Type' => 'application/x-www-form-urlencoded'],
                'body' => [
                    'client_id' => $s['google_client_id'],
                    'client_secret' => $s['google_client_secret'],
                    'refresh_token' => $s['google_refresh_token'],
                    'grant_type' => 'refresh_token',
                ],
            ]);
            if (is_wp_error($token)) {
                $status = 'تعذر الاتصال بخدمة OAuth';
                $message = $token->get_error_message();
            } else {
                $td = json_decode(wp_remote_retrieve_body($token), true);
                $access = $td['access_token'] ?? '';
                if (!$access) {
                    $status = 'فشل توثيق Google';
                    $message = sanitize_text_field($td['error_description'] ?? $td['error'] ?? 'لم يتم إرجاع access token.');
                } else {
                    $url = 'https://www.googleapis.com/webmasters/v3/sites/' . rawurlencode($s['gsc_property']);
                    $api = wp_remote_get($url, ['timeout' => 20, 'headers' => ['Authorization' => 'Bearer ' . $access]]);
                    if (is_wp_error($api)) {
                        $status = 'تعذر الاتصال بواجهة Search Console';
                        $message = $api->get_error_message();
                    } elseif (wp_remote_retrieve_response_code($api) >= 200 && wp_remote_retrieve_response_code($api) < 300) {
                        $status = 'تم الاتصال بنجاح';
                        $message = 'نجح OAuth وطلب Search Console للخاصية المحددة.';
                        $sitemap = home_url('/wp-sitemap.xml');
                        $submit_url = 'https://www.googleapis.com/webmasters/v3/sites/' . rawurlencode($s['gsc_property']) . '/sitemaps/' . rawurlencode($sitemap);
                        $submit = wp_remote_request($submit_url, ['method' => 'PUT', 'timeout' => 20, 'headers' => ['Authorization' => 'Bearer ' . $access]]);
                        if (is_wp_error($submit)) { $message .= ' تعذر إرسال خريطة الموقع: ' . $submit->get_error_message(); }
                        elseif (wp_remote_retrieve_response_code($submit) >= 200 && wp_remote_retrieve_response_code($submit) < 300) { $status = 'تم الاتصال وإرسال خريطة الموقع'; $message .= ' تم إرسال ' . $sitemap . ' إلى Search Console.'; }
                        else { $message .= ' تم الاتصال لكن تعذر إرسال خريطة الموقع (HTTP ' . wp_remote_retrieve_response_code($submit) . ').'; }
                    } else {
                        $status = 'فشل اختبار Search Console';
                        $message = 'HTTP ' . wp_remote_retrieve_response_code($api) . ': ' . sanitize_text_field(wp_remote_retrieve_body($api));
                    }
                }
            }
        }
        $s['gsc_last_status'] = $status . ($message ? ' — ' . wp_strip_all_tags($message) : '');
        $s['gsc_last_check'] = current_time('mysql');
        update_option(self::OPT, $s, false);
        wp_safe_redirect(add_query_arg('obc_message', rawurlencode($s['gsc_last_status']), admin_url('admin.php?page=' . self::MENU)));
        exit;
    }
}
Oxygen_Business_Control::boot();
