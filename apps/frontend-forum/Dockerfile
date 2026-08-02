FROM node:20-bullseye-slim AS builder
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/frontend-forum ./apps/frontend-forum

RUN npm ci --no-audit --no-fund

WORKDIR /usr/src/app/apps/frontend-forum
RUN npm run build

FROM node:20-bullseye-slim AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=builder /usr/src/app/apps/frontend-forum /usr/src/app
COPY --from=builder /usr/src/app/node_modules /usr/src/app/node_modules
EXPOSE 3001
CMD [ "npm", "run", "start" ]
