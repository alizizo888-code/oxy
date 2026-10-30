<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/wpshim.php';
Mutqan_Store::maybe_install();
$ok = true; $t = function ($n, $c) use (&$ok) { echo ($c ? 'PASS ' : 'FAIL ') . $n . "\n"; if (!$c) { $ok = false; } };
$sys = ['id' => 'system', 'role' => 'owner', 'powers' => ['read', 'write', 'manage'], 'kind' => 'user'];
$S = 'Mutqan_Shop';
// pure ladder
$t('offer >= price -> accepted at list price', $S::ladder_reply(1000, 800, 1200, 1) === ['accepted', 1000]);
$t('offer between floor and price -> accepted at offer', $S::ladder_reply(1000, 800, 900, 1) === ['accepted', 900]);
list($s1, $c1) = $S::ladder_reply(1000, 800, 500, 1); list($s2, $c2) = $S::ladder_reply(1000, 800, 500, 2); list($s3, $c3) = $S::ladder_reply(1000, 800, 500, 3);
$t('counter 1 above floor and below list', $s1 === 'counter' && $c1 > 800 && $c1 < 1000);
$t('counter 2 lower than counter 1', $s2 === 'counter' && $c2 < $c1 && $c2 >= 800);
$t('3rd low offer -> final = floor', $s3 === 'final' && $c3 === 800);
// end to end
Mutqan_Store::insert('used_ac', ['title' => 'سبليت 18000 مستعمل', 'kind' => 'split', 'price' => 1000, 'status' => 'available'], 'u1', [], $sys);
Mutqan_Store::insert('used_ac_private', ['floor' => 800], 'u1', [], $sys);
$r = $S::handle(['op' => 'offer', 'unitId' => 'u1', 'price' => 500, 'name' => 'أحمد', 'phone' => '0551234567'], ['kind' => 'guest']);
$t('first low offer -> counter, floor not leaked', $r['status'] === 'counter' && $r['price'] > 800 && strpos(json_encode($r, JSON_UNESCAPED_UNICODE), '800') === false);
$r2 = $S::handle(['op' => 'offer', 'unitId' => 'u1', 'price' => 600, 'name' => 'أحمد', 'phone' => '0551234567'], ['kind' => 'guest']);
$t('attempt counted per phone+unit', $r2['attempt'] === 2);
$r3 = $S::handle(['op' => 'offer', 'unitId' => 'u1', 'price' => $r['price'], 'name' => 'أحمد', 'phone' => '0551234567'], ['kind' => 'guest']);
$t('accepting the counter -> accepted', $r3['status'] === 'accepted' && $r3['price'] === $r['price']);
$saved = Mutqan_Store::get_raw('used_offers', 'o' . substr(md5('u1|966551234567'), 0, 24));
$t('offer stored for the team with phone', !empty($saved) && $saved['phone'] === '966551234567' && $saved['attempts'] === 3);
try { $S::handle(['op' => 'offer', 'unitId' => 'u1', 'price' => 900, 'name' => 'x', 'phone' => '123'], ['kind' => 'guest']); $t('bad phone rejected', false); } catch (Mutqan_Error $e) { $t('bad phone rejected', $e->slug === 'bad_phone'); }
Mutqan_Store::update('used_ac', 'u1', ['status' => 'sold'], $sys);
try { $S::handle(['op' => 'offer', 'unitId' => 'u1', 'price' => 900, 'name' => 'x', 'phone' => '0551234567'], ['kind' => 'guest']); $t('sold unit rejected', false); } catch (Mutqan_Error $e) { $t('sold unit rejected', $e->slug === 'unavailable'); }
// public catalogue is readable by guests, the private floor is not
$guest = ['id' => 'anon1', 'role' => null, 'powers' => [], 'kind' => 'guest'];
$pub = Mutqan_Store::select('used_ac', [], [], $guest);
$t('guest can read catalogue', is_array($pub) && count($pub) >= 1);
$prv = Mutqan_Store::select('used_ac_private', [], [], $guest);
$t('guest cannot read private floor', empty($prv));
// order seal
$sr = $S::handle(['op' => 'seal', 'service' => 'صيانة مكيف', 'price' => 250, 'time' => 'اليوم 5م', 'address' => 'مكة', 'ref' => 'AB123'], ['kind' => 'guest']);
$t('seal returns short url', preg_match('#/v/[A-Z0-9]{8}-[a-f0-9]{6}$#', $sr['url']) === 1);
$tok = substr($sr['url'], strrpos($sr['url'], '/v/') + 3);
$t('seal verified', $S::seal_check($tok)[0] === 'verified');
$t('seal wrong checksum -> invalid', $S::seal_check(substr($tok, 0, 9) . 'ffffff')[0] === 'invalid');
$t('seal no checksum -> invalid', $S::seal_check(substr($tok, 0, 8))[0] === 'invalid');
$t('seal unknown code -> missing', $S::seal_check('ZZZZZZZZ-aaaaaa')[0] === 'missing');
$t('seal garbage -> missing', $S::seal_check('x')[0] === 'missing');
$t('seal not readable by guest', empty(Mutqan_Store::select('order_seals', [], [], $guest)));
// appointment reminder
$soon = gmdate('c', time() + 600); $far = gmdate('c', time() + 7200);
Mutqan_Store::insert('orders', ['specialtyId' => 'ac', 'status' => 'new', 'appointmentAt' => $soon, 'preferredTime' => 'اليوم 5م', 'clientId' => 'cu1', 'clientName' => 'x'], 'ordsoon', [], $sys);
Mutqan_Store::insert('orders', ['specialtyId' => 'ac', 'status' => 'new', 'appointmentAt' => $far, 'clientId' => 'cu1'], 'ordfar', [], $sys);
$t('reminder sent only for appointment within 15 min', Mutqan_REST::send_reminders() === 1);
$t('reminder not repeated', Mutqan_REST::send_reminders() === 0);
$pu = Mutqan_Store::select('_push', [], ['limit' => 20], $sys);
$t('customer push created', count(array_filter($pu, function ($m) { return ($m['event'] ?? '') === 'appointment_reminder' && ($m['target']['user'] ?? '') === 'cu1'; })) === 1);
// order routing + manual orders
$anon = ['id' => 'anon-1', 'role' => null, 'powers' => [], 'kind' => 'anon'];
$ops = ['id' => 'ops1', 'role' => 'operations', 'powers' => ['read', 'write'], 'kind' => 'user'];
$ord = function ($id, $p, $extra = []) { return Mutqan_Store::insert('orders', array_merge(['specialtyId' => 'ac', 'clientName' => 'x', 'description' => 'd', 'status' => 'new'], $extra), $id, [], $p); };
$ord('rt1', $anon);
$t('default routing = whatsapp for customer orders', (Mutqan_Store::get_raw('orders', 'rt1')['routing'] ?? '') === 'whatsapp');
Mutqan_Store::upsert('pricing', ['serviceId' => 'order_routing', 'mode' => 'operations', 'opsCreate' => false], 'order_routing', ['groupId' => 'admins', 'writableBy' => 'admins'], $sys);
$ord('rt2', $anon, ['routing' => 'whatsapp']);
$t('operations routing stamped server-side (client cannot override)', (Mutqan_Store::get_raw('orders', 'rt2')['routing'] ?? '') === 'operations');
$ord('rt3', $anon, ['source' => 'whatsapp_manual']);
$t('customer cannot fake a manual order', !isset(Mutqan_Store::get_raw('orders', 'rt3')['source']));
$blocked = false; try { $ord('rt4', $ops, ['source' => 'whatsapp_manual']); } catch (Mutqan_Error $e) { $blocked = $e->status === 403; }
$t('ops manual order blocked while owner switch is off', $blocked);
Mutqan_Store::update('pricing', 'order_routing', ['opsCreate' => true], $sys);
$ord('rt5', $ops, ['source' => 'whatsapp_manual']);
$m = Mutqan_Store::get_raw('orders', 'rt5');
$t('ops manual order allowed when owner enables it, routed to operations', ($m['source'] ?? '') === 'whatsapp_manual' && ($m['routing'] ?? '') === 'operations');
$ld = $S::handle(['op' => 'load'], ['kind' => 'guest']);
$t('load returns booked times only', isset($ld['times']) && count($ld['times']) >= 1 && strpos(json_encode($ld), 'clientName') === false);
Mutqan_Store::insert('schedule_cfg', ['openFrom' => '09:00'], 'main', [], $sys);
$t('schedule_cfg is public-readable', count(Mutqan_Store::select('schedule_cfg', [], [], $guest)) === 1);
// payment links
$pc = $S::handle(['op' => 'pay_create', 'amount' => 350, 'desc' => 'غسيل 3 مكيفات', 'orderId' => 'rt1'], $ops);
$t('pay link created with short url', preg_match('#/pay/[A-Z0-9]{8}$#', $pc['url']) === 1);
$bad = false; try { $S::handle(['op' => 'pay_create', 'amount' => 0], $ops); } catch (Mutqan_Error $e) { $bad = true; }
$t('pay link rejects zero amount', $bad);
$deny = false; try { $S::handle(['op' => 'pay_create', 'amount' => 10], $anon); } catch (Mutqan_Error $e) { $deny = $e->status === 403; }
$t('customer cannot create pay links', $deny);
$S::handle(['op' => 'pay_claim', 'code' => $pc['code'], 'name' => 'علي', 'ref' => 'TX123', 'method' => 'transfer'], $anon);
$t('claim stored but NOT marked paid', (Mutqan_Store::get_raw('pay_links', $pc['code'])['status'] ?? '') === 'claimed' && (Mutqan_Store::get_raw('orders', 'rt1')['paymentStatus'] ?? '') !== 'paid');
$deny = false; try { $S::handle(['op' => 'pay_mark', 'code' => $pc['code']], $anon); } catch (Mutqan_Error $e) { $deny = true; }
$t('customer cannot mark paid', $deny);
$S::handle(['op' => 'pay_mark', 'code' => $pc['code']], $ops);
$t('team marks paid and the order follows', (Mutqan_Store::get_raw('pay_links', $pc['code'])['status'] ?? '') === 'paid' && (Mutqan_Store::get_raw('orders', 'rt1')['paymentStatus'] ?? '') === 'paid');
$t('pay_links not readable by guest', empty(Mutqan_Store::select('pay_links', [], [], $guest)));
exit($ok ? 0 : 1);
