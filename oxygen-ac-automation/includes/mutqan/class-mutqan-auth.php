<?php
if (!defined('ABSPATH')) { exit; }

/** Tiny fixed-window rate limiter keyed by client IP (transients). */
final class Mutqan_Limiter {
    public static function client() {
        $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'x';
        return md5($ip . wp_salt('auth'));
    }
    /** @throws Mutqan_Error when the limit is exceeded */
    public static function hit($bucket, $limit, $ttl, $extra = '') {
        $key = 'mq_' . substr(md5($bucket . $extra), 0, 12) . '_' . self::client();
        $n = (int) get_transient($key);
        if ($n >= $limit) { throw new Mutqan_Error('rate_limited', 'محاولات كثيرة. حاول لاحقًا.', 429); }
        set_transient($key, $n + 1, $ttl);
    }
    public static function peek($bucket, $limit, $extra = '') {
        $key = 'mq_' . substr(md5($bucket . $extra), 0, 12) . '_' . self::client();
        return (int) get_transient($key) < $limit;
    }
}

/**
 * Accounts, sessions and the team (owner / operations / supervisor / technician).
 * Customers and staff share one users table; a non-null role makes a user staff.
 * Sessions are random 256-bit tokens, stored only as SHA-256 hashes.
 */
final class Mutqan_Auth {
    const SESSION_DAYS = 30;
    const ROLES = ['operations', 'supervisor', 'technician'];   // assignable by the team (owner is created in WP admin)
    const POWERS = ['read', 'write', 'manage'];
    const DEFAULT_POWERS = ['operations' => ['read', 'write', 'manage'], 'supervisor' => ['read', 'write'], 'technician' => []];

    private static $memo = null;

    /* ------------------------------------------------------------------ principal */

    public static function principal($request = null) {
        if (self::$memo !== null) { return self::$memo; }
        $guest = ['id' => 'guest', 'role' => null, 'kind' => 'guest', 'powers' => [], 'name' => '', 'handle' => ''];
        $token = $request ? (string) $request->get_header('x-mutqan-token') : '';
        if ($token !== '' && preg_match('/^[a-f0-9]{64}$/', $token)) {
            global $wpdb;
            $s = Mutqan_Store::table('sessions'); $u = Mutqan_Store::table('users');
            $row = $wpdb->get_row($wpdb->prepare("SELECT u.* FROM $s s JOIN $u u ON u.id = s.user_id WHERE s.token_hash=%s AND s.expires_at > %s AND u.status='active'", hash('sha256', $token), Mutqan_Store::now()), ARRAY_A);
            if ($row) { return self::$memo = self::principal_from_user($row); }
        }
        $anon = $request ? (string) $request->get_header('x-mutqan-anon') : '';
        if ($anon !== '' && preg_match('/^[A-Za-z0-9-]{8,64}$/', $anon)) {
            return self::$memo = ['id' => 'anon-' . $anon, 'role' => null, 'kind' => 'anon', 'powers' => [], 'name' => '', 'handle' => ''];
        }
        return self::$memo = $guest;
    }

    public static function reset_memo() { self::$memo = null; }

    private static function principal_from_user($u) {
        $role = $u['role'] ?: null;
        return ['id' => $u['id'], 'role' => $role, 'kind' => 'user', 'powers' => self::powers_for($role), 'name' => $u['display_name'], 'handle' => $u['handle']];
    }

    public static function powers_for($role) {
        if ($role === 'owner') { return self::POWERS; }
        $map = self::role_powers_map();
        return $map[$role] ?? [];
    }

    public static function role_powers_map() {
        $saved = get_option('mutqan_role_powers', []);
        $map = self::DEFAULT_POWERS;
        if (is_array($saved)) {
            foreach (self::ROLES as $r) {
                if (isset($saved[$r]) && is_array($saved[$r])) { $map[$r] = array_values(array_intersect(self::POWERS, $saved[$r])); }
            }
        }
        return $map;
    }

    public static function require_user($p) {
        if (($p['kind'] ?? '') !== 'user') { throw new Mutqan_Error('unauthorized', 'سجّل الدخول أولًا.', 401); }
    }
    public static function require_manage($p) {
        self::require_user($p);
        if (!Mutqan_Policy::has_power($p, 'manage')) { throw new Mutqan_Error('forbidden', 'ليست لديك صلاحية إدارة الفريق.', 403); }
    }
    public static function require_owner($p) {
        self::require_user($p);
        if (($p['role'] ?? null) !== 'owner') { throw new Mutqan_Error('forbidden', 'هذا الإجراء للمالك فقط.', 403); }
    }

    /* ------------------------------------------------------------------ helpers */

    public static function fold_digits($s) {
        return strtr((string) $s, ['٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9','۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9']);
    }

    public static function normalize_handle($h) {
        $h = strtolower(trim(self::fold_digits((string) $h)));
        if (preg_match('/^[+\d][\d\s-]{7,}$/', $h)) {           // a phone number
            $d = preg_replace('/\D/', '', $h);
            if (strpos($d, '00') === 0) { $d = substr($d, 2); }
            return $d;
        }
        return $h;
    }

    private static function valid_staff_handle($h) {
        if (!preg_match('/^[a-z0-9][a-z0-9_.-]{2,31}$/', $h)) { throw new Mutqan_Error('bad_username', 'اسم المستخدم من 3 إلى 32 حرفًا إنجليزيًا أو أرقامًا.', 422); }
    }

    private static function valid_password($pw, $min = 6) {
        $pw = (string) $pw;
        if (strlen($pw) < $min || strlen($pw) > 200) { throw new Mutqan_Error('weak_password', "كلمة المرور {$min} أحرف على الأقل.", 422); }
    }

    private static function temp_password($pin = false) {
        if ($pin) { return (string) random_int(100000, 999999); }
        $chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; $out = '';
        for ($i = 0; $i < 10; $i++) { $out .= $chars[random_int(0, strlen($chars) - 1)]; }
        return $out;
    }

    public static function public_user($u) {
        return [
            'id' => $u['id'], 'handle' => $u['handle'], 'displayName' => $u['display_name'] !== '' ? $u['display_name'] : $u['handle'],
            'phone' => $u['phone'], 'email' => null, 'role' => $u['role'] ?: null, 'status' => $u['status'],
        ];
    }

    private static function find_by_handle($handle) {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . Mutqan_Store::table('users') . ' WHERE handle=%s', $handle), ARRAY_A);
    }
    private static function find_by_id($id) {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . Mutqan_Store::table('users') . ' WHERE id=%s', (string) $id), ARRAY_A);
    }

    private static function create_user($handle, $name, $phone, $password, $role, $status = 'active') {
        global $wpdb;
        if (self::find_by_handle($handle)) { throw new Mutqan_Error('handle_taken', 'اسم المستخدم مستخدم من قبل.', 409); }
        $id = 'u-' . substr(str_replace('-', '', wp_generate_uuid4()), 0, 20);
        $ok = $wpdb->insert(Mutqan_Store::table('users'), [
            'id' => $id, 'handle' => $handle, 'display_name' => mb_substr(trim((string) $name), 0, 120), 'phone' => mb_substr((string) $phone, 0, 32),
            'password_hash' => password_hash((string) $password, PASSWORD_DEFAULT), 'role' => $role, 'status' => $status, 'created_at' => Mutqan_Store::now(),
        ]);
        if ($ok === false) { throw new Mutqan_Error('handle_taken', 'اسم المستخدم مستخدم من قبل.', 409); }
        return self::find_by_id($id);
    }

    public static function issue_session($uid) {
        global $wpdb;
        $token = bin2hex(random_bytes(32));
        $wpdb->insert(Mutqan_Store::table('sessions'), [
            'token_hash' => hash('sha256', $token), 'user_id' => $uid,
            'expires_at' => gmdate('Y-m-d H:i:s', time() + self::SESSION_DAYS * 86400), 'created_at' => Mutqan_Store::now(),
        ]);
        return $token;
    }

    private static function session_result($u) {
        $wpdb = $GLOBALS['wpdb'];
        $wpdb->update(Mutqan_Store::table('users'), ['last_login' => Mutqan_Store::now()], ['id' => $u['id']]);
        return ['token' => self::issue_session($u['id']), 'user' => self::public_user($u)];
    }

    /** Session for an already-verified user (used by passkey sign-in). */
    public static function login_as($u) { return self::session_result($u); }

    private static function drop_sessions($uid) {
        $GLOBALS['wpdb']->delete(Mutqan_Store::table('sessions'), ['user_id' => $uid]);
    }

    /* ------------------------------------------------------------------ customers + login */

    public static function signup_customer($in) {
        Mutqan_Limiter::hit('signup', 10, 3600);
        $name = trim((string) ($in['name'] ?? ''));
        $handle = self::normalize_handle($in['phone'] ?? '');
        if (!preg_match('/^\d{8,15}$/', $handle)) { throw new Mutqan_Error('bad_phone', 'اكتب رقم جوال صحيح.', 422); }
        if ($name === '') { throw new Mutqan_Error('bad_name', 'اكتب اسمك.', 422); }
        self::valid_password($in['password'] ?? '', 6);
        $u = self::create_user($handle, $name, $handle, $in['password'], null);
        return self::session_result($u);
    }

    public static function login($in, $staff_only = false) {
        $handle = self::normalize_handle($in['handle'] ?? ($in['phone'] ?? ''));
        $pw = (string) ($in['password'] ?? '');
        if ($handle === '' || $pw === '') { throw new Mutqan_Error('bad_credentials', 'بيانات الدخول غير صحيحة.', 401); }
        if (!Mutqan_Limiter::peek('login_fail', 8, $handle)) { throw new Mutqan_Error('rate_limited', 'محاولات كثيرة. حاول بعد قليل.', 429); }
        $u = self::find_by_handle($handle);
        $ok = $u && password_verify($pw, $u['password_hash']);
        if (!$ok) {
            try { Mutqan_Limiter::hit('login_fail', 8, 900, $handle); } catch (Mutqan_Error $e) { /* counted */ }
            throw new Mutqan_Error('bad_credentials', 'بيانات الدخول غير صحيحة.', 401);
        }
        if ($u['status'] === 'pending') { throw new Mutqan_Error('pending', 'طلب انضمامك قيد المراجعة.', 403); }
        if ($u['status'] !== 'active') { throw new Mutqan_Error('disabled', 'هذا الحساب موقوف.', 403); }
        if ($staff_only && empty($u['role'])) { throw new Mutqan_Error('not_staff', 'هذا الحساب ليس ضمن فريق العمل.', 403); }
        return self::session_result($u);
    }

    public static function logout($request) {
        $t = (string) $request->get_header('x-mutqan-token');
        if (preg_match('/^[a-f0-9]{64}$/', $t)) { $GLOBALS['wpdb']->delete(Mutqan_Store::table('sessions'), ['token_hash' => hash('sha256', $t)]); }
        return ['ok' => true];
    }

    public static function me($p) {
        if (($p['kind'] ?? '') !== 'user') { return ['user' => null]; }
        $u = self::find_by_id($p['id']);
        return ['user' => $u ? self::public_user($u) : null];
    }

    public static function update_profile($p, $in) {
        self::require_user($p);
        $upd = [];
        if (isset($in['displayName'])) { $upd['display_name'] = mb_substr(trim((string) $in['displayName']), 0, 120); }
        if (isset($in['phone'])) { $upd['phone'] = mb_substr(preg_replace('/[^\d+]/', '', self::fold_digits($in['phone'])), 0, 32); }
        if ($upd) { $GLOBALS['wpdb']->update(Mutqan_Store::table('users'), $upd, ['id' => $p['id']]); }
        return self::me($p);
    }

    public static function change_password($p, $in) {
        self::require_user($p);
        $u = self::find_by_id($p['id']);
        if (!$u || !password_verify((string) ($in['current'] ?? ''), $u['password_hash'])) { throw new Mutqan_Error('bad_credentials', 'كلمة المرور الحالية غير صحيحة.', 401); }
        self::valid_password($in['next'] ?? '', 6);
        $GLOBALS['wpdb']->update(Mutqan_Store::table('users'), ['password_hash' => password_hash((string) $in['next'], PASSWORD_DEFAULT)], ['id' => $u['id']]);
        return ['ok' => true];
    }

    /* ------------------------------------------------------------------ owner (set from WordPress admin only) */

    public static function owner_exists() {
        global $wpdb;
        return (int) $wpdb->get_var("SELECT COUNT(*) FROM " . Mutqan_Store::table('users') . " WHERE role='owner'") > 0;
    }

    public static function owner_row() {
        global $wpdb;
        return $wpdb->get_row("SELECT * FROM " . Mutqan_Store::table('users') . " WHERE role='owner' LIMIT 1", ARRAY_A);
    }

    /** Creates the owner, or resets the existing owner's credentials. Called by the WP admin screen. */
    public static function set_owner($handle, $name, $password) {
        $handle = strtolower(trim($handle));
        self::valid_staff_handle($handle);
        self::valid_password($password, 8);
        $existing = self::owner_row();
        if ($existing) {
            $other = self::find_by_handle($handle);
            if ($other && $other['id'] !== $existing['id']) { throw new Mutqan_Error('handle_taken', 'اسم المستخدم مستخدم من قبل.', 409); }
            $GLOBALS['wpdb']->update(Mutqan_Store::table('users'), [
                'handle' => $handle, 'display_name' => $name ?: $existing['display_name'], 'password_hash' => password_hash($password, PASSWORD_DEFAULT), 'status' => 'active',
            ], ['id' => $existing['id']]);
            self::drop_sessions($existing['id']);
            return $existing['id'];
        }
        return self::create_user($handle, $name, '', $password, 'owner')['id'];
    }

    /* ------------------------------------------------------------------ team */

    public static function team_config() {
        $cfg = get_option('mutqan_login_config', []);
        return [
            'groupId' => 'main',
            'selfSignup' => (bool) get_option('mutqan_self_signup', false),
            'loginConfig' => ['pin' => !empty($cfg['pin']), 'memberPicker' => !empty($cfg['memberPicker'])],
        ];
    }

    public static function team_op($op, $in, $p) {
        $in = is_array($in) ? $in : [];
        global $wpdb;
        $U = Mutqan_Store::table('users'); $I = Mutqan_Store::table('invites');
        switch ($op) {
            case 'groupId': return ['value' => 'main'];
            case 'config': return self::team_config();
            case 'canManage': return ['value' => ($p['kind'] ?? '') === 'user' && Mutqan_Policy::has_power($p, 'manage')];
            case 'currentMember': {
                if (($p['kind'] ?? '') !== 'user' || !Mutqan_Policy::is_staff($p)) { return ['member' => null]; }
                $u = self::find_by_id($p['id']);
                return ['member' => $u ? self::member_row($u) : null];
            }
            case 'login': return self::login($in, true);
            case 'pkLoginOptions': return Mutqan_Passkey::login_options();
            case 'pkLoginVerify': return Mutqan_Passkey::login_verify($in);
            case 'pkRegOptions': return Mutqan_Passkey::reg_options($p);
            case 'pkRegVerify': return Mutqan_Passkey::reg_verify($p, $in);
            case 'pkList': return Mutqan_Passkey::list_keys($p);
            case 'pkRemove': return Mutqan_Passkey::remove($p, $in);
            case 'loginRoster': {
                if (empty(self::team_config()['loginConfig']['memberPicker'])) { return ['members' => []]; }
                $rows = $wpdb->get_results("SELECT handle, display_name FROM $U WHERE role IS NOT NULL AND status='active' ORDER BY display_name LIMIT 40", ARRAY_A) ?: [];
                return ['members' => array_map(function ($r) { return ['handle' => $r['handle'], 'displayName' => $r['display_name'] ?: $r['handle']]; }, $rows)];
            }
            case 'inviteInfo': {
                $inv = self::invite_row((string) ($in['code'] ?? ''));
                return $inv ? ['valid' => true, 'handle' => $inv['handle'] ?: null, 'role' => $inv['role']] : ['valid' => false];
            }
            case 'acceptInvite': return self::accept_invite($in);
            case 'requestAccess': return self::request_access($in);
        }

        self::require_manage($p);
        switch ($op) {
            case 'listMembersPage': {
                $offset = max(0, (int) ($in['cursor'] ?? 0)); $size = 50;
                $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM $U WHERE (role IS NOT NULL OR disabled_role IS NOT NULL) AND status <> 'pending' ORDER BY created_at ASC LIMIT %d OFFSET %d", $size + 1, $offset), ARRAY_A) ?: [];
                $more = count($rows) > $size; $rows = array_slice($rows, 0, $size);
                return ['members' => array_map([__CLASS__, 'member_row'], $rows), 'hasMore' => $more, 'nextCursor' => $more ? (string) ($offset + $size) : null];
            }
            case 'listPending': {
                $rows = $wpdb->get_results("SELECT * FROM $U WHERE status='pending' ORDER BY created_at ASC LIMIT 200", ARRAY_A) ?: [];
                return ['list' => array_map([__CLASS__, 'member_row'], $rows)];
            }
            case 'createMember': return self::create_member($in);
            case 'bulkCreateMembers': {
                $rows = isset($in['rows']) && is_array($in['rows']) ? array_slice($in['rows'], 0, 100) : [];
                $results = [];
                foreach ($rows as $r) {
                    try { $res = self::create_member(is_array($r) ? $r : []); $results[] = ['ok' => true, 'handle' => $res['handle'], 'tempPassword' => $res['tempPassword']]; }
                    catch (Mutqan_Error $e) { $results[] = ['ok' => false, 'handle' => (string) ($r['handle'] ?? ''), 'reason' => $e->getMessage()]; }
                }
                return ['results' => $results];
            }
            case 'createInvite': return self::create_invite($in, $p);
            case 'revokeInvite': { $wpdb->update($I, ['active' => 0], ['code' => (string) ($in['code'] ?? '')]); return ['ok' => true]; }
            case 'listInvitesPage': {
                $offset = max(0, (int) ($in['cursor'] ?? 0)); $size = 30;
                $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM $I ORDER BY created_at DESC LIMIT %d OFFSET %d", $size + 1, $offset), ARRAY_A) ?: [];
                $more = count($rows) > $size; $rows = array_slice($rows, 0, $size);
                return ['invites' => array_map([__CLASS__, 'invite_public'], $rows), 'hasMore' => $more, 'nextCursor' => $more ? (string) ($offset + $size) : null];
            }
            case 'approveMember': {
                $u = self::member_target($in['userId'] ?? '');
                $role = self::assignable_role($in['role'] ?? '');
                $wpdb->update($U, ['role' => $role, 'status' => 'active'], ['id' => $u['id']]);
                return ['ok' => true, 'role' => $role];
            }
            case 'rejectMember': { $u = self::member_target($in['userId'] ?? ''); if ($u['status'] === 'pending') { self::delete_user($u['id']); } return ['ok' => true]; }
            case 'rejectAllPending': {
                foreach ($wpdb->get_col("SELECT id FROM $U WHERE status='pending'") ?: [] as $id) { self::delete_user($id); }
                return ['ok' => true];
            }
            case 'setRole': {
                $u = self::member_target($in['userId'] ?? '');
                $role = self::assignable_role($in['role'] ?? '');
                $wpdb->update($U, ['role' => $role, 'status' => 'active', 'disabled_role' => null], ['id' => $u['id']]);
                self::drop_sessions($u['id']);
                return ['ok' => true, 'role' => $role];
            }
            case 'disableMember': {
                $u = self::member_target($in['userId'] ?? '');
                $wpdb->update($U, ['status' => 'disabled', 'disabled_role' => $u['role'] ?: $u['disabled_role'], 'role' => null], ['id' => $u['id']]);
                self::drop_sessions($u['id']);
                return ['ok' => true, 'disabledRole' => $u['role'] ?: $u['disabled_role']];
            }
            case 'enableMember': {
                $u = self::member_target($in['userId'] ?? '');
                $role = $u['disabled_role'] ?: ($u['role'] ?: null);
                $wpdb->update($U, ['status' => 'active', 'role' => $role, 'disabled_role' => null], ['id' => $u['id']]);
                return ['ok' => true, 'role' => $role];
            }
            case 'deleteMember': { $u = self::member_target($in['userId'] ?? ''); self::delete_user($u['id']); return ['ok' => true]; }
            case 'resetPassword': {
                $u = self::member_target($in['userId'] ?? '');
                $tmp = self::temp_password(!empty(self::team_config()['loginConfig']['pin']));
                $wpdb->update($U, ['password_hash' => password_hash($tmp, PASSWORD_DEFAULT)], ['id' => $u['id']]);
                self::drop_sessions($u['id']);
                return ['tempPassword' => $tmp];
            }
            case 'getRolePowers': {
                $map = self::role_powers_map();
                return ['adminRoles' => array_keys(array_filter($map)), 'powers' => $map, 'codePowers' => new stdClass()];
            }
            case 'setSelfSignup': { self::require_owner($p); update_option('mutqan_self_signup', !empty($in['value']) ? 1 : 0, false); return ['selfSignup' => !empty($in['value'])]; }
            case 'setLoginConfig': {
                self::require_owner($p);
                $cfg = get_option('mutqan_login_config', []); $cfg = is_array($cfg) ? $cfg : [];
                foreach (['pin', 'memberPicker'] as $k) { if (array_key_exists($k, $in)) { $cfg[$k] = !empty($in[$k]); } }
                update_option('mutqan_login_config', $cfg, false);
                return self::team_config();
            }
            case 'setRolePowers': {
                self::require_owner($p);
                $role = (string) ($in['role'] ?? '');
                if (!in_array($role, self::ROLES, true)) { throw new Mutqan_Error('bad_role', 'دور غير معروف.', 422); }
                $saved = get_option('mutqan_role_powers', []); $saved = is_array($saved) ? $saved : [];
                $saved[$role] = array_values(array_intersect(self::POWERS, (array) ($in['powers'] ?? [])));
                update_option('mutqan_role_powers', $saved, false);
                return ['ok' => true];
            }
            case 'syncRoles': return ['changed' => false];
        }
        throw new Mutqan_Error('bad_op', 'عملية غير معروفة.', 400);
    }

    private static function member_row($u) {
        return [
            'userId' => $u['id'], 'handle' => $u['handle'], 'displayName' => $u['display_name'] !== '' ? $u['display_name'] : $u['handle'],
            'role' => $u['role'] ?: null, 'status' => $u['status'], 'disabledRole' => $u['disabled_role'] ?: null,
            'createdAt' => Mutqan_Store::iso($u['created_at']), 'lastLoginAt' => Mutqan_Store::iso($u['last_login']),
        ];
    }

    private static function member_target($id) {
        $u = self::find_by_id($id);
        if (!$u) { throw new Mutqan_Error('not_found', 'العضو غير موجود.', 404); }
        if ($u['role'] === 'owner') { throw new Mutqan_Error('forbidden', 'لا يمكن تعديل المالك من هنا.', 403); }
        return $u;
    }

    private static function assignable_role($role) {
        $role = (string) $role;
        if (!in_array($role, self::ROLES, true)) { throw new Mutqan_Error('bad_role', 'دور غير معروف.', 422); }
        return $role;
    }

    private static function delete_user($id) {
        $GLOBALS['wpdb']->delete(Mutqan_Store::table('users'), ['id' => $id]);
        self::drop_sessions($id);
    }

    private static function app_url() { return trailingslashit(home_url('/app')); }

    private static function create_member($in) {
        $handle = strtolower(trim((string) ($in['handle'] ?? '')));
        self::valid_staff_handle($handle);
        $role = self::assignable_role($in['role'] ?? '');
        $pin = !empty(self::team_config()['loginConfig']['pin']);
        $pw = isset($in['password']) && $in['password'] !== '' ? (string) $in['password'] : self::temp_password($pin);
        self::valid_password($pw, 6);
        $u = self::create_user($handle, (string) ($in['displayName'] ?? ''), '', $pw, $role);
        return ['handle' => $u['handle'], 'tempPassword' => $pw, 'userId' => $u['id'], 'url' => self::app_url() . '#/staff'];
    }

    private static function create_invite($in, $p) {
        $handle = isset($in['handle']) && $in['handle'] !== '' ? strtolower(trim((string) $in['handle'])) : null;
        if ($handle !== null) { self::valid_staff_handle($handle); if (self::find_by_handle($handle)) { throw new Mutqan_Error('handle_taken', 'اسم المستخدم مستخدم من قبل.', 409); } }
        $role = self::assignable_role($in['role'] ?? '');
        $ms = isset($in['expiresIn']) && is_numeric($in['expiresIn']) ? (float) $in['expiresIn'] : 0;
        $code = strtoupper(substr(bin2hex(random_bytes(8)), 0, 12));
        $GLOBALS['wpdb']->insert(Mutqan_Store::table('invites'), [
            'code' => $code, 'handle' => $handle, 'role' => $role, 'expires_at' => $ms > 0 ? gmdate('Y-m-d H:i:s', time() + (int) ($ms / 1000)) : null,
            'used_count' => 0, 'active' => 1, 'created_by' => $p['id'], 'created_at' => Mutqan_Store::now(),
        ]);
        return ['code' => $code, 'url' => self::app_url() . '?join=' . $code . '#/staff'];
    }

    private static function invite_row($code) {
        if (!preg_match('/^[A-Za-z0-9]{6,40}$/', $code)) { return null; }
        $r = $GLOBALS['wpdb']->get_row($GLOBALS['wpdb']->prepare('SELECT * FROM ' . Mutqan_Store::table('invites') . ' WHERE code=%s', strtoupper($code)), ARRAY_A);
        if (!$r || !(int) $r['active'] || (int) $r['used_count'] > 0) { return null; }
        if ($r['expires_at'] && $r['expires_at'] < Mutqan_Store::now()) { return null; }
        return $r;
    }

    private static function invite_public($r) {
        $expired = $r['expires_at'] && $r['expires_at'] < Mutqan_Store::now();
        return [
            'code' => $r['code'], 'handle' => $r['handle'], 'role' => $r['role'], 'used_count' => (int) $r['used_count'],
            'active' => (bool) $r['active'] && !$expired, 'expiresAt' => Mutqan_Store::iso($r['expires_at']),
            'url' => self::app_url() . '?join=' . $r['code'] . '#/staff',
        ];
    }

    private static function accept_invite($in) {
        Mutqan_Limiter::hit('invite', 10, 3600);
        $inv = self::invite_row((string) ($in['code'] ?? ''));
        if (!$inv) { throw new Mutqan_Error('invalid_invite', 'رابط الدعوة غير صالح أو منتهي.', 410); }
        $handle = $inv['handle'] ?: strtolower(trim((string) ($in['handle'] ?? '')));
        self::valid_staff_handle($handle);
        self::valid_password($in['password'] ?? '', 6);
        $u = self::create_user($handle, (string) ($in['displayName'] ?? ''), '', $in['password'], $inv['role']);
        $GLOBALS['wpdb']->update(Mutqan_Store::table('invites'), ['used_count' => 1, 'active' => 0], ['code' => $inv['code']]);
        return self::session_result($u);
    }

    private static function request_access($in) {
        Mutqan_Limiter::hit('request_access', 5, 3600);
        if (!get_option('mutqan_self_signup', false)) { throw new Mutqan_Error('forbidden', 'طلبات الانضمام مغلقة حاليًا.', 403); }
        $handle = strtolower(trim((string) ($in['handle'] ?? '')));
        self::valid_staff_handle($handle);
        self::valid_password($in['password'] ?? '', 6);
        self::create_user($handle, (string) ($in['displayName'] ?? ''), '', $in['password'], null, 'pending');
        return ['ok' => true];
    }

    /* ------------------------------------------------------------------ social.* (group roles) used by the app */

    public static function set_role_for_applicant($p, $userId, $role) {
        self::require_manage($p);
        $u = self::member_target($userId);
        if ($u['role'] && $u['role'] !== $role) { return ['ok' => true, 'kept' => $u['role']]; }
        $GLOBALS['wpdb']->update(Mutqan_Store::table('users'), ['role' => self::assignable_role($role), 'status' => 'active'], ['id' => $u['id']]);
        return ['ok' => true, 'role' => $role];
    }
}
