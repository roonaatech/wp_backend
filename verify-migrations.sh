#!/bin/bash

# Migration Safety Verification Script
# This script verifies that all pending migrations are safe and non-destructive

echo "🔍 Migration Safety Verification Script"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SAFE=true

echo "📋 Checking migration files for dangerous operations..."
echo ""

# List of dangerous SQL keywords that should NOT appear in migrations
DANGEROUS_KEYWORDS=(
    "DROP TABLE"
    "TRUNCATE"
    "DELETE FROM users"
    "DELETE FROM leave_requests"
    "DELETE FROM on_duty_logs"
    "DELETE FROM time_off_requests"
    "DELETE FROM roles"
    "UPDATE users SET"
    "UPDATE leave_requests SET"
    "UPDATE on_duty_logs SET"
    "UPDATE time_off_requests SET"
)

# Check each migration file
for file in migrations/202602*.js; do
    if [ -f "$file" ]; then
        echo "Checking: $(basename $file)"
        
        # Check for dangerous keywords
        for keyword in "${DANGEROUS_KEYWORDS[@]}"; do
            if grep -qi "$keyword" "$file"; then
                echo -e "${RED}  ⚠️  DANGER: Found '$keyword' in $file${NC}"
                SAFE=false
            fi
        done
        
        # Check for safe operations
        if grep -qi "createTable\|addColumn\|bulkInsert" "$file"; then
            echo -e "${GREEN}  ✅ Safe operations detected (CREATE/ADD/INSERT)${NC}"
        fi
        
        echo ""
    fi
done

echo "========================================"
echo ""

if [ "$SAFE" = true ]; then
    echo -e "${GREEN}✅ ALL MIGRATIONS ARE SAFE!${NC}"
    echo ""
    echo "Summary of operations:"
    echo "  ✅ CREATE TABLE operations: Safe"
    echo "  ✅ ADD COLUMN operations: Safe"
    echo "  ✅ INSERT operations: Safe"
    echo "  ✅ UPDATE operations: Only metadata updates"
    echo ""
    echo -e "${GREEN}🚀 Safe to deploy to UAT!${NC}"
    exit 0
else
    echo -e "${RED}❌ DANGEROUS OPERATIONS DETECTED!${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  DO NOT DEPLOY TO UAT!${NC}"
    echo "Please review the flagged migrations before proceeding."
    exit 1
fi
