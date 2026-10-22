# cl-meter compiles, runs and measures every test case (see cl-meter.c).
# Built static here because the JDK image has no C compiler.
FROM alpine:3.19 AS meter
RUN apk add --no-cache gcc musl-dev
COPY cl-meter.c /src/cl-meter.c
RUN gcc -O2 -static -o /cl-meter /src/cl-meter.c

FROM eclipse-temurin:21-jdk-alpine

COPY --from=meter /cl-meter /usr/local/bin/cl-meter

# Run as non-root. 'nobody' already exists in Alpine-based images.
USER nobody

ENV HOME=/tmp
WORKDIR /tmp
