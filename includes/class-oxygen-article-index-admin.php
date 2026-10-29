<?php
defined('ABSPATH') || exit;

final class Oxygen_Article_Index_Admin {
    public static function boot() {
        add_action('admin_menu', array(__CLASS__, 'menu'), 61);
    }

    public static function menu() {
        add_options_page(
            'فهرس مقالات أكسجين',
            'فهرس مقالات أكسجين',
            'manage_options',
            'oxygen-article-index',
            array(__CLASS__, 'render')
        );
    }

    public static function render() {
        if (!current_user_can('manage_options')) {
            wp_die('ليست لديك صلاحية لعرض فهرس المقالات.');
        }
        echo '<div class="wrap" dir="rtl"><h1>فهرس مقالات أكسجين</h1>';
        echo '<p>روابط المقالات المنشورة في كتالوج الموقع. قد يستغرق ظهور المقال الجديد لحظات بعد اكتمال النشر.</p>';
        $response = wp_remote_get('https://oxygen11.com/articles/catalog.json', array('timeout' => 15, 'headers' => array('Accept' => 'application/json')));
        if (is_wp_error($response) || (int) wp_remote_retrieve_response_code($response) !== 200) {
            echo '<div class="notice notice-error"><p>تعذر جلب كتالوج المقالات من oxygen11.com. تحقق من نشر ملف articles/catalog.json وإمكانية الوصول إليه.</p></div></div>';
            return;
        }
        $catalog = json_decode(wp_remote_retrieve_body($response), true);
        if (!is_array($catalog)) {
            echo '<div class="notice notice-error"><p>الكتالوج ليس JSON صالحًا.</p></div></div>';
            return;
        }
        usort($catalog, function($a, $b) {
            return strcmp((string) ($b['published_at'] ?? ''), (string) ($a['published_at'] ?? ''));
        });
        echo '<p><strong>عدد السجلات في الكتالوج: ' . count($catalog) . '</strong></p>';
        echo '<table class="widefat striped"><thead><tr><th>العنوان</th><th>تاريخ النشر</th><th>الرابط الأساسي</th><th>فتح</th></tr></thead><tbody>';
        foreach ($catalog as $item) {
            $slug = sanitize_title((string) ($item['slug'] ?? ''));
            if (!$slug) {
                continue;
            }
            $title = sanitize_text_field((string) ($item['title'] ?? $slug));
            $date = sanitize_text_field((string) ($item['published_at'] ?? ''));
            $url = 'https://oxygen11.com/articles/' . rawurlencode($slug) . '/';
            echo '<tr><td>' . esc_html($title) . '</td><td>' . esc_html($date) . '</td><td><code>' . esc_html($url) . '</code></td><td><a href="' . esc_url($url) . '" target="_blank" rel="noopener">فتح المقال ↗</a></td></tr>';
        }
        echo '</tbody></table></div>';
    }
}

Oxygen_Article_Index_Admin::boot();
