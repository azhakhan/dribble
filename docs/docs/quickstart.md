---
sidebar_position: 2
---

# Quickstart Guide

Get Dribble up and running in just a few minutes! This guide will walk you through installation and your first database connection.

## Prerequisites

Before you start, make sure you have:

- [Docker](https://www.docker.com/) installed and running
- [Just](https://github.com/casey/just) command runner installed
- A database you want to connect to (PostgreSQL or MySQL)

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/azhakhan/dribble.git
   cd dribble
   ```

2. **Start Dribble**

   ```bash
   just start
   ```

   This command will:

   - Create the necessary Docker network
   - Build all required images automatically
   - Start the complete application stack

3. **Access the application**
   - **Dribble UI**: http://localhost:3000
   - **API Server**: http://localhost:8000

That's it! Dribble is now running locally.

## Your First Database Connection

Once Dribble is running, let's connect to your first database:

### Step 1: Add a Data Source

1. Click the **"Add Source"** button in the left sidebar
2. Fill in your database details:

   - **Name**: Give your connection a friendly name
   - **Type**: Select PostgreSQL or MySQL
   - **Host**: Your database server (e.g., `localhost`)
   - **Port**: Database port (usually 5432 for PostgreSQL, 3306 for MySQL)
   - **Database**: Name of the database to connect to
   - **Username & Password**: Your database credentials

3. Click **"Test Connection"** to verify everything works
4. Click **"Save"** to add the source

### Step 2: Explore Your Data

Once connected, you'll see:

- Your database appears in the **Sources** tab on the left
- Expand it to see tables, views, and other database objects
- Expand on any table to see its structure
- Double-click to loads its data

### Step 3: Write Your First Query

1. Click the **"+"** button to create a new query
2. Start typing SQL in the editor - you'll get auto-completion!
3. Try this simple query:
   ```sql
   SELECT * FROM your_table_name LIMIT 10;
   ```
4. Click **"Run"** or press `Ctrl+Enter`/`command+Enter` to execute
5. See your results in the table below the editor

### Step 4: Get AI Help

1. Click the **chat icon** on the right to open the AI assistant
2. Ask questions like:
   - "Show me all customers from New York"
   - "Help me optimize this slow query"
   - "Create a query to find the top 10 products by sales"
3. The AI understands your database structure and can write contextual queries!

## What's Next?

Now that you're up and running:

- **[Learn Key Concepts](./concepts)** - Understand how Dribble works
- **[Explore All Features](./using-the-app)** - Complete walkthrough of the interface
- **Save and organize queries** using the query management features
- **Set up additional data sources** to work across multiple databases

## Troubleshooting

**Can't access localhost:3000?**

- Make sure Docker is running
- Check if ports 3000 and 8000 are available
- Run `just down` then `just start` to restart

**Database connection fails?**

- Verify your database is running and accessible
- Check firewall settings
- Ensure credentials are correct
- For Docker databases, use `host.docker.internal` instead of `localhost`

**Need to stop Dribble?**

```bash
just down
```

Still having issues? Check our [troubleshooting section](./troubleshooting) or [open an issue](https://github.com/azhakhan/dribble/issues).
