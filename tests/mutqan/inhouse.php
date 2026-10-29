<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/wpshim.php';
Mutqan_Store::maybe_install();
$ok = true; $t = function ($n, $c) use (&$ok) { echo ($c ? 'PASS ' : 'FAIL ') . $n . "\n"; if (!$c) { $ok = false; } };
$owner = ['id' => 'system', 'role' => 'owner', 'powers' => ['read', 'write', 'manage'], 'kind' => 'user'];
$cust = ['id' => 'cust1', 'kind' => 'user', 'role' => null, 'powers' => []];
$order = function ($extra = []) { return ['specialtyId' => 'plumbing', 'qty' => 1, 'description' => 'x', 'priority' => 'normal'] + $extra; };
$t('off by default', Mutqan_Policy::inhouse_mode() === false);
$d = Mutqan_Policy::sanitize_insert('orders', $order(['inhouse' => true]), $cust);
$t('customer cannot self-flag inhouse when off', empty($d['inhouse']));
Mutqan_Store::upsert('pricing', ['serviceId' => 'ops_mode', 'inhouse' => true], 'ops_mode', ['writableBy' => 'admins'], $owner);
$t('mode on', Mutqan_Policy::inhouse_mode() === true);
$d = Mutqan_Policy::sanitize_insert('orders', $order(), $cust);
$t('new customer order flagged inhouse', !empty($d['inhouse']) && !empty($d['inhouseAt']));
Mutqan_Store::upsert('pricing', ['serviceId' => 'ops_mode', 'inhouse' => false], 'ops_mode', ['writableBy' => 'admins'], $owner);
$d = Mutqan_Policy::sanitize_insert('orders', $order(['inhouse' => true]), $cust);
$t('mode off again: not flagged, client flag stripped', empty($d['inhouse']));
exit($ok ? 0 : 1);
