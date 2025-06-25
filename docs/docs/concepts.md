---
sidebar_position: 3
---

# Key Concepts

Understanding these core concepts will help you get the most out of Dribble and work more efficiently with your databases.

## Data Sources

**Data Sources** are your database connections. Each source represents a connection to a specific database (PostgreSQL, MySQL, etc.).

- **Isolation**: Each source runs in its own isolated worker container for security and performance
- **Multiple Sources**: Connect to as many databases as you need from one interface
- **Schema Discovery**: Dribble automatically discovers and displays your database structure
- **Connection Management**: Sources can be added, edited, or removed as needed

## Queries

Queries are first-class citizens in Dribble - they're not just text, but managed entities with rich features.

### Query Lifecycle
- **Creation**: Start with a new query or duplicate an existing one
- **Editing**: Write SQL with intelligent auto-completion
- **Execution**: Run queries with a single click or keyboard shortcut
- **Saving**: Queries are automatically saved as you type

### Query Organization
- **Naming**: Give your queries descriptive names for easy organization
- **Folders**: Group related queries together (coming soon)
- **Search**: Quickly find queries by name or content

## Query Versions

Every time you make significant changes to a query, Dribble automatically creates a new version.

- **Version History**: See all previous versions of your query
- **Compare Changes**: View differences between versions
- **Restore**: Roll back to any previous version
- **Branching**: Experiment with changes without losing your original

## Query Runs

Every query execution is logged as a "query run" - giving you complete visibility into your query history.

### What's Tracked
- **Execution Time**: How long the query took to run
- **Row Count**: Number of rows returned
- **Timestamp**: When the query was executed  
- **Status**: Success, error, or cancelled
- **Results**: The actual data returned (for recent runs)

### Benefits
- **Performance Monitoring**: Track query performance over time
- **Debugging**: Understand why queries might be slow
- **Audit Trail**: See who ran what queries and when
- **Result Caching**: Quickly access recent query results

## AI Assistant

The AI assistant is your intelligent SQL companion, integrated directly into Dribble.

### Context-Aware Help
- **Schema Knowledge**: The AI knows your database structure
- **Query Context**: Understands the query you're currently working on
- **Historical Context**: Learns from your previous queries and conversations

### What the AI Can Do
- **Write Queries**: Generate SQL based on natural language descriptions
- **Optimize Performance**: Suggest improvements for slow queries
- **Explain Code**: Break down complex queries in plain English
- **Debug Errors**: Help identify and fix SQL syntax or logic issues
- **Data Exploration**: Suggest interesting queries based on your schema

## File Tree Navigation

The left sidebar shows your database structure in an intuitive file tree format.

### Structure
- **Sources**: Top-level database connections
- **Schemas**: Database schemas (for PostgreSQL)
- **Tables**: Regular database tables
- **Views**: Database views
- **Functions**: Stored procedures and functions
- **Other Objects**: Triggers, indexes, etc.

### Interactions
- **Click to Explore**: Click any object to see its structure
- **Quick Insert**: Double-click table names to insert into your query
- **Context Menus**: Right-click for additional actions
- **Search**: Find specific tables or columns quickly

## Query Tabs

Work with multiple queries simultaneously using the tab system.

- **Multiple Tabs**: Keep several queries open at once
- **Tab Management**: Create, rename, close, and reorder tabs
- **Auto-Save**: Each tab saves its state automatically
- **Context Switching**: Quickly switch between different queries

## Results Table

Query results are displayed in a powerful, spreadsheet-like table.

### Features
- **Large Dataset Support**: Handle thousands of rows smoothly
- **Sorting**: Click column headers to sort data
- **Filtering**: Filter rows based on column values
- **Export**: Copy data or export to CSV
- **Cell Navigation**: Use keyboard shortcuts to navigate efficiently

## LLM Settings

Configure how the AI assistant behaves and which language model it uses.

- **Model Selection**: Choose from different AI models
- **API Configuration**: Set up your own AI service credentials
- **Behavior Settings**: Adjust how verbose or conservative the AI should be
- **Context Limits**: Control how much information the AI considers

## Workers

Behind the scenes, Dribble uses isolated "worker" containers to execute your queries.

- **Per-Source Workers**: Each database connection gets its own worker
- **Isolation**: Workers run in separate containers for security
- **Scalability**: Workers can be distributed across multiple machines
- **Health Monitoring**: Dribble monitors worker health and restarts them if needed

## Understanding the Interface

The Dribble interface is organized into several key areas:

1. **Left Sidebar**: Sources, Queries tabs, and file tree navigation
2. **Main Editor**: SQL query editor with syntax highlighting
3. **Query Tabs**: Manage multiple open queries
4. **Results Area**: View query results and execution details
5. **Right Sidebar**: AI chat assistant
6. **Status Bar**: Connection status, query statistics, and shortcuts

Now that you understand these concepts, you're ready to dive into [Using the App](./using-the-app) for a complete feature walkthrough!