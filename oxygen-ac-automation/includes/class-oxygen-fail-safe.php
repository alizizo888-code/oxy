<?php
if (!defined('ABSPATH')) { exit; }

/**
 * Fail-safe pages:
 *  1) Any front-end 404 → 302 to the main page (keeps real 404s for REST/admin/feeds/assets).
 *  2) Database outage ("Error establishing a database connection") → branded wp-content/db-error.php drop-in
 *     that answers 503 and auto-retries until the site is back, then lands on the main page.
 */
class Oxygen_Fail_Safe {
    const VER = '1';

    public static function init() {
        add_action('template_redirect', [__CLASS__, 'redirect_404'], 99);
        add_action('init', [__CLASS__, 'install_dropin']);
    }

    public static function redirect_404() {
        if (!is_404() || is_admin() || is_feed() || (defined('REST_REQUEST') && REST_REQUEST) || (defined('DOING_AJAX') && DOING_AJAX)) { return; }
        $path = isset($_SERVER['REQUEST_URI']) ? (string) wp_parse_url(wp_unslash($_SERVER['REQUEST_URI']), PHP_URL_PATH) : '';
        if (preg_match('#\.(js|css|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|json|xml|txt|mp4|pdf)$#i', $path) || strpos($path, '/wp-json') === 0) { return; }
        if (trim($path, '/') === '') { return; }
        wp_safe_redirect(home_url('/'), 302);
        exit;
    }

    public static function install_dropin() {
        $f = WP_CONTENT_DIR . '/db-error.php';
        if (file_exists($f) && strpos((string) @file_get_contents($f), 'oxygen-fail-safe v' . self::VER) !== false) { return; }
        if (file_exists($f) && strpos((string) @file_get_contents($f), 'oxygen-fail-safe') === false) { return; } // never overwrite someone else's drop-in
        $name = esc_html(get_bloginfo('name') ?: 'الموقع');
        $home = esc_url(home_url('/'));
        $html = '<?php /* oxygen-fail-safe v' . self::VER . ' */ if (!headers_sent()) { http_response_code(503); header("Retry-After: 10"); header("Content-Type: text/html; charset=utf-8"); header("Cache-Control: no-store"); } ?>' . "\n"
            . '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="8;url=' . $home . '"><title>' . $name . '</title>'
            . '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b1220;color:#fff;font-family:system-ui,Tahoma,sans-serif;text-align:center;padding:24px}.c{max-width:360px}.s{width:44px;height:44px;border:4px solid rgba(255,255,255,.2);border-top-color:#38bdf8;border-radius:50%;margin:0 auto 18px;animation:r 1s linear infinite}@keyframes r{to{transform:rotate(360deg)}}a{display:inline-block;margin-top:18px;background:#38bdf8;color:#000;font-weight:800;border-radius:999px;padding:11px 26px;text-decoration:none}</style></head>'
            . '<body><div class="c"><div class="s"></div><h1 style="font-size:20px;margin:0 0 8px">لحظات ونعود</h1><p style="opacity:.75;font-size:14px;line-height:1.7;margin:0">نقوم بتحديث بسيط الآن، وسيُعاد تحميل الصفحة الرئيسية تلقائيًا.</p><a href="' . $home . '">الصفحة الرئيسية</a></div></body></html>';
        @file_put_contents($f, $html);
    }
}
Oxygen_Fail_Safe::init();
