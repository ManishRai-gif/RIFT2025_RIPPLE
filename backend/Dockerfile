FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache git docker-cli

COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3001

CMD ["node", "server.js"]
