#!/usr/bin/env bash
#
# One-off setup of an Ubuntu server for CodeLeet (see deploy/README.md).
# Run it on the server as root:
#
#   sudo bash setup-server.sh [deploy-user]     # default user: ubuntu
#
# Opens ports 80/443 in the server's own firewall where the image blocks them
# (Oracle), installs Docker, adds swap if there is none, creates the job
# folder and the app folder, and lets the deploy user run Docker. Safe to
# run again. The cloud firewall (Oracle security list, Azure network
# security group) is set in the cloud console, not here.

set -euo pipefail

DEPLOY_USER="${1:-ubuntu}"
JOBS_DIR=/var/lib/codeleet/jobs
SWAP_SIZE=2G

[[ $EUID -eq 0 ]] || { echo "Run as root: sudo bash $0 $DEPLOY_USER" >&2; exit 1; }
# shellcheck source=/dev/null
. /etc/os-release
[[ "${ID:-}" == ubuntu ]] || { echo "This script is for Ubuntu; found ${PRETTY_NAME:-unknown}" >&2; exit 1; }
id "$DEPLOY_USER" >/dev/null 2>&1 || { echo "No user $DEPLOY_USER" >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -q

echo "==> Firewall"
# Oracle's Ubuntu images end the INPUT chain with a REJECT rule that blocks
# everything but SSH, on top of the cloud security list. Accept HTTP, HTTPS
# and HTTP/3 ahead of it and save the rules. Done before Docker is installed,
# so the saved rules don't include Docker's own (it recreates them on start).
# Other images (Azure, most clouds) don't filter here, so leave them alone.
if iptables -S INPUT | grep -q -- '-j REJECT'; then
  apt-get install -y -q iptables-persistent
  open_port() {
    iptables -C INPUT -p "$1" --dport "$2" -m state --state NEW -j ACCEPT 2>/dev/null \
      || iptables -I INPUT -p "$1" --dport "$2" -m state --state NEW -j ACCEPT
  }
  open_port tcp 80
  open_port tcp 443
  open_port udp 443
  netfilter-persistent save
else
  echo "No blocking iptables rule; nothing to open here"
fi

echo "==> Docker"
if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
  echo "Already installed: $(docker --version)"
elif apt-cache policy | grep -q download.docker.com; then
  # Docker's own repository is set up; its containerd.io conflicts with
  # Ubuntu's docker.io, so install Docker's packages
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  apt-get install -y -q docker.io docker-compose-v2
fi
systemctl enable --now docker
# The deploy user runs `docker compose` over SSH. Docker access is
# root-equivalent, so keep this user's SSH key safe.
usermod -aG docker "$DEPLOY_USER"

echo "==> Swap"
if swapon --show | grep -q .; then
  echo "Swap already on:"; swapon --show
else
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
# Use swap only under pressure, so judging timings stay in RAM
echo 'vm.swappiness=10' > /etc/sysctl.d/99-codeleet.conf
sysctl -q -p /etc/sysctl.d/99-codeleet.conf

echo "==> Folders"
# The worker container runs as node (uid 1000) and writes each job here;
# sandboxes read it at the same path
install -d -m 755 -o 1000 -g 1000 "$JOBS_DIR"
home="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$home/codeleet"

echo
echo "Done. Next, as $DEPLOY_USER (log out and back in first, for the docker group):"
echo "  cd ~/codeleet && nano .env      # from .env.prod.example"
echo "  DOCKER_GID=$(stat -c %g /var/run/docker.sock)    # put this in .env"
