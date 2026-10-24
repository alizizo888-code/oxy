<?php
/**
 * Oxygen front page rendered through WordPress.
 */
defined('ABSPATH') || exit;

$oxygen_theme_assets = array(
    WP_PLUGIN_DIR . '/oxygen-ac-automation/assets/oxygen-maintenance-home.html',
);
$oxygen_theme_html = '';
foreach ($oxygen_theme_assets as $oxygen_theme_asset) {
    if (is_readable($oxygen_theme_asset)) {
        $oxygen_theme_html = file_get_contents($oxygen_theme_asset);
        if (is_string($oxygen_theme_html) && $oxygen_theme_html !== '') {
            break;
        }
    }
}

if (is_string($oxygen_theme_html) && $oxygen_theme_html !== '') {
    $oxygen_admin_url = admin_url('admin.php?page=oxygen-ac-automation');
    $oxygen_replacement = 'function openAdminGate() { window.location.href = ' . wp_json_encode($oxygen_admin_url, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . '; }';
    $oxygen_rewritten = preg_replace('/function\s+openAdminGate\s*\(\)\s*\{[\s\S]*?\n\s*\}/', $oxygen_replacement, $oxygen_theme_html, 1);
    if (is_string($oxygen_rewritten)) {
        $oxygen_theme_html = $oxygen_rewritten;
    }
    $oxygen_theme_html = str_replace(
        'https://googl.oxygen11.com/wp-admin/admin.php?page=oxygen-ac-automation',
        esc_url($oxygen_admin_url),
        $oxygen_theme_html
    );
    nocache_headers();
    header('Content-Type: text/html; charset=' . get_bloginfo('charset'));
    echo $oxygen_theme_html;
    exit;
}

get_header();
?>
<main class="oxygen-theme-shell">
<?php if (have_posts()) : while (have_posts()) : the_post(); ?>
  <article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
    <h1><?php the_title(); ?></h1>
    <div class="oxygen-theme-content"><?php the_content(); ?></div>
  </article>
<?php endwhile; else : ?>
  <h1><?php esc_html_e('مرحبًا بك في أكسجين للصيانة والتبريد', 'oxygen-wp-theme'); ?></h1>
  <p><?php esc_html_e('أضف محتوى الصفحة الرئيسية من لوحة WordPress.', 'oxygen-wp-theme'); ?></p>
<?php endif; ?>
</main>
<?php get_footer(); ?>
