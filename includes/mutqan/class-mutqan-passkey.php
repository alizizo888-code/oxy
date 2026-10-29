<?php
if (!defined('ABSPATH') && PHP_SAPI !== 'cli') { exit; }

/**
 * Owner biometric sign-in (WebAuthn / passkeys: fingerprint, face, device PIN).
 * No third-party library: minimal CBOR + ES256 (P-256) verification with OpenSSL.
 * The owner registers a passkey once after a normal username/password login;
 * afterwards the passkey alone opens an owner session. Public keys only are stored.
 */
final class Mutqan_Passkey {
    const OPT = 'mutqan_passkeys';

    /* ---------------- helpers ---------------- */
    public static function b64u($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
    public static function unb64u($s) { return base64_decode(strtr((string) $s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true); }
    private static function rp_id() { return strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST)); }
    private static function all() { $v = get_option(self::OPT, []); return is_array($v) ? $v : []; }

    private static function origin_ok($origin) {
        $o = wp_parse_url((string) $origin);
        if (!$o || empty($o['host']) || strtolower($o['host']) !== self::rp_id()) { return false; }
        $local = in_array(strtolower($o['host']), ['localhost', '127.0.0.1'], true);
        return ($o['scheme'] ?? '') === 'https' || $local;
    }

    private static function new_challenge($kind) {
        $c = random_bytes(32);
        set_transient('mq_pk_' . sha1(self::b64u($c)), $kind, 600);
        return self::b64u($c);
    }
    private static function take_challenge($b64, $kind) {
        $k = 'mq_pk_' . sha1((string) $b64);
        if (get_transient($k) !== $kind) { return false; }
        delete_transient($k);
        return true;
    }

    /** Minimal CBOR decoder (ints, byte/text strings, arrays, maps, simple values). */
    public static function cbor(&$s, &$o = 0) {
        $b = ord($s[$o++]); $mt = $b >> 5; $ai = $b & 31;
        if ($ai < 24) { $v = $ai; }
        elseif ($ai === 24) { $v = ord($s[$o]); $o += 1; }
        elseif ($ai === 25) { $v = unpack('n', substr($s, $o, 2))[1]; $o += 2; }
        elseif ($ai === 26) { $v = unpack('N', substr($s, $o, 4))[1]; $o += 4; }
        elseif ($ai === 27) { $v = unpack('J', substr($s, $o, 8))[1]; $o += 8; }
        else { $v = null; }
        switch ($mt) {
            case 0: return $v;
            case 1: return -1 - $v;
            case 2: $r = substr($s, $o, $v); $o += $v; return $r;
            case 3: $r = substr($s, $o, $v); $o += $v; return $r;
            case 4: $a = []; for ($i = 0; $i < $v; $i++) { $a[] = self::cbor($s, $o); } return $a;
            case 5: $m = []; for ($i = 0; $i < $v; $i++) { $k = self::cbor($s, $o); $m[$k] = self::cbor($s, $o); } return $m;
            case 7: return $ai === 21 ? true : ($ai === 20 ? false : null);
        }
        throw new Mutqan_Error('bad_passkey', 'بيانات البصمة غير صالحة.', 400);
    }

    private static function pem_from_cose($key) {
        if (!is_array($key) || ($key[3] ?? null) !== -7 || ($key[-1] ?? null) !== 1 || strlen($key[-2] ?? '') !== 32 || strlen($key[-3] ?? '') !== 32) {
            throw new Mutqan_Error('bad_passkey', 'نوع المفتاح غير مدعوم.', 400);
        }
        $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . "\x04" . $key[-2] . $key[-3];
        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }

    private static function client_data($b64, $type, $kind) {
        $raw = self::unb64u($b64);
        $cd = $raw ? json_decode($raw, true) : null;
        if (!is_array($cd) || ($cd['type'] ?? '') !== $type || !self::origin_ok($cd['origin'] ?? '') || !self::take_challenge($cd['challenge'] ?? '', $kind)) {
            throw new Mutqan_Error('bad_passkey', 'تعذر التحقق من البصمة.', 401);
        }
        return $raw;
    }

    /* ---------------- registration (owner already signed in) ---------------- */
    public static function reg_options($p) {
        Mutqan_Auth::require_owner($p);
        $ids = array_map(function ($id) { return ['type' => 'public-key', 'id' => (string) $id]; }, array_keys(self::all()));
        return ['publicKey' => [
            'challenge' => self::new_challenge('reg'),
            'rp' => ['name' => 'متقن', 'id' => self::rp_id()],
            'user' => ['id' => self::b64u((string) $p['id']), 'name' => (string) ($p['handle'] ?: 'owner'), 'displayName' => (string) ($p['name'] ?: 'المالك')],
            'pubKeyCredParams' => [['type' => 'public-key', 'alg' => -7]],
            'authenticatorSelection' => ['authenticatorAttachment' => 'platform', 'userVerification' => 'required', 'residentKey' => 'preferred'],
            'timeout' => 60000, 'attestation' => 'none', 'excludeCredentials' => $ids,
        ]];
    }

    public static function reg_verify($p, $in) {
        Mutqan_Auth::require_owner($p);
        self::client_data($in['clientDataJSON'] ?? '', 'webauthn.create', 'reg');
        $att = self::unb64u($in['attestationObject'] ?? '');
        if (!$att) { throw new Mutqan_Error('bad_passkey', 'بيانات البصمة غير صالحة.', 400); }
        $ob = self::cbor($att);
        $ad = is_array($ob) ? ($ob['authData'] ?? '') : '';
        if (strlen($ad) < 55 || substr($ad, 0, 32) !== hash('sha256', self::rp_id(), true)) { throw new Mutqan_Error('bad_passkey', 'بصمة غير مطابقة للموقع.', 401); }
        $flags = ord($ad[32]);
        if (!($flags & 0x01) || !($flags & 0x04) || !($flags & 0x40)) { throw new Mutqan_Error('bad_passkey', 'يلزم التحقق بالبصمة أو الوجه.', 401); }
        $count = unpack('N', substr($ad, 33, 4))[1];
        $len = unpack('n', substr($ad, 53, 2))[1];
        $cid = substr($ad, 55, $len);
        $o = 55 + $len;
        $pem = self::pem_from_cose(self::cbor($ad, $o));
        $id = self::b64u($cid);
        if ($id === '' || $id !== (string) ($in['id'] ?? '')) { throw new Mutqan_Error('bad_passkey', 'معرّف البصمة غير مطابق.', 400); }
        $all = self::all();
        $all[$id] = ['pem' => $pem, 'count' => $count, 'name' => mb_substr(trim((string) ($in['name'] ?? 'هذا الجهاز')), 0, 40), 'created' => Mutqan_Store::now(), 'uid' => $p['id']];
        update_option(self::OPT, $all, false);
        return ['ok' => true, 'id' => $id];
    }

    /* ---------------- sign-in (public) ---------------- */
    public static function login_options() {
        Mutqan_Limiter::hit('pk_opts', 30, 900);
        $all = self::all();
        if (!$all) { throw new Mutqan_Error('no_passkey', 'لا توجد بصمة مفعّلة بعد.', 404); }
        return ['publicKey' => [
            'challenge' => self::new_challenge('get'), 'rpId' => self::rp_id(), 'timeout' => 60000, 'userVerification' => 'required',
            'allowCredentials' => array_map(function ($id) { return ['type' => 'public-key', 'id' => (string) $id]; }, array_keys($all)),
        ]];
    }

    public static function login_verify($in) {
        Mutqan_Limiter::hit('pk_login', 20, 900);
        $all = self::all();
        $id = (string) ($in['id'] ?? '');
        if (!isset($all[$id])) { throw new Mutqan_Error('bad_passkey', 'بصمة غير معروفة.', 401); }
        $cdRaw = self::client_data($in['clientDataJSON'] ?? '', 'webauthn.get', 'get');
        $ad = self::unb64u($in['authenticatorData'] ?? '');
        $sig = self::unb64u($in['signature'] ?? '');
        if (!$ad || strlen($ad) < 37 || !$sig || substr($ad, 0, 32) !== hash('sha256', self::rp_id(), true)) { throw new Mutqan_Error('bad_passkey', 'بصمة غير مطابقة للموقع.', 401); }
        $flags = ord($ad[32]);
        if (!($flags & 0x01) || !($flags & 0x04)) { throw new Mutqan_Error('bad_passkey', 'يلزم التحقق بالبصمة أو الوجه.', 401); }
        if (openssl_verify($ad . hash('sha256', $cdRaw, true), $sig, $all[$id]['pem'], OPENSSL_ALGO_SHA256) !== 1) { throw new Mutqan_Error('bad_passkey', 'فشل التحقق من البصمة.', 401); }
        $count = unpack('N', substr($ad, 33, 4))[1];
        $old = (int) $all[$id]['count'];
        if (($count || $old) && $count <= $old) { throw new Mutqan_Error('bad_passkey', 'بصمة مستنسخة أو مكررة.', 401); }
        $all[$id]['count'] = $count; $all[$id]['last'] = Mutqan_Store::now();
        update_option(self::OPT, $all, false);
        $owner = Mutqan_Auth::owner_row();
        if (!$owner || $owner['status'] !== 'active') { throw new Mutqan_Error('disabled', 'الحساب غير متاح.', 403); }
        return Mutqan_Auth::login_as($owner);
    }

    /* ---------------- management ---------------- */
    public static function list_keys($p) {
        Mutqan_Auth::require_owner($p);
        $out = [];
        foreach (self::all() as $id => $k) { $out[] = ['id' => $id, 'name' => $k['name'], 'created' => $k['created'], 'last' => $k['last'] ?? null]; }
        return ['keys' => $out];
    }
    public static function remove($p, $in) {
        Mutqan_Auth::require_owner($p);
        $all = self::all(); unset($all[(string) ($in['id'] ?? '')]);
        update_option(self::OPT, $all, false);
        return ['ok' => true];
    }
}
