#!/bin/bash

# Exit immediately if any command exits with a non-zero status
set -e

# Target directory
TARGET_DIR="/apps/attendance/src/wp_backend"

echo "=============================================="
echo "🚀 Starting deployment for wp_backend..."
echo "=============================================="

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "❌ Error: Directory $TARGET_DIR does not exist."
    exit 1
fi

# Navigate to backend directory
cd "$TARGET_DIR"
echo "📂 Navigated to: $(pwd)"

# 1. Clean up any local changes or untracked files
echo "🧹 Cleaning up local git changes..."
git reset --hard
git clean -fd

# 2. Ensure it is in "develop" branch
echo "🌿 Checking out develop branch..."
git checkout develop

# 3. Pull latest code from remote develop branch and reset to ensure clean state
echo "📥 Pulling latest changes from origin develop..."
git fetch origin develop
git reset --hard origin/develop
git clean -fd

# 4. Run npm install
echo "📦 Installing npm dependencies..."
npm install

# 5. Run database migrations
echo "🗄️ Running database migrations..."
if [ -f "./migrate-db.sh" ]; then
    chmod +x ./migrate-db.sh
    ./migrate-db.sh
else
    echo "⚠️ Warning: ./migrate-db.sh not found. Skipping database migration."
fi

# 6. Bring up PM2 service using server-uat.js
APP_NAME="workpulse-service-uat"
echo "🔄 Bringing up PM2 service ($APP_NAME using server-uat.js)..."
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
    pm2 restart "$APP_NAME" --update-env
elif pm2 describe server-uat.js > /dev/null 2>&1; then
    pm2 restart server-uat.js --update-env
elif pm2 describe server-uat > /dev/null 2>&1; then
    pm2 restart server-uat --update-env
else
    pm2 start server-uat.js --name "$APP_NAME" -f
fi
pm2 save

# 7. Check logs to ensure no error and print last 10 lines
echo "⏳ Waiting 10 seconds for the process to spin up..."
sleep 10

echo "=============================================="
echo "📋 Last 10 lines of PM2 logs ($APP_NAME):"
echo "=============================================="
pm2 logs "$APP_NAME" --lines 10 --nostream 2>/dev/null || pm2 logs server-uat.js --lines 10 --nostream 2>/dev/null || pm2 logs --lines 10 --nostream

echo "=============================================="
echo "✅ Deployment completed successfully!"
echo "=============================================="
exit 0
