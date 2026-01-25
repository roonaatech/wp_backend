#!/bin/bash

# Load UAT environment variables
export $(cat .env | grep -v '^#' | xargs)

# Run migrations
npx sequelize-cli db:migrate

# Run seeders (for email templates)
echo "Seeding email templates..."
node utils/run_seeders.js

echo ""
echo "Migration and Seeding completed!"
