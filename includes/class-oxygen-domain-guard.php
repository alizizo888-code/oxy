<?php
/**
 * Domain guard: when the domain connected to this WordPress site changes (new Hostinger
 * domain / new Git link), rewrite every engine-article link to the new domain and
 * renumber the article slugs (-dN suffix) so nothing collides with articles that
 * already exist on the new site and every URL opens.
 */
if (!defined('ABSPATH')) { exit; }

class Oxygen_Domain_Guard {
    const OPT_HOST = 'oxygen_known_host';
    const OPT_EPOCH = 'oxygen_domain_epoch';

    public static function init() {
        add_action('init', [__CLASS__, 'check'], 20);
    }

    public static function host() {
        return strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
    }

    /** Main-site URL used by the article banners; follows the current domain unless overridden by the filter. */
    public static function main_url() {
        $opt = (string) get_option('oxygen_main_site_url', '');
        return apply_filters('oxygen_main_site_url', $opt !== '' ? $opt : 'https://oxygen11.com/');
    }

    public static function check() {
        $now = self::host();
        if ($now === '') { return; }
        $old = (string) get_option(self::OPT_HOST, '');
        if ($old === '') { update_option(self::OPT_HOST, $now, false); return; }
        if ($old === $now) { return; }
        // Guard against running twice concurrently.
        if (get_transient('oxygen_domain_guard_lock')) { return; }
        set_transient('oxygen_domain_guard_lock', 1, 300);
        self::migrate($old, $now);
        delete_transient('oxygen_domain_guard_lock');
    }

    public static function migrate($old, $new) {
        global $wpdb;
        $epoch = (int) get_option(self::OPT_EPOCH, 0) + 1;
        $ids = $wpdb->get_col("SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key='_oxy_seo_key'");
        $n = 0;
        foreach ($ids as $id) {
            $p = get_post((int) $id);
            if (!$p) { continue; }
            $content = preg_replace('#(https?:)?//' . preg_quote($old, '#') . '#i', '$1//' . $new, $p->post_content);
            $content = str_ireplace($old, $new, $content);
            $base = preg_replace('/-d\d+$/', '', $p->post_name);
            $slug = wp_unique_post_slug($base . '-d' . $epoch, $p->ID, $p->post_status, $p->post_type, $p->post_parent);
            wp_update_post(['ID' => $p->ID, 'post_content' => $content, 'post_name' => $slug]);
            $n++;
        }
        // If the main-site link pointed at the domain that just changed, follow it to the new one.
        $main = self::main_url();
        if (strtolower((string) wp_parse_url($main, PHP_URL_HOST)) === $old) { update_option('oxygen_main_site_url', trailingslashit(set_url_scheme('//' . $new, 'https')), false); }
        update_option(self::OPT_EPOCH, $epoch, false);
        update_option(self::OPT_HOST, $new, false);
        update_option('oxygen_domain_last_migration', ['from' => $old, 'to' => $new, 'posts' => $n, 'at' => current_time('mysql')], false);
        flush_rewrite_rules(false);
        if (function_exists('wp_cache_flush')) { wp_cache_flush(); }
    }
}
Oxygen_Domain_Guard::init();
