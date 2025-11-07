# Axon Deployment Guide

Complete guide for deploying Axon in various environments, from local development to production.

## Table of Contents

- [Deployment Overview](#deployment-overview)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Docker Deployment](#docker-deployment)
  - [Single Container](#single-container-development)
  - [Docker Compose (Recommended)](#docker-compose-recommended)
  - [Multi-Service Setup](#multi-service-docker-setup)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Cloud Platform Deployment](#cloud-platform-deployment)
  - [AWS](#aws-deployment)
  - [Google Cloud Platform](#google-cloud-platform)
  - [Azure](#microsoft-azure)
- [Database Setup](#database-setup)
- [Monitoring & Logging](#monitoring--logging)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)

---

## Deployment Overview

Axon consists of multiple services that need to be deployed together:

**Core Services**:

- **API Gateway** (Express.js) - Main entry point
- **MongoDB** - Document storage
- **Redis** - Cache and job queue
- **Qdrant** - Vector database for semantic search

**Deployment Strategies**:

1. **Development**: Local installation or Docker Compose
2. **Staging**: Docker Compose with external databases
3. **Production**: Kubernetes or managed services

---

## Prerequisites

### System Requirements

**Minimum** (Development):

- 2 CPU cores
- 4 GB RAM
- 10 GB disk space
- Node.js 20+

**Recommended** (Production):

- 4 CPU cores
- 8 GB RAM
- 50 GB disk space (with logs and backups)
- Load balancer

### Required Tools

- Docker 24+
- Docker Compose 2.20+
- kubectl (for Kubernetes)
- Git

---

## Environment Variables

### Core Configuration

Create a `.env` file with the following variables:

```bash
# ==============================================
# AXON ENVIRONMENT CONFIGURATION
# ==============================================

# Server Configuration
NODE_ENV=production                    # development | staging | production
PORT=3000                              # API server port
HOST=0.0.0.0                          # Bind address (0.0.0.0 for Docker)

# MongoDB Configuration
MONGODB_URI=mongodb://mongodb:27017/axon  # MongoDB connection string
MONGODB_MAX_POOL_SIZE=10               # Connection pool size
MONGODB_MIN_POOL_SIZE=2
MONGODB_TIMEOUT=30000                  # Connection timeout (ms)

# Redis Configuration
REDIS_HOST=redis                       # Redis hostname
REDIS_PORT=6379                        # Redis port
REDIS_PASSWORD=                        # Redis password (if any)
REDIS_DB=0                            # Redis database number
REDIS_KEY_PREFIX=axon:                # Key prefix for all Redis keys

# Qdrant Configuration
QDRANT_URL=http://qdrant:6333         # Qdrant API URL
QDRANT_API_KEY=                        # Qdrant API key (if using cloud)
QDRANT_COLLECTION=axon_contexts       # Collection name

# LLM Provider Configuration
OPENAI_API_KEY=sk-your-key-here       # OpenAI API key (REQUIRED)
OPENAI_MODEL=gpt-4                     # Model to use (gpt-3.5-turbo, gpt-4)
OPENAI_MAX_TOKENS=4096                # Max tokens per request
OPENAI_TEMPERATURE=0.7                # Response temperature (0-2)
OPENAI_TIMEOUT=30000                  # Request timeout (ms)

# Anthropic (Optional)
ANTHROPIC_API_KEY=                     # Anthropic API key
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this  # CHANGE IN PRODUCTION
JWT_EXPIRES_IN=24h                    # Token expiration

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000           # 15 minutes in ms
RATE_LIMIT_MAX_REQUESTS=100           # Max requests per window

# Logging
LOG_LEVEL=info                         # error | warn | info | debug
LOG_FORMAT=json                        # json | simple
LOG_FILE=logs/axon.log                # Log file path

# CORS
CORS_ORIGIN=*                          # Allowed origins (* for all, or comma-separated list)
CORS_CREDENTIALS=true                  # Allow credentials

# Embedding Model
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2  # HuggingFace model ID
EMBEDDING_CACHE_TTL=86400              # Cache TTL in seconds (24 hours)

# Context Engine
CONTEXT_MAX_RESULTS=10                 # Max contexts to retrieve
CONTEXT_SIMILARITY_THRESHOLD=0.7       # Minimum similarity score
CONTEXT_TOKEN_BUDGET=8000             # Max tokens for context

# Quality Gate
QUALITY_GATE_TEST_TIMEOUT=60000       # Test timeout (ms)
QUALITY_GATE_PARALLEL_EXECUTION=true  # Run checks in parallel

# Performance
MAX_REQUEST_SIZE=10mb                  # Max request body size
REQUEST_TIMEOUT=30000                  # Request timeout (ms)

# Health Checks
HEALTH_CHECK_INTERVAL=30000           # Interval for health checks (ms)

# Feature Flags (for future use)
ENABLE_AUTHENTICATION=false            # Enable API key auth
ENABLE_METRICS=false                   # Enable Prometheus metrics
ENABLE_TRACING=false                   # Enable OpenTelemetry tracing
```

### Environment-Specific Configurations

**Development** (`.env.development`):

```bash
NODE_ENV=development
LOG_LEVEL=debug
CORS_ORIGIN=*
MONGODB_URI=mongodb://localhost:27017/axon_dev
REDIS_HOST=localhost
QDRANT_URL=http://localhost:6333
```

**Staging** (`.env.staging`):

```bash
NODE_ENV=staging
LOG_LEVEL=info
CORS_ORIGIN=https://staging.axon.dev
MONGODB_URI=mongodb://mongodb-staging:27017/axon_staging
```

**Production** (`.env.production`):

```bash
NODE_ENV=production
LOG_LEVEL=warn
CORS_ORIGIN=https://axon.dev,https://app.axon.dev
MONGODB_URI=mongodb://mongodb-prod:27017/axon
JWT_SECRET=<use-secure-random-string>
```

---

## Docker Deployment

### Single Container (Development)

Build and run the API server in a single container:

```bash
# Build the Docker image
docker build -t axon-api:latest .

# Run the container
docker run -d \
  --name axon-api \
  -p 3000:3000 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/axon \
  -e REDIS_HOST=host.docker.internal \
  -e QDRANT_URL=http://host.docker.internal:6333 \
  -e OPENAI_API_KEY=sk-your-key \
  axon-api:latest

# View logs
docker logs -f axon-api

# Stop and remove
docker stop axon-api
docker rm axon-api
```

### Docker Compose (Recommended)

**File**: `docker-compose.yml`

```yaml
version: '3.8'

services:
  # API Gateway
  api:
    build:
      context: .
      dockerfile: Dockerfile
    image: axon-api:latest
    container_name: axon-api
    restart: unless-stopped
    ports:
      - '3000:3000'
    environment:
      NODE_ENV: production
      PORT: 3000
      MONGODB_URI: mongodb://mongodb:27017/axon
      REDIS_HOST: redis
      QDRANT_URL: http://qdrant:6333
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      JWT_SECRET: ${JWT_SECRET}
      LOG_LEVEL: info
    depends_on:
      - mongodb
      - redis
      - qdrant
    volumes:
      - ./logs:/app/logs
    networks:
      - axon-network
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/api/v1/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # MongoDB
  mongodb:
    image: mongo:6
    container_name: axon-mongodb
    restart: unless-stopped
    ports:
      - '27017:27017'
    environment:
      MONGO_INITDB_DATABASE: axon
    volumes:
      - mongodb-data:/data/db
      - mongodb-config:/data/configdb
    networks:
      - axon-network
    healthcheck:
      test: ['CMD', 'mongosh', '--eval', "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:7-alpine
    container_name: axon-redis
    restart: unless-stopped
    ports:
      - '6379:6379'
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - axon-network
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  # Qdrant Vector Database
  qdrant:
    image: qdrant/qdrant:latest
    container_name: axon-qdrant
    restart: unless-stopped
    ports:
      - '6333:6333'
      - '6334:6334' # gRPC port
    volumes:
      - qdrant-data:/qdrant/storage
    networks:
      - axon-network
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:6333/health']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mongodb-data:
    driver: local
  mongodb-config:
    driver: local
  redis-data:
    driver: local
  qdrant-data:
    driver: local

networks:
  axon-network:
    driver: bridge
```

**Usage**:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v

# Rebuild and restart
docker-compose up -d --build

# Scale API service (if needed)
docker-compose up -d --scale api=3
```

### Multi-Service Docker Setup

For production with separate services:

**File**: `docker-compose.prod.yml`

```yaml
version: '3.8'

services:
  api:
    image: axon-api:${VERSION:-latest}
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    environment:
      NODE_ENV: production
      MONGODB_URI: ${MONGODB_URI}
      REDIS_HOST: ${REDIS_HOST}
      QDRANT_URL: ${QDRANT_URL}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    ports:
      - '3000-3002:3000'
    networks:
      - axon-network

  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    networks:
      - axon-network

networks:
  axon-network:
    driver: overlay
```

**NGINX Configuration** (`nginx.conf`):

```nginx
upstream axon_api {
    least_conn;
    server api:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name axon.dev www.axon.dev;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name axon.dev www.axon.dev;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API Proxy
    location /api/ {
        proxy_pass http://axon_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health Check
    location /health {
        access_log off;
        proxy_pass http://axon_api/api/v1/health;
    }
}
```

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured
- Helm 3+ (optional but recommended)

### Kubernetes Manifests

**Namespace** (`k8s/namespace.yaml`):

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: axon
  labels:
    name: axon
```

**ConfigMap** (`k8s/configmap.yaml`):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: axon-config
  namespace: axon
data:
  NODE_ENV: 'production'
  PORT: '3000'
  LOG_LEVEL: 'info'
  MONGODB_URI: 'mongodb://mongodb:27017/axon'
  REDIS_HOST: 'redis'
  REDIS_PORT: '6379'
  QDRANT_URL: 'http://qdrant:6333'
  QDRANT_COLLECTION: 'axon_contexts'
```

**Secret** (`k8s/secret.yaml`):

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: axon-secrets
  namespace: axon
type: Opaque
data:
  # Base64 encoded values
  # echo -n 'sk-your-openai-key' | base64
  OPENAI_API_KEY: c2steW91ci1vcGVuYWkta2V5
  JWT_SECRET: eW91ci1qd3Qtc2VjcmV0
```

**Deployment** (`k8s/deployment.yaml`):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: axon-api
  namespace: axon
  labels:
    app: axon-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: axon-api
  template:
    metadata:
      labels:
        app: axon-api
    spec:
      containers:
        - name: api
          image: axon-api:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 3000
              name: http
          envFrom:
            - configMapRef:
                name: axon-config
            - secretRef:
                name: axon-secrets
          resources:
            requests:
              memory: '512Mi'
              cpu: '500m'
            limits:
              memory: '1Gi'
              cpu: '1000m'
          livenessProbe:
            httpGet:
              path: /api/v1/health/live
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /api/v1/health/ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          volumeMounts:
            - name: logs
              mountPath: /app/logs
      volumes:
        - name: logs
          emptyDir: {}
```

**Service** (`k8s/service.yaml`):

```yaml
apiVersion: v1
kind: Service
metadata:
  name: axon-api
  namespace: axon
  labels:
    app: axon-api
spec:
  type: ClusterIP
  ports:
    - port: 3000
      targetPort: 3000
      protocol: TCP
      name: http
  selector:
    app: axon-api
```

**Ingress** (`k8s/ingress.yaml`):

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: axon-ingress
  namespace: axon
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: '100'
spec:
  tls:
    - hosts:
        - axon.dev
        - api.axon.dev
      secretName: axon-tls
  rules:
    - host: api.axon.dev
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: axon-api
                port:
                  number: 3000
```

**HorizontalPodAutoscaler** (`k8s/hpa.yaml`):

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: axon-api-hpa
  namespace: axon
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: axon-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

**Deploy to Kubernetes**:

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Create secrets (update with real values first)
kubectl apply -f k8s/secret.yaml

# Create config
kubectl apply -f k8s/configmap.yaml

# Deploy databases (MongoDB, Redis, Qdrant)
kubectl apply -f k8s/mongodb.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/qdrant.yaml

# Deploy API
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml

# Create ingress
kubectl apply -f k8s/ingress.yaml

# Check status
kubectl get all -n axon

# View logs
kubectl logs -f -l app=axon-api -n axon

# Scale manually
kubectl scale deployment axon-api --replicas=5 -n axon
```

---

## Cloud Platform Deployment

### AWS Deployment

#### Option 1: AWS ECS (Fargate)

**Prerequisites**:

- AWS CLI configured
- ECR repository created

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build and push image
docker build -t axon-api:latest .
docker tag axon-api:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/axon-api:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/axon-api:latest

# Create ECS task definition (task-definition.json)
# Deploy with:
aws ecs create-service \
  --cluster axon-cluster \
  --service-name axon-api \
  --task-definition axon-api:1 \
  --desired-count 3 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx]}"
```

#### Option 2: AWS EKS

```bash
# Create EKS cluster
eksctl create cluster \
  --name axon-cluster \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 1 \
  --nodes-max 10 \
  --managed

# Deploy to EKS
kubectl apply -f k8s/
```

#### Database Services:

- **MongoDB**: Use MongoDB Atlas or DocumentDB
- **Redis**: Use ElastiCache
- **Qdrant**: Self-hosted on EC2 or ECS

---

### Google Cloud Platform

```bash
# Create GKE cluster
gcloud container clusters create axon-cluster \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n1-standard-2 \
  --enable-autoscaling \
  --min-nodes 1 \
  --max-nodes 10

# Get credentials
gcloud container clusters get-credentials axon-cluster --zone us-central1-a

# Push image to GCR
gcloud builds submit --tag gcr.io/[PROJECT-ID]/axon-api:latest

# Deploy
kubectl apply -f k8s/
```

**Database Services**:

- **MongoDB**: Use MongoDB Atlas or Cloud Firestore
- **Redis**: Use Memorystore
- **Qdrant**: Self-hosted on GCE or GKE

---

### Microsoft Azure

```bash
# Create AKS cluster
az aks create \
  --resource-group axon-rg \
  --name axon-cluster \
  --node-count 3 \
  --enable-addons monitoring \
  --generate-ssh-keys

# Get credentials
az aks get-credentials --resource-group axon-rg --name axon-cluster

# Push image to ACR
az acr build --registry axonregistry --image axon-api:latest .

# Deploy
kubectl apply -f k8s/
```

**Database Services**:

- **MongoDB**: Use MongoDB Atlas or Cosmos DB
- **Redis**: Use Azure Cache for Redis
- **Qdrant**: Self-hosted on VM or AKS

---

## Database Setup

### MongoDB Production Setup

```bash
# Create database user
mongosh mongodb://localhost:27017

use admin
db.createUser({
  user: "axon",
  pwd: "secure-password",
  roles: [
    { role: "readWrite", db: "axon" },
    { role: "dbAdmin", db: "axon" }
  ]
})

# Create indexes
use axon
db.contexts.createIndex({ "workspaceId": 1, "tier": 1 })
db.contexts.createIndex({ "createdAt": -1 })
db.contexts.createIndex({ "usageCount": -1 })
db.workspaces.createIndex({ "path": 1 }, { unique: true })
```

### Redis Production Setup

**redis.conf**:

```conf
# Security
requirepass your-secure-password
bind 0.0.0.0
protected-mode yes

# Persistence
appendonly yes
appendfsync everysec

# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Performance
tcp-backlog 511
timeout 0
tcp-keepalive 300
```

### Qdrant Production Setup

```bash
# Create collection via API
curl -X PUT http://qdrant:6333/collections/axon_contexts \
  -H 'Content-Type: application/json' \
  -d '{
    "vectors": {
      "size": 384,
      "distance": "Cosine"
    },
    "optimizers_config": {
      "indexing_threshold": 20000
    }
  }'
```

---

## Monitoring & Logging

### Logging

**Production Logging Setup**:

```bash
# Create logs directory
mkdir -p /var/log/axon

# Configure log rotation (/etc/logrotate.d/axon)
/var/log/axon/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 axon axon
    sharedscripts
    postrotate
        systemctl reload axon-api
    endscript
}
```

### Monitoring with Prometheus

**prometheus.yml**:

```yaml
scrape_configs:
  - job_name: 'axon-api'
    static_configs:
      - targets: ['axon-api:3000']
    metrics_path: '/metrics'
```

---

## SSL/TLS Configuration

### Let's Encrypt with Certbot

```bash
# Install certbot
apt-get install certbot python3-certbot-nginx

# Obtain certificate
certbot --nginx -d axon.dev -d api.axon.dev

# Auto-renewal
certbot renew --dry-run
```

---

## Backup & Recovery

### MongoDB Backup

```bash
# Backup
mongodump --uri="mongodb://localhost:27017/axon" --out=/backup/$(date +%Y%m%d)

# Restore
mongorestore --uri="mongodb://localhost:27017/axon" /backup/20251107
```

### Redis Backup

```bash
# Trigger save
redis-cli BGSAVE

# Copy RDB file
cp /var/lib/redis/dump.rdb /backup/redis-$(date +%Y%m%d).rdb
```

### Automated Backup Script

```bash
#!/bin/bash
BACKUP_DIR="/backup"
DATE=$(date +%Y%m%d)

# MongoDB
mongodump --uri="${MONGODB_URI}" --out="${BACKUP_DIR}/mongo-${DATE}"

# Redis
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb "${BACKUP_DIR}/redis-${DATE}.rdb"

# Qdrant
curl -X POST "http://qdrant:6333/collections/axon_contexts/snapshots"

# Cleanup old backups (keep 7 days)
find ${BACKUP_DIR} -mtime +7 -delete
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs axon-api

# Check environment variables
docker exec axon-api env

# Check network connectivity
docker exec axon-api ping mongodb
```

### High Memory Usage

```bash
# Check memory stats
docker stats axon-api

# Restart with memory limit
docker run -m 1g axon-api
```

### Database Connection Issues

```bash
# Test MongoDB connection
docker exec axon-api node -e "require('mongodb').MongoClient.connect('mongodb://mongodb:27017')"

# Test Redis connection
docker exec axon-api redis-cli -h redis ping
```

### Performance Issues

```bash
# Enable debug logging
docker exec axon-api env LOG_LEVEL=debug

# Check database indexes
docker exec mongodb mongosh --eval "db.contexts.getIndexes()"
```

---

**Last Updated**: November 7, 2025  
**Version**: MVP v1.0
