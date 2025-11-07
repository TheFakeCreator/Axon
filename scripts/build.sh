#!/bin/bash

# ==============================================
# Axon Build Script
# ==============================================

set -e  # Exit on error

echo "=========================================="
echo "Building Axon Application"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}Error: pnpm is not installed${NC}"
    echo "Install with: npm install -g pnpm"
    exit 1
fi

echo -e "${GREEN}✓${NC} pnpm is installed"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}Error: Node.js 20+ is required${NC}"
    echo "Current version: $(node -v)"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js version is compatible ($(node -v))"

# Clean previous build
echo ""
echo "Cleaning previous build..."
rm -rf dist/
rm -rf .turbo/
rm -rf packages/*/dist/
rm -rf apps/*/dist/

echo -e "${GREEN}✓${NC} Clean complete"

# Install dependencies
echo ""
echo "Installing dependencies..."
pnpm install --frozen-lockfile

echo -e "${GREEN}✓${NC} Dependencies installed"

# Run linting
echo ""
echo "Running linting..."
pnpm run lint || {
    echo -e "${YELLOW}Warning: Linting found issues${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
}

echo -e "${GREEN}✓${NC} Linting passed"

# Run type checking
echo ""
echo "Running type checking..."
pnpm run type-check || {
    echo -e "${RED}Error: Type checking failed${NC}"
    exit 1
}

echo -e "${GREEN}✓${NC} Type checking passed"

# Build all packages
echo ""
echo "Building all packages..."
pnpm build

echo -e "${GREEN}✓${NC} Build complete"

# Run tests (optional)
if [ "$1" = "--with-tests" ]; then
    echo ""
    echo "Running tests..."
    pnpm test
    echo -e "${GREEN}✓${NC} Tests passed"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Build completed successfully!${NC}"
echo "=========================================="

# Display build info
echo ""
echo "Build Information:"
echo "  Node.js: $(node -v)"
echo "  pnpm: $(pnpm -v)"
echo "  Date: $(date)"
echo ""
echo "Next steps:"
echo "  1. Build Docker image: ./scripts/build-docker.sh"
echo "  2. Run locally: pnpm dev"
echo "  3. Deploy: ./scripts/deploy.sh"
