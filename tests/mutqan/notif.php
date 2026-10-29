<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/wpshim.php';
Mutqan_Store::maybe_install();
$ok = true; $t = function ($n, $c) use (&$ok) { echo ($c ? 'PASS ' : 'FAIL ') . $n . "\n"; if (!$c) { $ok = false; } };
$ops = ['id' => 'o1', 'role' => 'operations', 'kind' => 'user', 'powers' => ['read', 'write'], 'name' => 'x'];
$cust = ['id' => 'c1', 'role' => null, 'kind' => 'user', 'powers' => []];
Mutqan_Rest::admin_alert('🆕 طلب جديد', 'عميل · حي النزهة', '#/staff/order/abc', 'new_order', 'high', 'abc');
$rows = Mutqan_Store::select('notifications', [], ['limit' => 20], $ops, false);
$t('ops sees new_order notification', count($rows) >= 1 && $rows[0]['event'] === 'new_order' && $rows[0]['audience'] === 'ops' && $rows[0]['priority'] === 'high');
$t('customer does not see it', count(Mutqan_Store::select('notifications', [], ['limit' => 20], $cust, false)) === 0);
$push = Mutqan_Store::select('_push', [], ['limit' => 10, 'order' => 'createdAt'], Mutqan_WA::sys(), false);
$hit = array_values(array_filter($push, function ($r) { return ($r['title'] ?? '') === '🆕 طلب جديد'; }));
$t('push queued for admins with priority', count($hit) >= 1 && !empty($hit[0]['target']['admins']) && $hit[0]['priority'] === 'high');
exit($ok ? 0 : 1);
