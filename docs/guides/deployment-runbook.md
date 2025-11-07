# Deployment Runbook

> **Purpose**: Step-by-step operational procedures for deploying, operating, and troubleshooting Axon in production.

---

## Table of Contents

- [Quick Reference](#quick-reference)
- [Deployment Procedures](#deployment-procedures)
- [Rollback Procedures](#rollback-procedures)
- [Operational Procedures](#operational-procedures)
- [Troubleshooting Guide](#troubleshooting-guide)
- [Common Issues](#common-issues)
- [Emergency Procedures](#emergency-procedures)

---

## Quick Reference

### Critical Commands

```bash
# Health check
curl http://localhost:3000/health

# View logs (Docker Compose)
docker-compose logs -f api

# View logs (Kubernetes)
kubectl logs -f deployment/axon-api

# Restart service (Docker Compose)
docker-compose restart api

# Restart service (Kubernetes)
kubectl rollout restart deployment/axon-api

# Check service status
docker-compose ps  # Docker Compose
kubectl get pods   # Kubernetes

# Database backup
mongodump --uri="$MONGODB_URI" --out=/backup/$(date +%Y%m%d)
```

### Key Endpoints

- **Health Check**: `GET /health`
- **Readiness**: `GET /health/ready`
- **Liveness**: `GET /health/live`
- **Process Prompt**: `POST /api/v1/prompts/process`
- **Quality Gate**: `POST /api/v1/quality-gate/execute`

### Environment Variables

```bash
# Essential
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://...
REDIS_URL=redis://...
QDRANT_URL=http://...
OPENAI_API_KEY=sk-...

# Optional
LOG_LEVEL=info
MAX_TOKEN_LIMIT=8000
DEFAULT_MODEL=gpt-4
```

---

## Deployment Procedures

### Pre-Deployment Checklist

**Before every deployment:**

1. [ ] Review [Production Readiness Checklist](./production-readiness.md)
2. [ ] Verify all tests pass: `pnpm test`
3. [ ] Verify build succeeds: `pnpm build`
4. [ ] Verify no linting errors: `pnpm lint`
5. [ ] Review CHANGELOG for breaking changes
6. [ ] Notify team in Slack/Discord: "Starting deployment of v1.X.X"
7. [ ] Create git tag: `git tag -a v1.X.X -m "Release v1.X.X"`
8. [ ] Push tag: `git push origin v1.X.X`

### Method 1: Docker Compose Deployment

**Recommended for**: Small deployments, staging environments

```bash
# 1. Navigate to project directory
cd /path/to/axon

# 2. Pull latest changes
git pull origin main

# 3. Build Docker image
./scripts/build-docker.sh
# Or on Windows:
./scripts/build-docker.ps1

# 4. Stop current services
docker-compose down

# 5. Start services with new image
docker-compose -f docker-compose.prod.yml up -d

# 6. Verify services started
docker-compose ps

# 7. Check logs for errors
docker-compose logs -f api

# 8. Verify health check
curl http://localhost:3000/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2025-11-07T...",
#   "uptime": 123,
#   "services": {
#     "mongodb": "connected",
#     "redis": "connected",
#     "qdrant": "connected"
#   }
# }

# 9. Run smoke tests
./scripts/smoke-test.sh  # Create this script

# 10. Monitor for 10 minutes
# - Watch logs: docker-compose logs -f
# - Check metrics dashboard
# - Verify no error alerts
```

**Smoke Test Script** (`scripts/smoke-test.sh`):

```bash
#!/bin/bash
set -e

API_URL="${API_URL:-http://localhost:3000}"

echo "Running smoke tests..."

# Health check
echo "1. Testing health endpoint..."
curl -f "$API_URL/health" || { echo "Health check failed"; exit 1; }

# Readiness check
echo "2. Testing readiness endpoint..."
curl -f "$API_URL/health/ready" || { echo "Readiness check failed"; exit 1; }

# Process prompt (requires test workspace)
echo "3. Testing prompt processing..."
curl -f -X POST "$API_URL/api/v1/prompts/process" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is this project about?",
    "workspaceId": "test-workspace",
    "source": "api"
  }' || { echo "Prompt processing failed"; exit 1; }

echo "✅ All smoke tests passed!"
```

### Method 2: Kubernetes Deployment

**Recommended for**: Production at scale, high availability

```bash
# 1. Build and push Docker image
./scripts/build-docker.sh

# Tag for registry
docker tag axon-api:latest your-registry.com/axon-api:v1.X.X
docker tag axon-api:latest your-registry.com/axon-api:latest

# Push to registry
docker push your-registry.com/axon-api:v1.X.X
docker push your-registry.com/axon-api:latest

# 2. Update Kubernetes manifests (if needed)
# Edit k8s/deployment.yaml to use new image tag

# 3. Apply configuration changes (if any)
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# 4. Deploy new version
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# 5. Monitor rollout
kubectl rollout status deployment/axon-api

# 6. Verify pods are running
kubectl get pods -l app=axon-api

# Expected output:
# NAME                        READY   STATUS    RESTARTS   AGE
# axon-api-7d8f4c5b6d-abc12   1/1     Running   0          30s
# axon-api-7d8f4c5b6d-def34   1/1     Running   0          30s
# axon-api-7d8f4c5b6d-ghi56   1/1     Running   0          30s

# 7. Check logs
kubectl logs -f deployment/axon-api

# 8. Verify health check
kubectl port-forward service/axon-api 3000:3000 &
curl http://localhost:3000/health

# 9. Run smoke tests
./scripts/smoke-test.sh

# 10. Monitor for 10 minutes
# - kubectl get pods -w
# - Check monitoring dashboard
# - Verify no error alerts
```

### Method 3: Using Deployment Script

**Recommended for**: Automated deployments, CI/CD

```bash
# Deploy to production
./scripts/deploy.sh production

# The script will:
# 1. Validate environment
# 2. Ask for deployment method (Docker Compose, Swarm, Kubernetes)
# 3. Perform pre-deployment checks
# 4. Deploy the application
# 5. Verify deployment
# 6. Show health check results
```

### Post-Deployment Verification

**After deployment, verify:**

```bash
# 1. All services running
docker-compose ps  # or kubectl get pods

# 2. Health checks passing
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
curl http://localhost:3000/health/live

# 3. No errors in logs
docker-compose logs --tail=100 api

# 4. Process a test prompt
curl -X POST http://localhost:3000/api/v1/prompts/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Hello, testing deployment",
    "workspaceId": "test",
    "source": "api"
  }'

# 5. Check monitoring dashboard
# - Request rate normal
# - Latency < 3s (p95)
# - Error rate < 1%
# - No alerts firing

# 6. Notify team
# "Deployment complete. Monitoring for issues."
```

---

## Rollback Procedures

### When to Rollback

**Initiate rollback immediately if:**

- Error rate > 10% for 5+ minutes
- Service completely down for 2+ minutes
- Critical security vulnerability discovered
- Data corruption detected
- Latency p95 > 10s for 5+ minutes

### Docker Compose Rollback

```bash
# 1. Stop current version
docker-compose down

# 2. Switch to previous image tag
# Edit docker-compose.prod.yml:
# image: axon-api:v1.X.X-previous

# Or pull specific version
docker pull axon-api:v1.X.X-previous
docker tag axon-api:v1.X.X-previous axon-api:latest

# 3. Start previous version
docker-compose -f docker-compose.prod.yml up -d

# 4. Verify rollback
curl http://localhost:3000/health

# 5. Monitor for 10 minutes
docker-compose logs -f api

# 6. If issues persist, check database state
# May need to restore from backup
```

### Kubernetes Rollback

```bash
# Option 1: Rollback to previous revision
kubectl rollout undo deployment/axon-api

# Option 2: Rollback to specific revision
# First, check revision history
kubectl rollout history deployment/axon-api

# Then rollback to specific revision
kubectl rollout undo deployment/axon-api --to-revision=2

# Verify rollback
kubectl rollout status deployment/axon-api
kubectl get pods -l app=axon-api

# Check health
kubectl port-forward service/axon-api 3000:3000 &
curl http://localhost:3000/health

# Monitor logs
kubectl logs -f deployment/axon-api
```

### Database Rollback

**If database changes were part of deployment:**

```bash
# 1. Stop application
docker-compose down  # or kubectl scale deployment axon-api --replicas=0

# 2. Restore database from backup
# MongoDB restore
mongorestore --uri="$MONGODB_URI" --drop /backup/20251106

# Redis restore (if using persistence)
# Copy RDB file to Redis data directory and restart

# 3. Verify database state
mongo "$MONGODB_URI" --eval "db.contexts.countDocuments()"

# 4. Restart application with previous version
docker-compose up -d  # or kubectl scale deployment axon-api --replicas=3

# 5. Verify application working
curl http://localhost:3000/health
```

### Post-Rollback Actions

1. [ ] **Document incident**
   - What went wrong?
   - When did it happen?
   - How long to detect?
   - How long to rollback?
   - Impact on users?

2. [ ] **Notify team**
   - "Rollback complete. System stable."
   - Share incident summary

3. [ ] **Root cause analysis**
   - Schedule post-mortem (within 48 hours)
   - Identify root cause
   - Create action items
   - Update runbook

4. [ ] **Create fix**
   - Fix the issue in code
   - Add test to prevent regression
   - Re-deploy when ready

---

## Operational Procedures

### Database Maintenance

#### MongoDB

**Weekly Backup:**

```bash
# Create backup
DATE=$(date +%Y%m%d)
mongodump --uri="$MONGODB_URI" --out=/backup/$DATE

# Compress backup
tar -czf /backup/mongodb-$DATE.tar.gz /backup/$DATE
rm -rf /backup/$DATE

# Upload to S3 (optional)
aws s3 cp /backup/mongodb-$DATE.tar.gz s3://your-bucket/backups/

# Delete backups older than 30 days
find /backup -name "mongodb-*.tar.gz" -mtime +30 -delete
```

**Index Maintenance:**

```bash
# Check index usage
mongo "$MONGODB_URI" --eval '
  db.contexts.aggregate([
    { $indexStats: {} }
  ]).forEach(printjson)
'

# Rebuild indexes (if needed)
mongo "$MONGODB_URI" --eval '
  db.contexts.reIndex()
  db.workspaces.reIndex()
  db.interactions.reIndex()
'
```

**Cleanup Old Data:**

```bash
# Delete contexts older than 90 days
mongo "$MONGODB_URI" --eval '
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const result = db.contexts.deleteMany({
    createdAt: { $lt: cutoffDate },
    usageCount: { $lt: 5 }
  });
  print("Deleted", result.deletedCount, "old contexts");
'

# Delete old interactions
mongo "$MONGODB_URI" --eval '
  const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = db.interactions.deleteMany({
    timestamp: { $lt: cutoffDate }
  });
  print("Deleted", result.deletedCount, "old interactions");
'
```

#### Redis

**Daily Backup (if using persistence):**

```bash
# Trigger BGSAVE
redis-cli -u "$REDIS_URL" BGSAVE

# Wait for save to complete
redis-cli -u "$REDIS_URL" LASTSAVE

# Copy RDB file
cp /data/redis/dump.rdb /backup/redis-$(date +%Y%m%d).rdb
```

**Cache Cleanup:**

```bash
# Clear all cache (use with caution!)
redis-cli -u "$REDIS_URL" FLUSHDB

# Clear specific cache keys
redis-cli -u "$REDIS_URL" --scan --pattern "axon:cache:*" | xargs redis-cli -u "$REDIS_URL" DEL

# Check memory usage
redis-cli -u "$REDIS_URL" INFO memory
```

#### Qdrant

**Backup Collection:**

```bash
# Create snapshot
curl -X POST "http://localhost:6333/collections/axon-contexts/snapshots"

# Download snapshot
curl "http://localhost:6333/collections/axon-contexts/snapshots/snapshot-name" \
  --output /backup/qdrant-$(date +%Y%m%d).snapshot
```

### Log Management

**View Recent Logs:**

```bash
# Docker Compose
docker-compose logs --tail=100 -f api

# Kubernetes
kubectl logs --tail=100 -f deployment/axon-api

# View specific pod
kubectl logs -f axon-api-7d8f4c5b6d-abc12
```

**Search Logs:**

```bash
# Search for errors (Docker Compose)
docker-compose logs api | grep -i error

# Search for specific request (Kubernetes)
kubectl logs deployment/axon-api | grep "requestId: abc123"

# Count errors in last hour
docker-compose logs --since 1h api | grep -c ERROR
```

**Export Logs:**

```bash
# Export to file
docker-compose logs api > logs-$(date +%Y%m%d-%H%M).txt

# Export to centralized logging
docker-compose logs api | \
  gzip | \
  aws s3 cp - s3://your-bucket/logs/api-$(date +%Y%m%d-%H%M).log.gz
```

### Certificate Renewal

**Let's Encrypt Certificate Renewal:**

```bash
# Renew certificate (runs automatically with certbot)
certbot renew

# Force renewal for testing
certbot renew --force-renewal

# Reload NGINX after renewal
docker-compose exec nginx nginx -s reload
# Or
kubectl exec -it deployment/nginx -- nginx -s reload

# Check certificate expiration
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | \
  openssl x509 -noout -dates
```

### Scaling

**Docker Compose Scaling:**

```bash
# Scale API service to 3 replicas
docker-compose up -d --scale api=3

# Verify
docker-compose ps
```

**Kubernetes Scaling:**

```bash
# Manual scaling
kubectl scale deployment axon-api --replicas=5

# Verify
kubectl get pods -l app=axon-api

# Enable autoscaling (HPA)
kubectl autoscale deployment axon-api \
  --cpu-percent=70 \
  --min=3 \
  --max=10

# Check HPA status
kubectl get hpa
```

---

## Troubleshooting Guide

### Service Won't Start

**Symptoms**: Service fails to start, crashes immediately

**Diagnosis:**

```bash
# Check logs for startup errors
docker-compose logs api

# Common errors:
# - "ECONNREFUSED" - Can't connect to database
# - "Invalid API key" - Missing/invalid environment variables
# - "Port already in use" - Port conflict
```

**Solutions:**

```bash
# 1. Verify environment variables
docker-compose exec api env | grep -E "(MONGODB|REDIS|QDRANT|OPENAI)"

# 2. Check database connectivity
docker-compose exec api nc -zv mongodb 27017
docker-compose exec api nc -zv redis 6379

# 3. Check port availability
netstat -tuln | grep 3000

# 4. Restart all services
docker-compose down
docker-compose up -d

# 5. Check service dependencies
docker-compose ps
```

### High Error Rate

**Symptoms**: Error rate > 5%, many 500 errors

**Diagnosis:**

```bash
# Check recent errors
docker-compose logs --tail=100 api | grep ERROR

# Check error distribution
docker-compose logs api | grep ERROR | awk '{print $NF}' | sort | uniq -c

# Check database connectivity
mongo "$MONGODB_URI" --eval "db.adminCommand('ping')"
redis-cli -u "$REDIS_URL" PING
```

**Solutions:**

```bash
# 1. Check for database connection issues
# Increase connection pool size if needed

# 2. Check for LLM API issues
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# 3. Restart service
docker-compose restart api

# 4. Check resource usage
docker stats

# 5. If persistent, rollback
./scripts/deploy.sh --rollback
```

### High Latency

**Symptoms**: Response time > 5s, slow requests

**Diagnosis:**

```bash
# Check current latency
time curl http://localhost:3000/health

# Check database query performance
mongo "$MONGODB_URI" --eval "db.setProfilingLevel(2)"
# Run slow queries
mongo "$MONGODB_URI" --eval "db.system.profile.find().limit(10).pretty()"

# Check cache hit rate
redis-cli -u "$REDIS_URL" INFO stats | grep keyspace
```

**Solutions:**

```bash
# 1. Clear cache and warm up
redis-cli -u "$REDIS_URL" FLUSHDB

# 2. Check database indexes
mongo "$MONGODB_URI" --eval "
  db.contexts.getIndexes()
"

# 3. Check resource usage
docker stats

# 4. Scale up if needed
docker-compose up -d --scale api=3

# 5. Optimize database queries
# Review slow query log
# Add missing indexes
```

### Memory Leak

**Symptoms**: Memory usage growing over time, eventual crash

**Diagnosis:**

```bash
# Monitor memory usage
docker stats --no-stream

# Check for memory leak pattern
watch -n 5 'docker stats --no-stream | grep api'

# Generate heap snapshot (if Node.js exposed)
curl http://localhost:3000/admin/heapdump > heap-$(date +%Y%m%d-%H%M).heapsnapshot
```

**Solutions:**

```bash
# 1. Restart service (temporary fix)
docker-compose restart api

# 2. Reduce memory usage
# - Clear caches
# - Reduce connection pool sizes
# - Tune garbage collection

# 3. Investigate code for leaks
# - Review event listeners
# - Check for circular references
# - Review large object retention

# 4. Increase memory limit (temporary)
# Edit docker-compose.yml:
# deploy:
#   resources:
#     limits:
#       memory: 2G
```

### Database Connection Exhaustion

**Symptoms**: "Too many connections", "Connection timeout"

**Diagnosis:**

```bash
# Check active connections (MongoDB)
mongo "$MONGODB_URI" --eval "db.serverStatus().connections"

# Check connection pool stats
docker-compose logs api | grep "connection pool"
```

**Solutions:**

```bash
# 1. Increase connection pool size
# Edit environment variable:
# MONGODB_MAX_POOL_SIZE=50

# 2. Check for connection leaks
# Review code for unclosed connections

# 3. Restart application
docker-compose restart api

# 4. Restart database (last resort)
docker-compose restart mongodb
```

---

## Common Issues

### Issue: "API not responding"

**Cause**: Service down or unhealthy

**Quick Fix:**

```bash
docker-compose restart api
curl http://localhost:3000/health
```

### Issue: "Context retrieval very slow"

**Cause**: Missing database indexes or vector search issues

**Quick Fix:**

```bash
# Rebuild indexes
mongo "$MONGODB_URI" --eval "
  db.contexts.createIndex({ workspaceId: 1, tier: 1 });
  db.contexts.createIndex({ createdAt: -1 });
"

# Check Qdrant status
curl http://localhost:6333/collections/axon-contexts
```

### Issue: "LLM API rate limit exceeded"

**Cause**: Too many requests to OpenAI

**Quick Fix:**

```bash
# Implement request queuing
# Increase rate limit with OpenAI
# Use caching for common prompts
```

### Issue: "Out of memory"

**Cause**: Memory leak or insufficient resources

**Quick Fix:**

```bash
# Increase memory limit
docker-compose down
# Edit docker-compose.yml to increase memory
docker-compose up -d

# Or restart to free memory
docker-compose restart api
```

---

## Emergency Procedures

### Complete System Outage

**Steps:**

1. **Assess impact**

   ```bash
   curl http://localhost:3000/health
   docker-compose ps
   ```

2. **Check all services**

   ```bash
   # MongoDB
   mongo "$MONGODB_URI" --eval "db.adminCommand('ping')"

   # Redis
   redis-cli -u "$REDIS_URL" PING

   # Qdrant
   curl http://localhost:6333/healthz
   ```

3. **Restart all services**

   ```bash
   docker-compose down
   docker-compose up -d
   ```

4. **Verify recovery**

   ```bash
   ./scripts/smoke-test.sh
   ```

5. **If still down, restore from backup**

   ```bash
   # Restore database
   mongorestore --uri="$MONGODB_URI" --drop /backup/latest

   # Restart application
   docker-compose up -d
   ```

6. **Notify stakeholders**
   - Update status page
   - Send incident notification
   - Provide ETA for resolution

### Data Corruption Detected

**Steps:**

1. **Stop application immediately**

   ```bash
   docker-compose down
   ```

2. **Assess damage**

   ```bash
   mongo "$MONGODB_URI" --eval "db.contexts.countDocuments()"
   ```

3. **Restore from last known good backup**

   ```bash
   mongorestore --uri="$MONGODB_URI" --drop /backup/20251106
   ```

4. **Verify data integrity**

   ```bash
   mongo "$MONGODB_URI" --eval "
     db.contexts.find().limit(10).pretty()
   "
   ```

5. **Restart application**

   ```bash
   docker-compose up -d
   ```

6. **Document incident**
   - What caused corruption?
   - How much data lost?
   - How to prevent recurrence?

### Security Incident

**Steps:**

1. **Isolate affected systems**

   ```bash
   # Block external traffic
   iptables -A INPUT -j DROP

   # Or stop service
   docker-compose down
   ```

2. **Assess breach**
   - Check logs for unauthorized access
   - Review database for tampering
   - Check for data exfiltration

3. **Rotate credentials**

   ```bash
   # Generate new secrets
   openssl rand -base64 32  # New JWT secret

   # Update environment variables
   # Update database passwords
   # Regenerate API keys
   ```

4. **Patch vulnerability**
   - Apply security updates
   - Fix vulnerable code
   - Deploy patched version

5. **Notify affected parties**
   - Users (if data compromised)
   - Management
   - Security team
   - Legal (if required)

6. **Post-incident review**
   - Document timeline
   - Identify improvements
   - Update security procedures

---

## Contacts & Escalation

### Primary Contacts

- **On-Call Engineer**: [Phone] / [Pager]
- **Engineering Lead**: [Phone] / [Email]
- **DevOps Lead**: [Phone] / [Email]
- **Product Manager**: [Phone] / [Email]

### Escalation Path

1. **Level 1**: On-call engineer (responds within 15 minutes)
2. **Level 2**: Engineering lead (for critical issues)
3. **Level 3**: VP Engineering (for major incidents)

### External Support

- **MongoDB Atlas**: https://support.mongodb.com
- **OpenAI**: https://help.openai.com
- **Cloud Provider**: [Your provider support link]

---

**Document Version**: 1.0
**Last Updated**: 2025-11-07
**Next Review**: 2025-12-07
