FROM alpine:3.19

RUN apk add --no-cache g++ build-base

# Run as non-root. 'nobody' already exists in Alpine.
USER nobody

ENV HOME=/tmp
WORKDIR /tmp
