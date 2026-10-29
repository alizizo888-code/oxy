<?php
if (!defined('ABSPATH')) { exit; }

if (!function_exists('array_is_list')) {
    function array_is_list(array $a) { return $a === [] || array_keys($a) === range(0, count($a) - 1); }
}

/**
 * Mutqan document store.
 *
 * A small Firestore-style layer on top of one MySQL/MariaDB table: collections of JSON documents,
 * with filters, ordering, counting, grouping and summing. Every read and write goes through the
 * per-collection policy below, so the browser is never trusted to decide who may see or change what.
 *
 * Works on MySQL 5.7+/MariaDB 10.2+ (JSON_EXTRACT) and, for local tests, on SQLite (json_extract).
 */
final class Mutqan_Store {
    const DB_VERSION = '3';
    const MAX_LIMIT = 1000;
    const MAX_DOC_BYTES = 262144; // 256 KB per document

    /* ------------------------------------------------------------------ schema */

    public static function table($name) {
        global $wpdb;
        return $wpdb->prefix . 'mutqan_' . $name;
    }

    public static function is_sqlite() {
        return defined('MUTQAN_SQLITE') && MUTQAN_SQLITE;
    }

    public static function maybe_install() {
        if (get_option('mutqan_db_version') === self::DB_VERSION) { return; }
        self::install();
        update_option('mutqan_db_version', self::DB_VERSION, false);
    }

    public static function install() {
        global $wpdb;
        $docs = self::table('docs'); $users = self::table('users'); $sess = self::table('sessions'); $inv = self::table('invites');
        if (self::is_sqlite()) {
            foreach ([
                "CREATE TABLE IF NOT EXISTS $docs (pk INTEGER PRIMARY KEY AUTOINCREMENT, coll TEXT NOT NULL, doc_id TEXT NOT NULL, owner_id TEXT NOT NULL DEFAULT '', visible_to TEXT NOT NULL DEFAULT 'everyone', writable_by TEXT NOT NULL DEFAULT 'creator-and-admin', writable_fields TEXT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT NULL)",
                "CREATE UNIQUE INDEX IF NOT EXISTS {$docs}_uq ON $docs (coll, doc_id)",
                "CREATE INDEX IF NOT EXISTS {$docs}_cr ON $docs (coll, created_at)",
                "CREATE TABLE IF NOT EXISTS $users (id TEXT PRIMARY KEY, handle TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', password_hash TEXT NOT NULL, role TEXT NULL, disabled_role TEXT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, last_login TEXT NULL)",
                "CREATE TABLE IF NOT EXISTS $sess (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)",
                "CREATE TABLE IF NOT EXISTS $inv (code TEXT PRIMARY KEY, handle TEXT NULL, role TEXT NOT NULL, expires_at TEXT NULL, used_count INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)",
                "CREATE TABLE IF NOT EXISTS " . self::table('kv') . " (k TEXT PRIMARY KEY, v TEXT NOT NULL, exp INTEGER NOT NULL)",
            ] as $sql) { $wpdb->query($sql); }
            return;
        }
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $cs = $wpdb->get_charset_collate();
        dbDelta("CREATE TABLE $docs (
            pk BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            coll VARCHAR(64) NOT NULL,
            doc_id VARCHAR(64) NOT NULL,
            owner_id VARCHAR(48) NOT NULL DEFAULT '',
            visible_to VARCHAR(64) NOT NULL DEFAULT 'everyone',
            writable_by VARCHAR(64) NOT NULL DEFAULT 'creator-and-admin',
            writable_fields TEXT NULL,
            data LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            expires_at DATETIME NULL,
            PRIMARY KEY  (pk),
            UNIQUE KEY coll_doc (coll, doc_id),
            KEY coll_created (coll, created_at),
            KEY owner (owner_id)
        ) $cs;");
        dbDelta("CREATE TABLE $users (
            id VARCHAR(48) NOT NULL,
            handle VARCHAR(64) NOT NULL,
            display_name VARCHAR(120) NOT NULL DEFAULT '',
            phone VARCHAR(32) NOT NULL DEFAULT '',
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(24) NULL,
            disabled_role VARCHAR(24) NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'active',
            created_at DATETIME NOT NULL,
            last_login DATETIME NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY handle (handle),
            KEY role (role)
        ) $cs;");
        dbDelta("CREATE TABLE $sess (
            token_hash CHAR(64) NOT NULL,
            user_id VARCHAR(48) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (token_hash),
            KEY user_id (user_id)
        ) $cs;");
        dbDelta("CREATE TABLE $inv (
            code VARCHAR(40) NOT NULL,
            handle VARCHAR(64) NULL,
            role VARCHAR(24) NOT NULL,
            expires_at DATETIME NULL,
            used_count INT NOT NULL DEFAULT 0,
            active TINYINT(1) NOT NULL DEFAULT 1,
            created_by VARCHAR(48) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL,
            PRIMARY KEY  (code)
        ) $cs;");
    }

    /* ------------------------------------------------------------------ small helpers */

    public static function now() { return gmdate('Y-m-d H:i:s'); }
    public static function iso($mysql) {
        if (!$mysql) { return null; }
        $t = strtotime($mysql . ' UTC');
        return $t ? gmdate('Y-m-d\TH:i:s.000\Z', $t) : null;
    }
    public static function to_db_time($v) {
        $t = is_numeric($v) ? (int) $v : strtotime((string) $v);
        return $t ? gmdate('Y-m-d H:i:s', $t) : null;
    }

    /** @throws Mutqan_Error */
    private static function valid_field($f) {
        if (!is_string($f) || !preg_match('/^[A-Za-z_][A-Za-z0-9_]{0,40}(\.[A-Za-z_][A-Za-z0-9_]{0,40}){0,3}$/', $f)) {
            throw new Mutqan_Error('bad_field', 'حقل غير صالح.', 400);
        }
        return $f;
    }

    private static function valid_coll($c) {
        if (!is_string($c) || !preg_match('/^[A-Za-z_][A-Za-z0-9_]{0,62}$/', $c)) {
            throw new Mutqan_Error('bad_collection', 'مجموعة غير صالحة.', 400);
        }
        return $c;
    }

    private static function jx($field) {
        $path = '$.' . $field;
        return self::is_sqlite() ? "json_extract(data,'$path')" : "JSON_UNQUOTE(JSON_EXTRACT(data,'$path'))";
    }

    /** One filter condition -> [sql, params]. */
    private static function condition($field, $op, $val) {
        $pseudo = ['id' => 'doc_id', 'createdAt' => 'created_at', 'updatedAt' => 'updated_at'];
        $date = in_array($field, ['createdAt', 'updatedAt'], true);
        $col = isset($pseudo[$field]) ? $pseudo[$field] : self::jx(self::valid_field($field));
        $sqlite = self::is_sqlite();
        $ops = ['eq' => '=', 'ne' => '<>', 'gt' => '>', 'gte' => '>=', 'lt' => '<', 'lte' => '<='];

        if ($op === 'in') {
            $vals = array_values(array_filter((array) $val, 'is_scalar'));
            if (!$vals) { return ['1=0', []]; }
            $ph = implode(',', array_fill(0, count($vals), '%s'));
            return ["$col IN ($ph)", array_map('strval', $vals)];
        }
        if (!isset($ops[$op])) { throw new Mutqan_Error('bad_operator', 'عامل مقارنة غير صالح.', 400); }
        $o = $ops[$op];

        if ($val === null) {
            $isnull = $sqlite ? "$col IS NULL" : "($col IS NULL OR $col = 'null')";
            return [$op === 'ne' ? "NOT $isnull" : $isnull, []];
        }
        if (is_bool($val)) {
            $b = $sqlite ? ($val ? 1 : 0) : ($val ? 'true' : 'false');
            return $sqlite ? ["$col $o %d", [$b]] : ["$col $o %s", [$b]];
        }
        if ($date) {
            $t = self::to_db_time($val);
            if (!$t) { throw new Mutqan_Error('bad_date', 'تاريخ غير صالح.', 400); }
            return ["$col $o %s", [$t]];
        }
        if (is_int($val) || is_float($val)) {
            $cast = $sqlite ? "CAST($col AS REAL)" : "CAST($col AS DECIMAL(24,6))";
            return ["$cast $o %f", [(float) $val]];
        }
        if (is_string($val)) { return ["$col $o %s", [$val]]; }
        throw new Mutqan_Error('bad_value', 'قيمة غير صالحة.', 400);
    }

    /** filters object -> [sql, params]. Plain value = equality; {gte: x, lt: y} = operators. */
    private static function where_filters($filters) {
        $sql = []; $params = [];
        if (!is_array($filters)) { return ['', []]; }
        if (count($filters) > 12) { throw new Mutqan_Error('too_many_filters', 'فلاتر كثيرة.', 400); }
        foreach ($filters as $field => $cond) {
            if (is_array($cond) && !array_is_list($cond) && $cond) {
                foreach ($cond as $op => $v) { list($s, $p) = self::condition((string) $field, (string) $op, $v); $sql[] = $s; $params = array_merge($params, $p); }
            } elseif (is_array($cond)) {
                list($s, $p) = self::condition((string) $field, 'in', $cond); $sql[] = $s; $params = array_merge($params, $p);
            } else {
                list($s, $p) = self::condition((string) $field, 'eq', $cond); $sql[] = $s; $params = array_merge($params, $p);
            }
        }
        return [$sql ? implode(' AND ', $sql) : '', $params];
    }

    private static function order_sql($order) {
        if (!$order) { return 'created_at DESC, pk DESC'; }
        $dir = 'ASC';
        if ($order[0] === '-') { $dir = 'DESC'; $order = substr($order, 1); }
        $pseudo = ['id' => 'doc_id', 'createdAt' => 'created_at', 'updatedAt' => 'updated_at'];
        $col = isset($pseudo[$order]) ? $pseudo[$order] : self::jx(self::valid_field($order));
        return "$col $dir, pk $dir";
    }

    /* ------------------------------------------------------------------ rows */

    public static function row_to_doc($r) {
        $data = json_decode($r['data'], true);
        if (!is_array($data)) { $data = []; }
        $data['id'] = $r['doc_id'];
        $data['createdAt'] = self::iso($r['created_at']);
        $data['updatedAt'] = self::iso($r['updated_at']);
        if (!isset($data['userId'])) { $data['userId'] = $r['owner_id'] !== '' ? $r['owner_id'] : null; }
        return $data;
    }

    /** Trusted server-side read of one doc's data (no policy check). */
    public static function peek_doc($coll, $id) {
        $row = self::fetch_row($coll, $id);
        return $row ? (json_decode($row['data'], true) ?: []) : [];
    }
    private static function fetch_row($coll, $id) {
        global $wpdb;
        $t = self::table('docs');
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM $t WHERE coll=%s AND doc_id=%s AND (expires_at IS NULL OR expires_at > %s)", $coll, $id, self::now()), ARRAY_A);
    }

    /* ------------------------------------------------------------------ queries */

    public static function select($coll, $filters, $opts, $p, $private = false) {
        global $wpdb;
        $coll = self::valid_coll($coll);
        $t = self::table('docs');
        $params = [$coll, self::now()];
        $where = ["coll=%s", "(expires_at IS NULL OR expires_at > %s)"];
        list($vis, $vp) = $private ? ['owner_id=%s', [$p['id']]] : Mutqan_Policy::read_clause($coll, $p);
        if ($vis === '0') { return []; }
        if ($vis !== '') { $where[] = $vis; $params = array_merge($params, $vp); }
        list($fs, $fp) = self::where_filters($filters);
        if ($fs !== '') { $where[] = $fs; $params = array_merge($params, $fp); }
        $limit = min(self::MAX_LIMIT, max(1, (int) ($opts['limit'] ?? 100)));
        $offset = max(0, (int) ($opts['offset'] ?? 0));
        $sql = "SELECT * FROM $t WHERE " . implode(' AND ', $where) . ' ORDER BY ' . self::order_sql($opts['order'] ?? '') . " LIMIT $limit OFFSET $offset";
        $rows = $wpdb->get_results($wpdb->prepare($sql, ...$params), ARRAY_A) ?: [];
        return array_map([__CLASS__, 'row_to_doc'], $rows);
    }

    public static function count($coll, $filters, $p, $private = false) {
        global $wpdb;
        $coll = self::valid_coll($coll);
        $t = self::table('docs');
        $params = [$coll, self::now()];
        $where = ["coll=%s", "(expires_at IS NULL OR expires_at > %s)"];
        list($vis, $vp) = $private ? ['owner_id=%s', [$p['id']]] : Mutqan_Policy::read_clause($coll, $p);
        if ($vis === '0') { return 0; }
        if ($vis !== '') { $where[] = $vis; $params = array_merge($params, $vp); }
        list($fs, $fp) = self::where_filters($filters);
        if ($fs !== '') { $where[] = $fs; $params = array_merge($params, $fp); }
        return (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE " . implode(' AND ', $where), ...$params));
    }

    public static function group_by($coll, $field, $filters, $limit, $p) {
        global $wpdb;
        $coll = self::valid_coll($coll);
        $t = self::table('docs');
        $col = self::jx(self::valid_field($field));
        $params = [$coll, self::now()];
        $where = ["coll=%s", "(expires_at IS NULL OR expires_at > %s)"];
        list($vis, $vp) = Mutqan_Policy::read_clause($coll, $p);
        if ($vis === '0') { return []; }
        if ($vis !== '') { $where[] = $vis; $params = array_merge($params, $vp); }
        list($fs, $fp) = self::where_filters($filters);
        if ($fs !== '') { $where[] = $fs; $params = array_merge($params, $fp); }
        $limit = min(200, max(1, (int) $limit ?: 20));
        $sql = "SELECT $col AS k, COUNT(*) AS c FROM $t WHERE " . implode(' AND ', $where) . " GROUP BY $col ORDER BY c DESC LIMIT $limit";
        $rows = $wpdb->get_results($wpdb->prepare($sql, ...$params), ARRAY_A) ?: [];
        return array_map(function ($r) { return ['key' => $r['k'], 'count' => (int) $r['c']]; }, $rows);
    }

    public static function sum($coll, $field, $filters, $p) {
        global $wpdb;
        $coll = self::valid_coll($coll);
        $t = self::table('docs');
        $col = self::jx(self::valid_field($field));
        $cast = self::is_sqlite() ? "CAST($col AS REAL)" : "CAST($col AS DECIMAL(24,6))";
        $params = [$coll, self::now()];
        $where = ["coll=%s", "(expires_at IS NULL OR expires_at > %s)"];
        list($vis, $vp) = Mutqan_Policy::read_clause($coll, $p);
        if ($vis === '0') { return 0; }
        if ($vis !== '') { $where[] = $vis; $params = array_merge($params, $vp); }
        list($fs, $fp) = self::where_filters($filters);
        if ($fs !== '') { $where[] = $fs; $params = array_merge($params, $fp); }
        $v = $wpdb->get_var($wpdb->prepare("SELECT COALESCE(SUM($cast),0) FROM $t WHERE " . implode(' AND ', $where), ...$params));
        return (float) $v;
    }

    /** Cheap change marker for polling: "count:latest-updated_at" of what this principal can read. */
    public static function stamp($coll, $p) {
        global $wpdb;
        $coll = self::valid_coll($coll);
        $t = self::table('docs');
        $params = [$coll, self::now()];
        $where = ["coll=%s", "(expires_at IS NULL OR expires_at > %s)"];
        list($vis, $vp) = Mutqan_Policy::read_clause($coll, $p);
        if ($vis === '0') { return '0:'; }
        if ($vis !== '') { $where[] = $vis; $params = array_merge($params, $vp); }
        $r = $wpdb->get_row($wpdb->prepare("SELECT COUNT(*) AS c, MAX(updated_at) AS m FROM $t WHERE " . implode(' AND ', $where), ...$params), ARRAY_A);
        // count + newest row catch most changes; the per-collection write token catches two writes inside one second.
        return ((int) ($r['c'] ?? 0)) . ':' . ($r['m'] ?? '') . ':' . get_option('mutqan_v_' . $coll, '0');
    }

    private static function bump($coll) {
        update_option('mutqan_v_' . $coll, (string) round(microtime(true) * 1000), false);
    }

    /* ------------------------------------------------------------------ writes */

    private static function clean_data($data) {
        if (!is_array($data) || ($data && array_is_list($data))) { throw new Mutqan_Error('bad_document', 'مستند غير صالح.', 400); }
        foreach (['id', 'createdAt', 'updatedAt'] as $k) { unset($data[$k]); }
        $json = wp_json_encode($data, JSON_UNESCAPED_UNICODE);
        if ($json === false || strlen($json) > self::MAX_DOC_BYTES) { throw new Mutqan_Error('too_large', 'المستند كبير جدًا.', 413); }
        return [$data, $json];
    }

    private static function opts_to_cols($coll, $opts, $p) {
        $opts = is_array($opts) ? $opts : [];
        $vis = isset($opts['visibleTo']) && is_string($opts['visibleTo']) ? substr($opts['visibleTo'], 0, 60) : 'everyone';
        $wr = isset($opts['writableBy']) && is_string($opts['writableBy']) ? substr($opts['writableBy'], 0, 60) : 'creator-and-admin';
        $wf = isset($opts['writableFields']) && is_array($opts['writableFields']) ? wp_json_encode(array_values(array_filter($opts['writableFields'], 'is_string'))) : null;
        $exp = isset($opts['expiresAt']) ? self::to_db_time($opts['expiresAt']) : null;
        // Doc-level hints never widen what the collection policy allows (see Mutqan_Policy::force_visibility).
        $vis = Mutqan_Policy::force_visibility($coll, $vis, $p);
        return [$vis, $wr, $wf, $exp];
    }

    public static function insert($coll, $data, $id, $opts, $p, $private = false) {
        global $wpdb;
        $coll = self::valid_coll($coll);
        if (!$private) { Mutqan_Policy::require_can('insert', $coll, $p, null, $data); }
        if (!$private) { $data = Mutqan_Policy::sanitize_insert($coll, $data, $p); }
        list($data, $json) = self::clean_data($data);
        $id = ($id !== null && $id !== '') ? self::valid_id($id) : wp_generate_uuid4();
        if (!$private) { Mutqan_Policy::check_insert_id($coll, $id, $p); }
        list($vis, $wr, $wf, $exp) = $private ? ['creator', 'creator-and-admin', null, self::to_db_time($opts['expiresAt'] ?? null)] : self::opts_to_cols($coll, $opts, $p);
        $now = self::now();
        $ok = $wpdb->insert(self::table('docs'), [
            'coll' => $coll, 'doc_id' => $id, 'owner_id' => $p['id'], 'visible_to' => $vis, 'writable_by' => $wr,
            'writable_fields' => $wf, 'data' => $json, 'created_at' => $now, 'updated_at' => $now, 'expires_at' => $exp,
        ]);
        if ($ok === false) { throw new Mutqan_Error('exists', 'المعرّف مستخدم من قبل.', 409); }
        self::bump($coll);
        return self::row_to_doc(self::fetch_row($coll, $id));
    }

    public static function update($coll, $id, $patch, $p) {
        global $wpdb;
        $coll = self::valid_coll($coll);
        $row = self::fetch_row($coll, self::valid_id($id));
        if (!$row) { throw new Mutqan_Error('not_found', 'غير موجود.', 404); }
        $patch = is_array($patch) ? $patch : [];
        Mutqan_Policy::require_can('update', $coll, $p, $row, $patch);
        $old = json_decode($row['data'], true) ?: [];
        $patch = Mutqan_Policy::sanitize_update($coll, $old, $patch, $p, $row);
        foreach (['id', 'createdAt', 'updatedAt'] as $k) { unset($patch[$k]); }
        $new = array_merge($old, $patch);
        foreach ($patch as $k => $v) { if ($v === null) { $new[$k] = null; } }
        list($new, $json) = self::clean_data($new);
        $wpdb->update(self::table('docs'), ['data' => $json, 'updated_at' => self::now()], ['pk' => $row['pk']]);
        self::bump($coll);
        return self::row_to_doc(self::fetch_row($coll, $id));
    }

    public static function upsert($coll, $data, $id, $opts, $p) {
        $coll = self::valid_coll($coll);
        $id = ($id !== null && $id !== '') ? self::valid_id($id) : wp_generate_uuid4();
        $row = self::fetch_row($coll, $id);
        if ($row) { return self::update($coll, $id, is_array($data) ? $data : [], $p); }
        return self::insert($coll, $data, $id, $opts, $p);
    }

    public static function delete($coll, $id, $p, $private = false) {
        global $wpdb;
        $coll = self::valid_coll($coll);
        $row = self::fetch_row($coll, self::valid_id($id));
        if (!$row) { return false; }
        if ($private) {
            if ($row['owner_id'] !== $p['id'] || $row['visible_to'] !== 'creator') { throw new Mutqan_Error('forbidden', 'غير مسموح.', 403); }
        } else {
            Mutqan_Policy::require_can('delete', $coll, $p, $row, null);
        }
        $wpdb->delete(self::table('docs'), ['pk' => $row['pk']]);
        self::bump($coll);
        return true;
    }

    public static function get_raw($coll, $id) {
        $row = self::fetch_row(self::valid_coll($coll), (string) $id);
        return $row ? (json_decode($row['data'], true) ?: []) : null;
    }

    private static function valid_id($id) {
        if (!is_string($id) && !is_numeric($id)) { throw new Mutqan_Error('bad_id', 'معرّف غير صالح.', 400); }
        $id = (string) $id;
        if (!preg_match('/^[A-Za-z0-9_.:@-]{1,64}$/', $id)) { throw new Mutqan_Error('bad_id', 'معرّف غير صالح.', 400); }
        return $id;
    }

    public static function purge_expired() {
        global $wpdb;
        $wpdb->query($wpdb->prepare('DELETE FROM ' . self::table('docs') . ' WHERE expires_at IS NOT NULL AND expires_at < %s', self::now()));
        $wpdb->query($wpdb->prepare('DELETE FROM ' . self::table('sessions') . ' WHERE expires_at < %s', self::now()));
    }
}

class Mutqan_Error extends Exception {
    public $status; public $slug;
    public function __construct($slug, $message, $status = 400) { parent::__construct($message); $this->slug = $slug; $this->status = $status; }
}
