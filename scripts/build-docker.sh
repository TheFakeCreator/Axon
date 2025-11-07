#!/bin/bash

# ==============================================
# Axon Docker Build Script
# ==============================================

set -e  # Exit on error

echo "=========================================="
echo "Building Axon Docker Image"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
IMAGE_NAME="${IMAGE_NAME:-axon-api}"
VERSION="${VERSION:-latest}"
PLATFORM="${PLATFORM:-linux/amd64}"

echo "Configuration:"
echo "  Image: $IMAGE_NAME:$VERSION"
echo "  Platform: $PLATFORM"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker is running"

# Build the image
echo ""
echo "Building Docker image..."
docker build \
    --platform "$PLATFORM" \
    -t "$IMAGE_NAME:$VERSION" \
    -t "$IMAGE_NAME:latest" \
    --progress=plain \
    .

echo -e "${GREEN}✓${NC} Docker image built successfully"

# Display image info
echo ""
echo "Image Information:"
docker images "$IMAGE_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo ""
echo "=========================================="
echo -e "${GREEN}Docker build completed!${NC}"
echo "=========================================="

echo ""
echo "Next steps:"
echo "  Test locally: docker run -p 3000:3000 $IMAGE_NAME:$VERSION"
echo "  Test with compose: docker-compose up"
echo "  Push to registry: docker push $IMAGE_NAME:$VERSION"
