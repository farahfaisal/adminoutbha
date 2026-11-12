#!/bin/bash
# وسيط جوال باي على pay.otlobha.site → apitest.jawwalpay.ps
# لا يغيّر مواقعك الحالية: يضيف موقعاً جديداً فقط باسم pay.otlobha.site
set -e
DOMAIN=pay.otlobha.site
UPSTREAM=apitest.jawwalpay.ps
SECRET_FILE=/etc/jawwal-proxy-secret
[ -f $SECRET_FILE ] || openssl rand -hex 24 > $SECRET_FILE
chmod 600 $SECRET_FILE
SECRET=$(cat $SECRET_FILE)

echo "== فحص الوصول لجوال باي من هذا الخادم =="
curl -s -o /dev/null -m 15 -w "jawwal http status: %{http_code}\n" -X POST https://$UPSTREAM/login || echo "jawwal: لا يوجد اتصال بعد (طبيعي قبل أن يسجّل أحمد عمرو العنوان)"

CONF_BODY="    location / {
        if (\$http_x_proxy_secret != \"$SECRET\") { return 403; }
        proxy_pass https://$UPSTREAM;
        proxy_ssl_server_name on;
        proxy_set_header Host $UPSTREAM;
        proxy_set_header X-Proxy-Secret \"\";
        proxy_connect_timeout 20s;
        proxy_read_timeout 60s;
    }"

if command -v nginx >/dev/null 2>&1; then
  echo "== nginx موجود: إضافة موقع $DOMAIN =="
  CONF=/etc/nginx/conf.d/$DOMAIN.conf
  [ -d /etc/nginx/conf.d ] || mkdir -p /etc/nginx/conf.d
  cat > $CONF <<EOF
server {
    listen 80;
    server_name $DOMAIN;
$CONF_BODY
}
EOF
  nginx -t && systemctl reload nginx
  if ! command -v certbot >/dev/null 2>&1; then
    apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx
  fi
  certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email --redirect
elif ! ss -ltn | grep -qE ':(80|443) '; then
  echo "== لا يوجد خادم ويب: تثبيت Caddy =="
  if ! command -v caddy >/dev/null 2>&1; then
    apt-get update -qq && apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gnupg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq && apt-get install -y -qq caddy
  fi
  cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
    @bad not header X-Proxy-Secret $SECRET
    respond @bad 403
    reverse_proxy https://$UPSTREAM {
        header_up Host $UPSTREAM
        header_up -X-Proxy-Secret
    }
}
EOF
  systemctl reload caddy || systemctl restart caddy
else
  echo "!! يوجد خادم ويب غير nginx على المنفذ 80/443. أرسل لـ Claude ناتج الأمر التالي:"
  ss -ltnp | grep -E ':(80|443) '
  exit 1
fi

sleep 3
echo "== فحص الوسيط =="
curl -s -o /dev/null -w "without secret (يجب 403): %{http_code}\n" https://$DOMAIN/login || true
echo
echo "================ تم ================"
echo "انسخ هذا السطر وضعه في Supabase كـ Secret باسم JAWWAL_PROXY_SECRET:"
echo "$SECRET"
echo "===================================="
