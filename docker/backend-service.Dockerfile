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
COPY packages ./packages
COPY services ./services

# Cần cả devDependencies ở bước này vì prisma CLI (devDependency của
# packages/db) phải có mặt để chạy `prisma generate`. --ignore-scripts vì
# script "prepare" (husky install) của root package.json không cần trong
# image production và không có .git để chạy đúng cách.
RUN npm install --workspaces --no-audit --no-fund --ignore-scripts
RUN npm exec --workspace packages/db -- prisma generate

# dockerCommand của từng service trong render.yaml override lệnh này.
CMD ["node", "--version"]
