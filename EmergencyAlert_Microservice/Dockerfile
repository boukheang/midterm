# Build from the REPOSITORY ROOT so the shared/ library can be copied in:
#   docker build -f EmergencyAlert_Microservice/Dockerfile -t <image> .
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /usr/src/app/service

# Install dependencies first so this layer is cached between code changes.
COPY EmergencyAlert_Microservice/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY shared /usr/src/app/shared
COPY EmergencyAlert_Microservice/ ./

# Run as the unprivileged 'node' user instead of root.
USER node

EXPOSE 5006

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3   CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5006/livez || exit 1

CMD ["node", "index.js"]
