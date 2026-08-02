FROM node:20-bullseye-slim
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --no-audit --no-fund --omit=dev
COPY . .
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD node -e 'require("http").get("http://localhost:4000/health",(res)=>{process.exit(res.statusCode===200?0:1)}).on("error",()=>process.exit(1))'
CMD [ "node", "src/index.js" ]
