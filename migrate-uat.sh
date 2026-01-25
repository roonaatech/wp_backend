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

# Run migrations
npx sequelize-cli db:migrate

# Run seeders (for email templates)
echo "Seeding email templates..."
node utils/run_seeders.js

echo ""
echo "Migration and Seeding completed!"
