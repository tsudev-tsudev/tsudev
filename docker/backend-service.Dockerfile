# Dockerfile dùng chung cho 4 backend service (user/content/storage/trust).
# Build context PHẢI là gốc repo (không phải services/<tên>) vì các service
# phụ thuộc package nội bộ npm-workspace @tsudev/db, @tsudev/types - không có
# trên npm registry công khai, npm install cô lập trong services/<tên> sẽ
# 404. Image dùng CHUNG cho cả 4 service - Render blueprint chọn service
# bằng cách override dockerCommand mỗi service, không dùng build arg (Render
# không hỗ trợ build-arg riêng theo từng service trong render.yaml).
FROM node:20-bullseye-slim
WORKDIR /repo

COPY package.json package-lock.json ./
# Solution file + cấu hình gốc của TypeScript. Thiếu chúng thì bước
# `npm run build:ts` bên dưới không tìm thấy project nào để dựng.
COPY tsconfig.services.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services

# `npm ci`, KHÔNG phải `npm install` - đây là khác biệt về chuỗi cung ứng, không
# phải sở thích. `npm install` giải lại phiên bản theo dải semver tại thời điểm
# dựng, nên image production có thể nhận bản phụ thuộc KHÁC với bản CI đã kiểm.
# `npm ci` cài đúng cây trong package-lock.json - thứ đã được test.
#
# Chạy được dù image không có `apps/`: npm bỏ qua workspace vắng mặt trên đĩa.
#
# Cần cả devDependencies ở bước này vì prisma CLI (devDependency của
# packages/db) và `typescript` (devDependency của root) phải có mặt để chạy
# `prisma generate` và `npm run build:services`. --ignore-scripts vì script
# "prepare" (husky install) không cần trong image và không có .git để chạy đúng.
RUN npm ci --no-audit --no-fund --ignore-scripts
RUN npm exec --workspace packages/db -- prisma generate

# Biên dịch các workspace TypeScript ra dist/. PHẢI có bước này: @tsudev/types
# và ba service đều trỏ "main" vào dist/index.js, nên thiếu nó là tiến trình
# chết ngay lúc require() với MODULE_NOT_FOUND.
#
# `build:services`, KHÔNG phải `build:ts`: bản đầy đủ còn dựng packages/ui, thứ
# cần @types/react - mà @types/react chỉ tới được qua hoisting từ `next`, và
# `next` nằm trong apps/ (không được COPY vào image này).
RUN npm run build:services

# Chạy bằng tài khoản KHÔNG PHẢI root.
#
# Image `node:*-slim` có sẵn user `node` (uid 1000). Không đổi sang nó thì tiến
# trình chạy bằng root, và một lỗ thực thi mã bất kỳ trong Express sẽ có toàn
# quyền trên container - kể cả ghi đè chính mã nguồn trong /repo.
#
# Đặt SAU mọi bước cài đặt: npm cần quyền ghi vào /repo lúc dựng, không cần lúc
# chạy. `chown` chỉ chạm thư mục làm việc, không chạm /usr/local.
RUN chown -R node:node /repo
USER node

# dockerCommand của từng service trong render.yaml override lệnh này.
CMD ["node", "--version"]
