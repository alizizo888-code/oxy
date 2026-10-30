<?php
if (!defined('ABSPATH')) { exit; }

/**
 * Who may read / write what. The browser can ask for anything; this class decides.
 *
 * Principal: ['id' => string, 'role' => ?string, 'kind' => 'user'|'anon'|'guest', 'powers' => string[]]
 *   - role: owner | operations | supervisor | technician (null for customers and visitors)
 *   - powers: subset of read|write|manage granted to the role (owner has everything)
 */
final class Mutqan_Policy {
    const STAFF_ROLES = ['owner', 'operations', 'supervisor', 'technician'];
    const OWNER_ONLY_AI_KEYS = ['globalPolicy', 'permissions', 'providers', 'costs', 'privacy'];

    /** collection => [read, insert, update, delete]. See can() for each rule's meaning. */
    private static function rules($coll) {
        static $R = null;
        if ($R === null) {
            $pub = ['public', 'write', 'write', 'write'];
            $R = [
                'pricing' => $pub, 'offers' => $pub, 'ac_media' => $pub, 'products' => $pub, 'coverage' => $pub,
                'warranty_policy' => $pub, 'payment_methods' => $pub, 'wa_numbers' => $pub,
                'notify_settings' => $pub, 'ai_settings' => $pub,
                'used_ac' => $pub, 'schedule_cfg' => $pub,
                'used_ac_private' => ['read', 'write', 'write', 'write'], 'used_offers' => ['read', 'write', 'write', 'write'], 'order_seals' => ['read', 'write', 'write', 'write'], 'pay_links' => ['read', 'write', 'write', 'write'],
                'assignment_settings' => ['staff', 'write', 'write', 'write'], 'tech_pay' => ['staff', 'write', 'write', 'write'],
                'pricing_internal' => ['read', 'write', 'write', 'write'],
                'tech_profiles' => ['staff', 'authed', 'creator_or_write', 'write'],
                'tech_applications' => ['creator_or_read', 'authed', 'write', 'write'],
                'orders' => ['orders', 'anon_ok', 'orders', 'write'],
                'customers' => ['creator_or_read', 'authed', 'creator_or_write', 'write'],
                'handoffs' => ['creator_or_read', 'anon_ok', 'staff_or_creator', 'write'],
                'calls' => ['creator_or_read', 'anon_ok', 'staff_or_creator', 'write'],
                'notifications' => ['creator_or_read', 'authed', 'target_or_write', 'write'],
                'warranties' => ['read', 'write', 'write', 'write'],
                'warranty_claims' => ['creator_or_read', 'authed', 'write', 'write'],
                'wa_threads' => ['read', 'write', 'write', 'write'], 'wa_msgs' => ['read', 'write', 'write', 'write'], 'wa_bot' => ['read', 'write', 'write', 'write'],
                'customer_profiles' => ['read', 'write', 'write', 'write'],
                'shops' => ['staff', 'write', 'write', 'write'],
                'wa_leads' => ['read', 'anon_ok', 'write', 'write'],
                'ai_logs' => ['read', 'anon_ok', 'write', 'write'],
                '_ai_usage' => ['read', 'anon_ok', 'write', 'write'],
                '_ai_audit' => ['read', 'anon_ok', 'write', 'write'],
                '_push' => ['never', 'never', 'never', 'never'],
            ];
        }
        return $R[$coll] ?? ['creator_or_read', 'authed', 'creator_or_write', 'write'];
    }

    public static function is_staff($p) { return !empty($p['role']) && in_array($p['role'], self::STAFF_ROLES, true); }
    public static function has_power($p, $power) {
        if (($p['role'] ?? null) === 'owner') { return true; }
        return in_array($power, $p['powers'] ?? [], true);
    }

    private static function jx($field) {
        $path = '$.' . $field;
        return Mutqan_Store::is_sqlite() ? "json_extract(data,'$path')" : "JSON_UNQUOTE(JSON_EXTRACT(data,'$path'))";
    }
    private static function jx_null($field) {
        $e = self::jx($field);
        return Mutqan_Store::is_sqlite() ? "$e IS NULL" : "($e IS NULL OR $e='null')";
    }

    /* ------------------------------------------------------------------ read scope (SQL) */

    /** @return array [string where-clause ('' = no restriction, '0' = nothing visible), array params] */
    /** Internal principal used by server code (push queue). Real ids are 'u-…' / 'anon-…', so nobody can claim it. */
    private static function is_system($p) { return ($p['id'] ?? '') === 'system'; }

    public static function read_clause($coll, $p) {
        if (self::is_system($p)) { return ['', []]; }
        $rule = self::rules($coll)[0];
        $me = $p['id'];
        $isUser = ($p['kind'] ?? '') !== 'guest';
        switch ($rule) {
            case 'public': return ['', []];
            case 'staff': return self::is_staff($p) ? ['', []] : ['0', []];
            case 'read': return self::has_power($p, 'read') ? ['', []] : ['0', []];
            case 'creator':
                return $isUser ? ['owner_id=%s', [$me]] : ['0', []];
            case 'creator_or_read':
                if (self::has_power($p, 'read')) { return ['', []]; }
                return $isUser ? ['(owner_id=%s OR visible_to=%s)', [$me, 'user:' . $me]] : ['0', []];
            case 'orders':
                if (self::has_power($p, 'read')) { return ['', []]; }
                if (!$isUser) { return ['0', []]; }
                if (($p['role'] ?? null) === 'technician') {
                    return ['(owner_id=%s OR ' . self::jx('technicianId') . '=%s OR ' . self::jx_null('technicianId') . ')', [$me, $me]];
                }
                return ['(owner_id=%s OR ' . self::jx('clientId') . '=%s)', [$me, $me]];
        }
        return ['0', []];
    }

    /* ------------------------------------------------------------------ per-document checks */

    public static function can($action, $coll, $p, $row = null, $data = null) {
        if (self::is_system($p)) { return true; }
        $rules = self::rules($coll);
        $rule = $rules[['read' => 0, 'insert' => 1, 'update' => 2, 'delete' => 3][$action]];
        $me = $p['id'];
        $kind = $p['kind'] ?? 'guest';
        $creator = $row && $row['owner_id'] === $me && $kind !== 'guest';
        switch ($rule) {
            case 'public': return true;
            case 'anon_ok': return $kind !== 'guest';
            case 'authed': return $kind === 'user';
            case 'staff': return self::is_staff($p);
            case 'read': return self::has_power($p, 'read');
            case 'write': return self::has_power($p, 'write');
            case 'creator_or_read': return $creator || self::has_power($p, 'read');
            case 'creator_or_write': return $creator || self::has_power($p, 'write');
            case 'staff_or_creator': return $creator || self::is_staff($p);
            case 'target_or_write':
                if (self::has_power($p, 'write')) { return true; }
                if (!$row) { return false; }
                return $row['visible_to'] === 'user:' . $me && self::fields_ok($row, $data);
            case 'orders':
                if (self::has_power($p, 'write')) { return true; }
                if ($kind === 'guest') { return false; }
                if ($creator) { return true; }
                if (!$row) { return false; }
                $old = json_decode($row['data'], true) ?: [];
                if (($p['role'] ?? null) === 'technician') {
                    $tid = $old['technicianId'] ?? null;
                    return $tid === null || $tid === $me;
                }
                return false;
        }
        return false;
    }

    private static function fields_ok($row, $patch) {
        if (!is_array($patch) || empty($row['writable_fields'])) { return true; }
        $allowed = json_decode($row['writable_fields'], true);
        if (!is_array($allowed)) { return true; }
        foreach (array_keys($patch) as $k) { if (!in_array($k, $allowed, true)) { return false; } }
        return true;
    }

    public static function require_can($action, $coll, $p, $row = null, $data = null) {
        if (!self::can($action, $coll, $p, $row, $data)) {
            throw new Mutqan_Error('forbidden', 'غير مسموح لك بهذا الإجراء.', ($p['kind'] ?? 'guest') === 'guest' ? 401 : 403);
        }
    }

    /** Non-privileged users may only create their own profile document (id == their user id). */
    public static function check_insert_id($coll, $id, $p) {
        if ($coll === 'tech_profiles' && !self::has_power($p, 'write') && $id !== $p['id']) {
            throw new Mutqan_Error('forbidden', 'غير مسموح لك بهذا الإجراء.', 403);
        }
        if ($coll === 'customers' && !self::has_power($p, 'write') && $id !== 'cust-' . $p['id']) {
            throw new Mutqan_Error('forbidden', 'غير مسموح لك بهذا الإجراء.', 403);
        }
    }

    /** Visibility a document is stored with, whatever the browser asked for. */
    public static function force_visibility($coll, $requested, $p) {
        $public = ['pricing', 'offers', 'ac_media', 'products', 'used_ac', 'schedule_cfg', 'coverage', 'warranty_policy', 'payment_methods', 'wa_numbers', 'notify_settings', 'ai_settings'];
        if (in_array($coll, $public, true)) { return 'everyone'; }
        if ($coll === 'tech_profiles' || $coll === 'assignment_settings') { return 'group'; }
        if ($coll === 'notifications') {
            if (self::is_staff($p) && preg_match('/^user:[A-Za-z0-9_.:@-]{1,48}$/', $requested)) { return $requested; }
            return $requested === 'user:' . $p['id'] ? $requested : 'creator-and-admin';
        }
        return 'creator-and-admin';
    }

    /* ------------------------------------------------------------------ write sanitising */

    /** Owner switch (pricing/ops_mode): when on, new customer orders are executed in-house. */
    public static function inhouse_mode() {
        try { $d = Mutqan_Store::peek_doc('pricing', 'ops_mode'); } catch (Throwable $e) { return false; }
        return !empty($d['inhouse']);
    }
    /** Owner switches (pricing/order_routing): where new orders go, and whether operations may create orders by hand. */
    public static function routing() {
        try { $d = Mutqan_Store::peek_doc('pricing', 'order_routing'); } catch (Throwable $e) { $d = []; }
        return ['mode' => (($d['mode'] ?? '') === 'operations') ? 'operations' : 'whatsapp', 'opsCreate' => !empty($d['opsCreate'])];
    }
    /** Payment links must be https and bounded; anything else is dropped. */
    public static function clean_pay_url($u) {
        if (!is_string($u)) { return null; }
        $u = trim($u);
        return (strlen($u) <= 600 && preg_match('#^https://[^\s<>"\']+$#i', $u)) ? $u : null;
    }
    private static function clean_pay_fields($coll, $data) {
        if ($coll === 'payment_methods' && array_key_exists('payUrl', $data) && $data['payUrl'] !== '') { $data['payUrl'] = self::clean_pay_url($data['payUrl']) ?? ''; }
        if ($coll === 'orders' && array_key_exists('payLink', $data) && $data['payLink'] !== null) { $data['payLink'] = self::clean_pay_url($data['payLink']); }
        return $data;
    }

    public static function sanitize_insert($coll, $data, $p) {
        if (!is_array($data)) { return $data; }
        $data = self::clean_pay_fields($coll, $data);
        $priv = self::has_power($p, 'write');
        if ($coll === 'orders') {
            unset($data['routing']);
            $manual = (($data['source'] ?? '') === 'whatsapp_manual');
            if ($manual && !$priv) { unset($data['source']); }
            elseif ($manual && ($p['role'] ?? '') !== 'owner' && empty(self::routing()['opsCreate'])) { throw new Mutqan_Error('forbidden', 'إنشاء الطلبات اليدوية متوقف من المالك.', 403); }
            elseif ($manual) { $data['routing'] = 'operations'; }
            elseif (!$priv) { $data['routing'] = self::routing()['mode']; }
        }
        if ($coll === 'orders' && !$priv) {
            Mutqan_Limiter::hit('order_insert', 6, 3600);
            foreach (['technicianId', 'technicianName', 'price', 'paidAt', 'paymentMethod', 'paidRecordedBy', 'escalation_override'] as $k) { unset($data[$k]); }
            $data['status'] = 'new';
            $data['paymentStatus'] = 'unpaid';
            $data['clientId'] = ($p['kind'] ?? '') === 'user' ? $p['id'] : null;
            $dev = $data['deviceId'] ?? '';
            unset($data['remindedAt']);
            if (isset($data['appointmentAt']) && (!is_string($data['appointmentAt']) || !strtotime($data['appointmentAt']))) { unset($data['appointmentAt']); }
            unset($data['deviceId'], $data['welcomeDiscountPct'], $data['welcomeDiscountMax'], $data['payLink'], $data['inhouse'], $data['inhouseAt']);
            if (self::inhouse_mode()) { $data['inhouse'] = true; $data['inhouseAt'] = gmdate('c'); }
            $pct = Mutqan_Promo::valid_device($dev) ? Mutqan_Promo::consume($dev) : 0;
            if ($pct > 0) { $data['welcomeDiscountPct'] = $pct; $data['welcomeDiscountMax'] = Mutqan_Promo::MAX_OFF; }
            self::price_guard($data, $pct);
        }
        if ($coll === 'tech_applications' && !$priv) {
            $data['status'] = 'pending';
            $data['userId'] = $p['id'];
            unset($data['reviewedAt'], $data['reviewedBy'], $data['reviewNote']);
        }
        if ($coll === 'tech_profiles' && !$priv) {
            $data['userId'] = $p['id'];
            unset($data['verified'], $data['approved']);
        }
        if ($coll === 'customers' && !$priv) { $data['userId'] = $p['id']; }
        if ($coll === 'handoffs' && !self::is_staff($p)) { Mutqan_Limiter::hit('handoff_insert', 10, 3600); }
        if ($coll === 'calls' && !self::is_staff($p)) { Mutqan_Limiter::hit('call_insert', 8, 3600); }
        return $data;
    }

    public static function sanitize_update($coll, $old, $patch, $p, $row) {
        $me = $p['id'];
        $patch = self::clean_pay_fields($coll, $patch);
        if ($coll === 'ai_settings' && ($p['role'] ?? null) !== 'owner') {
            foreach (self::OWNER_ONLY_AI_KEYS as $k) {
                if (array_key_exists($k, $old)) { $patch[$k] = $old[$k]; } else { unset($patch[$k]); }
            }
        }
        if ($coll === 'orders' && !self::has_power($p, 'write')) {
            $deny = ['price', 'agreedPrice', 'priceQuote', 'estimatedPrice', 'negotiated', 'welcomeDiscountPct', 'welcomeDiscountMax', 'deviceId', 'payLink', 'inhouse', 'inhouseAt', 'clientId', 'clientName', 'clientPhone', 'handler', 'escalation', 'transferLog', 'source', 'aiConversation', 'invoiceItems', 'photosBefore', 'photosAfter', 'technicianLocation', 'technicianDistanceM'];
            $creator = $row['owner_id'] === $me;
            if ($creator && ($p['role'] ?? null) !== 'technician') {
                $deny = array_merge($deny, ['technicianId', 'technicianName', 'paymentStatus', 'paidAt', 'paymentMethod', 'paidRecordedBy']);
            }
            foreach ($deny as $k) { unset($patch[$k]); }
            if (($p['role'] ?? null) === 'technician' && !$creator) {
                if (array_key_exists('technicianId', $patch) && $patch['technicianId'] !== null && $patch['technicianId'] !== $me) { unset($patch['technicianId'], $patch['technicianName']); }
                if (array_key_exists('technicianId', $patch) && $patch['technicianId'] === null && ($old['technicianId'] ?? null) !== $me) { unset($patch['technicianId'], $patch['technicianName']); }
            }
            if ($creator && !self::is_staff($p)) {
                $cancellable = in_array($old['status'] ?? 'new', ['new', 'forced', 'assigned', 'accepted'], true);
                if (!isset($patch['status']) || $patch['status'] !== 'cancelled' || !$cancellable) { unset($patch['status'], $patch['statusHistory']); }
            }
        }
        if ($coll === 'tech_applications' && !self::has_power($p, 'write')) { unset($patch['status'], $patch['reviewedAt'], $patch['reviewedBy'], $patch['reviewNote'], $patch['userId']); }
        return $patch;
    }

    /* ------------------------------------------------------------------ price floor */

    private static $PRICE_BASE = [
        'ac' => 115, 'electric' => 90, 'plumbing' => 100, 'locks' => 150, 'appliances' => 120, 'satellite' => 130,
        'paint' => 200, 'tiling' => 250, 'cameras' => 180, 'fridge' => 140, 'cleaning' => 150, 'pest' => 120,
        'tanks' => 180, 'moving' => 300, 'solar' => 400, 'corporate' => 500, 'general' => 100, 'contracting' => 600,
    ];

    /** Port of pricing.js computeQuote (without add-ons): the lowest total negotiation may reach. */
    public static function floor_for($specialtyId, $qty, $urgent) {
        $base0 = (float) (self::$PRICE_BASE[$specialtyId] ?? 100);
        $row = Mutqan_Store::get_raw('pricing', $specialtyId) ?: [];
        $num = function ($v, $fb) { return (is_numeric($v) && $v !== '') ? (float) $v : $fb; };
        $base = max(0, $num($row['base'] ?? null, $base0));
        $min = max(0, min($num($row['min'] ?? null, round($base0 * 0.9)), $base));
        $discount = min(90, max(0, $num($row['discountPct'] ?? null, 10)));
        $visit = max(0, $num($row['visitFee'] ?? null, 0));
        $emerg = max(0, $num($row['emergencyPct'] ?? null, 25));
        $extra = min(100, max(0, $num($row['extraUnitPct'] ?? null, 80)));
        $ai = Mutqan_Store::get_raw('ai_settings', 'default') ?: [];
        $globalMax = isset($ai['globalPolicy']['maxDiscountPct']) && is_numeric($ai['globalPolicy']['maxDiscountPct']) ? (float) $ai['globalPolicy']['maxDiscountPct'] : 20.0;
        $q = max(1, min(50, (int) $qty ?: 1));
        $units = 1 + ($q - 1) * ($extra / 100);
        $service = $base * $units;
        $pct = min($discount, max(0, $globalMax));
        $serviceFloor = max($min * $units, $service * (1 - $pct / 100));
        $fixed = $visit + ($urgent ? $service * ($emerg / 100) : 0);
        $total = round($service + $fixed);
        return (int) min($total, round($serviceFloor + $fixed));
    }

    /** Port of acPricing.js acQuote/acFloor: recompute the AC total from the owner's price table and apply max discount. */
    public static function ac_floor($q) {
        $total = self::ac_total($q);
        if ($total <= 0) { return 0; }
        $row = Mutqan_Store::get_raw('pricing', 'ac_calc') ?: [];
        $md = (isset($row['maxDiscountPct']) && is_numeric($row['maxDiscountPct'])) ? max(0, (float) $row['maxDiscountPct']) : 10.0;
        return (int) round(round($total) * (1 - $md / 100)) - 1;
    }

    /** Official AC total (0 = priced after inspection). Same rules as acPricing.js. */
    public static function ac_total($q) {
        if (!empty($q['items']) && is_array($q['items'])) {
            $row = Mutqan_Store::get_raw('pricing', 'ac_calc') ?: [];
            $g = function ($k, $d) use ($row) { return (isset($row[$k]) && is_numeric($row[$k])) ? max(0, (float) $row[$k]) : (float) $d; };
            $sum = 0.0; $units = 0;
            foreach (array_slice($q['items'], 0, 10) as $it) {
                $line = ['mode' => 'wash', 'type' => (string) ($it['type'] ?? 'سبليت'), 'qty' => (int) ($it['qty'] ?? 1), 'full' => !isset($it['full']) || $it['full'], 'warranty' => 'بدون', 'vat' => false];
                $sum += self::ac_total($line);
                $units += max(1, min(50, $line['qty']));
            }
            $wmap = ['شهر' => $g('w1', 10), 'شهرين' => $g('w2', 20), '3 شهور' => $g('w3', 30)];
            $sum += $units * ($wmap[(string) ($q['warranty'] ?? '')] ?? 0);
            if (!empty($q['vat'])) { $sum *= 1 + $g('vatPct', 15) / 100; }
            return (float) $sum;
        }
        $row = Mutqan_Store::get_raw('pricing', 'ac_calc') ?: [];
        $d = ['split1' => 100, 'split2' => 140, 'split3' => 200, 'win1' => 60, 'win2' => 100, 'win3' => 150, 'winExtra' => 50, 'other1' => 180,
              'innerOff1' => 10, 'innerOff2' => 20, 'innerOff3' => 40, 'w1' => 10, 'w2' => 20, 'w3' => 30, 'vatPct' => 15, 'maxDiscountPct' => 10];
        $c = [];
        foreach ($d as $k => $fb) { $c[$k] = (isset($row[$k]) && is_numeric($row[$k])) ? max(0, (float) $row[$k]) : (float) $fb; }
        $mode = (string) ($q['mode'] ?? 'wash');
        $type = (string) ($q['type'] ?? 'سبليت');
        $qty = max(1, min(50, (int) ($q['qty'] ?? 1)));
        $full = !isset($q['full']) || $q['full'];
        if ($mode !== 'wash') {
            $inst = $row['installPrices'][$type] ?? 0;
            $u = is_numeric($inst) ? (float) $inst : 0;
            if ($mode !== 'install' || $u <= 0) { return 0; }
            $base = $u * $qty;
            $w = 0;
        } else {
            $base = null;
            $offerKey = $q['offerKey'] ?? null;
            if ($offerKey && $full) {
                $o = Mutqan_Store::get_raw('offers', (string) $offerKey) ?: [];
                if (!empty($o['acMode']) && $o['acMode'] === 'wash' && (int) ($o['qty'] ?? 0) === $qty && ($o['acType'] ?? 'سبليت') === $type && ($o['active'] ?? true) !== false && is_numeric($o['price'] ?? null)) { $base = (float) $o['price']; }
            }
            if ($base === null) {
                if ($type === 'سبليت') {
                    $off = $full ? [0, 0, 0] : [$c['innerOff1'], $c['innerOff2'], $c['innerOff3']];
                    $p = [$c['split1'] - $off[0], $c['split2'] - $off[1], $c['split3'] - $off[2]];
                    $base = $qty <= 3 ? $p[$qty - 1] : $p[2] + ($qty - 3) * ($p[2] / 3);
                } elseif ($type === 'شباك') {
                    $base = $qty === 1 ? $c['win1'] : ($qty === 2 ? $c['win2'] : $c['win3'] + ($qty - 3) * $c['winExtra']);
                    if ($qty === 3) { $base = $c['win3']; }
                } else {
                    $base = $qty * $c['other1'];
                }
            }
            $wmap = ['شهر' => $c['w1'], 'شهرين' => $c['w2'], '3 شهور' => $c['w3']];
            $w = $qty * ($wmap[(string) ($q['warranty'] ?? '')] ?? 0);
        }
        $total = $base + $w;
        if (!empty($q['vat'])) { $total *= 1 + $c['vatPct'] / 100; }
        return (float) $total;
    }

    /** Reject orders whose agreed or quoted total is below what the owner's rules allow. */
    private static function price_guard($data, $pct = 0) {
        $spec = $data['specialtyId'] ?? null;
        if (!is_string($spec) || $spec === '') { return; }
        if ($spec === 'ac' && isset($data['acQuote']) && is_array($data['acQuote'])) {
            $floor = self::ac_floor($data['acQuote']);
        } else {
            $floor = self::floor_for($spec, $data['qty'] ?? 1, ($data['priority'] ?? '') === 'urgent');
        }
        if ($pct > 0) { $floor = $floor - Mutqan_Promo::off($floor, $pct); }
        $candidates = [];
        if (isset($data['agreedPrice']) && $data['agreedPrice'] !== null) { $candidates[] = $data['agreedPrice']; }
        if (isset($data['priceQuote']['total'])) { $candidates[] = $data['priceQuote']['total']; }
        if ($spec === 'ac' && isset($data['acQuote']['total'])) { $candidates[] = $data['acQuote']['total']; }
        foreach ($candidates as $v) {
            if (!is_numeric($v) || (float) $v < $floor - 1) {
                throw new Mutqan_Error('price_below_floor', 'السعر المرسل أقل من الحد المسموح لهذه الخدمة.', 422);
            }
        }
    }
}
