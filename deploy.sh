#!/bin/bash
set -euo pipefail

if [ -z "${DEPLOYMENT_GROUP_NAME:-}" ]; then
  echo "DEPLOYMENT_GROUP_NAME nao definido"
  exit 1
fi

BRANCH="$DEPLOYMENT_GROUP_NAME"

echo "=== Deploy: $BRANCH ==="

# Carrega NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 14

# Navega até o diretório do backend
cd /home/admin/html/backend

echo "=== Sincronizando codigo com origin/$BRANCH ==="
git reset --hard
git fetch --prune origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"

# Instala e builda
yarn install
yarn build

# Reinicia usando o ecosystem config
echo "=== Reiniciando aplicação com PM2 ==="
pm2 startOrReload ecosystem.backend.config.js --update-env

echo "=== Deploy concluído!!! ==="
pm2 list