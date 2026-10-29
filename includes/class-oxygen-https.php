<?php
/**
 * Fixes the browser's "Not secure" warning: the WordPress install was created with http:// URLs, so pages loaded over HTTPS
 * pulled scripts, images and the REST API over http (mixed content). This rewrites every generated URL to https when the
 * request itself is HTTPS, and corrects the stored Site/Home URL once.
 */
if (!defined('ABSPATH')) { exit; }

final class Oxygen_Https {
    private static function secure() {
        if (is_ssl()) { return true; }
        return isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https';
    }
    public static function fix($url) {
        return (is_string($url) && strpos($url, 'http://') === 0 && self::secure()) ? 'https://' . substr($url, 7) : $url;
    }
    public static function fix_deep($v) {
        if (is_array($v)) { foreach ($v as $k => $x) { $v[$k] = self::fix_deep($x); } return $v; }
        return self::fix($v);
    }
    public static function boot() {
        if (!self::secure()) { return; }
        foreach (['option_home', 'option_siteurl', 'home_url', 'site_url', 'plugins_url', 'content_url', 'includes_url', 'wp_get_attachment_url', 'rest_url', 'admin_url', 'login_url', 'script_loader_src', 'style_loader_src', 'stylesheet_directory_uri', 'template_directory_uri', 'theme_file_uri'] as $f) {
            add_filter($f, [__CLASS__, 'fix'], 1);
        }
        add_filter('upload_dir', [__CLASS__, 'fix_deep'], 1);
        add_filter('the_content', [__CLASS__, 'content'], 1);
        add_action('init', [__CLASS__, 'persist'], 1);
        add_action('send_headers', function () {
            if (!headers_sent()) { header('Strict-Transport-Security: max-age=31536000'); header('Upgrade-Insecure-Requests: 1', false); }
            if (!headers_sent()) { header('Content-Security-Policy: upgrade-insecure-requests', false); }
        });
    }
    public static function content($c) {
        $host = wp_parse_url(home_url(), PHP_URL_HOST);
        return $host ? str_replace('http://' . $host, 'https://' . $host, $c) : $c;
    }
    /** One-time: store https in the database so every context (cron, CLI, e-mails) agrees. */
    public static function persist() {
        if (get_option('oxygen_https_done')) { return; }
        remove_filter('option_home', [__CLASS__, 'fix'], 1);
        remove_filter('option_siteurl', [__CLASS__, 'fix'], 1);
        foreach (['home', 'siteurl'] as $o) {
            $v = get_option($o);
            if (is_string($v) && strpos($v, 'http://') === 0) { update_option($o, 'https://' . substr($v, 7)); }
        }
        update_option('oxygen_https_done', 1, false);
    }
}
Oxygen_Https::boot();
