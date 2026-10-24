<?php
/**
 * Theme functions for Oxygen WordPress.
 */
defined('ABSPATH') || exit;

function oxygen_wp_theme_setup() {
    load_theme_textdomain('oxygen-wp-theme', get_template_directory() . '/languages');
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('custom-logo');
    add_theme_support('automatic-feed-links');
    add_theme_support('html5', array('search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script'));
    register_nav_menus(array(
        'primary' => __('القائمة الرئيسية', 'oxygen-wp-theme'),
        'footer'  => __('قائمة التذييل', 'oxygen-wp-theme'),
    ));
}
add_action('after_setup_theme', 'oxygen_wp_theme_setup');

function oxygen_wp_theme_enqueue_styles() {
    wp_enqueue_style(
        'oxygen-wp-theme-style',
        get_stylesheet_uri(),
        array(),
        wp_get_theme()->get('Version')
    );
}
add_action('wp_enqueue_scripts', 'oxygen_wp_theme_enqueue_styles');

function oxygen_wp_theme_content_width() {
    $GLOBALS['content_width'] = 1050;
}
add_action('after_setup_theme', 'oxygen_wp_theme_content_width', 0);
