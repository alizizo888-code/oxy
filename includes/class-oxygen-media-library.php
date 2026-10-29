<?php
/**
 * Oxygen Media Library
 * Full-resolution media gallery, image fallbacks and selected-item export.
 */
defined('ABSPATH') || exit;

final class Oxygen_Media_Library {
    private static $instance = null;

    public static function instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', array($this, 'admin_menu'));
        add_shortcode('oxygen_media_library', array($this, 'shortcode'));
    }

    public function admin_menu() {
        add_media_page(
            'مكتبة الصور والجرافيكس',
            'مكتبة الصور والجرافيكس',
            'upload_files',
            'oxygen-media-library',
            array($this, 'admin_page')
        );
    }

    private function items($limit = 120) {
        return get_posts(array(
            'post_type' => 'attachment',
            'post_status' => 'inherit',
            'post_mime_type' => 'image',
            'posts_per_page' => max(1, min(300, (int) $limit)),
            'orderby' => 'date',
            'order' => 'DESC',
            'suppress_filters' => false,
        ));
    }

    private function item_data($attachment) {
        $id = (int) $attachment->ID;
        $full = wp_get_attachment_image_url($id, 'full');
        if (!$full) {
            $full = wp_get_attachment_url($id);
        }
        return array(
            'id' => $id,
            'title' => get_the_title($id),
            'alt' => (string) get_post_meta($id, '_wp_attachment_image_alt', true),
            'url' => $full ? esc_url_raw($full) : '',
            'mime' => (string) get_post_mime_type($id),
            'date' => get_post_time('c', true, $id),
        );
    }

    private function styles() {
        return '<style>
        .oxy-media-library{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#0f172a}
        .oxy-media-toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0}
        .oxy-media-toolbar input{min-width:220px;max-width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px}
        .oxy-media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:14px}
        .oxy-media-card{min-width:0;background:#fff;border:1px solid #dbeafe;border-radius:14px;overflow:hidden;box-shadow:0 4px 14px #0f172a0a}
        .oxy-media-card a.oxy-media-full{display:grid;place-items:center;aspect-ratio:1;background:linear-gradient(135deg,#e0f2fe,#f8fafc);overflow:hidden}
        .oxy-media-card img{width:100%;height:100%;object-fit:contain;display:block}
        .oxy-media-card .oxy-media-fallback{display:none;color:#0369a1;font-size:34px}
        .oxy-media-card .oxy-media-meta{padding:9px;font-size:12px;overflow-wrap:anywhere}
        .oxy-media-card label{display:flex;gap:6px;align-items:flex-start;font-weight:700}
        .oxy-media-btn{border:0;border-radius:10px;padding:10px 14px;background:#0369a1;color:#fff;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block}
        .oxy-media-btn.secondary{background:#e0f2fe;color:#075985}
        .oxy-media-note{background:#f0f9ff;border:1px solid #bae6fd;padding:12px;border-radius:12px;margin:10px 0}
        @media(prefers-reduced-motion:no-preference){.oxy-media-card{transition:transform .2s,box-shadow .2s}.oxy-media-card:hover{transform:translateY(-2px);box-shadow:0 10px 22px #0369a11a}}
        </style>';
    }

    private function grid($items, $is_admin = false) {
        $out = '<div class="oxy-media-grid">';
        foreach ($items as $attachment) {
            $data = $this->item_data($attachment);
            if (!$data['url']) {
                continue;
            }
            $thumb = wp_get_attachment_image_url($data['id'], 'medium');
            if (!$thumb) {
                $thumb = $data['url'];
            }
            $title = $data['title'] ? $data['title'] : 'صورة ' . $data['id'];
            $out .= '<article class="oxy-media-card" data-search="' . esc_attr(strtolower($title . ' ' . $data['alt'])) . '" data-export="' . esc_attr(wp_json_encode($data)) . '">';
            if ($is_admin) {
                $out .= '<div class="oxy-media-meta"><label><input type="checkbox" class="oxy-media-select"> <span>اختيار للتصدير</span></label></div>';
            }
            $out .= '<a class="oxy-media-full" href="' . esc_url($data['url']) . '" target="_blank" rel="noopener" title="فتح الصورة بالحجم الأصلي">';
            $out .= "<img src=\"" . esc_url($thumb) . "\" data-full=\"" . esc_url($data['url']) . "\" alt=\"" . esc_attr($data['alt'] ?: $title) . "\" loading=\"lazy\" decoding=\"async\" onerror=\"this.style.display='none';this.nextElementSibling.style.display='block';\">";
            $out .= '<span class="oxy-media-fallback" aria-label="معاينة بديلة">▧</span></a>';
            $out .= '<div class="oxy-media-meta"><strong>' . esc_html($title) . '</strong><br><span>المعرّف: ' . (int) $data['id'] . '</span>';
            $out .= '<br><a href="' . esc_url($data['url']) . '" target="_blank" rel="noopener">فتح الأصل الكامل ↗</a></div></article>';
        }
        return $out . '</div>';
    }

    public function admin_page() {
        if (!current_user_can('upload_files')) {
            wp_die('ليست لديك صلاحية الوصول إلى مكتبة الوسائط.');
        }
        $items = $this->items(300);
        echo '<div class="wrap oxy-media-library"><h1>مكتبة الصور والجرافيكس</h1>';
        echo '<p>معاينة مباشرة للوسائط الموجودة في مكتبة ووردبريس. رابط «فتح الأصل الكامل» يفتح الملف الأصلي دون تحويله إلى صورة مصغّرة.</p>';
        echo $this->styles();
        echo '<div class="oxy-media-note">التصدير ينشئ ملف JSON يحتوي بيانات العناصر المختارة وروابطها الأصلية؛ لا ينسخ الصور ولا يضغطها ولا يحذفها. احتفظ بملفات الوسائط في مكتبة ووردبريس.</div>';
        echo '<div class="oxy-media-toolbar"><input type="search" id="oxy-media-search" placeholder="ابحث باسم الصورة أو النص البديل"><button type="button" class="button" id="oxy-media-select-all">تحديد الظاهر</button><button type="button" class="oxy-media-btn" id="oxy-media-export">تصدير المحدد JSON</button><a class="oxy-media-btn secondary" href="' . esc_url(admin_url('media-new.php')) . '">رفع صور جديدة</a><a class="oxy-media-btn secondary" href="' . esc_url(admin_url('upload.php')) . '">مكتبة ووردبريس الأصلية</a></div>';
        if (!$items) {
            echo '<p>لا توجد صور بعد. استخدم زر رفع صور جديدة.</p>';
        } else {
            echo '<p>يعرض آخر ' . count($items) . ' صورة بحد أقصى 300 صورة في هذه الشاشة.</p>';
            echo $this->grid($items, true);
        }
        echo '<script>
        (function(){
          const root=document.querySelector(".oxy-media-library"); if(!root)return;
          const cards=Array.from(root.querySelectorAll(".oxy-media-card"));
          const search=root.querySelector("#oxy-media-search");
          search.addEventListener("input",function(){const q=this.value.trim().toLocaleLowerCase();cards.forEach(c=>{c.style.display=(c.dataset.search||"").includes(q)?"":"none";});});
          root.querySelector("#oxy-media-select-all").addEventListener("click",function(){cards.filter(c=>c.style.display!=="none").forEach(c=>{const cb=c.querySelector(".oxy-media-select");if(cb)cb.checked=true;});});
          root.querySelector("#oxy-media-export").addEventListener("click",function(){
            const chosen=cards.filter(c=>{const cb=c.querySelector(".oxy-media-select");return cb&&cb.checked;}).map(c=>{try{return JSON.parse(c.dataset.export||"{}")}catch(e){return null}}).filter(x=>x&&x.url);
            if(!chosen.length){window.alert("حدد صورة واحدة على الأقل للتصدير.");return;}
            const blob=new Blob([JSON.stringify({schema:"oxygen-media-library/v1",exported_at:new Date().toISOString(),items:chosen},null,2)],{type:"application/json;charset=utf-8"});
            const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="oxygen-media-library-export.json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
          });
        })();
        </script></div>';
    }

    public function shortcode($atts = array()) {
        $atts = shortcode_atts(array('limit' => 60, 'title' => 'مكتبة الصور والجرافيكس'), $atts, 'oxygen_media_library');
        $items = $this->items((int) $atts['limit']);
        ob_start();
        echo '<section class="oxy-media-library"><h2>' . esc_html($atts['title']) . '</h2>';
        echo $this->styles();
        echo '<div class="oxy-media-toolbar"><input type="search" class="oxy-media-public-search" placeholder="ابحث في الصور المعروضة" aria-label="ابحث في الصور"></div>';
        echo $this->grid($items, false);
        echo '<script>(function(){document.querySelectorAll(".oxy-media-library").forEach(function(root){const input=root.querySelector(".oxy-media-public-search");if(!input)return;input.addEventListener("input",function(){const q=this.value.trim().toLocaleLowerCase();root.querySelectorAll(".oxy-media-card").forEach(function(c){c.style.display=(c.dataset.search||"").includes(q)?"":"none";});});});})();</script>';
        echo '</section>';
        return ob_get_clean();
    }
}

Oxygen_Media_Library::instance();
