FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY public ./public
COPY private ./private
RUN mkdir -p /data
ENV DB_PATH=/data/game.db PORT=3000
EXPOSE 3000
CMD ["node","server.js"]
