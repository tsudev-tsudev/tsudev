FROM node:20-bullseye-slim AS builder
WORKDIR /usr/src/app
# copy root workspace manifests to resolve workspace packages
COPY package.json package-lock.json ./
# copy workspace packages and app source
COPY packages ./packages
COPY apps/frontend-main ./apps/frontend-main

# install all workspace dependencies (no audit to speed up)
RUN npm ci --no-audit --no-fund

WORKDIR /usr/src/app/apps/frontend-main
RUN npm run build

FROM node:20-bullseye-slim AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production
# copy built app and node_modules from builder
COPY --from=builder /usr/src/app/apps/frontend-main /usr/src/app
COPY --from=builder /usr/src/app/node_modules /usr/src/app/node_modules
EXPOSE 3000
CMD [ "npm", "run", "start" ]
