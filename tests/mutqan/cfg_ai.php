<?php
if (PHP_SAPI !== 'cli' && PHP_SAPI !== 'cli-server') { http_response_code(404); exit; }
require __DIR__ . '/wpshim.php';
$s = Mutqan_AI::settings();
$s['providers']['groq'] = array_merge($s['providers']['groq'], ['enabled' => 1, 'key' => 'gsk_test']);
$s['providers']['gemini'] = array_merge($s['providers']['gemini'], ['enabled' => 1, 'key' => 'AIza_test']);
update_option('mutqan_ai_settings', $s);
echo "ai configured\n";
