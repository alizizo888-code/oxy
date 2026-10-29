<?php
/**
 * Theme functions for Oxygen WordPress.
 */
defined('ABSPATH') || exit;

function oxygen_wp_theme_setup() {
    load_theme_textdomain('oxygen-wp-theme', get_template_directory() . '/languages');
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('custom-logo');
    add_theme_support('automatic-feed-links');
    add_theme_support('html5', array('search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script'));
    register_nav_menus(array(
        'primary' => __('القائمة الرئيسية', 'oxygen-wp-theme'),
        'footer'  => __('قائمة التذييل', 'oxygen-wp-theme'),
    ));
}
add_action('after_setup_theme', 'oxygen_wp_theme_setup');

function oxygen_wp_theme_enqueue_styles() {
    wp_enqueue_style(
        'oxygen-wp-theme-style',
        get_stylesheet_uri(),
        array(),
        wp_get_theme()->get('Version')
    );
}
add_action('wp_enqueue_scripts', 'oxygen_wp_theme_enqueue_styles');

function oxygen_wp_theme_content_width() {
    $GLOBALS['content_width'] = 1050;
}
add_action('after_setup_theme', 'oxygen_wp_theme_content_width', 0);

/**
 * App-style chrome for WordPress pages: launch splash + bottom dock
 * (Home / Orders / AI assistant / Calculator / More). The dock links into the Mutqan app.
 */
function oxygen_wp_theme_app_chrome() {
    if (is_admin() || is_customize_preview()) { return; }
    $app = home_url('/app/');
    $items = array(
        array(home_url('/?site=wp'), 'الموقع', '⌂'),
        array($app . '#/orders', 'طلباتي', '☰'),
        array($app . '#/ai', 'المساعد الذكي', '✦'),
        array($app . '#/calculator', 'الحاسبة', '▦'),
        array($app . '#/more', 'المزيد', '⋯'),
    );
    echo '<style>
#ox-splash{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:radial-gradient(circle at 50% 38%,#12427d,#0a2447 50%,#040d1c);color:#fff;transition:opacity .35s}
#ox-splash.hide{opacity:0;pointer-events:none}
#ox-splash b{font:900 34px/1 Cairo,Tajawal,sans-serif;letter-spacing:.14em}
#ox-splash i{display:block;width:180px;height:5px;border-radius:9px;background:rgba(255,255,255,.15);overflow:hidden}
#ox-splash i:after{content:"";display:block;height:100%;width:0;background:linear-gradient(90deg,#38bdf8,#34d399);animation:oxf .9s forwards}
@keyframes oxf{to{width:100%}}
.ox-dock{position:fixed;bottom:0;left:0;right:0;z-index:9990;display:flex;justify-content:space-around;background:rgba(255,255,255,.88);backdrop-filter:blur(18px);border-radius:24px 24px 0 0;box-shadow:0 -8px 30px rgba(8,60,130,.16);padding:8px 4px calc(8px + env(safe-area-inset-bottom,0px));direction:rtl}
.ox-dock a{flex:1;text-align:center;text-decoration:none;color:#64748b;font:700 10px Tajawal,sans-serif}
.ox-dock a span{display:block;font-size:20px;line-height:1.2}
.ox-dock a.ai{color:#0284c7}
body{padding-bottom:78px}
@media(min-width:900px){.ox-dock{display:none}body{padding-bottom:0}}
</style>';
    echo '<div id="ox-splash"><b>OXYGEN</b><small>الصيانة والمقاولات العامة · مُتقن</small><i></i></div>';
    echo '<nav class="ox-dock" aria-label="التطبيق">';
    foreach ($items as $it) {
        $cls = ($it[1] === 'المساعد الذكي') ? ' class="ai"' : '';
        echo '<a' . $cls . ' href="' . esc_url($it[0]) . '"><span>' . esc_html($it[2]) . '</span>' . esc_html($it[1]) . '</a>';
    }
    echo '</nav><script>setTimeout(function(){var s=document.getElementById("ox-splash");if(s){s.classList.add("hide");setTimeout(function(){s.remove()},400)}},900)</script>';
}
add_action('wp_footer', 'oxygen_wp_theme_app_chrome', 5);
