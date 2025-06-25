---
sidebar_position: 7
---

# Troubleshooting

Common issues and solutions when working with Dribble. If you don't find your issue here, please [open an issue](https://github.com/azhakhan/dribble/issues) on GitHub.

## Installation and Setup Issues

### Docker-related Problems

**Error: Cannot connect to the Docker daemon**

```bash
docker: Cannot connect to the Docker daemon at unix:///var/run/docker.sock
```

**Solutions:**

- Make sure Docker Desktop is running
- On Linux, ensure your user is in the `docker` group: `sudo usermod -aG docker $USER`
- Restart your terminal session after adding to docker group

**Error: Port already in use**

```bash
Error: bind: address already in use
```

**Solutions:**

- Check what's using the ports: `lsof -i :3000` and `lsof -i :8000`
- Stop conflicting services or use different ports
- Modify `docker-compose.yml` to use different ports

**Error: Network already exists**

```bash
Error response from daemon: network with name dribble-network already exists
```

**Solutions:**

- This is usually harmless - Dribble will use the existing network
- If you want to reset: `docker network rm dribble-network`

### Just Command Issues

**Error: `just` command not found**

**Solutions:**

- Install Just: `cargo install just` (if you have Rust)
- Or use package manager: `brew install just` (macOS) or `apt install just` (Ubuntu)
- Or download from [Just releases](https://github.com/casey/just/releases)

**Error: Permission denied when running just commands**

**Solutions:**

- Make sure Docker is running and you have permissions
- On Linux, add your user to the docker group
- Try running with `sudo` (not recommended for regular use)

## Connection Issues

### Database Connection Problems

**Error: Connection refused**

```
psycopg2.OperationalError: could not connect to server: Connection refused
```

**Solutions:**

- Verify database server is running
- Check host and port settings
- For local databases in Docker, use `host.docker.internal` instead of `localhost`
- Check firewall settings
- Verify network connectivity: `telnet your-db-host 5432`

**Error: Authentication failed**

```
psycopg2.OperationalError: FATAL: password authentication failed
```

**Solutions:**

- Double-check username and password
- Verify database user exists and has necessary permissions
- Check if database requires SSL connection
- Try connecting with a different database client to verify credentials

**Error: Database does not exist**

```
psycopg2.OperationalError: FATAL: database "mydb" does not exist
```

**Solutions:**

- Verify database name is correct (case-sensitive)
- Create the database if it doesn't exist
- Check if you have permission to access the database

### Network and Connectivity

**Error: Cannot reach Dribble at localhost:3000**

**Solutions:**

- Verify Docker containers are running: `docker ps`
- Check if containers are healthy: `docker compose ps`
- Restart the stack: `just down && just start`
- Check browser console for JavaScript errors

**Error: API calls failing with CORS errors**

**Solutions:**

- This usually indicates frontend/backend version mismatch
- Restart both client and server containers
- Check that both are running on expected ports

## Query Execution Issues

### Performance Problems

**Query runs very slowly**

**Solutions:**

- Add `LIMIT` clause to large queries for testing
- Check if appropriate indexes exist on filtered columns
- Use `EXPLAIN` to analyze query execution plan
- Ask the AI assistant for optimization suggestions

**Query seems to hang indefinitely**

**Solutions:**

- Click the "Cancel" button to stop the query
- Check database server logs for deadlocks or blocking
- Verify query syntax is correct
- Try a simpler version of the query first

### Error Messages

**Error: Syntax error in SQL**

```
ERROR: syntax error at or near "SELECT"
```

**Solutions:**

- Use the AI assistant to explain the error
- Check for missing semicolons or quotes
- Verify table and column names exist
- Check SQL dialect compatibility (PostgreSQL vs MySQL)

**Error: Permission denied**

```
ERROR: permission denied for table users
```

**Solutions:**

- Verify database user has SELECT permissions
- Check if table exists in the correct schema
- Contact database administrator for permission grants

**Error: Worker unavailable**

```
Worker for source 'mydb' is not available
```

**Solutions:**

- Wait a few seconds and try again (worker may be starting)
- Restart Dribble: `just down && just start`
- Check Docker logs: `docker logs <worker-container-name>`
- Verify source configuration is correct

## Interface and UI Issues

### Editor Problems

**Monaco editor not loading**

**Solutions:**

- Check browser console for JavaScript errors
- Clear browser cache and reload
- Try a different browser
- Ensure you have a stable internet connection

**Auto-completion not working**

**Solutions:**

- Verify you're connected to a data source
- Wait for schema loading to complete
- Refresh the page
- Check if source connection is active

### Results Display Issues

**Results table not showing data**

**Solutions:**

- Check if query actually returned results
- Look for error messages in the query execution panel
- Verify data types are supported
- Try a simpler query like `SELECT 1`

**Table performance issues with large results**

**Solutions:**

- Add `LIMIT` clause to reduce result size
- Use pagination controls at bottom of results
- Consider filtering data at the database level

### AI Assistant Problems

**Chat not responding**

**Solutions:**

- Check LLM configuration in settings
- Verify API keys are configured correctly
- Check browser console for errors
- Try refreshing the page

**AI responses are not relevant**

**Solutions:**

- Be more specific in your questions
- Provide context about what you're trying to achieve
- Check that the correct data source is selected
- Verify database schema information is available

## Data and State Issues

### Lost Work

**Queries disappeared after browser refresh**

**Solutions:**

- Check if queries were saved (look for unsaved changes indicator)
- Look in browser's local storage/developer tools
- Check if you were working with ephemeral queries
- Consider implementing regular saves as a workflow

**Query results lost**

**Solutions:**

- Re-run the query to get fresh results
- Check query run history for recent executions
- Export important results immediately after running queries

### Synchronization Issues

**Interface state seems inconsistent**

**Solutions:**

- Refresh the browser page
- Check browser console for errors
- Clear browser cache
- Try logging out and back in (if authentication is enabled)

## Performance Issues

### Slow Application Performance

**Dribble feels sluggish**

**Solutions:**

- Close unused query tabs
- Clear browser cache
- Check available system memory
- Restart Docker containers: `just down && just start`

**High CPU or memory usage**

**Solutions:**

- Limit the number of concurrent queries
- Reduce result set sizes with LIMIT clauses
- Monitor Docker container resource usage
- Consider allocating more resources to Docker

## Logging and Debugging

### Getting More Information

**Enable verbose logging**

For the server:

```bash
# Set log level in docker-compose.yml
environment:
  - LOG_LEVEL=DEBUG
```

For the client:

- Open browser developer tools
- Check Console and Network tabs
- Enable verbose logging in browser

**Check container logs**

```bash
# View all logs
docker compose logs

# View specific service logs
docker compose logs server
docker compose logs client

# Follow logs in real-time
docker compose logs -f
```

### Common Log Messages

**"Worker health check failed"**

- Worker container is not responding
- Restart the specific worker or full stack

**"Database connection pool exhausted"**

- Too many concurrent connections
- Increase connection pool size or reduce concurrent queries

**"Query execution timeout"**

- Query took too long to execute
- Add timeouts to long-running queries
- Optimize query performance

## Getting Help

If you're still having issues:

1. **Check the logs** using commands above
2. **Search existing issues** on GitHub
3. **Create a detailed issue** including:
   - Steps to reproduce the problem
   - Error messages and logs
   - Browser and system information
   - Docker and database versions
4. **Ask the community** for help

### Useful Information to Include

When reporting issues, include:

- Operating system and version
- Docker version: `docker --version`
- Browser version (if UI-related)
- Database type and version
- Dribble version/commit hash
- Complete error messages and stack traces
- Steps to reproduce the issue

This helps maintainers diagnose and fix issues quickly!
