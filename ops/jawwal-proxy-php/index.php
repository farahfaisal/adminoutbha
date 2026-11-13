<?php
// وسيط جوال باي (pay.otlobha.site) → apitest.jawwalpay.ps
// يمرّر الطلب فقط إذا حمل الرمز السري X-Proxy-Secret المحفوظ في ../private_html/.jawwal_secret
$upstream = 'https://apitest.jawwalpay.ps';
$secretFile = __DIR__ . '/../private_html/.jawwal_secret';
$secret = is_readable($secretFile) ? trim(file_get_contents($secretFile)) : '';
$given = $_SERVER['HTTP_X_PROXY_SECRET'] ?? '';
if ($secret === '' || !hash_equals($secret, $given)) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'forbidden']);
    exit;
}
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
if (!preg_match('#^/(login|v1/[A-Za-z0-9_/]+)$#', $path)) {
    http_response_code(404);
    echo json_encode(['error' => 'not found']);
    exit;
}
$headers = [];
foreach (['HTTP_AUTHORIZATION' => 'Authorization', 'HTTP_X_AUTH_TOKEN' => 'X-Auth-Token', 'CONTENT_TYPE' => 'Content-Type'] as $k => $name) {
    if (!empty($_SERVER[$k])) $headers[] = $name . ': ' . $_SERVER[$k];
}
if (empty($_SERVER['HTTP_AUTHORIZATION']) && function_exists('getallheaders')) {
    foreach (getallheaders() as $k => $v) if (strcasecmp($k, 'Authorization') === 0) $headers[] = 'Authorization: ' . $v;
}
$ch = curl_init($upstream . $path);
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $_SERVER['REQUEST_METHOD'],
    CURLOPT_POSTFIELDS => file_get_contents('php://input'),
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 20,
    CURLOPT_TIMEOUT => 60,
]);
$body = curl_exec($ch);
if ($body === false) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['errorCd' => 'PROXY', 'desc' => 'upstream unreachable: ' . curl_error($ch)]);
    exit;
}
http_response_code(curl_getinfo($ch, CURLINFO_HTTP_CODE));
header('Content-Type: ' . (curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: 'application/json'));
echo $body;
