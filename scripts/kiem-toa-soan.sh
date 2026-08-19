#!/usr/bin/env bash
# Nghiệm thu Toà soạn Agent AI trên production - ĐẾM VIỆC ĐÃ CHẠY, không đếm mã HTTP.
#
# ⚠️ Vì sao không dừng ở mã trạng thái: POST /api/newsroom/tick trả 202 NGAY rồi
# mới chạy việc ở nền. Nên 202 chỉ chứng minh TOKEN KHỚP - nó không nói gì về
# việc NEWSROOM_ENABLED đã bật hay chưa, vì dispatcher kiểm cờ đó bên trong và
# bỏ qua trong im lặng. Bằng chứng thật là số dòng AgentRun tăng lên.
#
# Đọc token và DATABASE_URL từ bản sao lưu, không phải gõ tay.
set -euo pipefail
cd "$(dirname "$0")/.."

BAK=backup/production-env-2026-08-19.txt
[ -f "$BAK" ] || { echo "✘ không thấy $BAK"; exit 1; }
val() { grep -m1 "^$1=" "$BAK" | cut -d= -f2-; }
need() { local v; v=$(val "$1"); [ -n "$v" ] && [ "${v:0:1}" != "<" ] || { echo "✘ $1 chưa điền trong $BAK"; exit 1; }; printf '%s' "$v"; }

T=$(need NEWSROOM_TICK_TOKEN)
D=$(need DATABASE_URL)

runs() {
  DATABASE_URL="$D" node -e "
    const {PrismaClient}=require('@prisma/client');
    const p=new PrismaClient({datasources:{db:{url:process.env.DATABASE_URL}}});
    p.agentRun.count().then(n=>{console.log(n);return p.\$disconnect()});
  "
}

before=$(runs)
echo "AgentRun trước: $before"

code=$(curl -s -o /tmp/tick.json -w '%{http_code}' --max-time 90 \
  -X POST https://tsudev-backend.onrender.com/api/newsroom/tick \
  -H "x-newsroom-token: $T" -H 'content-type: application/json' -d '{}')
echo "tick → HTTP=$code $(head -c 100 /tmp/tick.json)"

case "$code" in
  401) echo "✘ token LỆCH giữa Render và Worker cron - đặt lại CÙNG một giá trị ở cả hai"; exit 1;;
  503) echo "✘ NEWSROOM_TICK_TOKEN chưa đặt ở Render"; exit 1;;
  202) ;;
  *)   echo "✘ mã lạ, đọc thân phản hồi ở trên"; exit 1;;
esac

echo "…chờ 30 giây cho lượt chạy nền"
sleep 30
after=$(runs)
echo "AgentRun sau:   $after"

if [ "$after" -gt "$before" ]; then
  echo "✔ Toà soạn ĐANG CHẠY THẬT - agent đã thực thi $((after - before)) lượt"
else
  echo "✘ token khớp nhưng KHÔNG có lượt agent nào chạy. Nhiều khả năng:"
  echo "   - NEWSROOM_ENABLED chưa phải 'true' ở Render (hay gặp nhất)"
  echo "   - hoặc CF_ACCOUNT_ID / CF_AI_TOKEN chưa đặt ⇒ không có nhà cung cấp LLM"
  echo "   Xem log của tsudev-backend trên Render để biết nhánh nào."
  exit 1
fi
