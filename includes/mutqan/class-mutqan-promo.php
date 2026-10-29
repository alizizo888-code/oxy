<?php
if (!defined('ABSPATH')) { exit; }

/**
 * Welcome offer: 30% off the first order, once per device and at most N people per IP (households share an IP).
 * Only salted HMAC hashes are stored (never the raw device id or IP).
 */
final class Mutqan_Promo {
    const OPT = 'mutqan_welcome';
    const PCT = 30;
    const MAX_OFF = 20;   // SAR — advertised openly as "30% up to 20 SAR"
    const IP_MAX = 2;
    const CAP = 50000;

    private static function h($v) { return hash_hmac('sha256', (string) $v, wp_salt('auth')); }
    private static function ip() { return isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'x'; }
    public static function valid_device($d) { return is_string($d) && preg_match('/^[A-Za-z0-9-]{16,64}$/', $d); }
    private static function load() { $o = get_option(self::OPT, []); return is_array($o) ? $o + ['d' => [], 'i' => []] : ['d' => [], 'i' => []]; }
    private static function save($o) {
        foreach (['d', 'i'] as $k) { if (count($o[$k]) > self::CAP) { $o[$k] = array_slice($o[$k], -self::CAP, null, true); } }
        update_option(self::OPT, $o, false);
    }

    /** Real discount amount for a total: PCT% but never more than MAX_OFF. */
    public static function off($total, $pct = self::PCT) { return round(min(((float) $total) * $pct / 100, self::MAX_OFF), 2); }

    /** @return array [state, pct]  state: available | claimed | used | blocked */
    public static function status($device) {
        if (!self::valid_device($device)) { return ['blocked', 0]; }
        $o = self::load();
        $d = self::h($device);
        if (isset($o['d'][$d])) { return [!empty($o['d'][$d]['u']) ? 'used' : 'claimed', !empty($o['d'][$d]['u']) ? 0 : self::PCT]; }
        $ip = self::h(self::ip());
        if (($o['i'][$ip] ?? 0) >= self::IP_MAX) { return ['blocked', 0]; }
        return ['available', self::PCT];
    }
    /** Register the offer for this device (idempotent). */
    public static function claim($device) {
        list($st, $pct) = self::status($device);
        if ($st !== 'available') { return [$st, $pct]; }
        $o = self::load();
        $o['d'][self::h($device)] = ['t' => time(), 'u' => 0];
        $ip = self::h(self::ip());
        $o['i'][$ip] = ($o['i'][$ip] ?? 0) + 1;
        self::save($o);
        return ['claimed', self::PCT];
    }
    /** Called when a first order is created: returns the discount percent (0 if not eligible) and burns the offer. */
    public static function consume($device) {
        list($st) = self::status($device);
        if ($st === 'available') { self::claim($device); $st = 'claimed'; }
        if ($st !== 'claimed') { return 0; }
        $o = self::load();
        $d = self::h($device);
        $o['d'][$d]['u'] = time();
        self::save($o);
        return self::PCT;
    }
}
