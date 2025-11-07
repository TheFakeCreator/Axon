#!/bin/bash

# ==============================================
# Axon Deployment Script
# ==============================================

set -e

echo "=========================================="
echo "Axon Deployment Script"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ENVIRONMENT="${1:-development}"
VERSION="${VERSION:-latest}"

echo "Deployment Configuration:"
echo "  Environment: $ENVIRONMENT"
echo "  Version: $VERSION"
echo ""

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    echo -e "${RED}Error: Invalid environment. Use: development, staging, or production${NC}"
    exit 1
fi

# Check prerequisites
echo "Checking prerequisites..."

if [ "$ENVIRONMENT" = "production" ]; then
    # Production deployment checks
    echo -e "${YELLOW}⚠${NC}  Deploying to PRODUCTION"
    read -p "Are you sure? (yes/no) " -r
    if [[ ! $REPLY = "yes" ]]; then
        echo "Deployment cancelled"
        exit 0
    fi
    
    # Check required environment variables
    required_vars=("OPENAI_API_KEY" "JWT_SECRET" "MONGODB_URI")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo -e "${RED}Error: $var is not set${NC}"
            exit 1
        fi
    done
    echo -e "${GREEN}✓${NC} Environment variables validated"
fi

# Select deployment method
echo ""
echo "Deployment Methods:"
echo "  1) Docker Compose (Local/Staging)"
echo "  2) Docker Swarm"
echo "  3) Kubernetes"
echo ""
read -p "Select method (1-3): " -n 1 -r
echo ""

case $REPLY in
    1)
        echo "Deploying with Docker Compose..."
        
        # Select compose file
        if [ "$ENVIRONMENT" = "production" ]; then
            COMPOSE_FILE="docker-compose.prod.yml"
        else
            COMPOSE_FILE="docker-compose.yml"
        fi
        
        echo "Using: $COMPOSE_FILE"
        
        # Pull latest images
        echo "Pulling latest images..."
        docker-compose -f "$COMPOSE_FILE" pull
        
        # Start services
        echo "Starting services..."
        docker-compose -f "$COMPOSE_FILE" up -d
        
        # Wait for health checks
        echo "Waiting for services to be healthy..."
        sleep 10
        
        # Check service status
        docker-compose -f "$COMPOSE_FILE" ps
        
        echo -e "${GREEN}✓${NC} Deployment complete!"
        echo ""
        echo "Service URLs:"
        echo "  API: http://localhost:3000"
        echo "  Health: http://localhost:3000/api/v1/health"
        ;;
        
    2)
        echo "Deploying with Docker Swarm..."
        
        # Check if swarm is initialized
        if ! docker info --format '{{.Swarm.LocalNodeState}}' | grep -q active; then
            echo "Initializing Docker Swarm..."
            docker swarm init
        fi
        
        # Deploy stack
        docker stack deploy -c docker-compose.prod.yml axon
        
        echo -e "${GREEN}✓${NC} Swarm deployment complete!"
        echo "Check status: docker stack services axon"
        ;;
        
    3)
        echo "Deploying to Kubernetes..."
        
        # Check kubectl
        if ! command -v kubectl &> /dev/null; then
            echo -e "${RED}Error: kubectl not found${NC}"
            exit 1
        fi
        
        # Apply manifests
        echo "Applying Kubernetes manifests..."
        kubectl apply -f k8s/namespace.yaml
        kubectl apply -f k8s/configmap.yaml
        kubectl apply -f k8s/secret.yaml
        kubectl apply -f k8s/deployment.yaml
        kubectl apply -f k8s/service.yaml
        kubectl apply -f k8s/ingress.yaml
        kubectl apply -f k8s/hpa.yaml
        
        # Wait for rollout
        echo "Waiting for deployment..."
        kubectl rollout status deployment/axon-api -n axon
        
        echo -e "${GREEN}✓${NC} Kubernetes deployment complete!"
        echo "Check status: kubectl get all -n axon"
        ;;
        
    *)
        echo -e "${RED}Invalid selection${NC}"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=========================================="

echo ""
echo "Verification steps:"
echo "  1. Check health: curl http://localhost:3000/api/v1/health"
echo "  2. View logs: docker-compose logs -f api"
echo "  3. Test API: curl http://localhost:3000/api/v1/health/ready"
