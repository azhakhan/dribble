---
sidebar_position: 4
---

# Using the App

This guide walks you through every feature of Dribble, helping you become productive quickly and master advanced workflows.

## Interface Overview

Dribble's interface is designed for efficiency, with everything you need at your fingertips:

- **Left Sidebar**: Sources and Queries navigation
- **Main Area**: SQL editor and query tabs
- **Results Panel**: Query output and execution details
- **Right Sidebar**: AI chat assistant
- **Status Bar**: Connection info and quick stats

## Managing Data Sources

Data sources are your gateway to databases. Here's how to work with them effectively.

### Adding a New Source

1. Click **"Add Source"** in the left sidebar
2. Choose your database type (PostgreSQL or MySQL)
3. Enter connection details:
   - **Name**: Friendly name for this connection
   - **Host**: Database server address
   - **Port**: Database port (5432 for PostgreSQL, 3306 for MySQL)
   - **Database**: Database name to connect to
   - **Username/Password**: Your credentials
4. Click **"Test Connection"** to verify
5. Click **"Save"** to add the source

### Managing Sources

- **Edit**: Click the gear icon next to any source to modify settings
- **Delete**: Remove sources you no longer need
- **Connection Status**: Green dot = connected, red = disconnected

## Exploring Database Structure

The file tree shows your database structure in an intuitive, expandable format.

### Navigation

- **Expand/Collapse**: Click arrows to explore database objects
- **Double Click**: Double click to open a table, view or query

### Understanding Icons

- **Database**: Top-level database/schema
- **Schema**: Database schema
- **Tables**: Folder containing tables
- **Views**: Folder containing views

### Working with Tables

Click on any table to:

- See column definitions and data types
- View sample data
- Generate common queries (SELECT, INSERT, UPDATE)

## Writing and Managing Queries

Queries are at the heart of Dribble. Here's how to work with them effectively.

### Creating Queries

- Click the **"+"** button in the query tabs
- Click the **"+"** button in the query tree

### The SQL Editor

The editor provides a rich SQL authoring experience:

**Syntax Highlighting**: SQL keywords, strings, and comments are color-coded
**Auto-completion**:

- Type table names for intelligent suggestions
- Column names appear when you reference tables
- SQL keywords complete automatically

### Query Execution

- **Run Button**: Click the play button to execute your query
- **Keyboard Shortcut**: `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac): Run query

### Query Tabs

Work with multiple queries using the tab system:

**Tab Management**:

- Create new tabs with the **"+"** button
- Close tabs with the **"×"** button
- Right-click for close others option

### Saving Queries

- **Auto-Save**: Queries save automatically when you run them
- **Dirty Indicator**: Unsaved changes show with a dot on the tab

## Working with Query Results

Query results appear in a table above the editor.

**Pagination**:

- Navigate large result sets with page controls
- Adjust page size (10, 50, 100, 500 rows)
- Use arrow keys to navigate between pages

## Query History and Runs

Every query execution is tracked, giving you complete visibility.

### Viewing Run History

1. Click **"All Runs"** at the bottom of the screen
2. See all your recent query executions

### Run Details

For each query run, you can see:

- **Execution Time**: Total time to complete
- **Row Count**: Number of rows returned
- **Status**: Success, error, or cancelled
- **Query SQL**: The exact SQL that was executed
- **Error Details**: Full error messages for failed queries

## Version Control for Queries

Dribble automatically versions your queries as you make changes.

### Viewing Versions

1. Click the **version number** next to your query name
2. See a list of all saved versions
3. Compare changes between versions
4. View when each version was created

### Auto-Versioning

Dribble creates new query versions every time you make changes to a query and save it by either explicitly clicking the save button or by running the query.

## AI Chat Assistant

The AI assistant provides intelligent help right when you need it.

### Opening the Chat

- Click the **chat icon** in the top-right corner
- The chat sidebar will slide out from the right
- Chat history is preserved between sessions

### Types of Help

**Writing Queries**:

- "Show me all orders from last month"
- "Create a query to find duplicate customers"
- "Help me join these tables together"

**Query Optimization**:

- "This query is slow, how can I make it faster?"
- "Should I add an index for this query?"
- "Explain the execution plan"

**Data Exploration**:

- "What are the most popular products?"
- "Show me unusual patterns in this data"
- "Suggest some interesting queries for this database"

**Debugging**:

- "Why is this query returning wrong results?"
- "Fix this syntax error"
- "Explain what this query does"

### AI Context

The AI understands:

- Your current database schema
- The query you're working on
- Previous conversation history

## LLM and AI Settings

Configure how the AI assistant behaves to match your preferences.

### Accessing Settings

1. Click the **settings icon** (gear) in the top navigation
2. Navigate to the **"LLM"** or **"AI"** section
3. Modify settings as needed
4. Changes apply immediately

## Next Steps

Now that you know how to use all of Dribble's features:

- **[Explore Developer Concepts](./developer-concepts)** if you want to understand the technical architecture
- **Practice** with your own databases to become more proficient
- **Share feedback** to help improve Dribble for everyone

Happy querying! 🚀
