# Deploying Dribble to Fly.io

## Prerequisites

1. Install [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/)
2. Sign up for [Fly.io account](https://fly.io/app/sign-up)
3. Login: `fly auth login`

## Steps

### 1. Choose unique app names

Replace `YOUR_PREFIX` with something unique (e.g., your username):

- `YOUR_PREFIX-client`
- `YOUR_PREFIX-server`
- `YOUR_PREFIX-worker`
- `YOUR_PREFIX-db`
- `YOUR_PREFIX-redis`

### 2. Create fly.toml files

```bash
sed 's/YOUR_APP_NAME/YOUR_PREFIX/g' client/fly.toml.template > client/fly.toml
sed 's/YOUR_APP_NAME/YOUR_PREFIX/g' server/fly.toml.template > server/fly.toml
sed 's/YOUR_APP_NAME/YOUR_PREFIX/g' worker/fly.toml.template > worker/fly.toml
```

### 3. Create databases

```bash
fly postgres create --name YOUR_PREFIX-db --region ord
fly redis create --name YOUR_PREFIX-redis --region ord
```

Save the connection strings from the output.

### 4. Deploy server

```bash
cd server
fly apps create YOUR_PREFIX-server
fly secrets set \
    DATABASE_URL="postgresql+psycopg://user:pass@host:5432/db" \
    REDIS_URL="redis://user:pass@host:6379" \
    ENCRYPTION_KEY="$(openssl rand -hex 16)" \
    ENCRYPTION_SECRET="$(openssl rand -hex 32)" \
    CLIENT_URL="https://YOUR_PREFIX-client.fly.dev"
fly deploy
cd ..
```

### 5. Deploy worker

```bash
cd worker
fly apps create YOUR_PREFIX-worker
fly secrets set REDIS_URL="redis://user:pass@host:6379"
fly deploy
cd ..
```

### 6. Deploy client

```bash
cd client
fly apps create YOUR_PREFIX-client
fly deploy
cd ..
```

### 7. Verify

- Client: `https://YOUR_PREFIX-client.fly.dev`
- Server: `https://YOUR_PREFIX-server.fly.dev/health`

### 8. Cleanup

```bash
rm client/fly.toml server/fly.toml worker/fly.toml
```

## Useful Commands

```bash
# View logs
fly logs -a YOUR_PREFIX-server

# Check status
fly status -a YOUR_PREFIX-server

# Redeploy
fly deploy -a YOUR_PREFIX-server

# Scale up
fly scale count 2 -a YOUR_PREFIX-server
```
