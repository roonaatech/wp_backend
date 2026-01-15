#!/bin/bash

# This script tests the stats endpoint for a given user
# Usage: ./test-stats.sh <token>

if [ -z "$1" ]; then
    echo "Usage: ./test-stats.sh <auth-token>"
    exit 1
fi

TOKEN=$1
BASE_URL="http://localhost:3000"

echo "Testing /api/leave/my-stats endpoint..."
curl -X GET "${BASE_URL}/api/leave/my-stats" \
  -H "Content-Type: application/json" \
  -H "x-access-token: ${TOKEN}" \
  -w "\nStatus: %{http_code}\n"
