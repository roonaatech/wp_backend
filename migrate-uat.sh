#!/bin/bash

# Load UAT environment variables
export $(cat .env | grep -v '^#' | xargs)

# Run migrations
npx sequelize-cli db:migrate

echo ""
echo "Migration completed!"
