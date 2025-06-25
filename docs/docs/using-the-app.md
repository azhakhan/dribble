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
2. Choose your database type (PostgreSQL, MySQL)
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
- **Reconnect**: Click a disconnected source to reconnect

## Exploring Database Structure

The file tree shows your database structure in an intuitive, expandable format.

### Navigation

- **Expand/Collapse**: Click arrows to explore database objects
- **Quick Info**: Hover over items to see additional details
- **Context Menu**: Right-click for actions like "View Data" or "Generate Query"

### Understanding Icons

- 🗄️ **Database**: Top-level database/schema
- 📋 **Table**: Regular data table
- 👁️ **View**: Database view
- ⚙️ **Function**: Stored procedure or function
- 🔑 **Index**: Database index

### Working with Tables

Click on any table to:
- See column definitions and data types
- View sample data
- Generate common queries (SELECT, INSERT, UPDATE)
- Analyze table relationships

## Writing and Managing Queries

Queries are at the heart of Dribble. Here's how to work with them effectively.

### Creating Queries

**New Query**: Click the **"+"** button in the query tabs
**From Template**: Right-click a table and select "Generate Query"
**Duplicate**: Right-click an existing query tab and select "Duplicate"

### The SQL Editor

The editor provides a rich SQL authoring experience:

**Syntax Highlighting**: SQL keywords, strings, and comments are color-coded
**Auto-completion**: 
- Type table names for intelligent suggestions
- Column names appear when you reference tables
- SQL keywords complete automatically

**Keyboard Shortcuts**:
- `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac): Run query
- `Ctrl+/`: Comment/uncomment lines
- `Ctrl+D`: Duplicate current line
- `F1`: Open command palette

### Query Execution

**Run Button**: Click the play button to execute your query
**Keyboard Shortcut**: Use `Ctrl+Enter` for quick execution
**Partial Execution**: Select specific lines to run only that portion
**Cancel**: Click stop button to cancel long-running queries

### Query Tabs

Work with multiple queries using the tab system:

**Tab Management**:
- Create new tabs with the **"+"** button
- Close tabs with the **"×"** button
- Reorder by dragging tabs
- Right-click for options (rename, duplicate, close others)

**Auto-Save**: Queries save automatically as you type
**Dirty Indicator**: Unsaved changes show with a dot on the tab
**Tab Overflow**: Scroll through tabs when you have many open

## Working with Query Results

Query results appear in a powerful table below the editor.

### Table Features

**Sorting**: Click any column header to sort data
**Filtering**: Use the filter row to narrow down results
**Column Resize**: Drag column borders to adjust width
**Row Selection**: Click row numbers to select entire rows

### Result Actions

**Export Data**:
- Copy selected cells to clipboard
- Export all results to CSV
- Copy as SQL INSERT statements

**Pagination**: 
- Navigate large result sets with page controls
- Adjust page size (10, 50, 100, 500 rows)
- Jump to specific pages

**Cell Navigation**:
- Arrow keys to move between cells
- `Tab` to move to next cell
- `Enter` to move to next row

## Query History and Runs

Every query execution is tracked, giving you complete visibility.

### Viewing Run History

1. Click **"All Runs"** at the bottom of the screen
2. See all your recent query executions
3. Filter by date, duration, or status
4. Click any run to see full details

### Run Details

For each query run, you can see:
- **Execution Time**: Total time to complete
- **Row Count**: Number of rows returned
- **Status**: Success, error, or cancelled
- **Query SQL**: The exact SQL that was executed
- **Error Details**: Full error messages for failed queries

### Performance Monitoring

Use run history to:
- Identify slow queries that need optimization
- Track performance improvements over time
- Understand query patterns and usage
- Debug issues with failed executions

## Version Control for Queries

Dribble automatically versions your queries as you make changes.

### Viewing Versions

1. Click the **version number** next to your query name
2. See a list of all saved versions
3. Compare changes between versions
4. View when each version was created

### Working with Versions

**Restore**: Click any version to restore it as the current query
**Compare**: See differences between any two versions
**Branching**: Create experimental versions without losing your original

### Auto-Versioning

Dribble creates new versions when:
- You make significant changes to a query
- You haven't modified the query in a while
- You explicitly save a version

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
- Query execution results

### Chat Features

**Message History**: Scroll up to see previous conversations
**Copy Responses**: Click to copy SQL queries or explanations
**Clear Chat**: Start fresh conversations when needed
**Context Indicators**: See what information the AI is using

## LLM and AI Settings

Configure how the AI assistant behaves to match your preferences.

### Accessing Settings

1. Click the **settings icon** (gear) in the top navigation
2. Navigate to the **"LLM"** or **"AI"** section
3. Modify settings as needed
4. Changes apply immediately

### Available Settings

**Model Selection**:
- Choose between different AI models
- Balance between speed and capability
- Some models may require API keys

**Behavior Settings**:
- **Verbosity**: How detailed should responses be?
- **Conservativeness**: Should the AI be cautious with suggestions?
- **Code Style**: Prefer specific SQL formatting or patterns

**Context Settings**:
- **Schema Depth**: How much database structure to include
- **History Length**: How many previous messages to remember
- **Query Context**: Should the AI see your current query?

## Advanced Query Features

Take your SQL skills to the next level with these advanced features.

### Query Parameters

Create reusable queries with parameters:
```sql
SELECT * FROM orders 
WHERE created_date >= {{ start_date }}
  AND created_date <= {{ end_date }}
```

### Saved Query Libraries

Organize your most-used queries:
- **Favorites**: Star important queries for quick access
- **Categories**: Group queries by function or department
- **Sharing**: Share query templates with teammates (coming soon)


## Performance Tips

Get the most out of Dribble with these performance tips:

### Query Optimization

- Use **LIMIT** for exploratory queries
- **Index** frequently filtered columns
- **Explain** query plans for slow queries
- **Batch** multiple operations when possible

### Interface Efficiency

- Learn **keyboard shortcuts** for common actions
- Use **query tabs** to multitask effectively
- **Pin** frequently used sources at the top
- **Filter** the file tree to find objects quickly

### AI Usage

- Be **specific** in your questions to get better answers
- **Iterate** on AI suggestions rather than starting over
- Use the AI to **learn** new SQL techniques
- **Combine** AI suggestions with your domain knowledge

## Troubleshooting Common Issues

### Connection Problems

**Can't connect to database**:
- Verify host, port, and credentials
- Check network access and firewalls
- For Docker databases, use `host.docker.internal`
- Try the "Test Connection" button

### Query Issues

**Query runs forever**:
- Click the stop button to cancel
- Add LIMIT clauses to large queries
- Check for missing WHERE clauses
- Consider query optimization

**Syntax errors**:
- Use the AI assistant to explain errors
- Check SQL dialect differences
- Verify table and column names exist

### Performance Issues

**Slow query results**:
- Reduce result set size with LIMIT
- Add appropriate database indexes
- Optimize complex JOINs
- Use the AI for optimization suggestions

**Interface lag**:
- Close unused query tabs
- Clear browser cache
- Check available system memory
- Restart Dribble if needed

## Next Steps

Now that you know how to use all of Dribble's features:

- **[Explore Developer Concepts](./developer-concepts)** if you want to understand the technical architecture
- **[Check the API Reference](./api-reference)** for integration possibilities
- **Practice** with your own databases to become more proficient
- **Share feedback** to help improve Dribble for everyone

Happy querying! 🚀