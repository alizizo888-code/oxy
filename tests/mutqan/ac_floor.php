<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/wpshim.php';
Mutqan_Store::maybe_install();
$cases = [
  ['wash 3 splits', ['mode' => 'wash', 'type' => 'سبليت', 'qty' => 3, 'full' => true], 179],     // 200 * 0.9 - 1
  ['wash 1 split inner only', ['mode' => 'wash', 'type' => 'سبليت', 'qty' => 1, 'full' => false], 80],  // (100-10) * .9 -1
  ['window x2', ['mode' => 'wash', 'type' => 'شباك', 'qty' => 2], 89],
  ['other x2 + 3 months warranty + VAT', ['mode' => 'wash', 'type' => 'داكت', 'qty' => 2, 'warranty' => '3 شهور', 'vat' => true], 434], // (360+60)*1.15*0.9 - 1
  ['mixed 3 split + 2 window', ['items' => [['type' => 'سبليت', 'qty' => 3], ['type' => 'شباك', 'qty' => 2]], 'warranty' => 'بدون'], 269],  // (200+100)*.9 -1
  ['maintenance has no floor', ['mode' => 'maintenance', 'type' => 'سبليت'], 0],
];
$bad = 0;
foreach ($cases as [$n, $q, $want]) {
  $got = Mutqan_Policy::ac_floor($q);
  $ok = abs($got - $want) <= 1;
  if (!$ok) { $bad++; }
  echo ($ok ? 'PASS ' : 'FAIL ') . "ac_floor: $n (got $got, want ~$want)\n";
}
exit($bad ? 1 : 0);
