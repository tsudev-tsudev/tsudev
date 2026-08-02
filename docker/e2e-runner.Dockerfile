FROM mcr.microsoft.com/playwright:focal
WORKDIR /work

# Copy package files and install dependencies (includes playwright in root package.json)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Ensure Playwright browsers are installed
RUN npx playwright install --with-deps chromium

# Copy workspace into image
COPY . /work

CMD ["node", "/work/scripts/e2e-sso-upload.js"]
