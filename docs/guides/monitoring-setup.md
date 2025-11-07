# Monitoring & Observability Setup Guide

> **Purpose**: Comprehensive guide for setting up monitoring, logging, and observability for Axon in production.

---

## Table of Contents

- [Monitoring Stack Overview](#monitoring-stack-overview)
- [Prometheus Setup](#prometheus-setup)
- [Grafana Setup](#grafana-setup)
- [Application Metrics](#application-metrics)
- [Log Aggregation](#log-aggregation)
- [Alerting](#alerting)
- [Distributed Tracing](#distributed-tracing)
- [Dashboards](#dashboards)

---

## Monitoring Stack Overview

### Recommended Stack

```
┌──────────────────────────────────────────────────────────┐
│                    Application Layer                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │    API     │  │ Middleware │  │  Services  │         │
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘         │
│         │                │                │               │
│         └────────────────┴────────────────┘               │
│                          │                                │
└──────────────────────────┼────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐   ┌──────────┐
    │Prometheus│    │  Loki    │   │  Jaeger  │
    │ (Metrics)│    │  (Logs)  │   │(Tracing) │
    └────┬─────┘    └────┬─────┘   └────┬─────┘
         │               │              │
         └───────────────┴──────────────┘
                         │
                         ▼
                  ┌──────────┐
                  │ Grafana  │
                  │(Dashboards)│
                  └──────────┘
```

### Components

| Component         | Purpose                      | Port  | Storage         |
| ----------------- | ---------------------------- | ----- | --------------- |
| **Prometheus**    | Metrics collection & storage | 9090  | Time-series DB  |
| **Grafana**       | Visualization & dashboards   | 3001  | SQLite/Postgres |
| **Loki**          | Log aggregation              | 3100  | Object storage  |
| **Promtail**      | Log shipper                  | 9080  | N/A             |
| **Jaeger**        | Distributed tracing          | 16686 | Cassandra/ES    |
| **Node Exporter** | System metrics               | 9100  | N/A             |

---

## Prometheus Setup

### Installation with Docker Compose

**Add to `docker-compose.yml`:**

```yaml
services:
  # ... existing services ...

  prometheus:
    image: prom/prometheus:latest
    container_name: axon-prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
      - '--storage.tsdb.retention.time=30d'
    volumes:
      - ./docker/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - '9090:9090'
    networks:
      - axon-network
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:latest
    container_name: axon-node-exporter
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    ports:
      - '9100:9100'
    networks:
      - axon-network
    restart: unless-stopped

volumes:
  prometheus-data:
    driver: local
```

### Prometheus Configuration

**Create `docker/prometheus/prometheus.yml`:**

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'axon'
    environment: 'production'

# Alertmanager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

# Load rules once and periodically evaluate them
rule_files:
  - 'alerts.yml'

# Scrape configurations
scrape_configs:
  # Axon API metrics
  - job_name: 'axon-api'
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  # Node exporter (system metrics)
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  # MongoDB exporter
  - job_name: 'mongodb'
    static_configs:
      - targets: ['mongodb-exporter:9216']

  # Redis exporter
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Qdrant metrics
  - job_name: 'qdrant'
    static_configs:
      - targets: ['qdrant:6333']
    metrics_path: '/metrics'
```

### Application Metrics Endpoint

**Install prom-client:**

```bash
pnpm add prom-client
```

**Create metrics service** (`apps/api/src/services/metrics.ts`):

```typescript
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export class MetricsService {
  private register: Registry;

  // Counters
  public requestCounter: Counter;
  public errorCounter: Counter;

  // Histograms
  public requestDuration: Histogram;
  public llmDuration: Histogram;
  public contextRetrievalDuration: Histogram;

  // Gauges
  public activeConnections: Gauge;
  public cacheHitRate: Gauge;

  constructor() {
    this.register = new Registry();

    // Request counter
    this.requestCounter = new Counter({
      name: 'axon_requests_total',
      help: 'Total number of requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.register],
    });

    // Error counter
    this.errorCounter = new Counter({
      name: 'axon_errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'route'],
      registers: [this.register],
    });

    // Request duration histogram
    this.requestDuration = new Histogram({
      name: 'axon_request_duration_seconds',
      help: 'Request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    // LLM duration histogram
    this.llmDuration = new Histogram({
      name: 'axon_llm_duration_seconds',
      help: 'LLM API call duration in seconds',
      labelNames: ['model', 'status'],
      buckets: [0.5, 1, 2, 5, 10, 30],
      registers: [this.register],
    });

    // Context retrieval duration
    this.contextRetrievalDuration = new Histogram({
      name: 'axon_context_retrieval_duration_seconds',
      help: 'Context retrieval duration in seconds',
      labelNames: ['workspace_id', 'tier'],
      buckets: [0.1, 0.2, 0.5, 1, 2],
      registers: [this.register],
    });

    // Active connections gauge
    this.activeConnections = new Gauge({
      name: 'axon_active_connections',
      help: 'Number of active connections',
      registers: [this.register],
    });

    // Cache hit rate gauge
    this.cacheHitRate = new Gauge({
      name: 'axon_cache_hit_rate',
      help: 'Cache hit rate (0-1)',
      labelNames: ['cache_type'],
      registers: [this.register],
    });
  }

  getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  getContentType(): string {
    return this.register.contentType;
  }
}

export const metricsService = new MetricsService();
```

**Add metrics middleware** (`apps/api/src/middleware/metrics.ts`):

```typescript
import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metrics';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  // Increment active connections
  metricsService.activeConnections.inc();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;

    // Record request
    metricsService.requestCounter.inc({
      method: req.method,
      route,
      status: res.statusCode,
    });

    // Record duration
    metricsService.requestDuration.observe(
      {
        method: req.method,
        route,
        status: res.statusCode,
      },
      duration
    );

    // Record error if applicable
    if (res.statusCode >= 400) {
      metricsService.errorCounter.inc({
        type: res.statusCode >= 500 ? 'server' : 'client',
        route,
      });
    }

    // Decrement active connections
    metricsService.activeConnections.dec();
  });

  next();
}
```

**Expose metrics endpoint:**

```typescript
// apps/api/src/routes/metrics.ts
import { Router } from 'express';
import { metricsService } from '../services/metrics';

export const metricsRouter = Router();

metricsRouter.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsService.getContentType());
    const metrics = await metricsService.getMetrics();
    res.send(metrics);
  } catch (error) {
    res.status(500).send('Error generating metrics');
  }
});
```

**Register in server:**

```typescript
// apps/api/src/server.ts
import { metricsMiddleware } from './middleware/metrics';
import { metricsRouter } from './routes/metrics';

// Add metrics middleware globally
app.use(metricsMiddleware);

// Add metrics endpoint
app.use(metricsRouter);
```

---

## Grafana Setup

### Installation with Docker Compose

**Add to `docker-compose.yml`:**

```yaml
services:
  # ... existing services ...

  grafana:
    image: grafana/grafana:latest
    container_name: axon-grafana
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin}
      - GF_SERVER_HTTP_PORT=3001
      - GF_INSTALL_PLUGINS=redis-datasource
    volumes:
      - grafana-data:/var/lib/grafana
      - ./docker/grafana/provisioning:/etc/grafana/provisioning
    ports:
      - '3001:3001'
    networks:
      - axon-network
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  grafana-data:
    driver: local
```

### Grafana Provisioning

**Create `docker/grafana/provisioning/datasources/prometheus.yml`:**

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
```

**Create `docker/grafana/provisioning/dashboards/dashboard.yml`:**

```yaml
apiVersion: 1

providers:
  - name: 'Axon Dashboards'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
```

### Access Grafana

```bash
# Start services
docker-compose up -d grafana

# Access Grafana
open http://localhost:3001

# Login:
# Username: admin
# Password: admin (or value from GRAFANA_PASSWORD)
```

---

## Application Metrics

### Custom Business Metrics

**Track in orchestrator:**

```typescript
// packages/middleware/src/orchestrator/prompt-orchestrator.ts
import { metricsService } from '@axon/api/services/metrics';

export class PromptOrchestrator {
  async processPrompt(request: PromptRequest): Promise<OrchestrationResult> {
    const startTime = Date.now();

    try {
      // ... existing code ...

      // Track LLM duration
      const llmStart = Date.now();
      const llmResponse = await this.llmGateway.complete(/* ... */);
      const llmDuration = (Date.now() - llmStart) / 1000;

      metricsService.llmDuration.observe({ model: 'gpt-4', status: 'success' }, llmDuration);

      // Track context retrieval duration
      const retrievalStart = Date.now();
      const contexts = await this.contextRetriever.retrieve(/* ... */);
      const retrievalDuration = (Date.now() - retrievalStart) / 1000;

      metricsService.contextRetrievalDuration.observe(
        { workspace_id: request.workspaceId, tier: 'workspace' },
        retrievalDuration
      );

      // Track cache hit rate
      const cacheStats = this.getCacheStats();
      metricsService.cacheHitRate.set({ cache_type: 'embedding' }, cacheStats.embeddingHitRate);

      return result;
    } catch (error) {
      metricsService.llmDuration.observe(
        { model: 'gpt-4', status: 'error' },
        (Date.now() - startTime) / 1000
      );
      throw error;
    }
  }
}
```

### Database Metrics

**MongoDB Exporter:**

```yaml
# Add to docker-compose.yml
services:
  mongodb-exporter:
    image: percona/mongodb_exporter:latest
    container_name: axon-mongodb-exporter
    command:
      - '--mongodb.uri=${MONGODB_URI}'
      - '--collect-all'
    ports:
      - '9216:9216'
    networks:
      - axon-network
    restart: unless-stopped
```

**Redis Exporter:**

```yaml
# Add to docker-compose.yml
services:
  redis-exporter:
    image: oliver006/redis_exporter:latest
    container_name: axon-redis-exporter
    environment:
      - REDIS_ADDR=redis:6379
    ports:
      - '9121:9121'
    networks:
      - axon-network
    restart: unless-stopped
```

---

## Log Aggregation

### Loki + Promtail Setup

**Add to `docker-compose.yml`:**

```yaml
services:
  # ... existing services ...

  loki:
    image: grafana/loki:latest
    container_name: axon-loki
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - ./docker/loki/local-config.yaml:/etc/loki/local-config.yaml
      - loki-data:/loki
    ports:
      - '3100:3100'
    networks:
      - axon-network
    restart: unless-stopped

  promtail:
    image: grafana/promtail:latest
    container_name: axon-promtail
    command: -config.file=/etc/promtail/config.yml
    volumes:
      - ./docker/promtail/config.yml:/etc/promtail/config.yml
      - /var/log:/var/log:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    networks:
      - axon-network
    restart: unless-stopped

volumes:
  loki-data:
    driver: local
```

**Create `docker/loki/local-config.yaml`:**

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
  chunk_idle_period: 5m
  chunk_retain_period: 30s

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 168h

storage_config:
  boltdb:
    directory: /loki/index
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: true
  retention_period: 720h
```

**Create `docker/promtail/config.yml`:**

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  # Docker containers
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: 'container'
      - source_labels: ['__meta_docker_container_log_stream']
        target_label: 'stream'

  # Application logs
  - job_name: axon-api
    static_configs:
      - targets:
          - localhost
        labels:
          job: axon-api
          __path__: /var/log/axon/*.log
```

### Structured Logging

**Already implemented in `packages/shared/src/utils/logger.ts`:**

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Add console in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    })
  );
}
```

**Add Loki datasource in Grafana:**

```yaml
# docker/grafana/provisioning/datasources/loki.yml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: true
```

---

## Alerting

### Alertmanager Setup

**Add to `docker-compose.yml`:**

```yaml
services:
  alertmanager:
    image: prom/alertmanager:latest
    container_name: axon-alertmanager
    command:
      - '--config.file=/etc/alertmanager/config.yml'
      - '--storage.path=/alertmanager'
    volumes:
      - ./docker/alertmanager/config.yml:/etc/alertmanager/config.yml
      - alertmanager-data:/alertmanager
    ports:
      - '9093:9093'
    networks:
      - axon-network
    restart: unless-stopped

volumes:
  alertmanager-data:
    driver: local
```

### Alert Rules

**Create `docker/prometheus/alerts.yml`:**

```yaml
groups:
  - name: axon_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          (
            rate(axon_errors_total[5m])
            /
            rate(axon_requests_total[5m])
          ) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: 'High error rate detected'
          description: 'Error rate is {{ $value | humanizePercentage }} (threshold: 5%)'

      # High latency
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            rate(axon_request_duration_seconds_bucket[5m])
          ) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High latency detected'
          description: 'p95 latency is {{ $value }}s (threshold: 5s)'

      # Service down
      - alert: ServiceDown
        expr: up{job="axon-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'Axon API is down'
          description: 'API service has been down for more than 1 minute'

      # High memory usage
      - alert: HighMemoryUsage
        expr: |
          (
            node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes
          ) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High memory usage'
          description: 'Memory usage is {{ $value | humanizePercentage }}'

      # Database connection issues
      - alert: MongoDBDown
        expr: up{job="mongodb"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'MongoDB is down'
          description: 'MongoDB has been down for more than 1 minute'

      # Low cache hit rate
      - alert: LowCacheHitRate
        expr: axon_cache_hit_rate{cache_type="embedding"} < 0.6
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: 'Low cache hit rate'
          description: 'Cache hit rate is {{ $value | humanizePercentage }} (threshold: 60%)'
```

### Alertmanager Configuration

**Create `docker/alertmanager/config.yml`:**

```yaml
global:
  resolve_timeout: 5m
  # Slack webhook (optional)
  slack_api_url: '${SLACK_WEBHOOK_URL}'

route:
  group_by: ['alertname', 'cluster']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical'
      continue: true
    - match:
        severity: warning
      receiver: 'warning'

receivers:
  - name: 'default'
    email_configs:
      - to: 'team@example.com'
        from: 'alertmanager@example.com'
        smarthost: 'smtp.example.com:587'
        auth_username: 'alertmanager@example.com'
        auth_password: '${SMTP_PASSWORD}'

  - name: 'critical'
    slack_configs:
      - channel: '#alerts-critical'
        title: '🚨 Critical Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}\n{{ end }}'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_SERVICE_KEY}'

  - name: 'warning'
    slack_configs:
      - channel: '#alerts-warning'
        title: '⚠️ Warning Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}\n{{ end }}'
```

---

## Distributed Tracing

### Jaeger Setup (Optional)

**Add to `docker-compose.yml`:**

```yaml
services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: axon-jaeger
    environment:
      - COLLECTOR_ZIPKIN_HOST_PORT=:9411
    ports:
      - '5775:5775/udp'
      - '6831:6831/udp'
      - '6832:6832/udp'
      - '5778:5778'
      - '16686:16686'
      - '14268:14268'
      - '14250:14250'
      - '9411:9411'
    networks:
      - axon-network
    restart: unless-stopped
```

**Install OpenTelemetry:**

```bash
pnpm add @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-jaeger
```

**Create tracing setup** (`apps/api/src/tracing.ts`):

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const jaegerExporter = new JaegerExporter({
  endpoint: 'http://jaeger:14268/api/traces',
});

const sdk = new NodeSDK({
  traceExporter: jaegerExporter,
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: 'axon-api',
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
```

**Import in server:**

```typescript
// apps/api/src/server.ts
import './tracing'; // Must be first import!
// ... rest of imports
```

---

## Dashboards

### Axon Overview Dashboard

**Create JSON dashboard** (`docker/grafana/provisioning/dashboards/axon-overview.json`):

This is a complex JSON file. Here's the key panels structure:

```json
{
  "dashboard": {
    "title": "Axon Overview",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(axon_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(axon_errors_total[5m]) / rate(axon_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Latency (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(axon_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Active Connections",
        "targets": [
          {
            "expr": "axon_active_connections"
          }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "targets": [
          {
            "expr": "axon_cache_hit_rate"
          }
        ]
      },
      {
        "title": "LLM Duration",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(axon_llm_duration_seconds_bucket[5m]))"
          }
        ]
      }
    ]
  }
}
```

### Quick Start Commands

**Start monitoring stack:**

```bash
# Start all monitoring services
docker-compose up -d prometheus grafana loki promtail alertmanager node-exporter mongodb-exporter redis-exporter

# Verify services
docker-compose ps

# Access dashboards
open http://localhost:9090  # Prometheus
open http://localhost:3001  # Grafana
open http://localhost:16686 # Jaeger (if enabled)
```

---

## Monitoring Checklist

### Initial Setup

- [ ] Prometheus configured and scraping metrics
- [ ] Grafana installed with datasources
- [ ] Loki + Promtail for log aggregation
- [ ] Alertmanager configured
- [ ] Alert rules defined
- [ ] Notification channels configured (Slack, email)

### Application Instrumentation

- [ ] Metrics endpoint exposed (`/metrics`)
- [ ] Request duration tracked
- [ ] Error rate tracked
- [ ] LLM duration tracked
- [ ] Context retrieval duration tracked
- [ ] Cache hit rate tracked
- [ ] Database metrics exported

### Dashboards Created

- [ ] Overview dashboard (requests, errors, latency)
- [ ] Database dashboard (MongoDB, Redis, Qdrant)
- [ ] System dashboard (CPU, memory, disk)
- [ ] Business metrics dashboard (prompts/day, token usage)

### Alerting Configured

- [ ] High error rate alert
- [ ] High latency alert
- [ ] Service down alert
- [ ] High memory usage alert
- [ ] Database down alert
- [ ] Low cache hit rate alert

---

**Document Version**: 1.0
**Last Updated**: 2025-11-07
**Next Review**: 2025-12-07
