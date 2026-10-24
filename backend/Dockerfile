# ---------- deps: production node_modules only ----------
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- api: the HTTP + WebSocket server ----------
FROM node:22-alpine AS api

WORKDIR /app

ENV NODE_ENV=production PORT=5000

COPY --from=deps /app/node_modules ./node_modules

COPY . .

USER node

EXPOSE 5000
# Healthy only while MongoDB and Redis answer (see /api/ready in app.js)
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/ready >/dev/null || exit 1
CMD ["node", "server.js"]

# ---------- worker: runs user code in sandbox containers ----------
FROM node:22-alpine AS worker

# The Docker CLI is needed to start sandbox containers via the host's daemon
RUN apk add --no-cache docker-cli \
 && mkdir -p /var/codeleet/jobs \
 && chown node:node /var/codeleet/jobs

WORKDIR /app

ENV NODE_ENV=production \
    CODE_TMP_DIR=/var/codeleet/jobs

COPY --from=deps /app/node_modules ./node_modules

COPY . .

USER node

CMD ["node", "worker/submissionWorker.js"]
