<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/wpshim.php';
// gateway stub: records sends, returns a message id
$GLOBALS['__sent'] = [];
function wp_remote_request($url, $a) {
    if (preg_match('#/sessions/([^/]+)/send$#', $url, $m)) { $b = json_decode($a['body'], true); $GLOBALS['__sent'][] = [$m[1], $b['to'], $b['text']]; return ['code' => 200, 'body' => json_encode(['msgId' => 'G' . count($GLOBALS['__sent'])]), 'headers' => []]; }
    return ['code' => 200, 'body' => json_encode(['sessions' => []]), 'headers' => []];
}
Mutqan_Store::maybe_install();
$ok = true; $t = function ($n, $c) use (&$ok) { echo ($c ? 'PASS ' : 'FAIL ') . $n . "\n"; if (!$c) { $ok = false; } };
$B = 'Mutqan_WA_Bot';
$c = $B::defaults(); $c['enabled'] = true;
$c['videos'] = [['title' => 'غسيل المكيف', 'url' => 'https://www.tiktok.com/@x/video/1', 'keywords' => 'غسيل مكيف']];
$c['faq'] = [['keywords' => 'ضمان', 'reply' => 'الضمان 6 أشهر']];
$noon = strtotime('2026-10-28 12:00:00 Asia/Riyadh'); $night = strtotime('2026-10-28 03:00:00 Asia/Riyadh');
$t('open at noon', $B::open_now($c['hours'], $noon)); $t('closed at 3am', !$B::open_now($c['hours'], $night));
$o = $B::decide($c, [], 'السلام عليكم', $noon);
$t('first msg -> welcome+menu', count($o['replies']) === 1 && strpos($o['replies'][0], 'متقن') !== false && strpos($o['replies'][0], '5️⃣') !== false);
$th = ['bot' => $o['patch']['bot']];
$o = $B::decide($c, $th, '2', $noon + 5);
$t('2 -> tiktok link', strpos($o['replies'][0], 'tiktok.com') !== false);
$o = $B::decide($c, $th, 'كيف اغسل مكيف', $noon + 6);
$t('keyword video', strpos($o['replies'][0], 'tiktok.com') !== false);
$o = $B::decide($c, $th, 'كم الضمان عندكم؟', $noon + 7);
$t('faq reply', $o['replies'][0] === 'الضمان 6 أشهر');
$o = $B::decide($c, $th, 'مواعيد الدوام', $noon + 8);
$t('hours reply', strpos($o['replies'][0], '08:00') !== false && strpos($o['replies'][0], 'متواجدون') !== false);
$o = $B::decide($c, $th, '5', $noon + 9);
$t('human in hours -> handoff + pause + notify', strpos($o['replies'][0], 'تحويل') !== false && $o['patch']['bot']['pausedUntil'] > $noon && $o['notify']);
$t('paused -> silent', $B::decide($c, $o['patch'] + ['bot' => $o['patch']['bot']], 'hello', $noon + 20)['replies'] === []);
$o = $B::decide($c, $th, '5', $night);
$t('human while away -> capture starts', $o['patch']['bot']['step'] === 'name');
$th2 = ['bot' => $o['patch']['bot']];
$o = $B::decide($c, $th2, 'محمد', $night + 5); $th2 = ['bot' => $o['patch']['bot']];
$o = $B::decide($c, $th2, 'غسيل مكيف', $night + 10); $th2 = ['bot' => $o['patch']['bot']];
$o = $B::decide($c, $th2, 'حي النزهة', $night + 15);
$t('capture completes with lead', $o['lead'] && $o['lead']['name'] === 'محمد' && $o['lead']['area'] === 'حي النزهة' && $o['patch']['bot']['step'] === null);
$c2 = $c; $c2['forceAway'] = true;
$o = $B::decide($c2, $th, '5', $noon);
$t('forceAway in hours -> capture', $o['patch']['bot']['step'] === 'name');
$bot = ['welcomedAt' => $noon, 'hourStart' => $noon, 'hourCount' => 8];
$t('rate limit', $B::decide($c, ['bot' => $bot], '1', $noon + 5)['replies'] === []);

// webhook end to end
$cfg = Mutqan_WA::config_set(['url' => 'http://gw.local:8787', 'token' => 'tok']);
$t('config hides token', $cfg['hasToken'] === true && !isset($cfg['token']));
$sec = $cfg['secret'];
$body = json_encode(['type' => 'message', 'accountId' => 'main', 'msgId' => 'ABC1', 'direction' => 'in', 'phone' => '966501234567', 'name' => 'عميل', 'text' => 'مرحبا', 'kind' => 'text', 'ts' => time()]);
try { Mutqan_WA::webhook($body, 'bad'); $t('bad signature rejected', false); } catch (Mutqan_Error $e) { $t('bad signature rejected', $e->status === 403); }
Mutqan_Store::upsert('wa_bot', ['enabled' => true], 'cfg', [], Mutqan_WA::sys());
Mutqan_WA::webhook($body, hash_hmac('sha256', $body, $sec));
$tid = Mutqan_WA::tid('main', '966501234567');
$th = Mutqan_Store::get_raw('wa_threads', $tid);
$t('thread created + unread 1', $th && $th['unread'] === 1 && $th['phone'] === '966501234567');
$t('bot welcomed via gateway', count($GLOBALS['__sent']) === 1 && $GLOBALS['__sent'][0][0] === 'main');
Mutqan_WA::webhook($body, hash_hmac('sha256', $body, $sec));
$t('duplicate ignored', Mutqan_Store::get_raw('wa_threads', $tid)['unread'] === 1 && count($GLOBALS['__sent']) === 1);
$out = json_encode(['type' => 'message', 'accountId' => 'main', 'msgId' => 'PH1', 'direction' => 'out', 'phone' => '966501234567', 'text' => 'اهلا', 'kind' => 'text', 'ts' => time()]);
Mutqan_WA::webhook($out, hash_hmac('sha256', $out, $sec));
$t('reply from phone pauses bot', Mutqan_Store::get_raw('wa_threads', $tid)['bot']['pausedUntil'] > time());
$ops = ['id' => 'o1', 'role' => 'operations', 'kind' => 'user', 'powers' => ['read', 'write'], 'name' => 'مشرف'];
Mutqan_WA::handle(['op' => 'send', 'accountId' => 'main', 'to' => '966501234567', 'text' => 'تم'], $ops);
$t('staff send stores msg', count($GLOBALS['__sent']) === 2);
$cust = ['id' => 'c1', 'role' => null, 'kind' => 'user', 'powers' => []];
try { Mutqan_WA::handle(['op' => 'sessions'], $cust); $t('customer denied', false); } catch (Mutqan_Error $e) { $t('customer denied', $e->status === 403); }
$t('customer cannot read msgs', count(Mutqan_Store::select('wa_msgs', [], ['limit' => 50], $cust, false)) === 0);
$rows = Mutqan_Store::select('wa_msgs', [], ['limit' => 50], $ops, false);
$t('ops can read msgs', count($rows) >= 4);

// ── sales brain ──
$c = $B::defaults(); $c['enabled'] = true;
$mk = function ($th, $txt, $ts) use ($B, $c) { $o = $B::decide($c, $th, $txt, $ts); return [$o, ['bot' => $o['patch']['bot'] ?? ($th['bot'] ?? [])]]; };
Mutqan_Store::upsert('pricing', ['serviceId' => 'ac_calc', 'maxDiscountPct' => 20], 'ac_calc', [], Mutqan_WA::sys());
$ts = $noon + 1000; $th = [];
[$o, $th] = $mk($th, 'السلام عليكم', $ts);
$t('welcome asks need+count', strpos($o['replies'][0], 'كم') !== false || strpos($o['replies'][0], 'عدد') !== false);
[$o, $th] = $mk($th, 'ابغى غسيل مكيف', $ts + 5);
$t('asks quantity', count($o['replies']) === 1 && (strpos($o['replies'][0], 'كم') !== false || strpos($o['replies'][0], 'العدد') !== false));
[$o, $th] = $mk($th, '1', $ts + 10);
$t('quote 100', strpos($o['replies'][0], '100 ر.س') !== false && $th['bot']['neg']['floor'] === 80);
[$o, $th] = $mk($th, 'غالي', $ts + 15);
$t('step 90', strpos($o['replies'][0], '90') !== false);
[$o, $th] = $mk($th, 'لسه غالي', $ts + 20);
$t('step 80 floor', strpos($o['replies'][0], '80') !== false);
[$o, $th] = $mk($th, 'غالي برضو', $ts + 25);
$t('apology + support + notify', strpos($o['replies'][0], 'الدعم الفني') !== false && $o['notify'] && $th['bot']['await'] === 'handoff');
$t('never below floor', !preg_match('/\b(7\d|6\d)\s*ر\.س/u', implode(' ', $o['replies'])));
[$o, $th] = $mk($th, 'ايوه حولني', $ts + 30);
$t('accept handoff pauses', ($o['patch']['bot']['pausedUntil'] ?? 0) > $ts);
// counter below floor
[$o, $th2] = $mk([], 'غسيل 1 مكيف', $ts + 100);
[$o, $th2] = $mk($th2, 'ادفع 50', $ts + 105);
$t('counter 50 refused', strpos($o['replies'][0], 'الدعم الفني') !== false);
[$o, $th3] = $mk([], 'غسيل 1 مكيف', $ts + 200);
[$o, $th3] = $mk($th3, 'ابغى 85', $ts + 205);
$t('counter 85 accepted', $th3['bot']['neg']['offer'] === 85 && strpos($o['replies'][0], '85') !== false);
// coverage
$t('area inside', $B::area('حي الشوقية')['inside'] === true && $B::area('انا في جدة')['inside'] === false);
$t('moving to makkah not outside', ($B::area('نقل عفش من جده لمكه')['inside'] ?? true) !== false);
[$o] = $mk([], 'عندي مكيف في الطايف', $ts + 300);
$t('outside makkah -> partners', strpos($o['replies'][0], 'فروع') !== false || strpos($o['replies'][0], 'شرك') !== false);
// long absence
[$o, $thr] = $mk([], 'ابغى غسيل مكيف', $ts + 400);
[$o, $thr] = $mk($thr, 'مرحبا', $ts + 400 + 7 * 3600);
$t('resume prompt after absence', strpos($o['replies'][0], 'استكمال') !== false && strpos($o['replies'][0], 'جديدة') !== false);
[$o, $thr] = $mk($thr, '2', $ts + 400 + 7 * 3600 + 5);
$t('fresh chat resets', empty($thr['bot']['pendingWash']) && empty($thr['bot']['await']));
// ladder
$t('ladder 200/160/2', $B::ladder(200, 160, 2) === [180, 160]);
// learning
Mutqan_WA::learn_from_owner('كم سعر تركيب سبليت', 'تركيب السبليت يبدأ من 350 ريال شامل الفريون 🌟');
$lr = Mutqan_Store::get_raw('wa_bot', 'learn:' . substr(md5($B::norm('كم سعر تركيب سبليت')), 0, 16));
$t('owner reply learned (pending)', $lr && $lr['status'] === 'pending' && $lr['count'] === 1);
$st = Mutqan_Store::get_raw('wa_bot', 'style'); $t('style profile', $st && $st['n'] === 1 && $st['emoji'] >= 1);
Mutqan_WA::learn_miss('عندكم رش مبيدات للنمل');
$t('miss logged', Mutqan_Store::get_raw('wa_bot', 'miss:' . substr(md5($B::norm('عندكم رش مبيدات للنمل')), 0, 16))['count'] === 1);
// ── field map collections ──
$tech = ['id' => 't1', 'role' => 'technician', 'kind' => 'user', 'powers' => []];
Mutqan_Store::insert('customer_profiles', ['status' => 'vip', 'finance' => 'ok'], 'p500000001', [], Mutqan_WA::sys());
Mutqan_Store::insert('shops', ['name' => 'محل الاختبار', 'lat' => 21.4, 'lng' => 39.8, 'available' => true], 's1', [], Mutqan_WA::sys());
$t('ops reads customer profiles', count(Mutqan_Store::select('customer_profiles', [], ['limit' => 10], $ops, false)) === 1);
$t('customer cannot read profiles', count(Mutqan_Store::select('customer_profiles', [], ['limit' => 10], $cust, false)) === 0);
$t('technician cannot read profiles', count(Mutqan_Store::select('customer_profiles', [], ['limit' => 10], $tech, false)) === 0);
$t('technician reads shops', count(Mutqan_Store::select('shops', [], ['limit' => 10], $tech, false)) === 1);
$t('customer cannot read shops', count(Mutqan_Store::select('shops', [], ['limit' => 10], $cust, false)) === 0);
try { Mutqan_Store::insert('shops', ['name' => 'x'], null, [], $tech); $t('technician cannot write shops', false); } catch (Mutqan_Error $e) { $t('technician cannot write shops', true); }
exit($ok ? 0 : 1);
