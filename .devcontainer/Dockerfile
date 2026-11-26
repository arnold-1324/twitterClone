FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

# Install common tools
RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
    git \
    python3 \
    python3-pip \
    && apt-get clean
