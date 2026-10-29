<?php
if (PHP_SAPI !== 'cli' && PHP_SAPI !== 'cli-server') { http_response_code(404); exit; }
require __DIR__ . '/wpshim.php';
Mutqan_Store::maybe_install();
Mutqan_Auth::set_owner('ali', 'Ali', $argv[1]);
echo "owner set\n";
