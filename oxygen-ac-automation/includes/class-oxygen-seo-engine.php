<?php
/**
 * Oxygen SEO engine: 120 planned articles (60 commercial + 60 informational), endless refresh cycle with 24 scenarios per article,
 * archive log, owner follow-up page. Template/data driven: free, no AI credits. Optional polish through Mutqan_AI is NOT used by default.
 */
if (!defined('ABSPATH')) { exit; }

class Oxygen_SEO_Engine {
    const OPT = 'oxygen_seo_settings';
    const LOG = 'oxygen_seo_log';
    const CRON = 'oxygen_seo_tick';
    const LOG_MAX = 3000;
    const MAIN = 'oxygen-ac-automation.php';

    /* ---------- data ---------- */
    private static $cache = [];
    private static function data($name) {
        if (!isset(self::$cache[$name])) { self::$cache[$name] = include __DIR__ . '/seo/data-' . $name . '.php'; }
        return self::$cache[$name];
    }

    /* ---------- one code base, many sites: every site gets its own brand and its own rotation, so texts never duplicate ---------- */
    public static function brand() {
        $o = get_option('oxygen_seo_brand');
        if (is_string($o) && $o !== '') { return $o; }
        $h = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
        return strpos($h, 'mutqan') !== false ? 'متقن' : 'أكسجين';
    }
    /** Offset added to angle / paragraph rotation and to the plan order: the same topic is written from a different angle on each site. */
    public static function salt() { return self::brand() === 'متقن' ? 11 : 0; }

    /* ---------- automatic indexing (IndexNow: free, Bing/Yandex/Seznam/Naver; Google follows the XML sitemap) ---------- */
    public static function indexnow_key() {
        $k = get_option('oxygen_indexnow_key');
        if (!is_string($k) || !preg_match('/^[a-f0-9]{32}$/', $k)) { $k = bin2hex(random_bytes(16)); update_option('oxygen_indexnow_key', $k, false); }
        return $k;
    }
    public static function indexnow($urls) {
        $urls = array_values(array_unique(array_filter((array) $urls)));
        if (!$urls || !function_exists('wp_remote_post')) { return; }
        $key = self::indexnow_key();
        $host = (string) wp_parse_url(home_url('/'), PHP_URL_HOST);
        wp_remote_post('https://api.indexnow.org/indexnow', [
            'timeout' => 5, 'blocking' => false, 'headers' => ['Content-Type' => 'application/json; charset=utf-8'],
            'body' => wp_json_encode(['host' => $host, 'key' => $key, 'keyLocation' => home_url('/' . $key . '.txt'), 'urlList' => array_slice($urls, 0, 100)]),
        ]);
    }
    public static function serve_key() {
        $path = isset($_SERVER['REQUEST_URI']) ? (string) wp_parse_url(wp_unslash($_SERVER['REQUEST_URI']), PHP_URL_PATH) : '';
        if (!preg_match('#/([a-f0-9]{32})\.txt$#', $path, $m) || $m[1] !== get_option('oxygen_indexnow_key')) { return; }
        header('Content-Type: text/plain; charset=utf-8');
        echo $m[1];
        exit;
    }
    /** Real, clean URLs + visible to search engines (a fresh WordPress ships with ?p=123 links and sometimes "discourage search engines"). */
    public static function ensure_real_pages() {
        if (get_option('oxygen_seo_site_ready') === '1') { return; }
        if (get_option('permalink_structure') === '') {
            global $wp_rewrite;
            if ($wp_rewrite) { $wp_rewrite->set_permalink_structure('/%postname%/'); flush_rewrite_rules(false); }
        }
        if (get_option('blog_public') === '0') { update_option('blog_public', '1'); }
        update_option('oxygen_seo_site_ready', '1', false);
    }
    public static function ensure_hub() {
        if (get_page_by_path('oxygen-seo-archive')) { return; }
        wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'مقالات ' . self::brand(), 'post_name' => 'oxygen-seo-archive', 'post_content' => '[oxygen_seo_archive]']);
    }
    public static function sitemap_entry($e, $post) {
        if (!empty($post->post_modified_gmt) && $post->post_modified_gmt !== '0000-00-00 00:00:00') { $e['lastmod'] = gmdate('c', strtotime($post->post_modified_gmt . ' UTC')); }
        return $e;
    }
    private static function e($s) { return function_exists('esc_html') ? esc_html($s) : htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
    private static function sub($tpl, $r) { return str_replace(['{t}', '{kw}', '{d}', '{n}'], [$r['t'] ?? '', $r['kw'] ?? '', $r['d'] ?? '', $r['n'] ?? ''], $tpl); }

    /** The full plan: alternating commercial / informational items. */
    public static function plan() {
        if (isset(self::$cache['plan'])) { return self::$cache['plan']; }
        $svc = self::data('services');
        $topics = self::data('topics');
        $variants = [
            ['city' => 'مكة المكرمة', 'title' => '{n} في مكة المكرمة: دليل الخدمة وطريقة الحجز', 'kw' => '{n} في مكة', 'slug' => 'makkah'],
            ['city' => 'جدة', 'title' => '{n} في جدة: ما تشمله الخدمة وكيف تطلبها', 'kw' => '{n} في جدة', 'slug' => 'jeddah'],
            ['city' => 'مكة وجدة', 'title' => '{n} عاجل على مدار الساعة في مكة وجدة', 'kw' => '{n} عاجل مكة وجدة', 'slug' => 'urgent'],
        ];
        $com = [];
        foreach ($variants as $v) {
            foreach ($svc as $sid => $s) {
                $com[] = ['key' => 'oxy-' . $sid . '-' . $v['slug'], 'track' => 'commercial', 'sid' => $sid, 'city' => $v['city'], 'title' => str_replace('{n}', $s['n'], $v['title']), 'kw' => str_replace('{n}', $s['n'], $v['kw']), 'dom' => $s['spec']];
            }
        }
        $off = [];
        foreach ($topics as $t) {
            $off[] = ['key' => 'oxy-guide-' . $t[0], 'track' => 'official', 'sid' => $t[0], 'city' => '', 'title' => $t[1], 'kw' => $t[2], 'dom' => $t[3], 'points' => $t[4]];
        }
        $plan = [];
        $n = max(count($com), count($off));
        for ($i = 0; $i < $n; $i++) {
            if (isset($com[$i])) { $plan[] = $com[$i]; }
            if (isset($off[$i])) { $plan[] = $off[$i]; }
        }
        $k = count($plan) ? (self::salt() * 5) % count($plan) : 0;
        if ($k) { $plan = array_merge(array_slice($plan, $k), array_slice($plan, 0, $k)); }
        foreach ($plan as $i => &$p) { $p['idx'] = $i; $p['kind'] = 'base'; $p['title'] .= ' | ' . self::brand(); }
        unset($p);
        $idx = count($plan);
        // Same service, same site, different SEO: another title / focus keyword / meta and a different angle (never a copy).
        $alts = [
            ['t' => '{n} في {c}: الأسعار والضمان وطريقة الطلب', 'k' => 'سعر {n} في {c}', 'slug' => 's1'],
            ['t' => 'كيف تحجز {n} في {c} بسرعة؟ دليل الخطوات', 'k' => 'حجز {n} {c} اليوم', 'slug' => 's2'],
            ['t' => 'أفضل شركة {n} في {c}: كيف تختار الأنسب؟', 'k' => 'أفضل شركة {n} في {c}', 'slug' => 's3'],
            ['t' => '{n} في {c} للمنازل والشركات: ما الفرق وماذا تتوقع؟', 'k' => '{n} {c} للمنازل والشركات', 'slug' => 's4'],
            ['t' => 'أسئلة شائعة عن {n} في {c} قبل أن تطلب الخدمة', 'k' => 'أسئلة عن {n} في {c}', 'slug' => 's5'],
        ];
        foreach ($alts as $ai => $alt) {
            foreach ($svc as $sid => $sv) {
                foreach ($variants as $v) {
                    $c = $v['city'];
                    $plan[] = ['key' => 'oxy-' . $sid . '-' . $v['slug'] . '-' . $alt['slug'], 'track' => 'commercial', 'kind' => 'seo', 'sid' => $sid, 'city' => $c, 'alt' => $ai + 1,
                        'title' => str_replace(['{n}', '{c}'], [$sv['n'], $c], $alt['t']) . ' | ' . self::brand(), 'kw' => str_replace(['{n}', '{c}'], [$sv['n'], $c], $alt['k']),
                        'dom' => $sv['spec'] ?? 'general', 'idx' => $idx++];
                }
            }
        }
        // Local variants: the service in a named Makkah neighbourhood (the order differs per site so two sites never publish the same one).
        $dist = array_values(self::data('districts'));
        $k = (self::salt() * 3) % max(1, count($dist));
        if ($k) { $dist = array_merge(array_slice($dist, $k), array_slice($dist, 0, $k)); }
        foreach ($dist as $di => $d) {
            foreach ($svc as $sid => $sv) {
                $plan[] = ['key' => 'oxy-' . $sid . '-d' . md5($d), 'track' => 'commercial', 'kind' => 'district', 'sid' => $sid, 'city' => 'حي ' . $d . ' بمكة المكرمة', 'district' => $d, 'alt' => 3 + ($di % 3),
                    'title' => $sv['n'] . ' في حي ' . $d . ' بمكة المكرمة | ' . self::brand(), 'kw' => $sv['n'] . ' حي ' . $d . ' مكة',
                    'dom' => $sv['spec'] ?? 'general', 'idx' => $idx++];
            }
        }
        // Jeddah neighbourhoods (the business covers Makkah and Jeddah).
        $jd = array_values(self::data('districts-jeddah'));
        $k = (self::salt() * 4) % max(1, count($jd));
        if ($k) { $jd = array_merge(array_slice($jd, $k), array_slice($jd, 0, $k)); }
        foreach ($jd as $di => $d) {
            foreach ($svc as $sid => $sv) {
                $plan[] = ['key' => 'oxy-' . $sid . '-j' . md5($d), 'track' => 'commercial', 'kind' => 'district', 'sid' => $sid, 'city' => 'حي ' . $d . ' بجدة', 'district' => $d, 'alt' => 3 + ($di % 3),
                    'title' => $sv['n'] . ' في حي ' . $d . ' بجدة | ' . self::brand(), 'kw' => $sv['n'] . ' حي ' . $d . ' جدة',
                    'dom' => $sv['spec'] ?? 'general', 'idx' => $idx++];
            }
        }
        return self::$cache['plan'] = $plan;
    }
    private static function domain($dom) {
        $d = self::data('domains');
        $map = ['ac' => 'ac', 'plumbing' => 'plumbing', 'electric' => 'electric', 'fridge' => 'fridge', 'appliances' => 'appliances', 'pest' => 'pest', 'tanks' => 'tanks', 'locks' => 'locks', 'cameras' => 'cameras', 'solar' => 'solar'];
        return $d[$map[$dom] ?? 'general'] ?? $d['general'];
    }
    public static function angle_count() { return count(self::data('angles')); }
    public static function angle_index($idx, $rev) { return (($idx * 7) + $rev + self::salt()) % self::angle_count(); }
    public static function angle_label($idx, $rev) { $a = self::data('angles'); return $a[self::angle_index($idx, $rev)][0]; }

    /* ---------- content builders (pure, testable) ---------- */
    public static function cover_svg($title, $label, $seed) {
        $pal = [['#0b3a6e', '#00b4d8'], ['#14532d', '#22c55e'], ['#7c2d12', '#f59e0b'], ['#3b0764', '#a855f7'], ['#134e4a', '#2dd4bf'], ['#1e3a8a', '#60a5fa']];
        $c = $pal[abs(crc32($seed)) % count($pal)];
        $words = preg_split('/\s+/u', trim($title));
        $lines = []; $cur = '';
        foreach ($words as $w) {
            if ($cur !== '' && mb_strlen($cur . ' ' . $w) > 24 && count($lines) < 2) { $lines[] = $cur; $cur = $w; } else { $cur = ($cur === '' ? $w : $cur . ' ' . $w); }
        }
        $lines[] = $cur;
        $lines = array_slice($lines, 0, 3);
        $txt = '';
        foreach ($lines as $i => $l) { $txt .= '<text x="600" y="' . (250 + $i * 82) . '" text-anchor="middle" font-size="64" font-weight="700" fill="#fff">' . self::e($l) . '</text>'; }
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" direction="rtl" font-family="Tahoma,Arial,sans-serif"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' . $c[0] . '"/><stop offset="1" stop-color="' . $c[1] . '"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/><circle cx="1050" cy="120" r="220" fill="#fff" opacity=".07"/><circle cx="120" cy="560" r="260" fill="#fff" opacity=".06"/><text x="600" y="120" text-anchor="middle" font-size="34" fill="#fff" opacity=".85">' . self::e($label) . '</text>' . $txt . '<text x="600" y="580" text-anchor="middle" font-size="30" fill="#fff" opacity=".9">' . self::e(self::brand()) . ' · خدمات الصيانة في مكة وجدة</text></svg>';
    }
    private static function steps_html($app, $wa) {
        $h = '<ol><li>افتح تطبيق ' . self::brand() . ' أو صفحة الطلب.</li><li>اختر الخدمة المطلوبة وحدد موقعك بضغطة واحدة أو بلصق رابط الخريطة.</li><li>أرسل الطلب بدون تسجيل؛ يصلك التأكيد عبر واتساب.</li><li>يصل الفني في الموعد، ويُعرض عليك السعر قبل البدء.</li></ol>';
        $h .= '<p class="oxy-seo-cta"><a href="' . self::e($app) . '">اطلب الخدمة من التطبيق</a>';
        if ($wa) { $h .= ' · <a href="https://wa.me/' . self::e($wa) . '">تواصل عبر واتساب</a>'; }
        return $h . '</p>';
    }
    private static function links_html($links) {
        if (!$links) { return ''; }
        $h = '<h2>مقالات ذات صلة</h2><ul>';
        foreach ($links as $l) { $h .= '<li><a href="' . self::e($l[1]) . '">' . self::e($l[0]) . '</a></li>'; }
        return $h . '</ul>';
    }
    private static function rot($arr, $start, $n) { $out = []; $c = count($arr); for ($i = 0; $i < min($n, $c); $i++) { $out[] = $arr[($start + $i) % $c]; } return $out; }
    private static function faq_html($faq) {
        $h = '<h2>أسئلة شائعة</h2>';
        foreach ($faq as $q) { $h .= '<h3>' . self::e($q[0]) . '</h3><p>' . self::e($q[1]) . '</p>'; }
        return $h;
    }

    /** Returns ['html','faq','desc','text'] for one item at a revision. $ctx: app, wa, links, img */
    public static function build($item, $rev, $ctx = []) {
        $angles = self::data('angles');
        $a = $angles[self::angle_index($item['idx'], $rev)];
        $dm = self::domain($item['dom']);
        $app = $ctx['app'] ?? '#';
        $wa = $ctx['wa'] ?? '';
        $img = $ctx['img'] ?? '';
        $html = '';
        if ($img) { $html .= '<p><img src="' . self::e($img) . '" alt="' . self::e($item['title']) . '" width="1200" height="630" loading="lazy" style="max-width:100%;height:auto;border-radius:12px"></p>'; }
        if ($item['track'] === 'commercial') {
            $s = self::data('services')[$item['sid']];
            $r = ['t' => $item['title'], 'kw' => $item['kw'], 'd' => $s['n'], 'n' => $s['n']];
            $html .= '<p>تبحث عن <strong>' . self::e($item['kw']) . '</strong>؟ تقدم ' . self::brand() . ' خدمة ' . self::e($s['svc']) . ' في ' . self::e($item['city']) . ' بفنيين مدربين، وحجز بدون تسجيل، وسعر واضح يُعرض عليك قبل بدء العمل. ' . self::e(self::sub($a[1], $r)) . '</p>';
            $html .= '<h2>ماذا تشمل خدمة ' . self::e($s['n']) . '؟</h2><ul>';
            foreach ($s['items'] as $it) { $html .= '<li>' . self::e($it) . '</li>'; }
            $html .= '</ul><h2>' . self::e($a[2]) . '</h2>';
            foreach ($a[3] as $p) { $html .= '<p>' . self::e(self::sub($p, $r)) . '</p>'; }
            $html .= '<h2>لماذا تختار ' . self::brand() . '؟</h2><p>نعمل بنظام طلب بسيط بلا تسجيل، ونرسل لك التأكيد عبر واتساب، ونعرض السعر قبل بدء العمل حتى لا تفاجأ بالفاتورة. فنيونا يشرحون السبب ويقترحون الخيارات، ويوثقون العمل بما يسهل عليك المتابعة لاحقاً. تغطي فرقنا مكة المكرمة وجدة، ويمكنك طلب موعد عاجل أو مجدول بحسب ظروفك.</p>';
            $html .= '<h2>متى تحتاج إلى ' . self::e($s['n']) . '؟</h2><ul>';
            foreach ($s['signs'] as $it) { $html .= '<li>' . self::e($it) . '</li>'; }
            $html .= '</ul><h2>ما الذي يميز التعامل مع ' . self::brand() . ' في ' . self::e($item['city']) . '؟</h2>';
            foreach (self::rot($dm['paras'], $rev + self::salt(), 2) as $p) { $html .= '<p>' . self::e($p) . '</p>'; }
            if (!empty($item['district'])) {
                $dn = $item['district'];
                $tpl = [
                    'يطلب سكان حي ' . $dn . ' خدمة ' . $s['n'] . ' بحسب طبيعة المباني عندهم، ونحرص أن يكون الفني مجهزاً بما يناسب نوع الوحدة قبل الوصول.',
                    'إذا كنت في حي ' . $dn . ' فاذكر في الطلب رقم الدور وأقرب معلم، فهذا يسرّع وصول الفني ويقلل المكالمات الإضافية.',
                    'تختلف الأعطال في ' . $s['n'] . ' بين بيت وآخر داخل حي ' . $dn . '، ولذلك نبدأ بفحص الحالة ثم نعرض السعر قبل أي تنفيذ.',
                    'يؤكد فريق الجدولة موعد زيارتك في حي ' . $dn . ' بعد استلام الطلب، وتصلك رسالة تأكيد على واتساب.',
                    'نتعامل في حي ' . $dn . ' مع الشقق والفلل والمحلات، ويُحدَّد وقت الزيارة بحسب ازدحام اليوم وتوفر الفنيين.',
                    'سواء كانت المشكلة بسيطة أو تحتاج قطعة غيار، تُشرح لك الخطوات في حي ' . $dn . ' قبل البدء حتى تقرر وأنت مطمئن.',
                ];
                $html .= '<h2>' . self::e($s['n']) . ' في حي ' . self::e($dn) . '</h2>';
                foreach (self::rot($tpl, $item['idx'] + $rev + self::salt(), 3) as $p) { $html .= '<p>' . self::e($p) . '</p>'; }
            }
            $html .= '<h2>خطوات الطلب</h2>' . self::steps_html($app, $wa);
            $faq = $s['faq'];
            $faq[] = ['هل تغطون ' . $item['city'] . ' بالكامل؟', 'نغطي معظم أحياء ' . $item['city'] . ' ويؤكد فريق الجدولة الموعد المناسب لموقعك بعد استلام الطلب.'];
            $desc = $item['kw'] . ' — ' . $s['svc'] . ' في ' . $item['city'] . ' بحجز سريع بدون تسجيل وسعر واضح قبل التنفيذ وضمان على العمل.';
        } else {
            $r = ['t' => $item['title'], 'kw' => $item['kw'], 'd' => $dm['label'], 'n' => $dm['label']];
            $html .= '<p>يبحث كثيرون عن <strong>' . self::e($item['kw']) . '</strong>، وهذا الدليل يجمع لك الخلاصة العملية في صفحة واحدة. ' . self::e(self::sub($a[1], $r)) . '</p><h2>أهم النقاط</h2><ol>';
            foreach ($item['points'] as $pt) { $html .= '<li>' . self::e($pt) . '</li>'; }
            $html .= '</ol><h2>' . self::e($a[2]) . '</h2>';
            foreach ($a[3] as $p) { $html .= '<p>' . self::e(self::sub($p, $r)) . '</p>'; }
            $html .= '<h2>شرح أعمق: ' . self::e($dm['label']) . '</h2>';
            $paras = self::rot($dm['paras'], $rev + self::salt(), count($dm['paras']));
            foreach ($paras as $p) { $html .= '<p>' . self::e($p) . '</p>'; }
            $html .= '<h2>لماذا يهمك هذا الموضوع؟</h2><p>' . self::e(self::sub('موضوع «{t}» ليس ترفاً معرفياً؛ فهو يحدد كم تدفع في الفواتير، وكم يعيش الجهاز أو النظام، ومتى تظهر الأعطال. من يفهم الأساسيات في {d} يتخذ قرارات أهدأ وأرخص، ويتعامل مع الفني بثقة أكبر ويعرف ما يُطلب منه فعلاً.', $r)) . '</p>';
            $html .= '<h2>خطوات الفحص الأولي</h2><ol><li>سجّل ما تلاحظه بالضبط: متى بدأت المشكلة وما الذي تغيّر قبلها.</li><li>افصل الكهرباء أو أغلق المحبس المعني إن كان في الأمر خطر، ولا تبدأ بأي فك قبل ذلك.</li><li>افحص الأمور البسيطة أولاً كالنظافة والفلاتر والتوصيلات الظاهرة والإعدادات.</li><li>صوّر الجزء المتأثر أو رسالة الخطأ لتشاركها مع الفني عند الحاجة.</li><li>قارن النتيجة بعد كل خطوة ولا تغيّر عدة أمور دفعة واحدة، حتى تعرف ما الذي أثّر فعلاً.</li></ol>';
            $html .= '<h2>أخطاء يجب تجنبها</h2><ul><li>تأجيل الفحص بعد ظهور أول عَرَض، فالأعطال الصغيرة تتراكم مع الوقت.</li><li>استخدام قطع أو مواد رخيصة غير مطابقة للمواصفات لمجرد توفير مبلغ بسيط.</li><li>إصلاح العرض دون البحث عن السبب، فتعود المشكلة بعد أيام.</li><li>تجاهل تعليمات الشركة المصنعة عن التنظيف والتشغيل وحدود الاستخدام.</li></ul>';
            $html .= '<h2>جدول متابعة مقترح</h2><ul><li>أسبوعياً: نظرة سريعة على الأداء والأصوات والروائح والرطوبة.</li><li>شهرياً: تنظيف الأجزاء القابلة للتنظيف حسب دليل الاستخدام.</li><li>كل موسم: فحص أوسع قبل الصيف وبعده وتسجيل الملاحظات.</li><li>سنوياً: زيارة صيانة شاملة من مختص مع حفظ تقرير الزيارة.</li></ul>';
            $html .= '<h2>متى تحتاج إلى فني مختص؟</h2><p>تنصحك بالاستعانة بمختص ' . self::e($dm['call']) . ' فتأخير التدخل في هذه الحالات يرفع الكلفة ويزيد المخاطر.</p>';
            $faq = [
                ['هل أستطيع معالجة الأمر بنفسي؟', 'يمكنك إجراء الفحوص الأولية المذكورة في هذا الدليل، أما الأعمال التي تتعلق بالكهرباء أو الغاز أو الضغط العالي أو الارتفاعات فاتركها لمختص حفاظاً على السلامة.'],
                ['كم يستغرق التشخيص عادة؟', 'تشخيص معظم الحالات يتم في الزيارة الأولى، وقد يحتاج طلب قطعة أو فحص إضافي إلى زيارة ثانية.'],
                ['كيف أمنع تكرار المشكلة؟', 'الصيانة الدورية وتدوين الملاحظات والانتباه للأعراض المبكرة هي أقوى وسائل منع التكرار.'],
            ];
            $html .= self::faq_html($faq);
            $html .= '<h2>ملخص سريع</h2><p>' . self::e(self::sub('إذا أردت تلخيص «{t}» في جملة واحدة: راقب الأعراض مبكراً، وابدأ بالفحوص البسيطة الآمنة، ولا تتردد في طلب مختص حين يتعلق الأمر بالسلامة أو يتكرر العطل. بهذا تحمي {d} في منزلك وتوفر المال والوقت، وتبقى {kw} مسألة تحت سيطرتك بدل أن تتحول إلى مفاجأة مكلفة في وقت غير مناسب.', $r)) . '</p>';
            $html .= '<h2>هل تحتاج مساعدة مباشرة؟</h2><p>إن رغبت بفني يعاين الحالة في مكة أو جدة فيمكنك الطلب بسهولة بدون تسجيل.</p>' . self::steps_html($app, $wa);
            $desc = $item['title'] . ' — دليل عملي مختصر: الأسباب، الفحص الأولي، ومتى تستدعي فنياً.';
            $html .= self::links_html($ctx['links'] ?? []);
            return ['html' => $html, 'faq' => $faq, 'desc' => self::trim_desc($desc), 'text' => strip_tags($html)];
        }
        $html .= self::faq_html($faq);
        $html .= self::links_html($ctx['links'] ?? []);
        return ['html' => $html, 'faq' => $faq, 'desc' => self::trim_desc($desc), 'text' => strip_tags($html)];
    }
    private static function trim_desc($d) { return mb_strlen($d) > 158 ? mb_substr($d, 0, 155) . '...' : $d; }
    public static function word_count($text) { return count(preg_split('/\s+/u', trim(strip_tags($text)), -1, PREG_SPLIT_NO_EMPTY)); }

    /* ---------- settings / log ---------- */
    public static function settings() {
        $d = ['enabled' => 1, 'status' => 'publish', 'new_per_day' => 10, 'seo_per_day' => 10, 'district_per_day' => 10, 'random_per_day' => 10, 'refresh_per_day' => 4, 'min_age_days' => 7, 'wa' => ''];
        $s = get_option(self::OPT, []);
        return array_merge($d, is_array($s) ? $s : []);
    }
    public static function log($action, $post_id, $title, $extra = []) {
        $log = get_option(self::LOG, []);
        if (!is_array($log)) { $log = []; }
        array_unshift($log, array_merge(['ts' => time(), 'a' => $action, 'id' => (int) $post_id, 't' => $title, 'l' => $post_id ? get_permalink($post_id) : ''], $extra));
        update_option(self::LOG, array_slice($log, 0, self::LOG_MAX), false);
    }
    private static function today_count($action) {
        $log = get_option(self::LOG, []);
        $start = strtotime(wp_date('Y-m-d 00:00:00'));
        $n = 0;
        foreach ((array) $log as $r) { if (($r['ts'] ?? 0) >= $start && ($r['a'] ?? '') === $action) { $n++; } }
        return $n;
    }

    /* ---------- WP glue ---------- */
    public static function boot() {
        add_action('init', [__CLASS__, 'ensure_cron'], 3);
        add_action('init', [__CLASS__, 'serve_key'], 1);
        add_action('init', [__CLASS__, 'ensure_real_pages'], 30);
        add_filter('wp_sitemaps_enabled', '__return_true');
        add_filter('wp_sitemaps_posts_entry', [__CLASS__, 'sitemap_entry'], 10, 2);
        add_action(self::CRON, [__CLASS__, 'tick']);
        add_filter('the_content', [__CLASS__, 'filter_content'], 5);
        add_action('wp_head', [__CLASS__, 'head'], 4);
        add_filter('get_site_icon_url', [__CLASS__, 'site_icon_url'], 20, 2);   // Google / browser tab icon = the brand's own mark (sizes are multiples of 48 px, as Google requires)
        add_shortcode('oxygen_seo_archive', [__CLASS__, 'archive_shortcode']);
        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('admin_post_oxy_seo_save', [__CLASS__, 'h_save']);
        add_action('admin_post_oxy_seo_run', [__CLASS__, 'h_run']);
        add_action('admin_post_oxy_seo_pub', [__CLASS__, 'h_publish_drafts']);
        add_action('admin_post_oxy_seo_page', [__CLASS__, 'h_archive_page']);
    }
    public static function ensure_cron() {
        if (!wp_next_scheduled(self::CRON)) { wp_schedule_event(time() + 300, 'hourly', self::CRON); }
    }
    public static function active() { $s = self::settings(); return !empty($s['enabled']); }

    private static function app_url() { return plugins_url('app/index.html', dirname(__DIR__) . '/' . self::MAIN) . '#/'; }
    private static function map() {
        $ids = get_posts(['post_type' => 'post', 'post_status' => 'any', 'meta_key' => '_oxy_seo_key', 'numberposts' => -1, 'fields' => 'ids', 'no_found_rows' => true]);
        $m = [];
        foreach ($ids as $id) { $k = get_post_meta($id, '_oxy_seo_key', true); if ($k) { $m[$k] = (int) $id; } }
        return $m;
    }
    private static function ctx($item, $map, $key_img = true) {
        $s = self::settings();
        $links = [];
        foreach (self::plan() as $p) {
            if ($p['key'] === $item['key'] || $p['dom'] !== $item['dom'] || empty($map[$p['key']])) { continue; }
            if (get_post_status($map[$p['key']]) !== 'publish') { continue; }
            $links[] = [$p['title'], get_permalink($map[$p['key']])];
            if (count($links) >= 4) { break; }
        }
        $img = '';
        if ($key_img) {
            $u = wp_upload_dir();
            if (empty($u['error'])) {
                $dir = $u['basedir'] . '/oxygen-seo';
                if (wp_mkdir_p($dir)) {
                    $rev = !empty($map[$item['key']]) ? (int) get_post_meta($map[$item['key']], '_oxy_seo_rev', true) : 0;
                    $label = $item['track'] === 'commercial' ? 'خدمات ' . self::brand() . '' : 'دليل ' . self::brand() . '';
                    $fn = $item['key'] . '.svg';
                    if (@file_put_contents($dir . '/' . $fn, self::cover_svg($item['title'], $label, $item['key'] . $rev))) { $img = $u['baseurl'] . '/oxygen-seo/' . $fn . '?v=' . $rev; }
                }
            }
        }
        return ['app' => self::app_url(), 'wa' => preg_replace('/\D/', '', (string) $s['wa']), 'links' => $links, 'img' => $img];
    }
    private static function term($name) {
        if (!function_exists('wp_insert_term')) { return 0; }
        $t = term_exists($name, 'category');
        if (!$t) { $t = wp_insert_term($name, 'category'); }
        return is_array($t) ? (int) $t['term_id'] : 0;
    }

    public static function create_next($force_status = null, $kind = 'base') {
        $map = self::map();
        $s = self::settings();
        foreach (self::plan() as $item) {
            if (($item['kind'] ?? 'base') !== $kind || isset($map[$item['key']])) { continue; }
            $ctx = self::ctx($item, $map);
            $b = self::build($item, 0, $ctx);
            $author = get_users(['role' => 'administrator', 'number' => 1, 'fields' => 'ID']);
            $id = wp_insert_post([
                'post_type' => 'post', 'post_status' => $force_status ?: $s['status'], 'post_title' => $item['title'], 'post_name' => $item['key'],
                'post_content' => $b['html'], 'post_excerpt' => $b['desc'], 'post_author' => $author ? (int) $author[0] : 1,
            ], true);
            if (is_wp_error($id) || !$id) { return false; }
            update_post_meta($id, '_oxy_seo_key', $item['key']);
            update_post_meta($id, '_oxy_seo_track', $item['track']);
            update_post_meta($id, '_oxy_seo_kind', $kind);
            update_post_meta($id, '_oxy_seo_kw', $item['kw']);
            update_post_meta($id, '_oxy_seo_rev', 0);
            update_post_meta($id, '_oxy_seo_angle', self::angle_label($item['idx'], 0));
            update_post_meta($id, '_oxy_seo_updated', current_time('mysql'));
            update_post_meta($id, '_oxy_seo_desc', $b['desc']);
            update_post_meta($id, '_oxy_seo_faq', wp_json_encode($b['faq'], JSON_UNESCAPED_UNICODE));
            update_post_meta($id, '_oxy_seo_img', $ctx['img']);
            // Real WordPress post data: tags from the keyword system + compatibility with Yoast / Rank Math so editors see the same focus keyword.
            self::tag_post($id, $item, $b);
            $cat = self::term($item['track'] === 'commercial' ? 'خدمات ' . self::brand() . '' : 'أدلة وإرشادات');
            if ($cat) { wp_set_post_categories($id, [$cat]); }
            self::log($kind === 'seo' ? 'new_seo' : ($kind === 'district' ? 'new_dist' : 'new'), $id, $item['title'], ['track' => $item['track'], 'st' => get_post_status($id), 'rev' => 0, 'kind' => $kind]);
            if (get_post_status($id) === 'publish') { self::indexnow([get_permalink($id), home_url('/oxygen-seo-archive/')]); }
            return $id;
        }
        return false;
    }
    public static function refresh_next($ignore_age = false) {
        $map = self::map();
        $s = self::settings();
        $by_key = [];
        foreach (self::plan() as $it) { $by_key[$it['key']] = $it; }
        $cand = [];
        $min = time() - max(0, (int) $s['min_age_days']) * DAY_IN_SECONDS;
        foreach ($map as $key => $id) {
            if (!isset($by_key[$key])) { continue; }
            $upd = strtotime((string) get_post_meta($id, '_oxy_seo_updated', true)) ?: 0;
            if (!$ignore_age && $upd > $min) { continue; }
            $cand[] = [(int) get_post_meta($id, '_oxy_seo_rev', true), $upd, $id, $key];
        }
        if (!$cand) { return false; }
        usort($cand, function ($a, $b) { return $a[0] <=> $b[0] ?: $a[1] <=> $b[1]; });
        return self::do_refresh($cand[0][2], $by_key[$cand[0][3]], $map, 'refresh');
    }
    /** Random refresh of an already published article (older than ~20 hours), so old pages keep getting fresh angles. */
    public static function refresh_random() {
        $map = self::map();
        $by_key = [];
        foreach (self::plan() as $it) { $by_key[$it['key']] = $it; }
        $pool = [];
        foreach ($map as $key => $id) {
            if (!isset($by_key[$key]) || get_post_status($id) !== 'publish') { continue; }
            $upd = strtotime((string) get_post_meta($id, '_oxy_seo_updated', true)) ?: 0;
            if ($upd > time() - 20 * HOUR_IN_SECONDS) { continue; }
            $pool[] = [$id, $key];
        }
        if (!$pool) { return false; }
        $pick = $pool[array_rand($pool)];
        return self::do_refresh($pick[0], $by_key[$pick[1]], $map, 'refresh_rand');
    }
    /** Keyword system: tags + focus keyword/description for Yoast and Rank Math (so the posts behave like hand-written WordPress posts). */
    private static function tag_post($id, $item, $b) {
        $svcs = self::data('services');
        $tags = [$item['kw'], self::brand(), $item['track'] === 'commercial' ? ($item['city'] ?? '') : 'دليل إرشادي', isset($svcs[$item['sid'] ?? '']) ? $svcs[$item['sid']]['n'] : ''];
        wp_set_post_tags($id, array_values(array_unique(array_filter($tags))), false);
        update_post_meta($id, '_yoast_wpseo_focuskw', $item['kw']); update_post_meta($id, '_yoast_wpseo_metadesc', $b['desc']);
        update_post_meta($id, 'rank_math_focus_keyword', $item['kw']); update_post_meta($id, 'rank_math_description', $b['desc']);
    }
    private static function do_refresh($id, $item, $map, $action) {
        $rev = (int) get_post_meta($id, '_oxy_seo_rev', true) + 1;
        $ctx = self::ctx($item, $map);
        $b = self::build($item, $rev, $ctx);
        wp_update_post(['ID' => $id, 'post_title' => $item['title'], 'post_content' => $b['html'], 'post_excerpt' => $b['desc']]);
        update_post_meta($id, '_oxy_seo_rev', $rev);
        self::tag_post($id, $item, $b);
        update_post_meta($id, '_oxy_seo_angle', self::angle_label($item['idx'], $rev));
        update_post_meta($id, '_oxy_seo_updated', current_time('mysql'));
        update_post_meta($id, '_oxy_seo_desc', $b['desc']);
        update_post_meta($id, '_oxy_seo_faq', wp_json_encode($b['faq'], JSON_UNESCAPED_UNICODE));
        update_post_meta($id, '_oxy_seo_img', $ctx['img']);
        if (get_post_status($id) === 'publish') { self::indexnow([get_permalink($id)]); }
        self::log($action, $id, $item['title'], ['track' => $item['track'], 'st' => get_post_status($id), 'rev' => $rev, 'angle' => self::angle_label($item['idx'], $rev)]);
        return $id;
    }
    /** Runs hourly (and on traffic): five streams, each paced evenly over the day, up to 3 catch-up actions per stream per run. */
    public static function tick() {
        if (!self::active()) { return; }
        self::ensure_hub();
        $s = self::settings();
        $hour = (int) wp_date('G');
        $streams = [
            ['new', (int) $s['new_per_day'], function () { return self::create_next(null, 'base'); }],
            ['new_seo', (int) $s['seo_per_day'], function () { return self::create_next(null, 'seo'); }],
            ['new_dist', (int) $s['district_per_day'], function () { return self::create_next(null, 'district'); }],
            ['refresh_rand', (int) $s['random_per_day'], function () { return self::refresh_random(); }],
            ['refresh', (int) $s['refresh_per_day'], function () { return self::refresh_next(); }],
        ];
        foreach ($streams as $st) {
            list($act, $quota, $fn) = $st;
            $allowed = min($quota, (int) ceil($quota * ($hour + 1) / 24));
            for ($i = 0; $i < 3 && self::today_count($act) < $allowed; $i++) { if (!$fn()) { break; } }
        }
    }

    /* ---------- front end ---------- */
    private static function meta_for($pid) { return get_post_meta($pid, '_oxy_seo_key', true) ? $pid : 0; }
    public static function filter_content($c) {
        if (!is_singular('post') || !in_the_loop() || !is_main_query()) { return $c; }
        $id = get_the_ID();
        if (!self::meta_for($id)) { return $c; }
        $main = esc_url(Oxygen_Domain_Guard::main_url());
        $mh = preg_replace('#^www\.#', '', (string) wp_parse_url($main, PHP_URL_HOST));
        $top = '<p class="oxy-mainsite" style="background:#0ea5e9;color:#fff;border-radius:10px;padding:8px 12px;font-weight:700;text-align:center;margin:0 0 14px"><a href="' . $main . '" style="color:#fff;text-decoration:none">← الموقع الرئيسي ل' . self::brand() . ' · ' . esc_html($mh) . '</a></p>';
        $bottom = '<div class="oxy-mainsite-cta" style="margin-top:22px;border:1px solid #bae6fd;background:#f0f9ff;border-radius:12px;padding:12px 14px;text-align:center"><strong>خدمات الصيانة والتبريد</strong><br><a href="' . $main . '" style="font-weight:700">زيارة الموقع الرئيسي ل' . self::brand() . ' (' . esc_html($mh) . ') للخدمات والحجز</a></div>';
        $rev = (int) get_post_meta($id, '_oxy_seo_rev', true);
        $upd = '';
        if ($rev >= 1) {
            $d = get_post_meta($id, '_oxy_seo_updated', true);
            $ts = strtotime((string) $d) ?: time();
            $upd = '<p class="oxy-seo-updated" style="background:#ecfdf5;border:1px solid #10b981;border-radius:10px;padding:8px 12px;font-weight:700">✅ تم التحديث بتاريخ ' . esc_html(wp_date('j F Y', $ts)) . '</p>';
        }
        return $top . $upd . $c . $bottom;
    }
    public static function site_icon_url($url, $size) {
        $size = (int) $size; $pick = 512;
        foreach ([48, 96, 192, 512] as $n) { if ($n >= $size) { $pick = $n; break; } }
        return plugins_url('assets/site-icon-' . $pick . '.png', dirname(__FILE__));
    }
    public static function head() {
        if (!is_singular('post') || defined('WPSEO_VERSION') || defined('RANK_MATH_VERSION')) { return; }
        $id = get_queried_object_id();
        if (!self::meta_for($id)) { return; }
        $desc = (string) get_post_meta($id, '_oxy_seo_desc', true);
        $img = (string) get_post_meta($id, '_oxy_seo_img', true);
        $url = get_permalink($id);
        $title = get_the_title($id);
        echo "\n<meta name=\"description\" content=\"" . esc_attr($desc) . "\">\n";
        echo '<meta property="og:type" content="article"><meta property="og:title" content="' . esc_attr($title) . '"><meta property="og:description" content="' . esc_attr($desc) . '"><meta property="og:url" content="' . esc_url($url) . '"><meta property="og:locale" content="ar_AR">' . "\n";
        if ($img) { echo '<meta property="og:image" content="' . esc_url($img) . '"><meta name="twitter:card" content="summary_large_image">' . "\n"; }
        $faq = json_decode((string) get_post_meta($id, '_oxy_seo_faq', true), true) ?: [];
        $graph = [[
            '@type' => 'Article', 'headline' => $title, 'description' => $desc, 'inLanguage' => 'ar', 'mainEntityOfPage' => $url,
            'datePublished' => get_post_time('c', true, $id), 'dateModified' => get_post_modified_time('c', true, $id),
            'author' => ['@type' => 'Organization', 'name' => self::brand()], 'publisher' => ['@type' => 'Organization', 'name' => self::brand()],
        ] + ($img ? ['image' => $img] : []),
        ['@type' => 'BreadcrumbList', 'itemListElement' => [['@type' => 'ListItem', 'position' => 1, 'name' => 'الرئيسية', 'item' => home_url('/')], ['@type' => 'ListItem', 'position' => 2, 'name' => $title, 'item' => $url]]]];
        if ($faq) {
            $ents = [];
            foreach ($faq as $q) { $ents[] = ['@type' => 'Question', 'name' => $q[0], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $q[1]]]; }
            $graph[] = ['@type' => 'FAQPage', 'mainEntity' => $ents];
        }
        echo '<script type="application/ld+json">' . wp_json_encode(['@context' => 'https://schema.org', '@graph' => $graph], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "</script>\n";
    }
    public static function archive_shortcode() {
        $q = get_posts(['post_type' => 'post', 'post_status' => 'publish', 'meta_key' => '_oxy_seo_key', 'numberposts' => 200, 'orderby' => 'modified', 'order' => 'DESC']);
        if (!$q) { return '<p>لا توجد مقالات بعد.</p>'; }
        $g = [];
        foreach ($q as $p) { $g[wp_date('F Y', get_post_timestamp($p))][] = $p; }
        $h = '<div class="oxy-seo-archive">';
        foreach ($g as $m => $ps) {
            $h .= '<h2>' . esc_html($m) . '</h2><ul>';
            foreach ($ps as $p) {
                $rev = (int) get_post_meta($p->ID, '_oxy_seo_rev', true);
                $h .= '<li><a href="' . esc_url(get_permalink($p)) . '">' . esc_html(get_the_title($p)) . '</a>' . ($rev ? ' <small>(تم التحديث)</small>' : '') . '</li>';
            }
            $h .= '</ul>';
        }
        return $h . '</div>';
    }

    /* ---------- admin ---------- */
    public static function menu() {
        add_menu_page('أرشفة ومقالات SEO', 'مقالات وأرشفة SEO', 'manage_options', 'oxygen-seo', [__CLASS__, 'page'], 'dashicons-chart-line', 58);
    }
    private static function guard($nonce) { if (!current_user_can('manage_options')) { wp_die('غير مصرح.'); } check_admin_referer($nonce); }
    private static function back($msg) { wp_safe_redirect(add_query_arg('oxy_msg', rawurlencode($msg), admin_url('admin.php?page=oxygen-seo'))); exit; }
    public static function h_save() {
        self::guard('oxy_seo_save');
        $s = self::settings();
        $s['enabled'] = !empty($_POST['enabled']) ? 1 : 0;
        $s['status'] = (($_POST['status'] ?? '') === 'draft') ? 'draft' : 'publish';
        $s['new_per_day'] = max(0, min(40, (int) ($_POST['new_per_day'] ?? 10)));
        $s['seo_per_day'] = max(0, min(40, (int) ($_POST['seo_per_day'] ?? 10)));
        $s['district_per_day'] = max(0, min(40, (int) ($_POST['district_per_day'] ?? 10)));
        $s['random_per_day'] = max(0, min(40, (int) ($_POST['random_per_day'] ?? 10)));
        $s['refresh_per_day'] = max(0, min(24, (int) ($_POST['refresh_per_day'] ?? 4)));
        $s['min_age_days'] = max(0, min(365, (int) ($_POST['min_age_days'] ?? 7)));
        $s['wa'] = preg_replace('/\D/', '', (string) ($_POST['wa'] ?? ''));
        update_option(self::OPT, $s, false);
        self::back('تم حفظ الإعدادات.');
    }
    public static function h_run() {
        self::guard('oxy_seo_run');
        $w = sanitize_key($_POST['what'] ?? 'new');
        if ($w === 'refresh') { $id = self::refresh_next(true); self::back($id ? 'تم تحديث مقال.' : 'لا توجد مقالات للتحديث بعد.'); }
        $n = max(1, min(10, (int) ($_POST['count'] ?? 1)));
        $done = 0;
        for ($i = 0; $i < $n; $i++) { if (self::create_next()) { $done++; } else { break; } }
        self::back($done ? "تم إنشاء $done مقال." : 'اكتملت الخطة (كل المقالات منشورة).');
    }
    public static function h_publish_drafts() {
        self::guard('oxy_seo_pub');
        $ids = get_posts(['post_type' => 'post', 'post_status' => 'draft', 'meta_key' => '_oxy_seo_key', 'numberposts' => -1, 'fields' => 'ids']);
        foreach ($ids as $id) { wp_update_post(['ID' => $id, 'post_status' => 'publish']); self::log('publish', $id, get_the_title($id), ['st' => 'publish']); }
        self::indexnow(array_map('get_permalink', $ids));
        self::back('تم نشر ' . count($ids) . ' مسودة.');
    }
    public static function h_archive_page() {
        self::guard('oxy_seo_page');
        $p = get_page_by_path('oxygen-seo-archive');
        if (!$p) { wp_insert_post(['post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'أرشيف المقالات', 'post_name' => 'oxygen-seo-archive', 'post_content' => '[oxygen_seo_archive]']); }
        self::back('صفحة الأرشيف جاهزة: /oxygen-seo-archive/');
    }
    private static function days_ar() { return ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']; }
    public static function page() {
        if (!current_user_can('manage_options')) { return; }
        $s = self::settings();
        $map = self::map();
        $plan = self::plan();
        $pub = 0; $dr = 0; $revs = 0; $minrev = 9999;
        foreach ($plan as $it) {
            if (isset($map[$it['key']])) {
                $st = get_post_status($map[$it['key']]);
                $st === 'publish' ? $pub++ : $dr++;
                $r = (int) get_post_meta($map[$it['key']], '_oxy_seo_rev', true); $revs += $r; $minrev = min($minrev, $r);
            }
        }
        $log = (array) get_option(self::LOG, []);
        $days = self::days_ar();
        echo '<div class="wrap" dir="rtl"><h1>مقالات وأرشفة SEO — أكسجين</h1>';
        if (!empty($_GET['oxy_msg'])) { echo '<div class="notice notice-success"><p>' . esc_html(wp_unslash($_GET['oxy_msg'])) . '</p></div>'; }
        echo '<p><strong>المنشور:</strong> ' . (int) $pub . ' / ' . count($plan) . ' &nbsp; <strong>مسودات:</strong> ' . (int) $dr . ' &nbsp; <strong>إجمالي التحديثات:</strong> ' . (int) $revs . ' &nbsp; <strong>أقل عدد تحديثات لمقال:</strong> ' . ($minrev === 9999 ? 0 : (int) $minrev) . '</p>';
        echo '<p>الخطة: 60 مقالاً تجارياً + 60 مقالاً معلوماتياً (500+ كلمة)، ثم دورة تحديث لا تنتهي بـ24 سيناريو لكل مقال، وتظهر على المقال عبارة «تم التحديث».</p>';
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '"><input type="hidden" name="action" value="oxy_seo_save">';
        wp_nonce_field('oxy_seo_save');
        echo '<table class="form-table"><tr><th>تشغيل المحرك</th><td><label><input type="checkbox" name="enabled" value="1" ' . checked(!empty($s['enabled']), true, false) . '> مفعّل</label></td></tr>';
        echo '<tr><th>حالة المقال الجديد</th><td><select name="status"><option value="publish" ' . selected($s['status'], 'publish', false) . '>نشر مباشر</option><option value="draft" ' . selected($s['status'], 'draft', false) . '>مسودة للمراجعة قبل النشر</option></select></td></tr>';
        echo '<tr><th>مقالات جديدة / يوم</th><td><input type="number" name="new_per_day" value="' . (int) $s['new_per_day'] . '" min="0" max="40"></td></tr>';
        echo '<tr><th>نفس الخدمة بعنوان وكلمات SEO مختلفة / يوم</th><td><input type="number" name="seo_per_day" value="' . (int) $s['seo_per_day'] . '" min="0" max="40"></td></tr>';
        echo '<tr><th>نفس الخدمة بحي مختلف في مكة / يوم</th><td><input type="number" name="district_per_day" value="' . (int) $s['district_per_day'] . '" min="0" max="40"></td></tr>';
        echo '<tr><th>تحديث مقالات قديمة عشوائياً / يوم</th><td><input type="number" name="random_per_day" value="' . (int) $s['random_per_day'] . '" min="0" max="40"></td></tr>';
        echo '<tr><th>تحديثات / يوم</th><td><input type="number" name="refresh_per_day" value="' . (int) $s['refresh_per_day'] . '" min="0" max="24"></td></tr>';
        echo '<tr><th>أقل عمر قبل التحديث (أيام)</th><td><input type="number" name="min_age_days" value="' . (int) $s['min_age_days'] . '" min="0" max="365"></td></tr>';
        echo '<tr><th>رقم واتساب للمقالات</th><td><input type="text" name="wa" value="' . esc_attr($s['wa']) . '" placeholder="9665xxxxxxxx"></td></tr></table>';
        submit_button('حفظ الإعدادات');
        echo '</form><h2>تشغيل يدوي</h2><div style="display:flex;gap:8px;flex-wrap:wrap">';
        foreach ([['new', 1, 'إنشاء مقال'], ['new', 5, 'إنشاء 5 مقالات'], ['refresh', 1, 'تحديث مقال الآن']] as $b) {
            echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '"><input type="hidden" name="action" value="oxy_seo_run"><input type="hidden" name="what" value="' . esc_attr($b[0]) . '"><input type="hidden" name="count" value="' . (int) $b[1] . '">';
            wp_nonce_field('oxy_seo_run'); submit_button($b[2], 'secondary', '', false); echo '</form>';
        }
        foreach ([['oxy_seo_pub', 'نشر كل المسودات'], ['oxy_seo_page', 'إنشاء صفحة الأرشيف']] as $b) {
            echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '"><input type="hidden" name="action" value="' . esc_attr($b[0]) . '">';
            wp_nonce_field($b[0]); submit_button($b[1], 'secondary', '', false); echo '</form>';
        }
        echo '</div><p class="description">للتشغيل المنتظم على Hostinger: أضف مهمة Cron كل ساعة تستدعي <code>wget -q -O - ' . esc_html(home_url('/wp-cron.php?doing_wp_cron')) . '</code> مع تعطيل DISABLE_WP_CRON إن رغبت.</p>';
        echo '<h2>المقالات والأرشيف</h2><table class="widefat striped"><thead><tr><th>#</th><th>المسار</th><th>العنوان</th><th>الكلمة المفتاحية</th><th>الحالة</th><th>التحديثات</th><th>آخر سيناريو</th><th>آخر تحديث</th><th>روابط</th></tr></thead><tbody>';
        foreach ($plan as $it) {
            $id = $map[$it['key']] ?? 0;
            echo '<tr><td>' . ($it['idx'] + 1) . '</td><td>' . ($it['track'] === 'commercial' ? 'تجاري' : 'معلوماتي') . '</td><td>' . esc_html($it['title']) . '</td><td>' . esc_html($it['kw']) . '</td>';
            if ($id) {
                $st = get_post_status($id);
                echo '<td>' . ($st === 'publish' ? 'منشور' : 'مسودة') . '</td><td>' . (int) get_post_meta($id, '_oxy_seo_rev', true) . '</td><td>' . esc_html(get_post_meta($id, '_oxy_seo_angle', true)) . '</td><td>' . esc_html(get_post_meta($id, '_oxy_seo_updated', true)) . '</td><td><a href="' . esc_url($st === 'publish' ? get_permalink($id) : get_preview_post_link($id)) . '" target="_blank">' . ($st === 'publish' ? 'عرض' : 'معاينة') . '</a> | <a href="' . esc_url(get_edit_post_link($id)) . '">تحرير</a></td>';
            } else { echo '<td>في الانتظار</td><td>-</td><td>-</td><td>-</td><td>-</td>'; }
            echo '</tr>';
        }
        echo '</tbody></table><h2>سجل العمليات</h2><table class="widefat striped"><thead><tr><th>التاريخ</th><th>اليوم</th><th>الساعة</th><th>العملية</th><th>العنوان</th><th>الرابط</th></tr></thead><tbody>';
        $names = ['new' => 'مقال جديد', 'refresh' => 'تحديث', 'publish' => 'نشر مسودة', 'new_seo' => 'مقال بنفس الخدمة وSEO مختلف', 'new_dist' => 'مقال لحي في مكة', 'refresh_rand' => 'تحديث عشوائي'];
        foreach (array_slice($log, 0, 200) as $r) {
            $ts = (int) ($r['ts'] ?? 0);
            echo '<tr><td>' . esc_html(wp_date('Y-m-d', $ts)) . '</td><td>' . esc_html($days[(int) wp_date('w', $ts)]) . '</td><td>' . esc_html(wp_date('H:i', $ts)) . '</td><td>' . esc_html(($names[$r['a']] ?? $r['a']) . (isset($r['rev']) && $r['a'] === 'refresh' ? ' #' . $r['rev'] . ' — ' . ($r['angle'] ?? '') : '')) . '</td><td>' . esc_html($r['t'] ?? '') . '</td><td>' . (!empty($r['l']) ? '<a target="_blank" href="' . esc_url($r['l']) . '">فتح</a>' : '') . '</td></tr>';
        }
        echo '</tbody></table></div>';
    }
}
