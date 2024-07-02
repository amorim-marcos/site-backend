#!/bin/bash
cd /home/admin/html/backend

# $DEPLOYMENT_GROUP_NAME will be either qas or prd
echo $DEPLOYMENT_GROUP_NAME

git pull origin $DEPLOYMENT_GROUP_NAME

yarn install &&
yarn build &&
docker-compose restart &&
pm2 restart backend