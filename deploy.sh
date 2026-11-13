#!/bin/zsh
# Deploys the committed state of this repository to offbeat.kimiyu.ch (Hostpoint) over SSH,
# using your own SSH key. Run from your Mac: ./deploy.sh
#
# Offbeat is a static site: it is built locally from HEAD (not from the working tree)
# and only the build output (dist/) is uploaded into the web root (public/). Nothing
# runs on the server. The site's .htaccess (HTTPS redirect, caching) comes from
# public/.htaccess in this repo.
set -euo pipefail
cd "$(dirname "$0")"

HOST=pumutuxu@pumutuxu.myhostpoint.ch
DEST=/home/pumutuxu/www/offbeat.kimiyu.ch/public
URL=https://offbeat.kimiyu.ch

if [[ -n $(git status --porcelain) ]]; then
  echo "You have uncommitted changes. Commit them first; only committed code is deployed."
  exit 1
fi
if [[ ! -d node_modules ]]; then
  echo "node_modules is missing. Run 'npm install' first."
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
# mktemp folders are 700; rsync would copy that mode and lock out the web server.
chmod -R u=rwX,go=rX "$STAGE/dist"

echo "Uploading…"
rsync -az --delete \
  "$STAGE/dist/" "$HOST:$DEST/"

echo "Deployed $(git rev-parse --short HEAD) to $URL"
