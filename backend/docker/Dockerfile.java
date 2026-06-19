FROM eclipse-temurin:17-jdk-alpine

# Run as non-root. 'nobody' already exists in Alpine-based images.
USER nobody

ENV HOME=/tmp
WORKDIR /tmp