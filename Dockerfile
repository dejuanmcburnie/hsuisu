FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin appuser \
    && mkdir -p /app/data && chown -R appuser:appuser /app

COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY views ./views
COPY public ./public

USER appuser
EXPOSE 3000
CMD ["node", "src/index.js"]
