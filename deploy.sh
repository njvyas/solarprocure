#!/bin/bash
# =============================================================
# eProcurement System — On-Premise Deployment Script
# Tested on: Ubuntu 22.04 LTS / Debian 12
# Run as: sudo bash deploy.sh [--domain yourdomain.com] [--env prod|dev]
# =============================================================
set -euo pipefail

# ── Config ────────────────────────────────────────────────────
APP_DIR="/opt/eprocurement"
APP_USER="eprocure"
DOMAIN="${DOMAIN:-localhost}"
ENV="${ENV:-prod}"
COMPOSE_VERSION="2.24.0"
NODE_VERSION="20"
POSTGRES_VERSION="16"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
info() { echo -e "${YELLOW}▶ $1${NC}"; }
die()  { echo -e "${RED}  ✗ FATAL: $1${NC}"; exit 1; }

# ── Parse args ────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --domain) DOMAIN="$2"; shift 2 ;;
    --env)    ENV="$2";    shift 2 ;;
    *) shift ;;
  esac
done

echo ""
echo "============================================================"
echo "  eProcurement System — Deployment"
echo "  Domain: $DOMAIN | Mode: $ENV"
echo "============================================================"
echo ""

# ── Root check ────────────────────────────────────────────────
[ "$EUID" -eq 0 ] || die "Run as root: sudo bash deploy.sh"

# ── OS detection ──────────────────────────────────────────────
. /etc/os-release
info "OS: $PRETTY_NAME"
if [[ "$ID" != "ubuntu" && "$ID" != "debian" && "$ID" != "rhel" && "$ID" != "centos" ]]; then
  echo "  Warning: untested OS. Proceeding anyway."
fi

# ── Generate secrets ──────────────────────────────────────────
info "Generating secrets"
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -hex 16)
ok "Secrets generated"

# ── Install Docker ────────────────────────────────────────────
info "Checking Docker"
if ! command -v docker &>/dev/null; then
  info "Installing Docker"
  if [[ "$ID" == "ubuntu" || "$ID" == "debian" ]]; then
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/$ID/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/$ID $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  elif [[ "$ID" == "rhel" || "$ID" == "centos" || "$ID" == "rocky" ]]; then
    yum install -y -q yum-utils
    yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    yum install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable --now docker
  fi
  ok "Docker installed"
else
  ok "Docker already installed: $(docker --version | cut -d' ' -f3)"
fi

# Docker Compose v2 check
if ! docker compose version &>/dev/null; then
  info "Installing Docker Compose plugin"
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -fsSL "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  ok "Docker Compose installed"
else
  ok "Docker Compose: $(docker compose version --short)"
fi

# ── System packages ───────────────────────────────────────────
info "Installing system packages"
if [[ "$ID" == "ubuntu" || "$ID" == "debian" ]]; then
  apt-get install -y -qq \
    postgresql-client \
    nginx \
    certbot python3-certbot-nginx \
    ufw \
    fail2ban \
    logrotate \
    curl \
    wget \
    jq \
    cron \
    openssl \
    git 2>/dev/null || true
elif [[ "$ID" == "rhel" || "$ID" == "centos" || "$ID" == "rocky" ]]; then
  yum install -y -q postgresql nginx certbot python3-certbot-nginx firewalld fail2ban curl jq cronie openssl git 2>/dev/null || true
fi
ok "System packages installed"

# ── Create app user ───────────────────────────────────────────
info "Creating app user: $APP_USER"
if ! id "$APP_USER" &>/dev/null; then
  useradd --system --create-home --shell /bin/bash "$APP_USER"
  usermod -aG docker "$APP_USER"
fi
ok "App user ready"

# ── Create app directory ──────────────────────────────────────
info "Setting up app directory: $APP_DIR"
mkdir -p "$APP_DIR"/{logs,backups,uploads,nginx,ssl,scripts}
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
ok "Directories created"

# ── Write .env file ───────────────────────────────────────────
info "Writing environment file"
AI_ENC_KEY=$(openssl rand -hex 32)
cat > "$APP_DIR/.env" << ENVFILE
# eProcurement — Generated $(date -Iseconds)
# DO NOT COMMIT THIS FILE

NODE_ENV=production
PORT=4000

DATABASE_URL=postgresql://eprocure_user:${DB_PASSWORD}@postgres:5432/eprocure
REDIS_URL=redis://redis:6379

JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Separate key for encrypting stored AI provider API keys
# Rotating JWT_SECRET will NOT invalidate stored AI keys
AI_ENCRYPTION_KEY=${AI_ENC_KEY}

BCRYPT_ROUNDS=12

UPLOAD_DIR=/app/uploads
BACKUP_DIR=/app/backups
BACKUP_RETENTION_DAYS=30
MAX_FILE_SIZE=10485760

CORS_ORIGINS=http://${DOMAIN},https://${DOMAIN}
APP_URL=https://${DOMAIN}

# Database credentials (also used by postgres container)
POSTGRES_DB=eprocure
POSTGRES_USER=eprocure_user
POSTGRES_PASSWORD=${DB_PASSWORD}

LOG_LEVEL=info

# ── SMTP Email (configure via Admin UI → System Settings → Email) ──────────
# These are bootstrap values. After first login, manage via Admin UI.
# Leave blank to disable email — configure in Admin UI after setup.
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM_NAME=SolarProcure
SMTP_FROM_EMAIL=
ENVFILE
chmod 600 "$APP_DIR/.env"
ok "Environment file written"

# ── Write production docker-compose ──────────────────────────
info "Writing production docker-compose.yml"
cat > "$APP_DIR/docker-compose.yml" << 'DCFILE'
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: eprocure_db
    restart: unless-stopped
    env_file: .env
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/schema.sql:/docker-entrypoint-initdb.d/01_schema.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [internal]
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

  redis:
    image: redis:7-alpine
    container_name: eprocure_redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [internal]
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: eprocure_backend
    restart: unless-stopped
    env_file: .env
    volumes:
      - uploads_data:/app/uploads
      - backups_data:/app/backups
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks: [internal]
    logging:
      driver: json-file
      options: { max-size: "50m", max-file: "5" }

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
      args:
        VITE_API_URL: /api
    container_name: eprocure_frontend
    restart: unless-stopped
    networks: [internal]
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

networks:
  internal:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  uploads_data:
  backups_data:
DCFILE
ok "Production docker-compose written"

# ── Write production frontend Dockerfile ──────────────────────
info "Writing production frontend Dockerfile"
cat > "$APP_DIR/frontend/Dockerfile.prod" << 'DOCKERFILE'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
DOCKERFILE

# SPA nginx config for frontend container
cat > "$APP_DIR/frontend/nginx-spa.conf" << 'NGINXSPA'
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINXSPA
ok "Frontend production build files written"

# ── Write nginx reverse proxy config ─────────────────────────
info "Writing nginx reverse proxy config"
cat > "/etc/nginx/sites-available/eprocurement" << NGINXCONF
# eProcurement nginx config — $(date +%Y-%m-%d)

upstream eprocure_backend {
    server 127.0.0.1:4000;
    keepalive 32;
}

upstream eprocure_frontend {
    server 127.0.0.1:3000;
    keepalive 16;
}

server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    client_max_body_size 20M;

    # API proxy
    location /api/ {
        proxy_pass http://eprocure_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 90s;
        proxy_connect_timeout 10s;
    }

    # Frontend SPA
    location / {
        proxy_pass http://eprocure_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Health check (bypass auth for monitoring)
    location /health {
        proxy_pass http://eprocure_backend/api/health;
    }

    # Block hidden files
    location ~ /\. {
        deny all;
        return 404;
    }
}
NGINXCONF

# Enable site
if [[ -d /etc/nginx/sites-enabled ]]; then
  ln -sfn /etc/nginx/sites-available/eprocurement /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
fi
nginx -t && ok "Nginx config valid" || die "Nginx config invalid"

# ── Firewall ──────────────────────────────────────────────────
info "Configuring firewall"
if command -v ufw &>/dev/null; then
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow ssh
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  ok "UFW firewall configured (ssh + http + https)"
elif command -v firewall-cmd &>/dev/null; then
  firewall-cmd --permanent --add-service=ssh
  firewall-cmd --permanent --add-service=http
  firewall-cmd --permanent --add-service=https
  firewall-cmd --reload
  ok "firewalld configured"
fi

# ── fail2ban ──────────────────────────────────────────────────
info "Configuring fail2ban"
cat > /etc/fail2ban/jail.d/eprocurement.conf << 'F2B'
[nginx-req-limit]
enabled  = true
filter   = nginx-req-limit
logpath  = /var/log/nginx/error.log
maxretry = 10
findtime = 600
bantime  = 3600

[nginx-http-auth]
enabled = true
maxretry = 5
F2B
systemctl enable fail2ban --now 2>/dev/null || true
ok "fail2ban configured"

# ── Logrotate ─────────────────────────────────────────────────
cat > /etc/logrotate.d/eprocurement << 'LOGROTATE'
/opt/eprocurement/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 eprocure eprocure
    sharedscripts
    postrotate
        docker kill --signal=USR1 eprocure_backend 2>/dev/null || true
    endscript
}
LOGROTATE
ok "Logrotate configured"

# ── Cron: daily backup + health check ────────────────────────
info "Installing cron jobs"
cat > /etc/cron.d/eprocurement << CRONFILE
# eProcurement cron jobs
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Health check every 5 minutes — restart if unhealthy
*/5 * * * * root /opt/eprocurement/scripts/healthcheck.sh >> /opt/eprocurement/logs/healthcheck.log 2>&1

# Weekly DB vacuum
0 3 * * 0 root docker exec eprocure_db psql -U eprocure_user -d eprocure -c "VACUUM ANALYZE;" >> /opt/eprocurement/logs/maintenance.log 2>&1

# Clean old Docker images monthly
0 4 1 * * root docker image prune -f >> /opt/eprocurement/logs/maintenance.log 2>&1
CRONFILE
ok "Cron jobs installed"

# ── Health check script ───────────────────────────────────────
cat > "$APP_DIR/scripts/healthcheck.sh" << 'HCSCRIPT'
#!/bin/bash
STATUS=$(curl -sf http://localhost/health | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "down")
if [ "$STATUS" != "healthy" ]; then
    echo "$(date): Health check FAILED (status=$STATUS) — restarting backend"
    cd /opt/eprocurement && docker compose restart backend
fi
HCSCRIPT
chmod +x "$APP_DIR/scripts/healthcheck.sh"
ok "Health check script installed"

# ── SSL (Let's Encrypt) ───────────────────────────────────────
if [ "$DOMAIN" != "localhost" ] && [ "$ENV" = "prod" ]; then
  info "Obtaining SSL certificate for $DOMAIN"
  systemctl start nginx
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
    --non-interactive --agree-tos \
    --email "admin@${DOMAIN}" \
    --redirect \
    && ok "SSL certificate obtained" \
    || echo "  Warning: SSL failed — proceeding with HTTP. Run: certbot --nginx -d $DOMAIN"

  # Auto-renew
  cat > /etc/cron.d/certbot-renew << 'CERTBOT'
0 3 * * * root certbot renew --quiet --post-hook "systemctl reload nginx"
CERTBOT
fi

# ── Build and start ───────────────────────────────────────────
info "Building and starting containers"
cd "$APP_DIR"

# Copy application files if this script is run from the source dir
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "$SCRIPT_DIR/backend" ] && [ "$SCRIPT_DIR" != "$APP_DIR" ]; then
  info "Copying application files to $APP_DIR"
  cp -r "$SCRIPT_DIR/backend" "$APP_DIR/"
  cp -r "$SCRIPT_DIR/frontend" "$APP_DIR/"
  cp -r "$SCRIPT_DIR/scripts" "$APP_DIR/"
  chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
  ok "Files copied"
fi

# Build images
docker compose build --no-cache
ok "Docker images built"

# Start services
docker compose up -d
ok "Services started"

# Wait for healthy
info "Waiting for services to be healthy (up to 120s)..."
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  HEALTH=$(curl -sf http://localhost:4000/api/health 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
  if [ "$HEALTH" = "healthy" ]; then
    ok "API is healthy"
    break
  fi
  sleep 5
  ELAPSED=$((ELAPSED+5))
  echo "  Waiting... ($ELAPSED/$TIMEOUT)"
done
[ $ELAPSED -ge $TIMEOUT ] && echo "  Warning: health check timed out — check logs with: docker compose logs backend"

# ── Start nginx ───────────────────────────────────────────────
systemctl enable nginx
systemctl reload nginx || systemctl start nginx
ok "Nginx started"

# ── Post-install info ─────────────────────────────────────────
echo ""
echo "============================================================"
echo -e "${GREEN}  DEPLOYMENT COMPLETE${NC}"
echo "============================================================"
echo ""
echo "  URL:          http://${DOMAIN}  (HTTPS if cert was obtained)"
echo "  API health:   http://${DOMAIN}/health"
echo "  App dir:      $APP_DIR"
echo "  Logs:         docker compose -f $APP_DIR/docker-compose.yml logs -f"
echo "  Restart:      cd $APP_DIR && docker compose restart"
echo "  Stop:         cd $APP_DIR && docker compose down"
echo ""
echo "  Demo credentials:"
echo "    Org: alendei-green"
echo "    Email: admin@alendei-green.com"
echo "    Password: Admin@1234"
echo ""
echo "  !! CHANGE ALL PASSWORDS AFTER FIRST LOGIN !!"
echo "  Secrets saved to: $APP_DIR/.env"
echo ""
echo "  Integration test:"
echo "    BASE=http://${DOMAIN} ./scripts/validate_all_stages.sh"
echo ""
