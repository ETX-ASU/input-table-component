# input-table-component

The repo to hold the new input table component developed by WyeWorks

## Prerequisites

- Node.js >= 20
- pnpm (recommended package manager)

## Project Setup

1. Clone the repository:

```bash
git clone [repository-url]
cd input-table-component
```

2. Install dependencies:

```bash
pnpm i
```

3. Set up Git hooks (automatically done during install):

```bash
pnpm prepare
```

## Development

Start the development server:

```bash
pnpm dev
```

The development server will start at `http://localhost:5173` by default.

## Tech Stack

- React 19
- TypeScript
- Vite
- TailwindCSS
- Zustand (State Management)
- ESLint + Prettier (Code Quality)
- Husky + lint-staged (Git Hooks)

## Project Structure

- `/src` - Source code
- `/public` - Static assets
- `/dist` - Build output
- `.github` - GitHub workflows and templates
- `.husky` - Git hooks configuration
- `.vscode` - VS Code settings

## Code Quality

The project uses:

- ESLint for code linting
- Prettier for code formatting
- Husky for Git hooks
- lint-staged for pre-commit checks
