FROM alpine:3.19

RUN apk add --no-cache g++ build-base

WORKDIR /app

CMD ["sh", "-c", "sleep infinity"]
