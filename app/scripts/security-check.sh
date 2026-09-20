#!/bin/bash

# Security Check Script for Warung POS
# Run this before deployment

echo "🔐 Security Check Started..."
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0

# Function to print check result
check_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $2"
    ((PASSED++))
  else
    echo -e "${RED}✗${NC} $2"
    ((FAILED++))
  fi
}

warn_result() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARNINGS++))
}

# 1. Check .env files are not committed
echo "1. Checking .env security..."
if git ls-files --error-unmatch .env > /dev/null 2>&1; then
  check_result 1 ".env file is tracked in git (CRITICAL)"
else
  check_result 0 ".env file is not tracked in git"
fi

if git ls-files --error-unmatch app/.env > /dev/null 2>&1; then
  check_result 1 "app/.env file is tracked in git (CRITICAL)"
else
  check_result 0 "app/.env file is not tracked in git"
fi

# 2. Check if .env.example exists
echo ""
echo "2. Checking .env.example..."
if [ -f "app/.env.example" ]; then
  check_result 0 ".env.example exists"
else
  check_result 1 ".env.example missing"
fi

# 3. Check JWT_SECRET strength
echo ""
echo "3. Checking JWT_SECRET..."
if [ -f "app/.env" ]; then
  JWT_SECRET=$(grep "^JWT_SECRET=" app/.env | cut -d '=' -f2)
  if [ ${#JWT_SECRET} -lt 32 ]; then
    check_result 1 "JWT_SECRET too short (minimum 32 characters)"
  else
    check_result 0 "JWT_SECRET length sufficient"
  fi
  
  # Check if it's the default/weak secret
  if [[ "$JWT_SECRET" == *"super_secret"* ]] || [[ "$JWT_SECRET" == *"12345"* ]]; then
    check_result 1 "JWT_SECRET is weak/default (CRITICAL)"
  else
    check_result 0 "JWT_SECRET is not default"
  fi
else
  warn_result ".env file not found, skipping JWT_SECRET check"
fi

# 4. Check dependencies for known vulnerabilities
echo ""
echo "4. Checking npm packages for vulnerabilities..."
cd app
if command -v npm &> /dev/null; then
  npm audit --production > /dev/null 2>&1
  AUDIT_RESULT=$?
  if [ $AUDIT_RESULT -eq 0 ]; then
    check_result 0 "No known vulnerabilities in dependencies"
  else
    check_result 1 "Vulnerabilities found in dependencies (run: npm audit)"
  fi
else
  warn_result "npm not found, skipping dependency check"
fi
cd ..

# 5. Check for console.log in production code
echo ""
echo "5. Checking for console.log in code..."
CONSOLE_LOGS=$(grep -r "console\.log" app/app app/lib 2>/dev/null | wc -l)
if [ $CONSOLE_LOGS -gt 0 ]; then
  warn_result "Found $CONSOLE_LOGS console.log statements (consider removing for production)"
else
  check_result 0 "No console.log found"
fi

# 6. Check for hardcoded secrets
echo ""
echo "6. Checking for hardcoded secrets..."
PATTERNS=("password\s*=\s*['\"]" "secret\s*=\s*['\"]" "api_key\s*=\s*['\"]" "token\s*=\s*['\"]")
FOUND_SECRETS=0

for pattern in "${PATTERNS[@]}"; do
  if grep -rE "$pattern" app/app app/lib --exclude-dir=node_modules > /dev/null 2>&1; then
    ((FOUND_SECRETS++))
  fi
done

if [ $FOUND_SECRETS -gt 0 ]; then
  check_result 1 "Potential hardcoded secrets found (review manually)"
else
  check_result 0 "No obvious hardcoded secrets"
fi

# 7. Check if HTTPS is enforced
echo ""
echo "7. Checking HTTPS enforcement..."
if grep -q "secure.*process\.env\.NODE_ENV.*production" app/app/api/auth/login/route.ts; then
  check_result 0 "Secure cookies enforced in production"
else
  check_result 1 "Secure cookie flag may not be set properly"
fi

# 8. Check middleware exists
echo ""
echo "8. Checking middleware..."
if [ -f "app/middleware.ts" ]; then
  check_result 0 "middleware.ts exists"
  
  if grep -q "verifyToken" app/middleware.ts; then
    check_result 0 "Token verification in middleware"
  else
    check_result 1 "Token verification not found in middleware"
  fi
else
  check_result 1 "middleware.ts missing"
fi

# 9. Check Dockerfile security
echo ""
echo "9. Checking Dockerfile security..."
if [ -f "app/Dockerfile" ]; then
  check_result 0 "Dockerfile exists"
  
  if grep -q "USER nextjs" app/Dockerfile; then
    check_result 0 "Non-root user in Dockerfile"
  else
    check_result 1 "Running as root in Docker (security risk)"
  fi
else
  warn_result "Dockerfile not found"
fi

# 10. Check for rate limiting
echo ""
echo "10. Checking rate limiting..."
if [ -f "app/lib/rate-limiter.ts" ]; then
  check_result 0 "Rate limiter module exists"
else
  check_result 1 "Rate limiter module missing"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Security Check Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}❌ Security check FAILED. Please fix issues before deployment.${NC}"
  exit 1
else
  echo -e "${GREEN}✅ Security check PASSED!${NC}"
  if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}Note: There are $WARNINGS warnings to review.${NC}"
  fi
  exit 0
fi
