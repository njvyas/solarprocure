FROM node:20-alpine

RUN apk add --no-cache dumb-init postgresql-client

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p /app/uploads && chmod 755 /app/uploads

EXPOSE 4000

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
