#!/bin/zsh
# Deploys the committed state of this repository to https://offbeat.kimiyu.ch (Hostpoint)
# over SSH, using your own SSH key. Run from your Mac: ./deploy.sh
#
# The site is fully static: it is built from a clean checkout of HEAD and dist/ is
# uploaded to the subdomain's document root (public/). A .htaccess placed there via
# the Hostpoint panel is never overwritten or deleted.
set -euo pipefail
cd "$(dirname "$0")"

HOST=pumutuxu@pumutuxu.myhostpoint.ch
DEST=/home/pumutuxu/www/offbeat.kimiyu.ch/public

if [[ -n $(git status --porcelain) ]]; then
  echo "You have uncommitted changes. Commit them first; only committed code is deployed."
  exit 1
fi

echo "Running tests…"
npm run test --silent

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

echo "Building $(git rev-parse --short HEAD)…"
git archive HEAD | tar -x -C "$STAGE"
ln -s "$PWD/node_modules" "$STAGE/node_modules"
(cd "$STAGE" && npx vite build --logLevel warn)
# mktemp-style permissions would lock out the web server; make the upload world-readable.
chmod -R a+rX "$STAGE/dist"

echo "Uploading…"
rsync -az --delete \
  --filter 'protect /.htaccess' \
  "$STAGE/dist/" "$HOST:$DEST/"

echo "Deployed $(git rev-parse --short HEAD) to https://offbeat.kimiyu.ch"
