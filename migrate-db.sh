#!/bin/bash

# Load environment variables
if [ -f .env.uat ]; then
  echo "Using .env.uat"
  export $(cat .env.uat | grep -v '^#' | xargs)
elif [ -f .env ]; then
  echo "Using .env"
  export $(cat .env | grep -v '^#' | xargs)
else
  echo "WARNING: No .env or .env.uat file found!"
fi

# Run migrations or fresh deployment
if [[ "$1" == "--fresh" || "$1" == "-f" ]]; then
  echo "🚀 Running fresh deployment..."
  node utils/fresh_deploy.js
else
  echo "🔄 Running incremental migrations..."
  npx sequelize-cli db:migrate
  echo "Seeding configuration data..."
  node utils/run_seeders.js
fi

echo ""
echo "Database operation completed!"
