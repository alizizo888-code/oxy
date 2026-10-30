<?php
/**
 * Article boost: on every single post (and the articles hub) — a rotating banner carousel (the live offers), a moving gallery strip
 * (the admin's media), and a floating contact button + WhatsApp button on the side. Pure inline CSS/JS, no extra requests, no AI.
 */
if (!defined('ABSPATH')) { exit; }

final class Oxygen_Article_Boost {
    public static function boot() {
        add_filter('the_content', [__CLASS__, 'content'], 30);
        add_action('wp_footer', [__CLASS__, 'floating'], 50);
    }

    private static function brand() { return class_exists('Oxygen_SEO_Engine') ? Oxygen_SEO_Engine::brand() : get_bloginfo('name'); }
    private static function applies() {
        if (is_admin() || is_feed()) { return false; }
        if (is_singular('post')) { return true; }
        $hub = get_page_by_path('oxygen-seo-archive');
        return ($hub && is_page($hub->ID)) || is_home() || is_category() || is_tag();
    }
    private static function app_url() { return plugins_url('app/index.html', dirname(__DIR__) . '/oxygen-ac-automation.php') . '#/'; }

    /** WhatsApp / phone: article settings → business control → first enabled number of the app. */
    private static function contact() {
        static $c = null; if ($c !== null) { return $c; }
        $wa = ''; $phone = '';
        if (class_exists('Oxygen_SEO_Engine')) { $s = Oxygen_SEO_Engine::settings(); $wa = preg_replace('/\D/', '', (string) ($s['wa'] ?? '')); }
        $b = get_option('oxygen_business_control', []);
        if (is_array($b)) { if (!$wa) { $wa = preg_replace('/\D/', '', (string) ($b['whatsapp'] ?? '')); } $phone = preg_replace('/[^\d+]/', '', (string) ($b['phone'] ?? '')); }
        if (!$wa && class_exists('Mutqan_Store') && class_exists('Mutqan_WA')) {
            try {
                $rows = Mutqan_Store::select('wa_numbers', [], ['limit' => 20, 'order' => 'sort'], Mutqan_WA::sys());
                foreach ((array) $rows as $r) { if (!empty($r['phone']) && empty($r['deleted']) && ($r['enabled'] ?? true) !== false) { $wa = preg_replace('/\D/', '', (string) $r['phone']); break; } }
            } catch (Throwable $e) { /* optional */ }
        }
        return $c = ['wa' => $wa, 'phone' => $phone];
    }

    /** Live offers + gallery images from the app's own collections (cached 10 minutes). */
    private static function data() {
        $k = 'oxy_boost_data_v1';
        $d = get_transient($k);
        if (is_array($d)) { return $d; }
        $d = ['offers' => [], 'imgs' => []];
        if (class_exists('Mutqan_Store') && class_exists('Mutqan_WA')) {
            try {
                $sys = Mutqan_WA::sys();
                foreach ((array) Mutqan_Store::select('offers', [], ['limit' => 12, 'order' => '-createdAt'], $sys) as $o) {
                    if (empty($o['title'])) { continue; }
                    $d['offers'][] = ['id' => (string) ($o['key'] ?? $o['id'] ?? ''), 'title' => (string) $o['title'], 'sub' => (string) ($o['sub'] ?? ''), 'price' => $o['price'] ?? '', 'old' => $o['oldPrice'] ?? '', 'img' => (string) ($o['image'] ?? ''), 'tag' => (string) ($o['tag'] ?? '')];
                    if (!empty($o['image'])) { $d['imgs'][] = (string) $o['image']; }
                }
                foreach ((array) Mutqan_Store::select('ac_media', [], ['limit' => 60, 'order' => 'sort'], $sys) as $m) { if (!empty($m['url'])) { $d['imgs'][] = (string) $m['url']; } }
            } catch (Throwable $e) { /* optional */ }
        }
        $b = get_option('oxygen_business_control', []);
        if (is_array($b) && !empty($b['gallery_urls'])) { foreach (preg_split('/\R+/', (string) $b['gallery_urls']) as $u) { $u = trim($u); if ($u) { $d['imgs'][] = $u; } } }
        $d['imgs'] = array_slice(array_values(array_unique(array_filter($d['imgs'], function ($u) { return preg_match('#^(https?:)?//|^/#', $u); }))), 0, 16);
        set_transient($k, $d, 10 * MINUTE_IN_SECONDS);
        return $d;
    }

    private static function css() {
        static $done = false; if ($done) { return ''; } $done = true;
        return '<style id="oxy-boost-css">'
            . '.oxb{--c:#0ea5e9;--d:#075985;direction:rtl;font-family:inherit;margin:22px 0}'
            . '.oxb-car{position:relative;overflow:hidden;border-radius:18px;background:linear-gradient(120deg,#0b3b73,#0a2a55 55%,#071a33);color:#fff;box-shadow:0 8px 24px rgba(7,26,51,.25)}'
            . '.oxb-track{display:flex;transition:transform .55s ease;direction:ltr}'
            . '.oxb-slide{direction:rtl;flex:0 0 100%;min-height:150px;padding:18px 18px 20px;position:relative;display:flex;flex-direction:column;justify-content:center;gap:6px;background-size:cover;background-position:center}'
            . '.oxb-slide::before{content:"";position:absolute;inset:0;background:linear-gradient(to left,rgba(7,26,51,.92) 40%,rgba(7,26,51,.35))}'
            . '.oxb-slide>*{position:relative}'
            . '.oxb-tag{align-self:flex-start;background:#fbbf24;color:#4a2c00;font-size:11px;font-weight:800;border-radius:99px;padding:2px 10px}'
            . '.oxb-t{font-size:19px;font-weight:800;line-height:1.5;margin:0;color:#fff}.oxb-s{font-size:13px;opacity:.85;margin:0;color:#fff}'
            . '.oxb-p{font-size:22px;font-weight:900;color:#7dd3fc}.oxb-p del{font-size:13px;opacity:.6;margin-right:8px;color:#fff}'
            . '.oxb-cta{align-self:flex-start;background:var(--c);color:#fff!important;text-decoration:none!important;border-radius:99px;padding:8px 18px;font-weight:800;font-size:14px}'
            . '.oxb-dots{position:absolute;bottom:7px;left:0;right:0;display:flex;justify-content:center;gap:6px}.oxb-dots i{width:7px;height:7px;border-radius:99px;background:rgba(255,255,255,.4);cursor:pointer}.oxb-dots i.on{background:#fff;width:18px}'
            . '.oxb-gal{overflow:hidden;border-radius:16px;background:#f0f9ff;border:1px solid #bae6fd;padding:10px 0}.oxb-gal h4{margin:0 14px 8px;font-size:14px;color:#075985}'
            . '.oxb-mq{display:flex;gap:10px;width:max-content;animation:oxbm 38s linear infinite;direction:ltr}.oxb-gal:hover .oxb-mq{animation-play-state:paused}'
            . '.oxb-mq img{width:170px;height:112px;object-fit:cover;border-radius:12px;flex:none;margin:0!important}'
            . '@keyframes oxbm{to{transform:translateX(-50%)}}'
            . '.oxb-fab{position:fixed;z-index:99990;right:12px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:10px;direction:rtl}'
            . '.oxb-fab a,.oxb-fab button{width:52px;height:52px;border-radius:50%;border:0;display:flex;align-items:center;justify-content:center;color:#fff!important;box-shadow:0 6px 18px rgba(0,0,0,.28);cursor:pointer;text-decoration:none!important;transition:transform .15s}'
            . '.oxb-fab a:active,.oxb-fab button:active{transform:scale(.92)}'
            . '.oxb-main{background:var(--c);width:56px!important;height:56px!important}.oxb-wa{background:#25d366}.oxb-call{background:#0369a1}.oxb-app{background:#f59e0b}'
            . '.oxb-menu{display:none;flex-direction:column;gap:10px}.oxb-fab.open .oxb-menu{display:flex}'
            . '.oxb-lbl{position:absolute;right:62px;background:#0f172a;color:#fff;font-size:12px;border-radius:8px;padding:3px 9px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .15s}'
            . '.oxb-menu>div{position:relative}.oxb-menu>div:hover .oxb-lbl{opacity:1}'
            . '.oxb-wa-fixed{position:fixed;z-index:99990;left:12px;bottom:18px;width:58px;height:58px;border-radius:50%;background:#25d366;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(0,0,0,.3)}'
            . '@media(max-width:520px){.oxb-t{font-size:16px}.oxb-fab{right:8px}}'
            . '</style>';
    }

    private static function carousel($offset = 0) {
        $d = self::data(); $brand = self::brand(); $c = self::contact(); $app = esc_url(self::app_url());
        $slides = [];
        foreach ($d['offers'] as $o) { $slides[] = ['tag' => $o['tag'] ?: 'عرض', 'title' => $o['title'], 'sub' => $o['sub'], 'price' => $o['price'], 'old' => $o['old'], 'img' => $o['img'], 'href' => $app . 'new?offer=' . rawurlencode($o['id']), 'cta' => 'اطلب العرض الآن']; }
        if (!$slides) {
            $slides = [
                ['tag' => 'حجز سريع', 'title' => 'اطلب فني صيانة الآن بدون تسجيل', 'sub' => 'سعر واضح قبل التنفيذ وضمان على العمل — مكة وجدة', 'price' => '', 'old' => '', 'img' => '', 'href' => $app . 'new', 'cta' => 'اطلب الخدمة'],
                ['tag' => 'ضمان', 'title' => 'غسيل وصيانة المكيفات بضمان معتمد', 'sub' => 'فنيون مدرّبون وتأكيد على واتساب', 'price' => '', 'old' => '', 'img' => '', 'href' => $app . 'services', 'cta' => 'تصفح الخدمات'],
                ['tag' => 'على مدار الساعة', 'title' => 'طوارئ التسربات والكهرباء', 'sub' => 'فريق جاهز للاستجابة السريعة في مكة وجدة', 'price' => '', 'old' => '', 'img' => '', 'href' => $c['wa'] ? 'https://wa.me/' . $c['wa'] : $app . 'new', 'cta' => 'تواصل الآن'],
            ];
        }
        if ($offset && count($slides) > 1) { $o = $offset % count($slides); $slides = array_merge(array_slice($slides, $o), array_slice($slides, 0, $o)); }
        $h = '<div class="oxb oxb-car-wrap" aria-label="عروض ' . esc_attr($brand) . '"><div class="oxb-car"><div class="oxb-track">';
        foreach ($slides as $s) {
            $bg = $s['img'] ? ' style="background-image:url(' . esc_url($s['img']) . ')"' : '';
            $h .= '<div class="oxb-slide"' . $bg . '><span class="oxb-tag">' . esc_html($s['tag']) . '</span><p class="oxb-t">' . esc_html($s['title']) . '</p>'
                . ($s['sub'] ? '<p class="oxb-s">' . esc_html($s['sub']) . '</p>' : '')
                . ($s['price'] !== '' ? '<div class="oxb-p">' . esc_html($s['price']) . ' ر.س' . ($s['old'] ? '<del>' . esc_html($s['old']) . '</del>' : '') . '</div>' : '')
                . '<a class="oxb-cta" href="' . esc_url($s['href']) . '" rel="nofollow">' . esc_html($s['cta']) . '</a></div>';
        }
        $h .= '</div><div class="oxb-dots">' . str_repeat('<i></i>', count($slides)) . '</div></div></div>';
        return $h;
    }

    private static function gallery() {
        $d = self::data(); if (count($d['imgs']) < 3) { return ''; }
        $imgs = $d['imgs']; shuffle($imgs); $imgs = array_slice($imgs, 0, 12);
        $row = ''; foreach ($imgs as $u) { $row .= '<img src="' . esc_url($u) . '" alt="من أعمال ' . esc_attr(self::brand()) . '" loading="lazy" width="170" height="112">'; }
        return '<div class="oxb"><div class="oxb-gal"><h4>📸 من أعمالنا</h4><div class="oxb-mq">' . $row . $row . '</div></div></div>';
    }

    public static function content($c) {
        if (!is_singular('post') || !in_the_loop() || !is_main_query() || strpos($c, 'oxb-car') !== false) { return $c; }
        $css = self::css();
        $first = self::carousel(0);
        $gal = self::gallery();
        $last = self::carousel(1);
        // banner after the first paragraph
        $pos = stripos($c, '</p>');
        $c = $pos !== false ? substr($c, 0, $pos + 4) . $css . $first . substr($c, $pos + 4) : $css . $first . $c;
        // gallery before the 3rd section heading (or at the end for short posts)
        if ($gal) {
            $p = 0; $n = 0;
            while (($p = stripos($c, '<h2', $p)) !== false) { if (++$n === 3) { break; } $p += 3; }
            $c = ($n === 3 && $p !== false) ? substr($c, 0, $p) . $gal . substr($c, $p) : $c . $gal;
        }
        return $c . $last . self::js();
    }

    private static function js() {
        static $done = false; if ($done) { return ''; } $done = true;
        return '<script id="oxb-js">(function(){function init(w){var t=w.querySelector(".oxb-track"),dots=w.querySelectorAll(".oxb-dots i"),n=dots.length,i=0,timer;if(!t||n<2){if(dots[0])dots[0].className="on";return}function go(k){i=(k+n)%n;t.style.transform="translateX("+(i*100)+"%)";for(var j=0;j<n;j++)dots[j].className=j===i?"on":""}function start(){stop();timer=setInterval(function(){go(i+1)},4500)}function stop(){clearInterval(timer)}for(var j=0;j<n;j++)(function(k){dots[k].onclick=function(){go(k);start()}})(j);w.addEventListener("touchstart",stop,{passive:true});w.addEventListener("touchend",start);w.addEventListener("mouseenter",stop);w.addEventListener("mouseleave",start);go(0);start()}function run(){var a=document.querySelectorAll(".oxb-car");for(var k=0;k<a.length;k++){if(!a[k].__oxb){a[k].__oxb=1;init(a[k])}}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);else run()})();</script>';
    }

    public static function floating() {
        if (!self::applies()) { return; }
        $c = self::contact(); $app = esc_url(self::app_url() . 'new');
        $title = is_singular() ? wp_strip_all_tags(get_the_title()) : '';
        $text = rawurlencode('مرحباً، أحتاج خدمة' . ($title ? ' (من مقال: ' . $title . ')' : ''));
        $wa = $c['wa'] ? 'https://wa.me/' . $c['wa'] . '?text=' . $text : '';
        $ic = [
            'chat' => '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
            'wa' => '<svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4.1-4.7-4.3-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.3.4-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.4.1.6-.1l.7-.9c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg>',
            'call' => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
            'app' => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/></svg>',
        ];
        $menu = '';
        if ($wa) { $menu .= '<div><a class="oxb-wa" href="' . esc_url($wa) . '" target="_blank" rel="noopener nofollow" aria-label="واتساب">' . $ic['wa'] . '</a><span class="oxb-lbl">واتساب</span></div>'; }
        if ($c['phone']) { $menu .= '<div><a class="oxb-call" href="tel:' . esc_attr($c['phone']) . '" aria-label="اتصال">' . $ic['call'] . '</a><span class="oxb-lbl">اتصال مباشر</span></div>'; }
        $menu .= '<div><a class="oxb-app" href="' . $app . '" rel="nofollow" aria-label="اطلب خدمة">' . $ic['app'] . '</a><span class="oxb-lbl">اطلب خدمة</span></div>';
        echo self::css();
        echo '<div class="oxb-fab" id="oxb-fab"><div class="oxb-menu">' . $menu . '</div><button type="button" class="oxb-main" aria-label="تواصل معنا" onclick="document.getElementById(\'oxb-fab\').classList.toggle(\'open\')">' . $ic['chat'] . '</button></div>';
        if ($wa) { echo '<a class="oxb-wa-fixed" href="' . esc_url($wa) . '" target="_blank" rel="noopener nofollow" aria-label="واتساب">' . $ic['wa'] . '</a>'; }
        echo self::js();
    }
}
Oxygen_Article_Boost::boot();
