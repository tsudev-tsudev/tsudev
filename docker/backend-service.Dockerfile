# Dockerfile dùng chung cho 4 backend service (user/content/storage/trust).
# Build context PHẢI là gốc repo (không phải services/<tên>) vì các service
# phụ thuộc package nội bộ npm-workspace @tsudev/db, @tsudev/types — không có
# trên npm registry công khai, npm install cô lập trong services/<tên> sẽ
# 404. Image dùng CHUNG cho cả 4 service — Render blueprint chọn service
# bằng cách override dockerCommand mỗi service, không dùng build arg (Render
# không hỗ trợ build-arg riêng theo từng service trong render.yaml).
FROM node:20-bullseye-slim
WORKDIR /repo

COPY package.json ./
# Solution file + cấu hình gốc của TypeScript. Thiếu chúng thì bước
# `npm run build:ts` bên dưới không tìm thấy project nào để dựng.
COPY tsconfig.services.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services

# Cần cả devDependencies ở bước này vì prisma CLI (devDependency của
# packages/db) phải có mặt để chạy `prisma generate`. --ignore-scripts vì
# script "prepare" (husky install) của root package.json không cần trong
# image production và không có .git để chạy đúng cách.
#
# --include-workspace-root là BẮT BUỘC, không phải tuỳ chọn: `--workspaces` một
# mình chỉ cài dependency CỦA CÁC WORKSPACE, bỏ qua devDependencies của root —
# nơi `typescript` và `@types/jest` đang nằm. Thiếu chúng thì bước `npm run
# build:services` bên dưới vỡ, mà chỉ vỡ TRONG image nên máy dev không thấy gì.
RUN npm install --workspaces --include-workspace-root --no-audit --no-fund --ignore-scripts
RUN npm exec --workspace packages/db -- prisma generate

# Biên dịch các workspace TypeScript ra dist/. PHẢI có bước này: @tsudev/types
# và ba service đều trỏ "main" vào dist/index.js, nên thiếu nó là tiến trình
# chết ngay lúc require() với MODULE_NOT_FOUND.
#
# `build:services`, KHÔNG phải `build:ts`: bản đầy đủ còn dựng packages/ui, thứ
# cần @types/react — mà @types/react chỉ tới được qua hoisting từ `next`, và
# `next` nằm trong apps/ (không được COPY vào image này).
RUN npm run build:services

# dockerCommand của từng service trong render.yaml override lệnh này.
CMD ["node", "--version"]
