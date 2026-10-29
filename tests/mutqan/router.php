<?php
if (PHP_SAPI !== 'cli' && PHP_SAPI !== 'cli-server') { http_response_code(404); exit; }
require __DIR__ . '/wpshim.php';
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$plugin = dirname(__DIR__, 2) . '/oxygen-ac-automation';
if (strpos($uri, '/wp-json/') === 0) {
    $hdr = [];
    foreach ($_SERVER as $k => $v) { if (strpos($k, 'HTTP_') === 0) { $hdr[strtolower(str_replace('_', '-', substr($k, 5)))] = $v; } }
    $res = shim_dispatch($_SERVER['REQUEST_METHOD'], $uri, $hdr, file_get_contents('php://input'), $_GET);
    http_response_code($res->status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($res->data, JSON_UNESCAPED_UNICODE);
    return true;
}
if (preg_match('#^/app/?(index\.html|sw\.js|manifest\.webmanifest|icon-192\.png|apple-touch-icon\.png)?$#', $uri)) { Mutqan_Rest::serve_app(); return true; }
$map = ['/wp-content/plugins/oxygen-ac-automation/' => $plugin . '/'];
foreach ($map as $pre => $dir) {
    if (strpos($uri, $pre) === 0) {
        $f = realpath($dir . substr($uri, strlen($pre)));
        if ($f && strpos($f, $dir) === 0 && is_file($f)) {
            $types = ['js' => 'text/javascript', 'css' => 'text/css', 'svg' => 'image/svg+xml', 'webmanifest' => 'application/manifest+json', 'html' => 'text/html'];
            header('Content-Type: ' . ($types[pathinfo($f, PATHINFO_EXTENSION)] ?? 'application/octet-stream'));
            readfile($f); return true;
        }
    }
}
http_response_code(404); echo 'not found';
