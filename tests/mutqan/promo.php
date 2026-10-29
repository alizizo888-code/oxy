<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/wpshim.php';
$_SERVER['REMOTE_ADDR'] = '10.0.0.7';
$ok = true; $t = function ($n, $c) use (&$ok) { echo ($c ? 'PASS ' : 'FAIL ') . $n . "\n"; if (!$c) { $ok = false; } };
$d1 = 'dAAAAAAAAAAAAAAAA' . bin2hex(random_bytes(4)); $d2 = 'dBBBBBBBBBBBBBBBB' . bin2hex(random_bytes(4)); $d3 = 'dCCCCCCCCCCCCCCCC' . bin2hex(random_bytes(4));
$t('first order gets 30%', Mutqan_Promo::consume($d1) === 30);
$t('same device again gets 0', Mutqan_Promo::consume($d1) === 0);
$t('status used', Mutqan_Promo::status($d1)[0] === 'used');
$t('second device on same IP ok', Mutqan_Promo::consume($d2) === 30);
$t('third device on same IP blocked', Mutqan_Promo::consume($d3) === 0);
$t('bad device id gives 0', Mutqan_Promo::consume('bad') === 0);
$t('cap: 30% of 50 = 15', Mutqan_Promo::off(50) == 15.0);
$t('cap: 30% of 400 limited to 20', Mutqan_Promo::off(400) == 20.0);
exit($ok ? 0 : 1);
