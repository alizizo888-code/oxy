<?php
if (!defined('ABSPATH')) { exit; }

/**
 * REST surface of the Mutqan web app: /wp-json/mutqan/v1/{db,auth,team,ai,upload,push,geocode,config}
 * plus serving the built app at /app/.
 */
final class Mutqan_Rest {
    const NS = 'mutqan/v1';

    public static function boot() {
        add_action('init', ['Mutqan_Store', 'maybe_install'], 1);
        add_action('init', [__CLASS__, 'serve_app'], 2);
        add_action('rest_api_init', [__CLASS__, 'routes']);
        // Cross-origin use (the static Oxygen front on oxygen11.com talks to this API). Token auth, no cookies -> safe to allow the brand origins.
        add_action('rest_api_init', function () {
            add_filter('rest_pre_serve_request', function ($served) {
                $o = isset($_SERVER['HTTP_ORIGIN']) ? (string) $_SERVER['HTTP_ORIGIN'] : '';
                if ($o !== '' && preg_match('#^https://([a-z0-9-]+\.)?oxygen11\.com$#i', $o)) {
                    header('Access-Control-Allow-Origin: ' . $o);
                    header('Vary: Origin');
                    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Mutqan-Token, X-Mutqan-Anon, X-WP-Nonce');
                    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
                }
                return $served;
            });
        }, 20);
        add_action('mutqan_purge', ['Mutqan_Store', 'purge_expired']);
        add_action('mutqan_remind', [__CLASS__, 'send_reminders']);
        add_action('init', function () { if (!wp_next_scheduled('mutqan_remind')) { wp_schedule_event(time() + 120, 'mutqan_5min', 'mutqan_remind'); } }, 3);
        add_filter('cron_schedules', function ($s) { $s['mutqan_5min'] = ['interval' => 300, 'display' => 'Mutqan 5 min']; return $s; });
        add_action('init', function () { if (!wp_next_scheduled('mutqan_purge')) { wp_schedule_event(time() + 600, 'daily', 'mutqan_purge'); } }, 3);
    }

    /* ------------------------------------------------------------------ routing */

    public static function routes() {
        foreach (['db', 'auth', 'team', 'ai', 'push', 'promo', 'wa', 'shop'] as $name) {
            register_rest_route(self::NS, '/' . $name, [
                'methods' => 'POST', 'permission_callback' => '__return_true',
                'callback' => function ($req) use ($name) { return self::guard($req, [__CLASS__, 'h_' . $name]); },
            ]);
        }
        register_rest_route(self::NS, '/wa-hook', ['methods' => 'POST', 'permission_callback' => '__return_true',
            'callback' => function ($req) {
                try { $out = Mutqan_WA::webhook((string) $req->get_body(), (string) $req->get_header('x-mq-signature')); $res = new WP_REST_Response(['data' => $out], 200); }
                catch (Mutqan_Error $e) { $res = new WP_REST_Response(['error' => ['code' => $e->slug, 'message' => $e->getMessage()]], $e->status); }
                catch (Throwable $e) { error_log('[mutqan] wa-hook ' . $e->getMessage()); $res = new WP_REST_Response(['error' => ['code' => 'server_error']], 500); }
                $res->header('Cache-Control', 'no-store');
                return $res;
            }]);
        register_rest_route(self::NS, '/upload', ['methods' => 'POST', 'permission_callback' => '__return_true',
            'callback' => function ($req) { return self::guard($req, [__CLASS__, 'h_upload']); }]);
        register_rest_route(self::NS, '/geocode', ['methods' => 'GET', 'permission_callback' => '__return_true',
            'callback' => function ($req) { return self::guard($req, [__CLASS__, 'h_geocode']); }]);
        register_rest_route(self::NS, '/config', ['methods' => 'GET', 'permission_callback' => '__return_true',
            'callback' => function ($req) { return self::guard($req, [__CLASS__, 'h_config']); }]);
    }

    private static function guard($req, $fn) {
        try {
            Mutqan_Auth::reset_memo();
            $p = Mutqan_Auth::principal($req);
            $out = call_user_func($fn, $req, $p);
            $res = new WP_REST_Response(['data' => $out], 200);
        } catch (Mutqan_Error $e) {
            $res = new WP_REST_Response(['error' => ['code' => $e->slug, 'message' => $e->getMessage()]], $e->status);
        } catch (Throwable $e) {
            error_log('[mutqan] ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine());
            $res = new WP_REST_Response(['error' => ['code' => 'server_error', 'message' => 'حدث خطأ في الخادم.']], 500);
        }
        $res->header('Cache-Control', 'no-store');
        return $res;
    }

    private static function body($req) {
        $b = $req->get_json_params();
        return is_array($b) ? $b : [];
    }

    /* ------------------------------------------------------------------ /db */

    public static function h_db($req, $p) {
        $in = self::body($req);
        if (($in['op'] ?? '') === 'batch') {
            $out = [];
            foreach (array_slice((array) ($in['ops'] ?? []), 0, 20) as $one) {
                try { $out[] = ['ok' => true, 'data' => self::db_one(is_array($one) ? $one : [], $p)]; }
                catch (Mutqan_Error $e) { $out[] = ['ok' => false, 'error' => ['code' => $e->slug, 'message' => $e->getMessage()], 'status' => $e->status]; }
            }
            return $out;
        }
        return self::db_one($in, $p);
    }

    private static function db_one($in, $p) {
        $op = (string) ($in['op'] ?? '');
        $coll = (string) ($in['coll'] ?? '');
        $filters = isset($in['filters']) && is_array($in['filters']) ? $in['filters'] : [];
        $opts = isset($in['opts']) && is_array($in['opts']) ? $in['opts'] : [];
        $private = in_array($op, ['select', 'count', 'insert', 'update', 'delete'], true);
        if ($private && ($p['kind'] ?? 'guest') === 'guest') { throw new Mutqan_Error('unauthorized', 'سجّل الدخول أو افتح التطبيق من جديد.', 401); }
        $write = in_array($op, ['insert', 'insertShared', 'update', 'updateShared', 'upsertShared', 'delete', 'deleteShared'], true);
        if ($write && !Mutqan_Policy::is_staff($p)) { Mutqan_Limiter::hit('db_write', 240, 600); }

        switch ($op) {
            case 'select': case 'selectShared': return Mutqan_Store::select($coll, $filters, $opts, $p, $private);
            case 'count': case 'countShared': return Mutqan_Store::count($coll, $filters, $p, $private);
            case 'groupByShared': return Mutqan_Store::group_by($coll, (string) ($in['field'] ?? ''), $filters, (int) ($opts['limit'] ?? 20), $p);
            case 'sumShared': return Mutqan_Store::sum($coll, (string) ($in['field'] ?? ''), $filters, $p);
            case 'stamps': {
                $out = [];
                foreach (array_slice((array) ($in['topics'] ?? []), 0, 30) as $c) { $out[(string) $c] = Mutqan_Store::stamp((string) $c, $p); }
                return $out;
            }
            case 'insert': case 'insertShared': {
                $doc = Mutqan_Store::insert($coll, $in['data'] ?? [], $in['id'] ?? null, $opts, $p, $private);
                if ($coll === 'orders' && !$private) { self::after_order_created($doc); self::alert_new_order($doc); }
                if ($coll === 'tech_applications' && !$private) { self::alert_tech_application($doc); }
                return $doc;
            }
            case 'update': case 'updateShared': return Mutqan_Store::update($coll, $in['id'] ?? '', $in['data'] ?? [], $p);
            case 'upsertShared': return Mutqan_Store::upsert($coll, $in['data'] ?? [], $in['id'] ?? null, $opts, $p);
            case 'delete': case 'deleteShared': return ['deleted' => Mutqan_Store::delete($coll, $in['id'] ?? '', $p, $private)];
        }
        throw new Mutqan_Error('bad_op', 'عملية غير معروفة.', 400);
    }

    /** Reaches every admin (owner, operations, supervisor): push + a row in the notification center. */
    public static function admin_alert($title, $body, $url, $event, $priority = 'high', $orderId = null) {
        $sys = ['id' => 'system', 'role' => 'owner', 'powers' => ['read', 'write', 'manage'], 'kind' => 'user'];
        try {
            Mutqan_Store::insert('_push', ['target' => ['admins' => true], 'title' => mb_substr($title, 0, 120), 'body' => mb_substr($body, 0, 300), 'url' => $url, 'sound' => 'bell', 'priority' => $priority, 'event' => $event, 'from' => 'system'], null, ['expiresAt' => gmdate('c', time() + 7 * 86400)], $sys);
            Mutqan_Store::insert('notifications', ['userId' => null, 'audience' => 'ops', 'event' => $event, 'title' => mb_substr($title, 0, 120), 'body' => mb_substr($body, 0, 300), 'url' => $url, 'orderId' => $orderId, 'priority' => $priority, 'read' => false, 'at' => gmdate('c')], null, ['visibleTo' => 'creator-and-admin', 'writableBy' => 'admins', 'expiresAt' => gmdate('c', time() + 60 * 86400)], $sys);
        } catch (Throwable $e) { error_log('[mutqan] admin_alert: ' . $e->getMessage()); }
    }

    /** Top priority: every new order alerts the whole admin team immediately, server-side (cannot be skipped by the client). */
    private static function alert_new_order($doc) {
        $urgent = (($doc['priority'] ?? '') === 'urgent');
        $bits = array_filter([(string) ($doc['clientName'] ?? ''), mb_substr((string) ($doc['address'] ?? ''), 0, 40), !empty($doc['inhouse']) ? 'تنفيذ داخلي' : '']);
        $ops = (($doc['routing'] ?? '') === 'operations');
        self::admin_alert(($urgent ? '🚨 طلب عاجل جديد' : ($ops ? '📋 طلب بانتظار التوزيع' : '🆕 طلب جديد')) . (!empty($doc['specialtyId']) ? ' — ' . $doc['specialtyId'] : ''), implode(' · ', $bits) ?: 'طلب خدمة جديد بانتظار المعالجة', '#/staff/order/' . $doc['id'], 'new_order', 'high', $doc['id']);
    }

    private static function alert_tech_application($doc) {
        self::admin_alert('👷 طلب انضمام فني جديد', trim((string) ($doc['name'] ?? $doc['fullName'] ?? '') . ' ' . (string) ($doc['specialty'] ?? $doc['specialtyId'] ?? '')) ?: 'طلب جديد بانتظار المراجعة', '#/staff/tech-requests', 'tech_application', 'high');
    }

    /** New order -> WhatsApp message to the owner (if Cloud API is configured in "الشات بوت والطلبات"). */
    private static function after_order_created($doc) {
        if (!class_exists('Oxygen_Orders_Chat') || !method_exists('Oxygen_Orders_Chat', 'whatsapp_owner')) { return; }
        $lines = ['طلب جديد من تطبيق متقن #' . substr((string) $doc['id'], -6)];
        if (!empty($doc['specialtyId'])) { $lines[] = 'الخدمة: ' . $doc['specialtyId']; }
        if (!empty($doc['description'])) { $lines[] = 'التفاصيل: ' . mb_substr((string) $doc['description'], 0, 300); }
        $price = $doc['agreedPrice'] ?? ($doc['priceQuote']['total'] ?? null);
        if ($price) { $lines[] = 'السعر: ' . $price; }
        if (!empty($doc['clientName'])) { $lines[] = 'الاسم: ' . $doc['clientName']; }
        if (!empty($doc['clientPhone'])) { $lines[] = 'الجوال: ' . $doc['clientPhone']; }
        if (!empty($doc['address'])) { $lines[] = 'العنوان: ' . $doc['address']; }
        if (isset($doc['lat'], $doc['lng']) && is_numeric($doc['lat']) && is_numeric($doc['lng'])) { $lines[] = 'الموقع: https://maps.google.com/?q=' . $doc['lat'] . ',' . $doc['lng']; }
        try { Oxygen_Orders_Chat::whatsapp_owner(implode("\n", $lines)); } catch (Throwable $e) { error_log('[mutqan] whatsapp notify failed: ' . $e->getMessage()); }
    }

    public static function h_wa($req, $p) {
        if (($p['kind'] ?? 'guest') !== 'user') { throw new Mutqan_Error('unauthorized', 'سجّل الدخول.', 401); }
        return Mutqan_WA::handle(self::body($req), $p);
    }

    public static function h_shop($req, $p) {
        return Mutqan_Shop::handle(self::body($req), $p);
    }

    public static function h_promo($req, $p) {
        $in = self::body($req);
        Mutqan_Limiter::hit('promo', 60, 3600);
        $dev = $in['deviceId'] ?? '';
        $op = (string) ($in['op'] ?? 'status');
        if ($op === 'claim') { list($st, $pct) = Mutqan_Promo::claim($dev); }
        else { list($st, $pct) = Mutqan_Promo::status($dev); }
        return ['state' => $st, 'pct' => $pct, 'max' => Mutqan_Promo::MAX_OFF];
    }

    /* ------------------------------------------------------------------ /auth, /team */

    public static function h_auth($req, $p) {
        $in = self::body($req);
        switch ((string) ($in['op'] ?? '')) {
            case 'signup': return Mutqan_Auth::signup_customer($in);
            case 'login': return Mutqan_Auth::login($in, false);
            case 'logout': return Mutqan_Auth::logout($req);
            case 'me': return Mutqan_Auth::me($p);
            case 'profile': return Mutqan_Auth::update_profile($p, $in);
            case 'password': return Mutqan_Auth::change_password($p, $in);
        }
        throw new Mutqan_Error('bad_op', 'عملية غير معروفة.', 400);
    }

    public static function h_team($req, $p) {
        $in = self::body($req);
        return Mutqan_Auth::team_op((string) ($in['op'] ?? ''), $in, $p);
    }

    /* ------------------------------------------------------------------ /ai */

    public static function h_ai($req, $p) {
        $in = self::body($req);
        if (($p['kind'] ?? 'guest') === 'guest') { throw new Mutqan_Error('unauthorized', 'افتح التطبيق من جديد.', 401); }
        return Mutqan_AI::run($in['prompt'] ?? '', is_array($in['opts'] ?? null) ? $in['opts'] : [], $p);
    }

    /* ------------------------------------------------------------------ /push (in-app notifications) */

    /** 15 minutes before a booked appointment: push to the customer (account) and to the team. Runs from cron and, throttled, from inbox polls. */
    public static function send_reminders() {
        $sys = ['id' => 'system', 'role' => 'owner', 'powers' => ['read', 'write', 'manage'], 'kind' => 'user'];
        try {
            $rows = Mutqan_Store::select('orders', ['appointmentAt' => ['gte' => gmdate('Y-m-d')]], ['limit' => 200], $sys);
        } catch (Throwable $e) { return 0; }
        $now = time(); $n = 0;
        foreach ($rows as $o) {
            if (!empty($o['remindedAt']) || empty($o['appointmentAt'])) { continue; }
            if (in_array($o['status'] ?? '', ['completed', 'cancelled', 'done', 'closed'], true)) { continue; }
            $at = strtotime((string) $o['appointmentAt']);
            if (!$at || $at - $now > 15 * 60 || $at - $now < -30 * 60) { continue; }
            $when = !empty($o['preferredTime']) ? $o['preferredTime'] : 'قريباً';
            try {
                Mutqan_Store::update('orders', $o['id'], ['remindedAt' => gmdate('c')], $sys);
                $exp = ['expiresAt' => gmdate('c', time() + 2 * 86400)];
                if (!empty($o['clientId'])) {
                    Mutqan_Store::insert('_push', ['target' => ['user' => (string) $o['clientId']], 'title' => '⏰ موعدك بعد 15 دقيقة', 'body' => 'موعد خدمتك: ' . $when, 'url' => '#/order/' . $o['id'], 'sound' => 'bell', 'priority' => 'high', 'event' => 'appointment_reminder', 'from' => 'system'], null, $exp, $sys);
                }
                self::admin_alert('⏰ موعد خلال 15 دقيقة', trim((string) ($o['clientName'] ?? '') . ' · ' . $when . ' · ' . mb_substr((string) ($o['address'] ?? ''), 0, 40)), '#/staff/order/' . $o['id'], 'appointment_reminder', 'high', $o['id']);
                $n++;
            } catch (Throwable $e) { error_log('[mutqan] reminder: ' . $e->getMessage()); }
        }
        return $n;
    }

    public static function h_push($req, $p) {
        $in = self::body($req);
        $op = (string) ($in['op'] ?? '');
        if ($op === 'inbox' && !get_transient('mutqan_rem_lock')) { set_transient('mutqan_rem_lock', 1, 60); self::send_reminders(); }
        if (($p['kind'] ?? 'guest') === 'guest') { throw new Mutqan_Error('unauthorized', 'افتح التطبيق من جديد.', 401); }
        if ($op === 'inbox') {
            $raw = $in['since'] ?? 0;
            if (is_numeric($raw) && $raw > 100000000000) { $raw = (int) ($raw / 1000); }   // browsers send milliseconds
            $since = Mutqan_Store::to_db_time($raw) ?: gmdate('Y-m-d H:i:s', time() - 3600);
            $items = Mutqan_Store::select('_push', [], ['limit' => 100, 'order' => 'createdAt'], ['id' => 'system', 'role' => 'owner', 'powers' => ['read', 'write', 'manage'], 'kind' => 'user'], false);
            $out = [];
            foreach ($items as $m) {
                if (Mutqan_Store::to_db_time($m['createdAt']) < $since) { continue; }   // '<' not '<=': the client de-duplicates by id
                $t = $m['target'] ?? [];
                $mine = (isset($t['user']) && $t['user'] === $p['id'])
                    || (isset($t['role']) && $t['role'] === ($p['role'] ?? '#'))
                    || (!empty($t['admins']) && Mutqan_Policy::has_power($p, 'read'));
                if ($mine) { $out[] = ['id' => $m['id'], 'title' => $m['title'] ?? '', 'body' => $m['body'] ?? '', 'url' => $m['url'] ?? '', 'sound' => $m['sound'] ?? null, 'priority' => $m['priority'] ?? 'normal', 'event' => $m['event'] ?? null, 'at' => $m['createdAt']]; }
            }
            return ['items' => $out, 'now' => Mutqan_Store::iso(Mutqan_Store::now())];
        }
        if ($op === 'send') {
            Mutqan_Limiter::hit('push_send', Mutqan_Policy::is_staff($p) ? 400 : 40, 3600);
            $t = $in['target'] ?? [];
            $target = [];
            if (!empty($t['user'])) { $target['user'] = (string) $t['user']; }
            elseif (!empty($t['role']) && in_array($t['role'], ['operations', 'supervisor', 'technician'], true)) { $target['role'] = $t['role']; }
            else { $target['admins'] = true; }
            if (!Mutqan_Policy::is_staff($p) && !isset($target['admins']) && !isset($target['role'])) {
                if (($target['user'] ?? '') !== $p['id']) { throw new Mutqan_Error('forbidden', 'غير مسموح.', 403); }
            }
            $msg = isset($in['message']) && is_array($in['message']) ? $in['message'] : [];
            $doc = [
                'target' => $target, 'title' => mb_substr((string) ($msg['title'] ?? ''), 0, 120), 'body' => mb_substr((string) ($msg['body'] ?? ''), 0, 300),
                'url' => mb_substr((string) ($msg['url'] ?? ''), 0, 200), 'sound' => isset($msg['sound']) ? mb_substr((string) $msg['sound'], 0, 20) : null, 'from' => $p['id'],
                'priority' => (Mutqan_Policy::is_staff($p) && ($msg['priority'] ?? '') === 'high') ? 'high' : 'normal', 'event' => isset($msg['event']) ? preg_replace('/[^a-z_]/', '', mb_substr((string) $msg['event'], 0, 30)) : null,
            ];
            $sys = ['id' => 'system', 'role' => 'owner', 'powers' => ['read', 'write', 'manage'], 'kind' => 'user'];
            Mutqan_Store::insert('_push', $doc, null, ['expiresAt' => gmdate('c', time() + 7 * 86400)], $sys, false);
            return ['ok' => true];
        }
        throw new Mutqan_Error('bad_op', 'عملية غير معروفة.', 400);
    }

    /* ------------------------------------------------------------------ /upload */

    public static function h_upload($req, $p) {
        if (($p['kind'] ?? '') !== 'user') { throw new Mutqan_Error('unauthorized', 'سجّل الدخول لرفع الملفات.', 401); }
        Mutqan_Limiter::hit('upload', Mutqan_Policy::is_staff($p) ? 120 : 20, 3600);
        $files = $req->get_file_params();
        $f = $files['file'] ?? null;
        if (!$f || !isset($f['tmp_name']) || $f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) { throw new Mutqan_Error('no_file', 'لم يصل ملف.', 400); }
        if ($f['size'] > 6 * 1024 * 1024) { throw new Mutqan_Error('too_large', 'الحد الأقصى للملف 6 ميجابايت.', 413); }
        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif', 'application/pdf' => 'pdf'];
        $mime = function_exists('finfo_open') ? finfo_file(finfo_open(FILEINFO_MIME_TYPE), $f['tmp_name']) : '';
        if (!isset($allowed[$mime])) { throw new Mutqan_Error('bad_type', 'نوع الملف غير مدعوم (صور أو PDF فقط).', 415); }
        $up = wp_upload_dir();
        $dir = trailingslashit($up['basedir']) . 'mutqan/' . gmdate('Y/m');
        if (!wp_mkdir_p($dir)) { throw new Mutqan_Error('server_error', 'تعذر حفظ الملف.', 500); }
        @file_put_contents(trailingslashit($up['basedir']) . 'mutqan/index.html', '');
        $name = bin2hex(random_bytes(12)) . '.' . $allowed[$mime];
        if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) { throw new Mutqan_Error('server_error', 'تعذر حفظ الملف.', 500); }
        return ['url' => trailingslashit($up['baseurl']) . 'mutqan/' . gmdate('Y/m') . '/' . $name];
    }

    /* ------------------------------------------------------------------ /geocode (OpenStreetMap Nominatim, cached) */

    public static function h_geocode($req, $p) {
        if (($p['kind'] ?? 'guest') === 'guest') { throw new Mutqan_Error('unauthorized', 'افتح التطبيق من جديد.', 401); }
        $lat = (float) $req->get_param('lat'); $lng = (float) $req->get_param('lng');
        if (abs($lat) > 90 || abs($lng) > 180 || ($lat == 0 && $lng == 0)) { throw new Mutqan_Error('bad_coords', 'إحداثيات غير صالحة.', 400); }
        $key = 'mq_geo_' . md5(round($lat, 3) . ',' . round($lng, 3));
        $hit = get_transient($key);
        if (is_array($hit)) { return $hit; }
        Mutqan_Limiter::hit('geocode', 30, 3600);
        $res = wp_remote_get('https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=ar&zoom=18&lat=' . $lat . '&lon=' . $lng, [
            'timeout' => 10, 'headers' => ['User-Agent' => 'OxygenMutqan/1.0 (' . home_url('/') . ')'],
        ]);
        $addr = '';
        if (!is_wp_error($res) && (int) wp_remote_retrieve_response_code($res) === 200) {
            $d = json_decode(wp_remote_retrieve_body($res), true);
            if (is_array($d)) {
                $a = $d['address'] ?? [];
                $parts = array_filter([$a['road'] ?? '', $a['neighbourhood'] ?? ($a['suburb'] ?? ''), $a['city'] ?? ($a['town'] ?? ($a['state'] ?? ''))]);
                $addr = $parts ? implode('، ', $parts) : (string) ($d['display_name'] ?? '');
            }
        }
        $out = ['address' => $addr];
        if ($addr !== '') { set_transient($key, $out, 30 * DAY_IN_SECONDS); }
        return $out;
    }

    /* ------------------------------------------------------------------ /config */

    public static function h_config($req, $p) {
        $ai = Mutqan_AI::any_enabled();
        $wa = false;
        if (class_exists('Oxygen_Orders_Chat')) { $s = Oxygen_Orders_Chat::get(); $wa = $s['wa_token'] !== '' && $s['wa_phone_id'] !== '' && $s['wa_owner'] !== ''; }
        return ['ai' => ['available' => $ai], 'whatsapp' => ['connected' => $wa], 'ownerReady' => Mutqan_Auth::owner_exists(), 'time' => Mutqan_Store::iso(Mutqan_Store::now())];
    }

    /* ------------------------------------------------------------------ serving /app/ */

    public static function app_dir() { return plugin_dir_path(dirname(dirname(__FILE__))) . 'app/'; }

    private static function serve_pwa_file($name) {
        $file = self::app_dir() . $name;
        if (!is_readable($file)) { status_header(404); exit; }
        $types = ['js' => 'application/javascript; charset=utf-8', 'webmanifest' => 'application/manifest+json; charset=utf-8', 'png' => 'image/png', 'svg' => 'image/svg+xml'];
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $body = (string) file_get_contents($file);
        $app_path = (string) wp_parse_url(home_url('/app/'), PHP_URL_PATH);
        if ($ext === 'js') { $body = str_replace('__BUILD__', (string) (int) @filemtime(self::app_dir() . 'index.html'), $body); }
        if ($ext === 'webmanifest') { $body = str_replace('__APP__', $app_path, $body); }
        header('Content-Type: ' . $types[$ext]);
        header('X-Content-Type-Options: nosniff');
        if ($ext === 'js') { header('Service-Worker-Allowed: ' . $app_path); header('Cache-Control: no-cache'); }
        elseif ($ext === 'webmanifest') { header('Cache-Control: no-cache'); }
        else { header('Cache-Control: public, max-age=86400'); }
        echo $body;
        exit;
    }

    public static function serve_app() {
        if (empty($_SERVER['REQUEST_URI']) || (defined('WP_CLI') && WP_CLI) || (defined('DOING_CRON') && DOING_CRON) || (defined('DOING_AJAX') && DOING_AJAX)) { return; }
        $path = isset($_SERVER['REQUEST_URI']) ? (string) wp_parse_url(wp_unslash($_SERVER['REQUEST_URI']), PHP_URL_PATH) : '';
        $base = rtrim((string) wp_parse_url(home_url('/'), PHP_URL_PATH), '/');
        $rel = substr($path, strlen($base));
        // PWA files must live under /app/ so the service worker's scope covers the app (plugin dir paths would not).
        if (preg_match('#^/app/(sw\.js|manifest\.webmanifest|icon-192\.png|icon-512\.png|icon-maskable-512\.png|apple-touch-icon\.png|icon\.svg)$#', $rel, $m)) { self::serve_pwa_file($m[1]); }
        if (preg_match('#^/pay/([A-Za-z0-9]{8})/?$#', $rel, $pm) && (!isset($_SERVER['REQUEST_METHOD']) || in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD'], true))) { Mutqan_Shop::pay_page($pm[1]); }
        if (preg_match('#^/v/([A-Za-z0-9-]{8,16})/?$#', $rel, $vm) && (!isset($_SERVER['REQUEST_METHOD']) || in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD'], true))) { Mutqan_Shop::seal_page(strtoupper(substr($vm[1], 0, 8)) . substr($vm[1], 8)); }
        $is_root = ($rel === '' || $rel === '/');
        if ($is_root) {
            // Domain front page opens the app (owner can switch it off in the Mutqan settings; ?site=wp bypasses it).
            if (get_option('mutqan_root_app2', '1') === '0') { return; }
            if (!empty($_GET['site']) || (defined('REST_REQUEST') && REST_REQUEST) || (function_exists('is_admin') && is_admin())) { return; }
            // Only a clean front-page visit (tracking params allowed) opens the app; any other query (rest_route, cron, preview, search…) is left to WordPress.
            foreach (array_keys($_GET) as $k) { if (!preg_match('/^(utm_[a-z_]+|fbclid|gclid|ref|source|v|pwa)$/i', (string) $k)) { return; } }
            if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'HEAD') { return; }
        } elseif ($rel !== '/app' && $rel !== '/app/' && $rel !== '/app/index.html') { return; }
        if ($rel === '/app') { wp_safe_redirect(home_url('/app/') . (isset($_SERVER['QUERY_STRING']) && $_SERVER['QUERY_STRING'] !== '' ? '?' . $_SERVER['QUERY_STRING'] : '')); exit; }
        $file = self::app_dir() . 'index.html';
        nocache_headers();
        header('Content-Type: text/html; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        if (!is_readable($file)) {
            status_header(503);
            echo '<!doctype html><meta charset="utf-8"><title>متقن</title><body dir="rtl" style="font-family:Tahoma;padding:2rem">التطبيق قيد الإعداد: لم يُرفع ملف الواجهة بعد.</body>';
            exit;
        }
        $html = (string) file_get_contents($file);
        $cfg = wp_json_encode(['api' => esc_url_raw(rest_url(self::NS)), 'app' => home_url('/app/')], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES);
        $inject = '<script>window.__MUTQAN__=' . $cfg . ';</script>';
        if ($is_root) { $inject .= '<link rel="canonical" href="' . esc_url(home_url('/')) . '">'; }
        $app_path = (string) wp_parse_url(home_url('/app/'), PHP_URL_PATH);
        $html = str_replace(['href="./manifest.webmanifest"', 'href="./icon.svg"'], ['href="' . esc_attr($app_path) . 'manifest.webmanifest"', 'href="' . esc_attr($app_path) . 'apple-touch-icon.png"'], $html);
        $html = preg_replace('/<head>/i', '<head>' . $inject, $html, 1);
        echo $html;
        exit;
    }
}
