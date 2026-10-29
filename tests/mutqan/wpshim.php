<?php
if (PHP_SAPI !== 'cli' && PHP_SAPI !== 'cli-server') { http_response_code(404); exit; }
// Minimal WordPress stand-in for integration tests: sqlite-backed $wpdb, options, transients, REST dispatch.
define('ABSPATH', '/nonexistent/');
define('MUTQAN_SQLITE', true);
define('ARRAY_A', 'ARRAY_A');
define('MINUTE_IN_SECONDS', 60); define('HOUR_IN_SECONDS', 3600); define('DAY_IN_SECONDS', 86400);
define('JSON_HEX_TAG_X', 1);
$GLOBALS['__dir'] = getenv('MQ_DATA') ?: sys_get_temp_dir() . '/mutqan-test-data';
@mkdir($GLOBALS['__dir'], 0777, true);
$GLOBALS['__hooks'] = []; $GLOBALS['__routes'] = [];

class Shim_DB {
    public $prefix = 'wp_'; public $pdo;
    function __construct() {
        $this->pdo = new PDO('sqlite:' . $GLOBALS['__dir'] . '/db.sqlite');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_SILENT);
        $this->pdo->exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000');
        $this->pdo->exec('CREATE TABLE IF NOT EXISTS shim_kv (k TEXT PRIMARY KEY, v TEXT, exp INTEGER)');
    }
    function get_charset_collate() { return ''; }
    function prepare($sql, ...$args) {
        if (count($args) === 1 && is_array($args[0])) { $args = $args[0]; }
        $i = 0;
        return preg_replace_callback('/%[sdf]/', function ($m) use (&$i, $args) {
            $v = $args[$i++] ?? null;
            if ($m[0] === '%d') { return (string) (int) $v; }
            if ($m[0] === '%f') { return (string) (float) $v; }
            return $this->pdo->quote((string) $v);
        }, $sql);
    }
    function query($sql) { $r = $this->pdo->exec($sql); return $r === false ? false : $r; }
    function get_results($sql, $o = null) { $s = $this->pdo->query($sql); return $s ? $s->fetchAll(PDO::FETCH_ASSOC) : []; }
    function get_row($sql, $o = null) { $s = $this->pdo->query($sql); $r = $s ? $s->fetch(PDO::FETCH_ASSOC) : false; return $r ?: null; }
    function get_var($sql) { $s = $this->pdo->query($sql); $r = $s ? $s->fetch(PDO::FETCH_NUM) : false; return $r ? $r[0] : null; }
    function get_col($sql) { $s = $this->pdo->query($sql); return $s ? $s->fetchAll(PDO::FETCH_COLUMN, 0) : []; }
    private function lit($v) { return $v === null ? 'NULL' : (is_int($v) || is_float($v) ? (string) $v : $this->pdo->quote((string) $v)); }
    function insert($t, $d) {
        $sql = "INSERT INTO $t (" . implode(',', array_keys($d)) . ') VALUES (' . implode(',', array_map([$this, 'lit'], $d)) . ')';
        $r = $this->pdo->exec($sql); return $r === false ? false : $r;
    }
    private function wh($w) { $p = []; foreach ($w as $k => $v) { $p[] = $v === null ? "$k IS NULL" : "$k=" . $this->lit($v); } return implode(' AND ', $p); }
    function update($t, $d, $w) {
        $s = []; foreach ($d as $k => $v) { $s[] = "$k=" . $this->lit($v); }
        $r = $this->pdo->exec("UPDATE $t SET " . implode(',', $s) . ' WHERE ' . $this->wh($w)); return $r === false ? false : $r;
    }
    function delete($t, $w) { $r = $this->pdo->exec("DELETE FROM $t WHERE " . $this->wh($w)); return $r === false ? false : $r; }
}
$GLOBALS['wpdb'] = new Shim_DB();

function __kv_get($k) { $r = $GLOBALS['wpdb']->get_row($GLOBALS['wpdb']->prepare('SELECT v, exp FROM shim_kv WHERE k=%s', $k)); if (!$r) return [false, null]; if ($r['exp'] && $r['exp'] < time()) return [false, null]; return [true, unserialize($r['v'])]; }
function __kv_set($k, $v, $ttl = 0) { $GLOBALS['wpdb']->query($GLOBALS['wpdb']->prepare('REPLACE INTO shim_kv (k,v,exp) VALUES (%s,%s,%d)', $k, serialize($v), $ttl ? time() + $ttl : 0)); }
function get_option($n, $d = false) { list($ok, $v) = __kv_get('opt_' . $n); return $ok ? $v : $d; }
function update_option($n, $v, $a = null) { __kv_set('opt_' . $n, $v); return true; }
function delete_option($n) { $GLOBALS['wpdb']->query($GLOBALS['wpdb']->prepare('DELETE FROM shim_kv WHERE k=%s', 'opt_' . $n)); }
function get_transient($n) { list($ok, $v) = __kv_get('tr_' . $n); return $ok ? $v : false; }
function set_transient($n, $v, $t = 0) { __kv_set('tr_' . $n, $v, $t); return true; }
function delete_transient($n) { $GLOBALS['wpdb']->query($GLOBALS['wpdb']->prepare('DELETE FROM shim_kv WHERE k=%s', 'tr_' . $n)); }

function add_action($h, $cb, $p = 10, $a = 1) { $GLOBALS['__hooks'][$h][] = $cb; }
function add_filter($h, $cb, $p = 10, $a = 1) { $GLOBALS['__hooks'][$h][] = $cb; }
function do_action($h, ...$a) { foreach ($GLOBALS['__hooks'][$h] ?? [] as $cb) { call_user_func_array($cb, $a); } }
function wp_next_scheduled($h) { return true; } function wp_schedule_event(...$a) {}
function register_rest_route($ns, $route, $args) { $GLOBALS['__routes'][$ns . $route] = $args; }  // $args is one handler or a list of handlers keyed by method
function home_url($p = '') { return 'http://127.0.0.1:8099' . ($p === '' ? '' : '/' . ltrim($p, '/')); }
function rest_url($p = '') { return 'http://127.0.0.1:8099/wp-json/' . ltrim($p, '/'); }
function esc_url_raw($u) { return $u; } function esc_url($u) { return $u; } function esc_attr($s) { return htmlspecialchars((string) $s, ENT_QUOTES); } function esc_html($s) { return htmlspecialchars((string) $s, ENT_QUOTES); }
function wp_parse_url($u, $c = -1) { return parse_url($u, $c); }
function wp_unslash($v) { return $v; } function sanitize_text_field($s) { return trim(strip_tags((string) $s)); }
function wp_json_encode($d, $f = 0) { return json_encode($d, $f); }
function trailingslashit($s) { return rtrim($s, '/\\') . '/'; }
function plugin_dir_path($f) { return trailingslashit(dirname($f)); }
function wp_generate_uuid4() { return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x', mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000, mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)); }
function wp_salt($x = '') { return 'test-salt'; } function nocache_headers() {} function status_header($c) { http_response_code($c); }
function wp_safe_redirect($u) { header('Location: ' . $u); } function is_wp_error($x) { return $x instanceof WP_Error; }
function current_user_can($c) { return true; } function wp_die($m) { die($m); } function is_admin() { return false; }
function wp_upload_dir() { $d = $GLOBALS['__dir'] . '/uploads'; @mkdir($d, 0777, true); return ['basedir' => $d, 'baseurl' => 'http://127.0.0.1:8099/uploads']; }
function wp_mkdir_p($d) { return is_dir($d) || mkdir($d, 0777, true); }
class WP_Error { public $m; function __construct($c = '', $m = '') { $this->m = $m; } function get_error_message() { return $this->m; } }
class WP_REST_Response { public $data; public $status; public $headers = []; function __construct($d = null, $s = 200) { $this->data = $d; $this->status = $s; } function header($k, $v) { $this->headers[$k] = $v; } }
class WP_REST_Request {
    public $method, $headers = [], $body = '', $params = [], $files = [];
    function get_header($n) { return $this->headers[strtolower(str_replace('_', '-', $n))] ?? null; }
    function get_json_params() { $j = json_decode($this->body, true); return is_array($j) ? $j : null; }
    function get_param($k) { return $this->params[$k] ?? null; }
    function get_body() { return $this->body; }
    function get_file_params() { return $this->files; }
}
// Outbound HTTP (AI providers, WhatsApp, Nominatim) is faked and logged.
function wp_remote_post($url, $a) {
    $log = $GLOBALS['__dir'] . '/http.log';
    file_put_contents($log, json_encode(['url' => $url, 'body' => json_decode($a['body'] ?? '', true)], JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND);
    $mode = @file_get_contents($GLOBALS['__dir'] . '/ai_mode_' . (strpos($url, 'groq') !== false ? 'groq' : (strpos($url, 'generativelanguage') !== false ? 'gemini' : 'other'))) ?: 'ok';
    if (strpos($url, 'graph.facebook.com') !== false) { return ['code' => 200, 'body' => '{}', 'headers' => []]; }
    if ($mode === '429') { return ['code' => 429, 'body' => '{"error":{"message":"Rate limit exceeded: per day"}}', 'headers' => ['retry-after' => '60']]; }
    $b = json_decode($a['body'], true);
    $prompt = $b['messages'][0]['content'] ?? ($b['contents'][0]['parts'][0]['text'] ?? '');
    $wantJson = isset($b['response_format']) || isset($b['generationConfig']['responseMimeType']);
    $text = $wantJson ? '{"reply":"أهلا وسهلا","intent":{},"action":"none"}' : 'تم';
    if (strpos($url, 'groq') !== false) { return ['code' => 200, 'body' => json_encode(['choices' => [['message' => ['content' => $text]]]]), 'headers' => []]; }
    if (strpos($url, 'generativelanguage') !== false) { return ['code' => 200, 'body' => json_encode(['candidates' => [['content' => ['parts' => [['text' => 'GEMINI:' . $text]]]]]]), 'headers' => []]; }
    return ['code' => 500, 'body' => '{}', 'headers' => []];
}
function wp_remote_get($url, $a = []) { return ['code' => 200, 'body' => json_encode(['address' => ['road' => 'شارع التحلية', 'city' => 'جدة']]), 'headers' => []]; }
function wp_remote_retrieve_response_code($r) { return $r['code']; } function wp_remote_retrieve_body($r) { return $r['body']; }
function wp_remote_retrieve_header($r, $h) { return $r['headers'][$h] ?? ''; }

function wp_parse_args($a, $d = []) { return array_merge($d, (array) $a); }
function register_post_type(...$a) {} function wp_insert_post($a, $e = false) { static $n = 0; return ++$n; } function update_post_meta(...$a) {} function sanitize_textarea_field($s) { return trim(strip_tags((string) $s)); } function wp_strip_all_tags($s) { return strip_tags($s); }
$P = dirname(__DIR__, 2) . '/oxygen-ac-automation/includes/';
require $P . 'class-oxygen-orders-chat.php';
foreach (['store', 'policy', 'auth', 'passkey', 'promo', 'wa', 'ai', 'rest', 'admin'] as $part) { require $P . 'mutqan/class-mutqan-' . $part . '.php'; }
Mutqan_Rest::boot();
do_action('init'); do_action('rest_api_init');

function shim_dispatch($method, $path, $headers, $body, $params = []) {
    $key = preg_replace('#^/wp-json/#', '', $path);
    $route = $GLOBALS['__routes'][$key] ?? null;
    if (!$route) { return new WP_REST_Response(['error' => ['code' => 'no_route', 'message' => $key]], 404); }
    $req = new WP_REST_Request(); $req->method = $method; $req->body = $body; $req->params = $params;
    foreach ($headers as $k => $v) { $req->headers[strtolower($k)] = $v; }
    if (isset($route[0])) { // list of handlers: pick by HTTP method
        $pick = null;
        foreach ($route as $h) { if (strtoupper($h['methods']) === strtoupper($method)) { $pick = $h; } }
        if (!$pick) { return new WP_REST_Response(['error' => ['code' => 'bad_method']], 405); }
        $route = $pick;
    }
    return call_user_func($route['callback'], $req);
}
