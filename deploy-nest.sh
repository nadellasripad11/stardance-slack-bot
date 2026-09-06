#!/usr/bin/env bash
# One-shot deploy for Hack Club Nest. Run this AFTER you have SSHed into Nest.
#
#   ssh <you>@<you>.hackclub.app        # or however you log into Nest
#   curl -fsSL https://raw.githubusercontent.com/nadellasripad11/stardance-slack-bot/main/deploy-nest.sh | bash
#
# ...then edit the .env it creates and paste your two Slack tokens.
set -euo pipefail

REPO="https://github.com/nadellasripad11/stardance-slack-bot"
NAME="stardance-slack-bot"
DIR="$HOME/$NAME"

echo "==> installing prerequisites (node, npm, git)"
if ! command -v node >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y git curl ca-certificates
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node --version

echo "==> cloning / updating repo"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  git clone "$REPO" "$DIR"
fi
cd "$DIR"
npm install --omit=dev --no-fund --no-audit

if [ ! -f .env ]; then
  cp .env.example .env
  echo
  echo "!!  Created $DIR/.env  --  edit it now and set:"
  echo "      SLACK_BOT_TOKEN=xoxb-...   (OAuth & Permissions)"
  echo "      SLACK_APP_TOKEN=xapp-...   (Basic Information > App-Level Tokens)"
  echo "    then re-run:  systemctl --user restart $NAME"
fi

echo "==> installing systemd --user service"
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/$NAME.service" <<EOF
[Unit]
Description=Stardance Slack Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Restart=always
RestartSec=5
WorkingDirectory=$DIR
ExecStart=$(command -v node) index.js

[Install]
WantedBy=default.target
EOF

loginctl enable-linger "$USER" >/dev/null 2>&1 || true
systemctl --user daemon-reload
systemctl --user enable --now "$NAME.service"
sleep 2
systemctl --user status "$NAME.service" --no-pager || true

echo
echo "==> done. useful commands:"
echo "     systemctl --user status $NAME"
echo "     systemctl --user restart $NAME     # after editing .env"
echo "     journalctl --user -u $NAME -f      # live logs"
