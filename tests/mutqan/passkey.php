<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/wpshim.php';
Mutqan_Store::maybe_install();
$ok = true; $t = function ($n, $c) use (&$ok) { echo ($c ? 'PASS ' : 'FAIL ') . $n . "\n"; if (!$c) { $ok = false; } };
$b = 'Mutqan_Passkey';
// --- tiny CBOR encoder + virtual authenticator
function ce($v) {
    if (is_int($v)) { return $v >= 0 ? ch(0, $v) : ch(1, -1 - $v); }
    if (is_array($v) && isset($v['__b'])) { return ch(2, strlen($v['__b'])) . $v['__b']; }
    if (is_string($v)) { return ch(3, strlen($v)) . $v; }
    $o = ch(5, count($v)); foreach ($v as $k => $x) { $o .= ce($k) . ce($x); } return $o;
}
function ch($mt, $n) { return $n < 24 ? chr(($mt << 5) | $n) : ($n < 256 ? chr(($mt << 5) | 24) . chr($n) : chr(($mt << 5) | 25) . pack('n', $n)); }
$key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
$d = openssl_pkey_get_details($key); $x = $d['ec']['x']; $y = $d['ec']['y'];
$host = '127.0.0.1'; $origin = 'http://127.0.0.1:8099';
$rp = hash('sha256', $host, true);
$cid = random_bytes(32); $id = $b::b64u($cid);
$p = ['id' => 'u1', 'role' => 'owner', 'kind' => 'user', 'handle' => 'ali', 'name' => 'Ali', 'powers' => []];
$u = Mutqan_Auth::set_owner('ali', 'Ali', 'password123'); $p['id'] = $u;
// registration
$o = $b::reg_options($p); $ch = $o['publicKey']['challenge'];
$cd = json_encode(['type' => 'webauthn.create', 'challenge' => $ch, 'origin' => $origin]);
$cose = ce([1 => 2, 3 => -7, -1 => 1, -2 => ['__b' => $x], -3 => ['__b' => $y]]);
$ad = $rp . chr(0x45) . pack('N', 0) . str_repeat("\0", 16) . pack('n', 32) . $cid . $cose;
$att = ce(['fmt' => 'none', 'attStmt' => [], 'authData' => ['__b' => $ad]]);
$r = $b::reg_verify($p, ['id' => $id, 'clientDataJSON' => $b::b64u($cd), 'attestationObject' => $b::b64u($att), 'name' => 'iPhone']);
$t('register ok', !empty($r['ok']) && count($b::list_keys($p)['keys']) === 1);
try { $b::reg_verify($p, ['id' => $id, 'clientDataJSON' => $b::b64u($cd), 'attestationObject' => $b::b64u($att)]); $t('challenge reuse rejected', false); } catch (Mutqan_Error $e) { $t('challenge reuse rejected', true); }
try { $b::reg_options(['role' => 'technician', 'kind' => 'user', 'id' => 'z', 'powers' => []]); $t('non-owner cannot register', false); } catch (Mutqan_Error $e) { $t('non-owner cannot register', true); }
// login
function assertion($b, $key, $rp, $origin, $id, $count, $type = 'webauthn.get') {
    $lo = $b::login_options(); $ch = $lo['publicKey']['challenge'];
    $cd = json_encode(['type' => $type, 'challenge' => $ch, 'origin' => $origin]);
    $ad = $rp . chr(0x05) . pack('N', $count);
    openssl_sign($ad . hash('sha256', $cd, true), $sig, $key, OPENSSL_ALGO_SHA256);
    return ['id' => $id, 'clientDataJSON' => $b::b64u($cd), 'authenticatorData' => $b::b64u($ad), 'signature' => $b::b64u($sig)];
}
$s = $b::login_verify(assertion($b, $key, $rp, $origin, $id, 1));
$t('passkey login -> owner session', !empty($s['token']) && ($s['user']['role'] ?? '') === 'owner');
try { $b::login_verify(assertion($b, $key, $rp, $origin, $id, 1)); $t('replayed counter rejected', false); } catch (Mutqan_Error $e) { $t('replayed counter rejected', true); }
$other = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
try { $b::login_verify(assertion($b, $other, $rp, $origin, $id, 5)); $t('wrong key rejected', false); } catch (Mutqan_Error $e) { $t('wrong key rejected', true); }
try { $b::login_verify(assertion($b, $key, $rp, 'https://evil.example', $id, 6)); $t('wrong origin rejected', false); } catch (Mutqan_Error $e) { $t('wrong origin rejected', true); }
try { $b::login_verify(assertion($b, $key, hash('sha256', 'evil.com', true), $origin, $id, 7)); $t('wrong rpId rejected', false); } catch (Mutqan_Error $e) { $t('wrong rpId rejected', true); }
$s = $b::login_verify(assertion($b, $key, $rp, $origin, $id, 8));
$t('login still works after failures', !empty($s['token']));
$b::remove($p, ['id' => $id]);
try { $b::login_options(); $t('removed -> none', false); } catch (Mutqan_Error $e) { $t('removed -> none', $e->slug === 'no_passkey'); }
exit($ok ? 0 : 1);
