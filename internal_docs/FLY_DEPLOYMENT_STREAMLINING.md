# Fly.io Deployment Streamlining

## Overview

Refactored the Fly.io deployment process to eliminate conflicts with local development and remove hardcoded values. This makes the deployment process more maintainable and user-friendly.

## Changes Made

### 1. Separate Development and Production Dockerfiles

**Problem**: Fly.io deployment was overwriting the development Dockerfiles, causing conflicts.

**Solution**: Created separate production-specific Dockerfiles:

- `client/Dockerfile.prod` - Multi-stage build with Nginx for production
- `server/Dockerfile.prod` - Production build with startup script and migrations
- Restored original Dockerfiles for development use

### 2. Template-Based Configuration

**Problem**: fly.toml files contained hardcoded app names like "dribble-client.fly.dev".

**Solution**: Created template files:

- `client/fly.toml.template`
- `server/fly.toml.template`
- `worker/fly.toml.template`

Templates use `YOUR_APP_NAME` placeholder that gets replaced during deployment.

### 3. Dynamic CORS Configuration

**Problem**: Server CORS origins were hardcoded to "https://dribble-client.fly.dev".

**Solution**: Updated `server/app/main.py` to:

- Accept `CLIENT_URL` environment variable
- Fallback to deriving client URL from server app name
- Maintain localhost for development

### 4. Automated Deployment Script

**Problem**: Deployment process was manual and error-prone.

**Solution**: Created `deploy.sh` script that:

- ✅ Validates prerequisites (Fly CLI, authentication)
- ✅ Prompts for unique app name prefix
- ✅ Generates fly.toml files from templates
- ✅ Creates PostgreSQL and Redis databases
- ✅ Generates encryption keys automatically
- ✅ Deploys all applications with proper configuration
- ✅ Runs database migrations
- ✅ Cleans up temporary files

### 5. Consolidated Documentation

**Problem**: Had separate FLY_DEPLOYMENT.md and QUICK_DEPLOY.md files.

**Solution**: Created single `DEPLOYMENT.md` that includes:

- Quick deployment with script
- Manual deployment steps
- Architecture overview
- Troubleshooting guide
- Management commands
- Cost estimation

### 6. Removed Hardcoded Values

**Eliminated**:

- App names in fly.toml files
- CORS origins in server code
- API URLs in client build args
- Database connection strings

**Replaced with**:

- Template-based configuration
- Environment variables
- Dynamic URL generation
- User-provided app prefixes

## File Structure Changes

### Added Files

```
client/Dockerfile.prod          # Production client build
client/fly.toml.template        # Template for client deployment
server/Dockerfile.prod          # Production server build
server/fly.toml.template        # Template for server deployment
worker/fly.toml.template        # Template for worker deployment
deploy.sh                       # Automated deployment script
DEPLOYMENT.md                   # Consolidated deployment guide
```

### Removed Files

```
FLY_DEPLOYMENT.md              # Consolidated into DEPLOYMENT.md
QUICK_DEPLOY.md                # Consolidated into DEPLOYMENT.md
client/fly.toml                # Replaced with template
server/fly.toml                # Replaced with template
worker/fly.toml                # Replaced with template
server/startup.sh              # Moved inline to Dockerfile.prod
```

### Modified Files

```
client/Dockerfile              # Restored to development version
server/Dockerfile              # Restored to development version
server/app/main.py             # Dynamic CORS configuration
```

## Benefits

1. **No Development Conflicts**: Separate production Dockerfiles don't interfere with local development
2. **Reusable**: Anyone can deploy with their own unique app names
3. **Automated**: One-command deployment with `./deploy.sh`
4. **Maintainable**: No hardcoded values to update
5. **Secure**: Automatic encryption key generation
6. **Documented**: Comprehensive deployment guide

## Usage

### Quick Deploy

```bash
./deploy.sh
```

### Manual Deploy

```bash
sed 's/YOUR_APP_NAME/myapp/g' client/fly.toml.template > client/fly.toml
# ... repeat for other templates
# ... follow manual steps in DEPLOYMENT.md
```

## Development Workflow Unchanged

- `docker-compose up` still works for local development
- `client/Dockerfile.dev` used for hot reload in development
- `server/Dockerfile` restored to development-friendly version
- No impact on existing development workflows

## Production Features

- Automatic database migrations on server startup
- Proper health checks for all services
- HTTPS enforcement
- Optimized Docker builds
- Secure secrets management
- Cross-origin resource sharing properly configured

This streamlined approach makes Dribble easier to deploy while maintaining a clean separation between development and production environments.
