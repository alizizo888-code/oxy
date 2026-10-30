<?php
if (!defined('ABSPATH')) { exit; }

/**
 * Real, crawlable WordPress home page (static front page) for the main domain.
 * Server-rendered HTML + JSON-LD so search engines index it; the ordering app lives at /app/.
 * Page content (the intro text) stays editable from WordPress → Pages → «الرئيسية».
 */
class Oxygen_Home_Page {
    const OPT = 'oxygen_home_page_id';
    const DONE = 'oxygen_home_v1';

    public static function init() {
        add_action('init', [__CLASS__, 'ensure'], 5);
        add_action('template_redirect', [__CLASS__, 'render'], 1);
    }

    private static function services() {
        return [
            ['صيانة وتكييف', 'غسيل، فك وتركيب، شحن فريون وإصلاح الأعطال'],
            ['كهرباء', 'تمديدات وأعطال ولوحات كهرباء'],
            ['سباكة', 'كشف التسربات وتمديد الأدوات الصحية'],
            ['أقفال ذكية', 'تركيب وصيانة الأقفال الذكية'],
            ['أجهزة منزلية', 'غسالات وأفران وسخانات'],
            ['ساتلايت ودش', 'تركيب وضبط القنوات'],
            ['دهان وديكور', 'دهانات وورق جدران وديكور'],
            ['تبليط وترميم', 'تبليط وترميم وعزل'],
            ['كاميرات ومراقبة', 'تركيب كاميرات وأنظمة أمن'],
            ['التبريد', 'ثلاجات ومبردات وفريزرات'],
            ['تنظيف وتعقيم', 'تنظيف عميق وتعقيم'],
            ['مكافحة الحشرات', 'رش ومكافحة'],
            ['خزانات المياه', 'تنظيف وعزل وتعقيم الخزانات'],
            ['نقل الأثاث', 'فك ونقل وتركيب'],
            ['طاقة شمسية', 'تركيب وصيانة الأنظمة الشمسية'],
            ['خدمات الشركات', 'عقود وصيانة المنشآت'],
        ];
    }

    public static function ensure() {
        if (get_option(self::DONE) === '1') { return; }
        if (!function_exists('wp_insert_post')) { return; }
        $brand = Oxygen_SEO_Engine::brand();
        $id = (int) get_option(self::OPT, 0);
        if (!$id || !get_post($id)) {
            $intro = 'نقدّم في ' . $brand . ' خدمات الصيانة المنزلية والتجارية في مكة المكرمة وجدة: تكييف وكهرباء وسباكة وأجهزة منزلية وغيرها. اطلب الخدمة من التطبيق وتابع طلبك خطوة بخطوة.';
            $id = (int) wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_title' => $brand . ' للصيانة والخدمات المنزلية', 'post_name' => 'home', 'post_content' => $intro], true);
            if (!$id || is_wp_error($id)) { return; }
            update_option(self::OPT, $id, false);
        }
        update_option('show_on_front', 'page');
        update_option('page_on_front', $id);
        update_option('mutqan_root_app2', '0'); // the WordPress page owns "/", the app is at /app/
        update_option(self::DONE, '1', false);
        flush_rewrite_rules(false);
        if (method_exists('Oxygen_SEO_Engine', 'indexnow')) { try { Oxygen_SEO_Engine::indexnow([home_url('/')]); } catch (Throwable $e) { /* optional */ } }
    }

    private static function faq() {
        $b = Oxygen_SEO_Engine::brand();
        return [
            ['كيف أطلب خدمة؟', 'افتح تطبيق ' . $b . '، اختر الخدمة، حدّد موقعك وأرسل الطلب، ثم تتابع حالته حتى الاكتمال.'],
            ['في أي مدن تتوفر الخدمة؟', 'نخدم مكة المكرمة وجدة. للتأكد من تغطية حيّك راسلنا عبر واتساب أو اتصل بنا.'],
            ['هل أستطيع معرفة السعر قبل التنفيذ؟', 'نعرض لك السعر قبل اعتماد الطلب، وتظهر بنود الفاتورة بعد التنفيذ.'],
            ['هل يمكن طلب الخدمة بدون تطبيق؟', 'نعم، تواصل معنا عبر واتساب أو الهاتف وسنسجّل طلبك.'],
        ];
    }

    public static function render() {
        if (!is_front_page() || is_admin() || is_feed() || (defined('REST_REQUEST') && REST_REQUEST)) { return; }
        $id = (int) get_option(self::OPT, 0);
        if (!$id || (int) get_option('page_on_front') !== $id) { return; }
        $post = get_post($id); if (!$post || $post->post_status !== 'publish') { return; }
        foreach (array_keys($_GET) as $k) { if (!preg_match('/^(utm_[a-z_]+|fbclid|gclid|ref|source|v|pwa)$/i', (string) $k)) { return; } }

        $brand = Oxygen_SEO_Engine::brand();
        $url = home_url('/');
        $app = home_url('/app/');
        $title = $post->post_title;
        $desc = $brand . ' للصيانة والخدمات المنزلية في مكة المكرمة وجدة: تكييف، كهرباء، سباكة، أجهزة منزلية والمزيد. اطلب الخدمة وتابع طلبك من التطبيق.';
        $c = class_exists('Oxygen_Article_Boost') ? Oxygen_Article_Boost::contact() : ['wa' => '', 'phone' => ''];
        $wa = $c['wa'] ? 'https://wa.me/' . $c['wa'] . '?text=' . rawurlencode('السلام عليكم، أرغب بطلب خدمة من ' . $brand) : '';
        $tel = $c['phone'] ? 'tel:' . $c['phone'] : '';
        $sv = self::services(); $faq = self::faq();

        $posts = get_posts(['numberposts' => 12, 'post_status' => 'publish', 'orderby' => 'date', 'order' => 'DESC']);

        $ld = [
            ['@context' => 'https://schema.org', '@type' => 'LocalBusiness', '@id' => $url . '#org', 'name' => $brand, 'url' => $url, 'description' => $desc, 'areaServed' => ['مكة المكرمة', 'جدة'], 'priceRange' => '$$', 'sameAs' => [],
                'hasOfferCatalog' => ['@type' => 'OfferCatalog', 'name' => 'خدمات ' . $brand, 'itemListElement' => array_map(function ($s) { return ['@type' => 'Offer', 'itemOffered' => ['@type' => 'Service', 'name' => $s[0], 'description' => $s[1]]]; }, $sv)]],
            ['@context' => 'https://schema.org', '@type' => 'WebSite', 'url' => $url, 'name' => $brand, 'inLanguage' => 'ar'],
            ['@context' => 'https://schema.org', '@type' => 'FAQPage', 'mainEntity' => array_map(function ($f) { return ['@type' => 'Question', 'name' => $f[0], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $f[1]]]; }, $faq)],
        ];
        if ($c['phone']) { $ld[0]['telephone'] = $c['phone']; }
        $ld = array_map(function ($x) { return '<script type="application/ld+json">' . wp_json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) . '</script>'; }, $ld);

        // Keep SEO plugins/core from printing a second canonical/title; we print our own.
        remove_action('wp_head', 'rel_canonical');
        status_header(200);
        header('Content-Type: text/html; charset=utf-8');
        ob_start(); wp_head(); $head = ob_get_clean();
        ob_start(); wp_footer(); $foot = ob_get_clean();

        $e = 'esc_html';
        // An installed SEO plugin (Yoast / Rank Math / AIOSEO) prints title, description, canonical, robots and OG itself — never duplicate them.
        $seo_plugin = defined('WPSEO_VERSION') || defined('RANK_MATH_VERSION') || defined('AIOSEO_VERSION');
        echo '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
        if (!$seo_plugin) {
            echo '<title>' . $e($title) . '</title><meta name="description" content="' . esc_attr($desc) . '"><link rel="canonical" href="' . esc_url($url) . '"><meta name="robots" content="index,follow,max-image-preview:large">';
            echo '<meta property="og:type" content="website"><meta property="og:locale" content="ar_SA"><meta property="og:title" content="' . esc_attr($title) . '"><meta property="og:description" content="' . esc_attr($desc) . '"><meta property="og:url" content="' . esc_url($url) . '">';
        } elseif (!current_theme_supports('title-tag')) { echo '<title>' . $e($title) . '</title>'; }
        echo '<meta name="theme-color" content="#0ea5e9">';
        echo '<style>:root{--c:#0ea5e9;--d:#0b1220}*{box-sizing:border-box}body{margin:0;font-family:system-ui,"Segoe UI",Tahoma,sans-serif;color:#0f172a;background:#f8fafc;line-height:1.8}a{color:inherit}.w{max-width:1040px;margin:0 auto;padding:0 16px}.hero{background:linear-gradient(135deg,#0b1220,#0c4a6e);color:#fff;padding:56px 0 48px;text-align:center}.hero h1{font-size:clamp(24px,5vw,38px);margin:0 0 12px;line-height:1.4}.hero p{margin:0 auto 24px;max-width:640px;opacity:.9}.btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.b{display:inline-block;padding:13px 26px;border-radius:999px;font-weight:800;text-decoration:none;background:var(--c);color:#04121f}.b.wa{background:#25d366}.b.t{background:#fff}h2{font-size:22px;margin:40px 0 14px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}.k{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px}.k h3{margin:0 0 4px;font-size:16px}.k p{margin:0;font-size:13px;color:#475569}.l{list-style:none;padding:0;margin:0;display:grid;gap:8px}.l a{display:block;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:11px 14px;text-decoration:none;font-weight:700;font-size:14px}details{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:8px}summary{font-weight:800;cursor:pointer}footer{margin-top:48px;background:#0b1220;color:#cbd5e1;text-align:center;padding:24px 16px;font-size:13px}</style>';
        echo $head . implode('', $ld) . '</head><body>';
        echo '<header class="hero"><div class="w"><h1>' . $e($title) . '</h1><p>' . $e(wp_strip_all_tags($post->post_content)) . '</p><div class="btns"><a class="b" href="' . esc_url($app) . '">اطلب خدمة الآن</a>';
        if ($wa) { echo '<a class="b wa" href="' . esc_url($wa) . '" rel="noopener">واتساب</a>'; }
        if ($tel) { echo '<a class="b t" href="' . esc_attr($tel) . '">اتصال</a>'; }
        echo '</div></div></header><main class="w">';
        echo '<h2>خدماتنا</h2><div class="g">';
        foreach ($sv as $s) { echo '<a class="k" href="' . esc_url($app) . '" style="text-decoration:none"><h3>' . $e($s[0]) . '</h3><p>' . $e($s[1]) . '</p></a>'; }
        echo '</div><h2>مناطق الخدمة</h2><p>نخدم مكة المكرمة وجدة. اكتب موقعك عند الطلب وسنؤكد التغطية.</p>';
        if ($posts) {
            echo '<h2>أحدث المقالات</h2><ul class="l">';
            foreach ($posts as $p) { echo '<li><a href="' . esc_url(get_permalink($p)) . '">' . $e(get_the_title($p)) . '</a></li>'; }
            echo '</ul>';
        }
        echo '<h2>أسئلة شائعة</h2>';
        foreach ($faq as $f) { echo '<details><summary>' . $e($f[0]) . '</summary><p>' . $e($f[1]) . '</p></details>'; }
        echo '</main><footer>© ' . gmdate('Y') . ' ' . $e($brand) . ' — <a href="' . esc_url($app) . '">التطبيق</a></footer>' . $foot . '</body></html>';
        exit;
    }
}
Oxygen_Home_Page::init();
