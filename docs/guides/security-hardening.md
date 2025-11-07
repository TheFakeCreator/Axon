# Security Hardening Guide

> **Purpose**: Comprehensive guide for securing Axon in production environments, covering authentication, authorization, data protection, and security best practices.

---

## Table of Contents

- [Security Overview](#security-overview)
- [Authentication & Authorization](#authentication--authorization)
- [Input Validation & Sanitization](#input-validation--sanitization)
- [Data Protection](#data-protection)
- [Network Security](#network-security)
- [Secrets Management](#secrets-management)
- [Security Monitoring](#security-monitoring)
- [Dependency Security](#dependency-security)
- [Security Checklist](#security-checklist)

---

## Security Overview

### Security Layers

```
┌──────────────────────────────────────────────────┐
│ Layer 1: Network Security                        │
│ • Firewall rules                                 │
│ • DDoS protection                                │
│ • TLS/SSL encryption                             │
└────────────────────┬─────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│ Layer 2: Application Security                    │
│ • Authentication (API keys, JWT)                 │
│ • Authorization (RBAC)                           │
│ • Rate limiting                                  │
└────────────────────┬─────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│ Layer 3: Input Security                          │
│ • Input validation                               │
│ • XSS prevention                                 │
│ • Injection prevention                           │
└────────────────────┬─────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│ Layer 4: Data Security                           │
│ • Encryption at rest                             │
│ • Encryption in transit                          │
│ • Secure storage                                 │
└────────────────────┬─────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│ Layer 5: Infrastructure Security                 │
│ • Container security                             │
│ • Database security                              │
│ • Secrets management                             │
└──────────────────────────────────────────────────┘
```

### Threat Model

| Threat                         | Risk Level | Mitigation                                |
| ------------------------------ | ---------- | ----------------------------------------- |
| **Unauthorized API Access**    | High       | API key authentication, rate limiting     |
| **Data Breach**                | High       | Encryption, access control                |
| **Injection Attacks**          | Medium     | Input validation, parameterized queries   |
| **DDoS**                       | Medium     | Rate limiting, CDN, firewall              |
| **Man-in-the-Middle**          | Medium     | TLS/SSL, certificate pinning              |
| **Secrets Exposure**           | High       | Secrets management, environment variables |
| **Dependency Vulnerabilities** | Medium     | Regular audits, automated scanning        |

---

## Authentication & Authorization

### API Key Authentication

**Generate API Keys:**

```typescript
// packages/shared/src/utils/api-keys.ts
import crypto from 'crypto';
import bcrypt from 'bcrypt';

export class APIKeyManager {
  private static readonly PREFIX = 'axon_';
  private static readonly KEY_LENGTH = 32;
  private static readonly SALT_ROUNDS = 10;

  /**
   * Generate a new API key
   * Returns: { key: string, hash: string }
   */
  static async generate(): Promise<{ key: string; hash: string }> {
    // Generate random key
    const randomBytes = crypto.randomBytes(this.KEY_LENGTH);
    const key = `${this.PREFIX}${randomBytes.toString('base64url')}`;

    // Hash for storage
    const hash = await bcrypt.hash(key, this.SALT_ROUNDS);

    return { key, hash };
  }

  /**
   * Verify API key against hash
   */
  static async verify(key: string, hash: string): Promise<boolean> {
    return bcrypt.compare(key, hash);
  }

  /**
   * Validate API key format
   */
  static isValid(key: string): boolean {
    return key.startsWith(this.PREFIX) && key.length > this.PREFIX.length + 20;
  }
}
```

**Store API Keys:**

```typescript
// MongoDB schema for API keys
interface APIKey {
  _id: ObjectId;
  name: string;
  keyHash: string; // Never store raw key!
  userId: string;
  workspaceId?: string;
  scopes: string[]; // ['prompts:read', 'prompts:write', 'contexts:read']
  rateLimit: {
    requests: number;
    window: number; // seconds
  };
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  isActive: boolean;
}

// Create indexes
db.api_keys.createIndex({ keyHash: 1 }, { unique: true });
db.api_keys.createIndex({ userId: 1 });
db.api_keys.createIndex({ expiresAt: 1 });
db.api_keys.createIndex({ isActive: 1 });
```

**Authentication Middleware:**

```typescript
// apps/api/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { APIKeyManager } from '@axon/shared/utils/api-keys';
import { getDatabase } from '@axon/shared/database';

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    workspaceId?: string;
    scopes: string[];
    apiKeyId: string;
  };
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    // Extract API key from header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const apiKey = authHeader.substring(7);

    // Validate format
    if (!APIKeyManager.isValid(apiKey)) {
      return res.status(401).json({ error: 'Invalid API key format' });
    }

    // Find API key in database
    const db = getDatabase();
    const keys = await db.collection('api_keys').find({ isActive: true }).toArray();

    // Verify against stored hashes
    let matchedKey: any = null;
    for (const key of keys) {
      if (await APIKeyManager.verify(apiKey, key.keyHash)) {
        matchedKey = key;
        break;
      }
    }

    if (!matchedKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Check expiration
    if (matchedKey.expiresAt && new Date() > matchedKey.expiresAt) {
      return res.status(401).json({ error: 'API key expired' });
    }

    // Update last used
    await db
      .collection('api_keys')
      .updateOne({ _id: matchedKey._id }, { $set: { lastUsedAt: new Date() } });

    // Attach auth info to request
    req.auth = {
      userId: matchedKey.userId,
      workspaceId: matchedKey.workspaceId,
      scopes: matchedKey.scopes,
      apiKeyId: matchedKey._id.toString(),
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Require specific scopes
 */
export function requireScopes(...requiredScopes: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const hasAllScopes = requiredScopes.every((scope) => req.auth!.scopes.includes(scope));

    if (!hasAllScopes) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredScopes,
        granted: req.auth.scopes,
      });
    }

    next();
  };
}
```

**Apply Authentication:**

```typescript
// apps/api/src/routes/prompts.ts
import { authenticate, requireScopes } from '../middleware/auth';

// Protected routes
router.post('/process', authenticate, requireScopes('prompts:write'), processPromptHandler);

router.get('/history', authenticate, requireScopes('prompts:read'), getHistoryHandler);
```

### JWT Tokens (Alternative/Complementary)

**Install dependencies:**

```bash
pnpm add jsonwebtoken
pnpm add -D @types/jsonwebtoken
```

**JWT Service:**

```typescript
// packages/shared/src/utils/jwt.ts
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  workspaceId?: string;
  scopes: string[];
  iat?: number;
  exp?: number;
}

export class JWTService {
  private static readonly SECRET = process.env.JWT_SECRET!;
  private static readonly EXPIRATION = '24h';
  private static readonly REFRESH_EXPIRATION = '7d';

  /**
   * Generate access token
   */
  static generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, this.SECRET, {
      expiresIn: this.EXPIRATION,
      issuer: 'axon-api',
      audience: 'axon-users',
    });
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(payload: JWTPayload): string {
    return jwt.sign(payload, this.SECRET, {
      expiresIn: this.REFRESH_EXPIRATION,
      issuer: 'axon-api',
      audience: 'axon-users',
    });
  }

  /**
   * Verify and decode token
   */
  static verify(token: string): JWTPayload {
    return jwt.verify(token, this.SECRET, {
      issuer: 'axon-api',
      audience: 'axon-users',
    }) as JWTPayload;
  }

  /**
   * Decode without verification (for debugging)
   */
  static decode(token: string): JWTPayload | null {
    return jwt.decode(token) as JWTPayload | null;
  }
}
```

---

## Input Validation & Sanitization

### XSS Prevention

**Already implemented in PromptCollector, enhance:**

```typescript
// packages/middleware/src/collectors/prompt-collector.ts
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

export class PromptCollector {
  private sanitizeInput(text: string): string {
    // Remove HTML tags
    let sanitized = DOMPurify.sanitize(text, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });

    // Remove potential XSS patterns
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

    // Escape special characters
    sanitized = validator.escape(sanitized);

    return sanitized;
  }

  async collect(request: PromptRequest): Promise<RawPrompt> {
    // Sanitize prompt text
    const sanitizedText = this.sanitizeInput(request.prompt);

    // Sanitize workspace ID (alphanumeric + hyphens only)
    const sanitizedWorkspaceId = validator.isAlphanumeric(request.workspaceId.replace(/-/g, ''))
      ? request.workspaceId
      : '';

    if (!sanitizedWorkspaceId) {
      throw new ValidationError('Invalid workspace ID format');
    }

    // ... rest of collection logic
  }
}
```

### SQL/NoSQL Injection Prevention

**Use parameterized queries:**

```typescript
// ❌ BAD: String concatenation
const result = await db.collection('contexts').find({
  workspaceId: req.query.workspaceId, // Vulnerable!
});

// ✅ GOOD: Parameterized query with validation
const workspaceId = validator.isUUID(req.query.workspaceId) ? req.query.workspaceId : null;

if (!workspaceId) {
  throw new ValidationError('Invalid workspace ID');
}

const result = await db.collection('contexts').find({
  workspaceId: workspaceId, // Safe
});
```

**Validate all inputs with Zod:**

```typescript
// Already implemented in API routes
import { z } from 'zod';

const ProcessPromptSchema = z.object({
  prompt: z.string().min(1).max(10000),
  workspaceId: z.string().uuid(),
  source: z.enum(['api', 'cli', 'ui']),
  metadata: z
    .object({
      fileName: z.string().optional(),
      language: z.string().optional(),
    })
    .optional(),
});

// Validate request body
const validated = ProcessPromptSchema.parse(req.body);
```

### Path Traversal Prevention

```typescript
// packages/workspace-manager/src/coding-workspace-manager.ts
import path from 'path';

export class CodingWorkspaceManager {
  private validatePath(filePath: string): string {
    // Resolve to absolute path
    const resolvedPath = path.resolve(this.workspacePath, filePath);

    // Ensure path is within workspace
    if (!resolvedPath.startsWith(this.workspacePath)) {
      throw new Error('Path traversal attempt detected');
    }

    return resolvedPath;
  }

  async readFile(filePath: string): Promise<string> {
    const safePath = this.validatePath(filePath);
    return fs.readFile(safePath, 'utf-8');
  }
}
```

---

## Data Protection

### Encryption at Rest

**MongoDB Encryption:**

```yaml
# Enable MongoDB encryption
# In MongoDB Atlas: Enable "Encryption at Rest" in security settings

# For self-hosted:
security:
  enableEncryption: true
  encryptionKeyFile: /path/to/keyfile
```

**Encrypt Sensitive Fields:**

```typescript
// packages/shared/src/utils/encryption.ts
import crypto from 'crypto';

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'base64');

  /**
   * Encrypt text
   */
  static encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.KEY, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt text
   */
  static decrypt(encrypted: string): string {
    const [ivHex, authTagHex, encryptedText] = encrypted.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(this.ALGORITHM, this.KEY, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

// Usage: Store sensitive context data encrypted
const encryptedContent = EncryptionService.encrypt(sensitiveData);
await db.collection('contexts').insertOne({
  content: encryptedContent,
  encrypted: true,
});

// Decrypt when retrieving
const context = await db.collection('contexts').findOne({ _id });
if (context.encrypted) {
  context.content = EncryptionService.decrypt(context.content);
}
```

### Encryption in Transit

**TLS/SSL Configuration:**

```yaml
# docker-compose.prod.yml
services:
  nginx:
    image: nginx:alpine
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    ports:
      - '443:443'
      - '80:80'
```

**NGINX Configuration:**

```nginx
# docker/nginx/nginx.conf
server {
    listen 80;
    server_name api.axon.example.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.axon.example.com;

    # SSL certificates
    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    # SSL configuration (Mozilla Intermediate)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Let's Encrypt Setup:**

```bash
# Install certbot
apt-get update
apt-get install certbot

# Generate certificate
certbot certonly --standalone \
  -d api.axon.example.com \
  --email admin@example.com \
  --agree-tos

# Auto-renewal cron job
0 0 * * * certbot renew --quiet --post-hook "docker-compose restart nginx"
```

---

## Network Security

### Firewall Rules

**UFW (Ubuntu):**

```bash
# Enable firewall
ufw enable

# Allow SSH
ufw allow 22/tcp

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Block direct database access
ufw deny 27017/tcp  # MongoDB
ufw deny 6379/tcp   # Redis
ufw deny 6333/tcp   # Qdrant

# Allow only from application network
ufw allow from 172.18.0.0/16 to any port 27017
ufw allow from 172.18.0.0/16 to any port 6379
ufw allow from 172.18.0.0/16 to any port 6333

# Check status
ufw status verbose
```

### Rate Limiting

**Already implemented, enhance:**

```typescript
// apps/api/src/middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedisClient } from '@axon/shared/database';

// Global rate limit
export const globalLimiter = rateLimit({
  store: new RedisStore({
    client: getRedisClient(),
    prefix: 'rl:global:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limit for expensive operations
export const strictLimiter = rateLimit({
  store: new RedisStore({
    client: getRedisClient(),
    prefix: 'rl:strict:',
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many requests, please slow down',
});

// Per-API-key rate limiting
export const apiKeyLimiter = rateLimit({
  store: new RedisStore({
    client: getRedisClient(),
    prefix: 'rl:apikey:',
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req: AuthenticatedRequest) => {
    // Get limit from API key metadata
    return req.auth?.rateLimit?.requests || 1000;
  },
  keyGenerator: (req: AuthenticatedRequest) => {
    return req.auth?.apiKeyId || req.ip;
  },
});
```

### DDoS Protection

**Cloudflare Setup (Recommended):**

1. Sign up for Cloudflare
2. Add your domain
3. Enable DDoS protection
4. Configure firewall rules
5. Enable rate limiting

**Alternative: Fail2Ban:**

```bash
# Install fail2ban
apt-get install fail2ban

# Configure for NGINX
cat > /etc/fail2ban/jail.local << EOF
[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/*error.log
maxretry = 10
findtime = 600
bantime = 3600
EOF

# Restart fail2ban
systemctl restart fail2ban
```

---

## Secrets Management

### Environment Variables

**Never commit secrets:**

```bash
# .gitignore (already included)
.env
.env.local
.env.production
*.pem
*.key
```

**Use environment-specific files:**

```bash
# .env.production (not committed)
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/axon
REDIS_URL=rediss://user:password@redis.example.com:6380
QDRANT_URL=https://qdrant.example.com:6333

# LLM
OPENAI_API_KEY=sk-...

# Security
JWT_SECRET=<64-char-random-string>
ENCRYPTION_KEY=<base64-encoded-32-bytes>
API_KEY_SALT=<32-char-random-string>

# Monitoring
GRAFANA_PASSWORD=<strong-password>
```

### AWS Secrets Manager

```typescript
// packages/shared/src/utils/secrets.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export class SecretsManager {
  private static client = new SecretsManagerClient({ region: process.env.AWS_REGION });

  static async getSecret(secretName: string): Promise<any> {
    try {
      const response = await this.client.send(new GetSecretValueCommand({ SecretId: secretName }));
      return JSON.parse(response.SecretString!);
    } catch (error) {
      console.error(`Error retrieving secret ${secretName}:`, error);
      throw error;
    }
  }
}

// Usage in server startup
const secrets = await SecretsManager.getSecret('axon/production');
process.env.MONGODB_URI = secrets.MONGODB_URI;
process.env.OPENAI_API_KEY = secrets.OPENAI_API_KEY;
```

### HashiCorp Vault

```typescript
// packages/shared/src/utils/vault.ts
import vault from 'node-vault';

export class VaultManager {
  private static client = vault({
    endpoint: process.env.VAULT_ADDR,
    token: process.env.VAULT_TOKEN,
  });

  static async getSecret(path: string): Promise<any> {
    const result = await this.client.read(path);
    return result.data;
  }
}
```

---

## Security Monitoring

### Audit Logging

```typescript
// packages/shared/src/utils/audit-logger.ts
import { getDatabase } from '../database';

interface AuditEvent {
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export class AuditLogger {
  static async log(event: AuditEvent): Promise<void> {
    const db = getDatabase();
    await db.collection('audit_log').insertOne({
      ...event,
      timestamp: new Date(),
    });
  }
}

// Usage
await AuditLogger.log({
  userId: req.auth?.userId,
  action: 'prompt.process',
  resource: 'prompt',
  metadata: { workspaceId: req.body.workspaceId },
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  success: true,
});
```

### Security Events Monitoring

```typescript
// Track security events
await AuditLogger.log({
  action: 'auth.failed',
  resource: 'api_key',
  metadata: { reason: 'Invalid key' },
  ip: req.ip,
  success: false,
});

// Alert on suspicious patterns
const recentFailures = await db.collection('audit_log').countDocuments({
  action: 'auth.failed',
  ip: req.ip,
  timestamp: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
});

if (recentFailures > 5) {
  // Block IP temporarily
  await redis.setex(`blocked:${req.ip}`, 3600, '1');
  // Send alert
}
```

---

## Dependency Security

### Automated Scanning

**npm audit:**

```bash
# Check for vulnerabilities
pnpm audit

# Fix automatically (with caution)
pnpm audit --fix

# Generate report
pnpm audit --json > audit-report.json
```

**Snyk Integration:**

```bash
# Install Snyk CLI
npm install -g snyk

# Authenticate
snyk auth

# Test for vulnerabilities
snyk test

# Monitor project
snyk monitor
```

**GitHub Dependabot:**

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 10
    reviewers:
      - 'your-username'
    assignees:
      - 'your-username'
```

### Container Security

**Trivy Scanning (already in CI/CD):**

```bash
# Scan Docker image
trivy image axon-api:latest

# Scan with severity filter
trivy image --severity HIGH,CRITICAL axon-api:latest

# Generate report
trivy image --format json --output report.json axon-api:latest
```

---

## Security Checklist

### Pre-Deployment

- [ ] API key authentication implemented
- [ ] All inputs validated with Zod schemas
- [ ] XSS prevention implemented
- [ ] SQL/NoSQL injection prevention verified
- [ ] Path traversal protection in place
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Security headers set (Helmet)
- [ ] TLS/SSL certificates installed
- [ ] Secrets not in code or Git
- [ ] Environment variables documented
- [ ] Audit logging implemented

### Production

- [ ] Firewall rules configured
- [ ] Database access restricted
- [ ] DDoS protection enabled (Cloudflare)
- [ ] Rate limiting active
- [ ] Secrets in secure vault (AWS Secrets Manager)
- [ ] Monitoring and alerting configured
- [ ] Security events tracked
- [ ] Regular security scans (npm audit, Snyk)
- [ ] Container scanning in CI/CD
- [ ] Backup encryption enabled

### Ongoing

- [ ] Regular dependency updates (weekly)
- [ ] Security audit logs reviewed (daily)
- [ ] Failed authentication attempts monitored
- [ ] SSL certificates renewed (automatic)
- [ ] Security patches applied promptly
- [ ] Penetration testing (quarterly)
- [ ] Security training for team (annual)

---

## Security Incident Response

### Detection

1. **Monitor security alerts:**
   - Failed authentication attempts
   - Suspicious IP addresses
   - Unusual API usage patterns
   - Security scan failures

2. **Automated responses:**
   - Temporary IP blocking
   - API key suspension
   - Alert notifications

### Response

1. **Contain the incident:**
   - Block affected IP/API key
   - Rotate compromised credentials
   - Isolate affected systems

2. **Investigate:**
   - Review audit logs
   - Check for data access
   - Identify vulnerability

3. **Remediate:**
   - Patch vulnerability
   - Update systems
   - Reset credentials

4. **Document:**
   - Timeline of events
   - Actions taken
   - Lessons learned

---

**Document Version**: 1.0
**Last Updated**: 2025-11-07
**Next Review**: 2025-12-07
