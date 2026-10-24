#!/usr/bin/env bash
#
# One-off setup of an Ubuntu server for CodeLeet (see deploy/README.md).
# Run it on the server as root:
#
#   sudo bash setup-server.sh [deploy-user]     # default user: ubuntu
#
# Installs Docker, adds swap if there is none, opens ports 80/443 in the
# server's own firewall, creates the job folder and the app folder, and lets
# the deploy user run Docker. Safe to run again.

set -euo pipefail

DEPLOY_USER="${1:-ubuntu}"
JOBS_DIR=/var/lib/codeleet/jobs
SWAP_SIZE=2G

[[ $EUID -eq 0 ]] || { echo "Run as root: sudo bash $0 $DEPLOY_USER" >&2; exit 1; }
# shellcheck source=/dev/null
. /etc/os-release
[[ "${ID:-}" == ubuntu ]] || { echo "This script is for Ubuntu; found ${PRETTY_NAME:-unknown}" >&2; exit 1; }
id "$DEPLOY_USER" >/dev/null 2>&1 || { echo "No user $DEPLOY_USER" >&2; exit 1; }

echo "==> Installing Docker"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q docker.io docker-compose-v2 iptables-persistent
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

echo "==> Firewall"
# Oracle's Ubuntu images reject everything except SSH in iptables, on top of
# the cloud security list. Accept HTTP, HTTPS and HTTP/3 ahead of that rule.
open_port() {
  iptables -C INPUT -p "$1" --dport "$2" -m state --state NEW -j ACCEPT 2>/dev/null \
    || iptables -I INPUT -p "$1" --dport "$2" -m state --state NEW -j ACCEPT
}
open_port tcp 80
open_port tcp 443
open_port udp 443
netfilter-persistent save

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
