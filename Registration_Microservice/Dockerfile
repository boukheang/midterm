# Build from the REPOSITORY ROOT so the shared/ library can be copied in:
#   docker build -f Registration_Microservice/Dockerfile -t <image> .
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /usr/src/app/service

# Install dependencies first so this layer is cached between code changes.
COPY Registration_Microservice/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY shared /usr/src/app/shared
COPY Registration_Microservice/ ./

# Run as the unprivileged 'node' user instead of root.
USER node

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3   CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5001/livez || exit 1

CMD ["node", "registration.js"]
