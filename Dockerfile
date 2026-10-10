FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PUPPETEER_CACHE_DIR=/home/node/.cache/puppeteer
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npx puppeteer browsers install chrome --install-deps \
    && apt-get install -y --no-install-recommends fonts-dejavu-core fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/* \
    && chown -R node:node /app /home/node/.cache
COPY --chown=node:node backend/ ./
COPY --chown=node:node src/assets/cv-profile.jpeg /app/src/assets/cv-profile.jpeg
USER node
EXPOSE 3000
CMD ["node", "server.js"]
