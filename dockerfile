# Build Stage
FROM node:20.16.0-alpine as builder
WORKDIR /work/
COPY ./src/package*.json ./
RUN npm install --production
COPY ./src/ .

# Final Stage
FROM node:20.16.0-alpine
WORKDIR /app
COPY --from=builder /work/ .
RUN apk add --no-cache curl jq
CMD ["node", "server.js"]
