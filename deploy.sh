#!/bin/bash
set -e

echo "=== Deploy: $DEPLOYMENT_GROUP_NAME ==="

# Carrega NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 14

# Navega até o diretório do backend
cd /home/admin/html/backend

git pull origin "$DEPLOYMENT_GROUP_NAME"

# Instala e builda
yarn install
yarn build

# Reinicia usando o ecosystem config
pm2 startOrReload ecosystem.backend.config.js --update-env

echo "=== Deploy concluído ==="
pm2 list