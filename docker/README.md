# Axon Docker Development Environment

## Quick Start

Start all services:

```bash
docker-compose -f docker/docker-compose.dev.yml up -d
```

Stop all services:

```bash
docker-compose -f docker/docker-compose.dev.yml down
```

Stop and remove volumes (⚠️ This will delete all data):

```bash
docker-compose -f docker/docker-compose.dev.yml down -v
```

## Services

### MongoDB

- **Port**: 27017
- **Admin User**: admin
- **Admin Password**: password
- **Database**: axon
- **Connection String**: `mongodb://admin:password@localhost:27017/axon?authSource=admin`

To connect with mongosh:

```bash
docker exec -it axon-mongodb mongosh -u admin -p password
```

### Redis

- **Port**: 6379
- **No password** (for local development)
- **Connection**: `redis://localhost:6379`

To connect with redis-cli:

```bash
docker exec -it axon-redis redis-cli
```

### Qdrant

- **HTTP Port**: 6333
- **gRPC Port**: 6334
- **Dashboard**: http://localhost:6333/dashboard
- **Connection**: `http://localhost:6333`

To check health:

```bash
curl http://localhost:6333/healthz
```

## Health Checks

Check status of all services:

```bash
docker-compose -f docker/docker-compose.dev.yml ps
```

View logs:

```bash
# All services
docker-compose -f docker/docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker/docker-compose.dev.yml logs -f mongodb
docker-compose -f docker/docker-compose.dev.yml logs -f redis
docker-compose -f docker/docker-compose.dev.yml logs -f qdrant
```

## Data Persistence

Data is persisted in Docker volumes:

- `mongodb_data` - MongoDB database files
- `redis_data` - Redis persistence files
- `qdrant_data` - Qdrant vector storage

To inspect volumes:

```bash
docker volume ls | grep axon
```

## Troubleshooting

### MongoDB Connection Issues

1. Ensure container is running: `docker ps | grep mongodb`
2. Check logs: `docker logs axon-mongodb`
3. Test connection: `docker exec -it axon-mongodb mongosh --eval "db.adminCommand('ping')"`

### Redis Connection Issues

1. Ensure container is running: `docker ps | grep redis`
2. Check logs: `docker logs axon-redis`
3. Test connection: `docker exec -it axon-redis redis-cli ping`

### Qdrant Connection Issues

1. Ensure container is running: `docker ps | grep qdrant`
2. Check logs: `docker logs axon-qdrant`
3. Test connection: `curl http://localhost:6333/healthz`
4. Access dashboard: Open http://localhost:6333/dashboard in browser

### Port Conflicts

If ports are already in use, you can modify the port mappings in `docker-compose.dev.yml`:

```yaml
ports:
  - '<new-port>:<container-port>'
```

Then update your `.env` file accordingly.
