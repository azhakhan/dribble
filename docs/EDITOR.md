# SQL Editor and Auto-Complete in Dribble

This document explains how the SQL editor and intelligent auto-complete system works in the dribble web-based database manager.

## Overview

Dribble uses **Monaco Editor** (the same editor that powers VS Code) enhanced with **monaco-sql-languages** to provide a rich SQL editing experience with schema-aware auto-completion, syntax highlighting, and error detection.

### Key Features

- 🎨 **Syntax Highlighting**: Full SQL syntax highlighting for PostgreSQL and MySQL
- 🧠 **Intelligent Auto-Complete**: Schema-aware suggestions for tables, columns, and views
- 🔍 **Error Detection**: Real-time SQL syntax validation
- ⚡ **Performance Optimized**: Efficient completion system with limited suggestions
- 🌙 **Dark Theme**: Integrated VS Code dark theme
- 📱 **Responsive Design**: Adapts to different screen sizes

## Architecture

### Core Components

1. **MonacoSQLEditor Component** (`client/src/features/editor/MonacoSQLEditor.tsx`)

   - React wrapper around Monaco Editor
   - Handles editor initialization and configuration
   - Manages auto-complete providers

2. **Monaco Setup** (`client/src/shared/lib/monaco-setup.ts`)

   - Configures Monaco workers for SQL languages
   - Sets up language contributions
   - Provides worker environment configuration

3. **Schema Integration** (`client/src/shared/store/useAppStore.ts`)
   - Connects editor to database schema data
   - Provides real-time schema updates
   - Manages source selection state

### Language Support

Currently supported SQL dialects:

- **PostgreSQL** (`LanguageIdEnum.PG`)
- **MySQL** (`LanguageIdEnum.MYSQL`)

## Auto-Complete System

### Schema-Aware Completions

The auto-complete system provides intelligent suggestions based on the selected data source's schema:

#### Table Completions

```sql
SELECT * FROM act  -- suggests: actor, actor_info
```

- **Source**: All tables from connected database schemas
- **Display**: Table name with schema context
- **Icon**: Class icon (📋)
- **Detail**: `table (schema_name)`

#### Column Completions

```sql
SELECT first_n  -- suggests: first_name, first_update
```

- **Source**: Columns from all tables in the schema
- **Display**: Column name with type and table context
- **Icon**: Field icon (🔢)
- **Detail**: `column (data_type) - table_name`
- **Optimization**: Limited to 5 columns per table to prevent performance issues

#### View Completions

```sql
SELECT * FROM customer_  -- suggests: customer_list, customer_view
```

- **Source**: All views from connected database schemas
- **Display**: View name with schema context
- **Icon**: Interface icon (👁️)
- **Detail**: `view (schema_name)`

#### Schema/Database Completions

```sql
USE public  -- suggests available schemas
```

- **Source**: Available database schemas
- **Display**: Schema name
- **Icon**: Module icon (📁)
- **Detail**: `schema`

### Performance Optimizations

The auto-complete system is optimized for performance:

1. **Memoization**: Schema completions are cached and only recalculated when schema changes
2. **Limited Suggestions**: Maximum 30 total completions to prevent UI lag
3. **Column Limiting**: Only first 5 columns per table to reduce memory usage
4. **Deduplication**: Removes duplicate column names across tables
5. **Lazy Loading**: Completions only generated when needed

### Implementation Details

```typescript
// Memoized completion generation
const schemaCompletions = useMemo(() => {
  if (!selectedSource || !sourceSchemaMap[selectedSource.id]) {
    return [];
  }

  const schemas = sourceSchemaMap[selectedSource.id];
  const completions: Omit<monaco.languages.CompletionItem, "range">[] = [];

  // Generate table, view, and column completions
  // ... (implementation details)

  return completions.slice(0, 30); // Limit total completions
}, [selectedSource, sourceSchemaMap]);
```

## Editor Configuration

### Monaco Editor Options

```typescript
monaco.editor.create(hostRef.current, {
  language: language, // SQL dialect (pgsql/mysql)
  theme: "vs-dark", // Dark theme
  minimap: { enabled: false }, // Disable minimap for SQL
  fontSize: 14, // Readable font size
  wordWrap: "on", // Wrap long SQL statements
  automaticLayout: true, // Auto-resize
  scrollBeyondLastLine: false, // Compact view

  // Auto-complete configuration
  quickSuggestions: {
    other: true, // Enable completions
    comments: false, // Disable in comments
    strings: false // Disable in strings
  },
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnCommitCharacter: true,
  acceptSuggestionOnEnter: "on",
  wordBasedSuggestions: "off", // Use only schema completions

  suggest: {
    showKeywords: true, // Show SQL keywords
    showSnippets: true, // Show code snippets
    showFunctions: true, // Show SQL functions
    localityBonus: true // Prioritize recent suggestions
  }
});
```

### Language Detection

The editor automatically detects the appropriate SQL dialect based on the selected data source:

```typescript
function getMonacoLanguage(dbtype?: string): string {
  switch (dbtype?.toLowerCase()) {
    case "postgres":
      return LanguageIdEnum.PG;
    case "mysql":
      return LanguageIdEnum.MYSQL;
    default:
      return LanguageIdEnum.MYSQL; // Default fallback
  }
}
```

## Integration with Dribble

### Schema Data Flow

1. **Source Selection**: User selects a database source
2. **Schema Loading**: App fetches schema data from worker container
3. **Store Update**: Schema data stored in Zustand store
4. **Editor Update**: Auto-complete provider receives new schema data
5. **Completion Generation**: New completions generated for tables/columns

### Real-time Updates

The editor automatically updates completions when:

- Different data source is selected
- Schema data is refreshed
- New tables/columns are added to the database

### State Management

```typescript
// Zustand store integration
const { selectedSource, sourceSchemaMap } = useAppStore();

// Schema structure
interface SchemaTable {
  columns: SchemaColumn[];
  primary_keys: string[];
  foreign_keys: SchemaForeignKey[];
  relationships?: SchemaRelationship;
}

interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
}
```

## Usage Examples

### Basic Table Selection

```sql
-- Type "act" and get completions for actor table
SELECT * FROM actor;
```

### Column Selection

```sql
-- Type "first_" and get completions for first_name
SELECT first_name, last_name FROM actor;
```

### Schema-Qualified Names

```sql
-- Get completions for specific schemas
SELECT * FROM public.actor;
```

### JOIN Operations

```sql
-- Auto-complete works in JOIN clauses
SELECT a.first_name, f.title
FROM actor a
INNER JOIN film_actor fa ON a.actor_id = fa.actor_id
INNER JOIN film f ON fa.film_id = f.film_id;
```

## Development

### Adding New SQL Dialects

To add support for a new SQL dialect:

1. **Install Language Support**:

   ```bash
   npm install monaco-sql-languages
   ```

2. **Update Monaco Setup**:

   ```typescript
   // Add worker import
   import NewSQLWorker from "monaco-sql-languages/esm/languages/newsql/newsql.worker?worker";

   // Add language contribution
   import "monaco-sql-languages/esm/languages/newsql/newsql.contribution";

   // Update worker configuration
   if (label === LanguageIdEnum.NEWSQL) {
     return new NewSQLWorker();
   }
   ```

3. **Update Language Detection**:
   ```typescript
   case "newsql":
     return LanguageIdEnum.NEWSQL;
   ```

### Customizing Completions

To customize the completion behavior:

```typescript
// Modify completion generation in MonacoSQLEditor.tsx
const schemaCompletions = useMemo(() => {
  // Custom completion logic
  // - Filter specific tables
  // - Add custom snippets
  // - Modify completion priorities
}, [selectedSource, sourceSchemaMap]);
```

### Debugging

To debug auto-complete issues:

1. **Check Schema Data**: Verify `sourceSchemaMap` contains expected data
2. **Monitor Completions**: Log generated completions in browser console
3. **Test Language Support**: Ensure proper SQL dialect is detected
4. **Performance Profiling**: Use React DevTools to monitor re-renders

## Troubleshooting

### Common Issues

#### Auto-complete Not Working

- **Cause**: No data source selected or schema not loaded
- **Solution**: Select a connected data source and wait for schema to load

#### Performance Issues

- **Cause**: Too many completions generated
- **Solution**: Completion system automatically limits suggestions (max 30)

#### SQL Syntax Errors

- **Cause**: Monaco's built-in SQL validation
- **Solution**: Monaco uses standard SQL syntax; some database-specific features may show warnings

#### Missing Table/Column Suggestions

- **Cause**: Schema not properly loaded or cached
- **Solution**: Refresh schema data or reconnect to data source

### Debug Mode

Enable debug logging in development:

```typescript
// Add to MonacoSQLEditor.tsx
console.log("Schema completions:", schemaCompletions);
console.log("Selected source:", selectedSource);
console.log("Source schema map:", sourceSchemaMap);
```

## Future Enhancements

### Planned Features

1. **Smart Query Suggestions**: Context-aware SQL query templates
2. **Foreign Key Navigation**: Auto-suggest JOINs based on relationships
3. **Query History**: Completion suggestions from previous queries
4. **Custom Snippets**: User-defined SQL code snippets
5. **Multi-Schema Support**: Better handling of complex database structures
6. **Real-time Validation**: Live SQL syntax checking and error reporting

### Performance Improvements

1. **Virtual Scrolling**: Handle databases with thousands of tables
2. **Incremental Loading**: Load completions on-demand
3. **Background Updates**: Non-blocking schema refreshes
4. **Caching Strategy**: Persistent completion cache across sessions

## Contributing

When contributing to the editor:

1. **Test Multiple Dialects**: Ensure changes work with both PostgreSQL and MySQL
2. **Performance Testing**: Test with large schemas (100+ tables)
3. **Edge Cases**: Handle empty schemas, connection failures, etc.
4. **Accessibility**: Maintain keyboard navigation and screen reader support
5. **Mobile Testing**: Verify functionality on touch devices

### Code Style

Follow existing patterns:

- Use TypeScript for type safety
- Memoize expensive operations
- Handle loading and error states
- Provide fallbacks for missing data
- Comment complex completion logic

---

The SQL editor in dribble provides a professional database management experience with intelligent auto-completion that adapts to your specific database schema, making SQL development faster and more accurate.
