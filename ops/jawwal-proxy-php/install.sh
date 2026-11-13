#!/bin/bash
# يُشغَّل داخل مجلد التطبيق على Cloudways (المجلد الذي فيه public_html)
set -e
cd "${1:-.}"
[ -d public_html ] || { echo "شغّل الأمر داخل مجلد التطبيق (الذي فيه public_html)"; exit 1; }
BASE=https://raw.githubusercontent.com/farahfaisal/adminoutbha/main/ops/jawwal-proxy-php
curl -fsSL $BASE/index.php -o public_html/index.php
curl -fsSL $BASE/.htaccess -o public_html/.htaccess
mkdir -p private_html
[ -s private_html/.jawwal_secret ] || php -r 'echo bin2hex(random_bytes(24));' > private_html/.jawwal_secret
chmod 600 private_html/.jawwal_secret
echo "jawwal from this server: $(curl -s -o /dev/null -m 15 -w '%{http_code}' -X POST https://apitest.jawwalpay.ps/login || echo 'no connection yet')"
echo "================ تم ================"
echo "الرمز السري (ضعه في Supabase باسم JAWWAL_PROXY_SECRET):"
cat private_html/.jawwal_secret; echo
echo "===================================="
