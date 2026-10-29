<?php
if (!defined('ABSPATH')) { exit; }

/**
 * Free-tier AI gateway.
 *
 * Tries the configured providers in order (Groq, Gemini, Cloudflare Workers AI, OpenRouter). A provider that
 * answers 429 / quota errors is put in a short "cooldown" and the next one is used, so one provider's daily
 * free limit never stops the chat while another still has room. Keys live only in a WordPress option on the
 * server; the browser never sees them. Phone numbers and e-mails are masked before text leaves the server,
 * because free tiers may let humans review prompts.
 */
final class Mutqan_AI {
    const OPT = 'mutqan_ai_settings';
    const MAX_PROMPT_CHARS = 30000;

    public static function defaults() {
        return [
            'order' => ['groq', 'gemini', 'cloudflare', 'openrouter'],
            'providers' => [
                'groq'       => ['enabled' => 0, 'key' => '', 'model' => 'openai/gpt-oss-120b'],
                'gemini'     => ['enabled' => 0, 'key' => '', 'model' => 'gemini-3.1-flash-lite'],
                'cloudflare' => ['enabled' => 0, 'key' => '', 'account' => '', 'model' => '@cf/meta/llama-3.3-70b-instruct-fp8-fast'],
                'openrouter' => ['enabled' => 0, 'key' => '', 'model' => 'meta-llama/llama-3.3-70b-instruct:free'],
            ],
            'per_ip_10min' => 30,
            'per_ip_day' => 250,
            'mask_pii' => 1,
            'status' => [],
        ];
    }

    public static function settings() {
        $s = (array) get_option(self::OPT, []);
        $d = self::defaults();
        $out = array_merge($d, $s);
        foreach ($d['providers'] as $id => $def) {
            $out['providers'][$id] = array_merge($def, (array) ($s['providers'][$id] ?? []));
        }
        return $out;
    }

    public static function labels() {
        return ['groq' => 'Groq', 'gemini' => 'Google Gemini', 'cloudflare' => 'Cloudflare Workers AI', 'openrouter' => 'OpenRouter'];
    }

    public static function any_enabled($s = null) {
        $s = $s ?: self::settings();
        foreach ($s['providers'] as $id => $c) { if (self::usable($id, $c)) { return true; } }
        return false;
    }

    private static function usable($id, $c) {
        if (empty($c['enabled']) || $c['key'] === '') { return false; }
        return $id !== 'cloudflare' || $c['account'] !== '';
    }

    /* ------------------------------------------------------------------ public entry */

    public static function mask($text) {
        $text = preg_replace('/[\w.+-]+@[\w-]+\.[\w.-]+/u', '[بريد]', $text);
        $text = preg_replace('/(?<![\d.])\+?\d[\d\s().-]{6,}\d(?![\d.])/u', '[رقم]', Mutqan_Auth::fold_digits($text));
        return $text;
    }

    /** @return array ['text' => string, 'json' => ?array, 'provider' => string] @throws Mutqan_Error */
    public static function run($prompt, $opts, $p) {
        $prompt = (string) $prompt;
        if ($prompt === '') { throw new Mutqan_Error('empty_prompt', 'الرسالة فارغة.', 400); }
        if (mb_strlen($prompt) > self::MAX_PROMPT_CHARS) { throw new Mutqan_Error('prompt_too_large', 'الطلب كبير جدًا.', 413); }
        $s = self::settings();
        if (!self::any_enabled($s)) { throw new Mutqan_Error('ai_unavailable', 'خدمة الذكاء الاصطناعي غير مفعّلة.', 503); }

        if (!Mutqan_Policy::is_staff($p)) {
            Mutqan_Limiter::hit('ai10', (int) $s['per_ip_10min'], 600);
            Mutqan_Limiter::hit('aiday', (int) $s['per_ip_day'], 86400);
        }
        if (!empty($s['mask_pii'])) { $prompt = self::mask($prompt); }
        $wantJson = !empty($opts['json']);
        $temp = isset($opts['temperature']) && is_numeric($opts['temperature']) ? max(0, min(1.2, (float) $opts['temperature'])) : 0.4;

        $tried = 0; $lastText = ''; $lastProvider = '';
        foreach ($s['order'] as $id) {
            $c = $s['providers'][$id] ?? null;
            if (!$c || !self::usable($id, $c) || self::cooling($id)) { continue; }
            if ($tried >= 3) { break; }
            $tried++;
            $r = self::call($id, $c, $prompt, $wantJson, $temp);
            if ($r['ok']) {
                $text = trim($r['text']);
                $json = $wantJson ? self::extract_json($text) : null;
                if ($wantJson && $json === null) { $lastText = $text; $lastProvider = $id; self::note($id, 'JSON غير صالح'); continue; }
                self::note($id, 'ok');
                return ['text' => $text, 'json' => $json, 'provider' => $id];
            }
            self::note($id, $r['error']);
            if ($r['cooldown']) { self::set_cooldown($id, $r['cooldown']); }
        }
        if ($lastText !== '') { return ['text' => $lastText, 'json' => null, 'provider' => $lastProvider]; }
        throw new Mutqan_Error('ai_unavailable', 'خدمة الذكاء الاصطناعي مشغولة الآن.', 503);
    }

    /* ------------------------------------------------------------------ cooldown + status */

    private static function cooling($id) { return (bool) get_transient('mq_cool_' . $id); }
    private static function set_cooldown($id, $secs) { set_transient('mq_cool_' . $id, 1, max(30, min(10800, (int) $secs))); }

    private static function note($id, $msg) {
        $s = (array) get_option(self::OPT, []);
        $st = isset($s['status']) && is_array($s['status']) ? $s['status'] : [];
        $st[$id] = ['at' => Mutqan_Store::now(), 'msg' => mb_substr((string) $msg, 0, 160)];
        $s['status'] = $st;
        update_option(self::OPT, $s, false);
    }

    public static function cooldowns() {
        $out = [];
        foreach (array_keys(self::labels()) as $id) { $out[$id] = self::cooling($id); }
        return $out;
    }

    /* ------------------------------------------------------------------ providers */

    private static function http($url, $headers, $body) {
        $res = wp_remote_post($url, ['timeout' => 22, 'headers' => $headers, 'body' => wp_json_encode($body)]);
        if (is_wp_error($res)) { return [0, null, $res->get_error_message(), '']; }
        $code = (int) wp_remote_retrieve_response_code($res);
        $raw = wp_remote_retrieve_body($res);
        return [$code, json_decode($raw, true), $raw, (string) wp_remote_retrieve_header($res, 'retry-after')];
    }

    private static function classify($code, $data, $raw, $retry) {
        $msg = is_array($data) ? ($data['error']['message'] ?? ($data['errors'][0]['message'] ?? '')) : '';
        $msg = 'HTTP ' . $code . ' ' . mb_substr((string) ($msg ?: $raw), 0, 120);
        $cool = 0;
        if ($code === 429 || $code === 402 || $code === 403 || ($code === 503 && stripos($raw, 'quota') !== false)) {
            $cool = (int) $retry > 0 ? (int) $retry : 90;
            if (preg_match('/per day|daily|RPD|quota|neurons|exceeded your current/i', $raw)) { $cool = max($cool, 3600); }
        } elseif ($code === 0 || $code >= 500) { $cool = 30; }
        elseif ($code === 401) { $cool = 600; }
        return ['ok' => false, 'error' => $msg, 'cooldown' => $cool];
    }

    private static function call($id, $c, $prompt, $json, $temp) {
        switch ($id) {
            case 'groq': return self::call_openai_compat('https://api.groq.com/openai/v1/chat/completions', $c, $prompt, $json, $temp, []);
            case 'openrouter': return self::call_openai_compat('https://openrouter.ai/api/v1/chat/completions', $c, $prompt, $json, $temp, ['X-Title' => 'Oxygen Mutqan']);
            case 'gemini': return self::call_gemini($c, $prompt, $json, $temp);
            case 'cloudflare': return self::call_cloudflare($c, $prompt, $temp);
        }
        return ['ok' => false, 'error' => 'unknown provider', 'cooldown' => 0];
    }

    private static function call_openai_compat($url, $c, $prompt, $json, $temp, $extra_headers) {
        $body = ['model' => $c['model'], 'messages' => [['role' => 'user', 'content' => $prompt]], 'temperature' => $temp, 'max_tokens' => 900];
        if ($json) { $body['response_format'] = ['type' => 'json_object']; }
        $h = array_merge(['Authorization' => 'Bearer ' . $c['key'], 'Content-Type' => 'application/json'], $extra_headers);
        list($code, $data, $raw, $retry) = self::http($url, $h, $body);
        if ($code === 400 && $json) {            // some models reject response_format; retry once as plain text
            unset($body['response_format']);
            list($code, $data, $raw, $retry) = self::http($url, $h, $body);
        }
        if ($code >= 200 && $code < 300 && isset($data['choices'][0]['message']['content'])) {
            return ['ok' => true, 'text' => (string) $data['choices'][0]['message']['content']];
        }
        return self::classify($code, $data, $raw, $retry);
    }

    private static function call_gemini($c, $prompt, $json, $temp) {
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($c['model']) . ':generateContent';
        $gen = ['temperature' => $temp, 'maxOutputTokens' => 900];
        if ($json) { $gen['responseMimeType'] = 'application/json'; }
        list($code, $data, $raw, $retry) = self::http($url, ['x-goog-api-key' => $c['key'], 'Content-Type' => 'application/json'], [
            'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]], 'generationConfig' => $gen,
        ]);
        if ($code >= 200 && $code < 300 && isset($data['candidates'][0]['content']['parts'])) {
            $t = '';
            foreach ($data['candidates'][0]['content']['parts'] as $part) { $t .= (string) ($part['text'] ?? ''); }
            if ($t !== '') { return ['ok' => true, 'text' => $t]; }
        }
        return self::classify($code, $data, $raw, $retry);
    }

    private static function call_cloudflare($c, $prompt, $temp) {
        $url = 'https://api.cloudflare.com/client/v4/accounts/' . rawurlencode($c['account']) . '/ai/run/' . $c['model'];
        list($code, $data, $raw, $retry) = self::http($url, ['Authorization' => 'Bearer ' . $c['key'], 'Content-Type' => 'application/json'], [
            'messages' => [['role' => 'user', 'content' => $prompt]], 'max_tokens' => 900, 'temperature' => $temp,
        ]);
        if ($code >= 200 && $code < 300 && isset($data['result']['response']) && is_string($data['result']['response'])) {
            return ['ok' => true, 'text' => $data['result']['response']];
        }
        return self::classify($code, $data, $raw, $retry);
    }

    /* ------------------------------------------------------------------ JSON extraction */

    public static function extract_json($text) {
        $t = trim((string) $text);
        $t = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', $t);
        $d = json_decode($t, true);
        if (is_array($d)) { return $d; }
        $a = strpos($t, '{'); $b = strrpos($t, '}');
        if ($a !== false && $b !== false && $b > $a) {
            $d = json_decode(substr($t, $a, $b - $a + 1), true);
            if (is_array($d)) { return $d; }
        }
        return null;
    }

    /** Sends one tiny request to every configured provider (admin "test" button). */
    public static function test_all() {
        $s = self::settings(); $out = [];
        foreach ($s['order'] as $id) {
            $c = $s['providers'][$id] ?? null;
            if (!$c || !self::usable($id, $c)) { $out[$id] = 'غير مفعّل'; continue; }
            $r = self::call($id, $c, 'أجب بكلمة واحدة فقط: تم', false, 0.0);
            $out[$id] = $r['ok'] ? 'يعمل ✓' : ('فشل: ' . $r['error']);
            if (!$r['ok'] && $r['cooldown']) { self::set_cooldown($id, $r['cooldown']); }
            if ($r['ok']) { delete_transient('mq_cool_' . $id); }
        }
        return $out;
    }
}
