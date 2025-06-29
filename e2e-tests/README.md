# E2E Tests for Evolu Groups Functionality

This directory contains end-to-end tests for the React and Svelte group functionality implementations using Playwright.

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Install Playwright browsers (if not already installed):
   ```bash
   pnpm exec playwright install
   ```

## Running Tests

### Prerequisites

The tests require the example apps to be running. **Important**: You need to start these manually in separate terminals:

1. Start the React example (on port 5174):
   ```bash
   pnpm examples:react-vite-pwa:dev
   ```

2. Start the Svelte example (on port 5175):
   ```bash
   # In a new terminal
   cd examples/svelte-vite-pwa
   pnpm dev --port 5175
   ```

### Run All Tests

```bash
# From the e2e-tests directory
npm test
```

Or if the dev servers are not running, the tests will start them automatically (but this may take longer).

### Run React Tests Only

```bash
pnpm test:react
```

### Run Svelte Tests Only

```bash
pnpm test:svelte
```

### Debug Tests

```bash
pnpm test:debug
```

### UI Mode

```bash
pnpm test:ui
```

## Test Coverage

Both React and Svelte tests cover:

- Groups demo section display
- Creating new groups
- Joining groups with invite codes
- Setting/clearing current group context
- Viewing group details
- Generating invite codes with different roles
- Error handling (invalid invite codes, empty inputs)
- Reactive state updates
- Console error monitoring

## Architecture

The tests use:
- Playwright for browser automation
- Data-testid attributes for reliable element selection
- Separate test projects for React and Svelte
- Console monitoring to catch runtime errors
- Proper timeouts for async operations