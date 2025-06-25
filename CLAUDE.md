# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Main development:**
- `just start` - Start the entire application stack (builds missing images automatically)
- `just up` - Start stack in foreground mode
- `just down` - Stop the application stack

**Testing:**
- `just test` - Run complete test suite with setup and cleanup
- `just test-setup` - Set up test environment only
- `just test-cov` - Generate and open test coverage report

**Building:**
- `just build-server` - Build server Docker image
- `just build-client` - Build client Docker image  
- `just build-worker <name>` - Build worker image (e.g., `just build-worker pg` for postgres)

**Client development (from /client directory):**
- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn lint` - Run ESLint

**Server development (from /server directory):**
- `uv run app.main:app` - Run FastAPI server directly
- `pytest tests/` - Run tests
- `ruff check .` - Run linting
- `ruff format .` - Format code

## Architecture Overview

Dribble is a multi-container SQL IDE with AI assistance that follows a client-server-worker architecture:

**Client (React/TypeScript):**
- Built with Vite, React 19, TypeScript, ShadCN/UI, Tailwind
- State management via Zustand stores (centralized in `/shared/store/`)
- Monaco editor for SQL editing with syntax highlighting
- Glide Data Grid for spreadsheet-style results display
- Feature-based organization under `/features/` (chat, editor, query, sources, tables)

**Server (FastAPI/Python):**
- FastAPI backend with async/await patterns
- SQLAlchemy ORM with Alembic migrations
- Pydantic schemas for API validation
- Route organization: `/routes/` with corresponding `/controllers/` and `/schemas/`
- Core services in `/core/` for database operations, encryption, worker management

**Workers (Dockerized FastAPI):**
- Isolated per-database-type containers (`/worker/postgres/`, `/worker/mysql/`) 
- Handle query execution against specific database types
- Communicate via `dribble-network` Docker network
- Spawned dynamically by server for database connections

**Key Data Models:**
- Queries are first-class entities with version history (`query_version` table)
- Query runs logged for observability (`query_run` table)
- Chat messages with SQL context for AI assistance
- Sources represent database connections with isolated workers

## State Management

The client uses Zustand with feature-specific stores:
- `useQueryStore` - Query CRUD, active query state
- `useTabManagerStore` - Tab management and navigation  
- `useChatStore` - AI chat messages and context
- `useSourceStore` - Database connection management
- `useUIStore` - UI state (sidebars, modals, themes)

## Development Patterns

**Frontend:**
- Components follow ShadCN patterns with Tailwind styling
- Prefer small/extra-small font sizes for UI elements
- Feature-based folder structure with co-located components, hooks, services
- TypeScript throughout with strict type checking
- Support both light and dark themes

**Backend:**
- Use async/await for all FastAPI routes
- Pydantic models for request/response validation
- Don't mix dataclasses with Pydantic models
- Database operations via SQLAlchemy with proper transaction handling
- Worker communication through HTTP API calls

**Testing:**
- Server tests use pytest with asyncio support
- Test database setup via Docker containers with temporary data
- Coverage reporting configured (minimum 35% threshold)

## AI Integration

The AI chat assistant receives context including:
- Current query SQL from query versions
- Database schema information for relevant sources
- Previous chat history for conversational context
- Supports context-aware SQL assistance and debugging