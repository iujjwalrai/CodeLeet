FROM alpine:3.19

RUN apk add --no-cache g++ build-base

# cl-meter compiles, runs and measures every test case (see cl-meter.c)
COPY cl-meter.c /tmp/cl-meter.c
RUN gcc -O2 -static -o /usr/local/bin/cl-meter /tmp/cl-meter.c && rm /tmp/cl-meter.c

# Run as non-root. 'nobody' already exists in Alpine.
USER nobody

ENV HOME=/tmp
WORKDIR /tmp
