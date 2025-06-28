# Evolu Project Guide for Claude Code

## Project Overview

Evolu is a TypeScript library and local-first framework for building offline-capable, privacy-focused applications with automatic synchronization. It uses SQLite, CRDTs (Conflict-free Replicated Data Types), and end-to-end encryption (E2EE).

**Key Features:**
- Local-first database with SQLite
- Automatic conflict resolution using CRDTs
- End-to-end encryption for privacy
- Multi-platform support (React, React Native, Svelte, Node.js, Web)
- TypeScript-first with strong type safety
- Offline-first with automatic sync when online

## Project Structure

This is a monorepo managed with pnpm workspaces and Turbo. The workspace structure is:

```
evolu/
├── apps/           # Applications
│   ├── relay/      # Evolu Relay server (Docker-based sync server)
│   └── web/        # Documentation website (Next.js)
├── examples/       # Example applications
│   ├── react-electron/
│   ├── react-expo/
│   ├── react-nextjs/
│   ├── react-vite-pwa/
│   └── svelte-vite-pwa/
├── packages/       # Core libraries
│   ├── common/     # Core Evolu library (platform-agnostic)
│   ├── nodejs/     # Node.js-specific implementation
│   ├── react/      # React hooks and components
│   ├── react-native/ # React Native adapters
│   ├── react-web/  # React web-specific implementation
│   ├── svelte/     # Svelte integration
│   ├── tsconfig/   # Shared TypeScript configurations
│   └── web/        # Web-specific implementation (SharedWorker, WASM)
└── scripts/        # Build and maintenance scripts
```

## Key Technologies

- **Language:** TypeScript (strict mode, ES modules)
- **Package Manager:** pnpm (v10.12.4)
- **Build Tool:** Turbo
- **Node Version:** >=22.0.0
- **Testing:** Vitest
- **Linting:** ESLint with TypeScript ESLint
- **Formatting:** Prettier with plugins for SQL, JSDoc
- **Documentation:** TypeDoc with markdown plugin

## Important Configuration Files

1. **package.json** - Root monorepo configuration with scripts
2. **pnpm-workspace.yaml** - Defines workspace packages
3. **turbo.json** - Turbo build pipeline configuration
4. **eslint.config.mjs** - ESLint configuration (flat config format)
5. **prettier.config.mjs** - Prettier formatting rules
6. **typedoc.json** - Documentation generation config

## Development Commands

```bash
# Install dependencies
pnpm install

# Development (runs packages + web docs)
pnpm dev

# Build all packages
pnpm build

# Build documentation website
pnpm build:web

# Run tests
pnpm test

# Linting
pnpm lint
pnpm lint-monorepo  # Check monorepo structure

# Format code
pnpm format

# Clean build artifacts
pnpm clean

# Example app development
pnpm examples:react-nextjs:dev
pnpm examples:react-vite-pwa:dev
pnpm examples:react-electron:dev
pnpm examples:svelte-vite-pwa:dev

# Mobile examples (requires pnpm dev running)
pnpm ios
pnpm android
```

## Architecture Overview

### Core Library (`packages/common`)

The heart of Evolu, containing:
- **Evolu/** - Main framework code
  - `Evolu.ts` - Main API entry point
  - `Db.ts` - Database operations
  - `Schema.ts` - Schema definitions
  - `Sync.ts` - Synchronization logic
  - `Owner.ts` - Identity and ownership management
  - `Timestamp.ts` - CRDT timestamp implementation
  - `Query.ts` - Query system
  - `Kysely.ts` - SQL query builder integration

### Platform Adapters

- **packages/web** - Web implementation using SharedWorker and WASM SQLite
- **packages/nodejs** - Node.js implementation using better-sqlite3
- **packages/react-native** - React Native with expo-sqlite or op-sqlite

### Framework Integrations

- **packages/react** - React hooks (useEvolu, useQuery, etc.)
- **packages/svelte** - Svelte stores and reactivity

## Key Concepts

1. **Local-First:** All data is stored locally in SQLite first
2. **CRDT-based Sync:** Uses custom timestamp-based CRDT for conflict resolution
3. **End-to-End Encryption:** All data is encrypted before leaving the device
4. **Owner-based Partitioning:** Data is partitioned by owner (user or shared space)
5. **Schema Evolution:** Type-safe schema definitions with migrations

## Testing Approach

- Unit tests using Vitest
- Snapshot testing for complex data structures
- Test files follow `*.test.ts` pattern
- Test utilities in `test/_deps.ts` and `test/_fixtures.ts`

## Code Style Guidelines

1. **TypeScript:** Strict mode, exact optional properties
2. **Imports:** ES modules only, avoid circular dependencies
3. **Exports:** Barrel exports from index files
4. **JSDoc:** Required for public APIs
5. **Error Handling:** Use Result type for fallible operations
6. **Arrays:** Generic array syntax preferred (`Array<T>` over `T[]`)

## Current Work & Notes

The project recently explored multi-owner functionality (SharedOwner) for team collaboration features. The `docs/shared-owner.md` file contains detailed design notes and a proof-of-concept for this feature.

## Building and Publishing

- Uses changesets for version management
- Automated release process via GitHub Actions
- Docker image available for the relay server
- NPM packages published under @evolu scope

## Important Patterns

1. **Dependency Injection:** Platform-specific dependencies injected via factory functions
2. **Worker Architecture:** Heavy operations run in Web Workers
3. **Microtask Batching:** Mutations batched using microtasks for performance
4. **Type-Safe Queries:** Kysely provides type-safe SQL query building
5. **Effect-like Error Handling:** Result types for explicit error handling

## Documentation

- Main documentation site: https://evolu.dev
- API documentation generated with TypeDoc
- Examples in the examples/ directory
- Blog posts in apps/web/src/app/(landing)/blog/