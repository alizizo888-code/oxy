<?php
defined('ABSPATH') || exit;
get_header();
?>
<main class="oxygen-theme-shell">
<?php if (have_posts()) : while (have_posts()) : the_post(); ?>
  <article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
    <h1><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h1>
    <div class="oxygen-theme-content"><?php the_content(); ?></div>
  </article>
<?php endwhile; the_posts_pagination(); else : ?>
  <h1><?php esc_html_e('لا يوجد محتوى بعد', 'oxygen-wp-theme'); ?></h1>
<?php endif; ?>
</main>
<?php get_footer(); ?>
