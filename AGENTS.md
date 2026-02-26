# Agent Instructions

## Attribution & AI References
- Never add AI attribution to commit messages, code comments, docstrings, docs, or PR descriptions.

## Project Structure
- Monorepo: `backend/` (Express/GraphQL/TypeScript) and `frontend/` (React/TypeScript/Vite).
- Package manager: npm. Never use yarn or bun.
- TypeScript strict mode enabled in both packages.

## Commands
- Install: `npm install` (run from `backend/` or `frontend/`)
- Backend build: `cd backend && npx tsc`
- Frontend build: `cd frontend && npm run build`
- Tests: `npm run test` (Vitest; run from the relevant package directory)
- Lint: `cd frontend && npm run lint`

## Code Conventions
- Use path alias `@/*` for imports within each package.
- No Prettier — ESLint only for formatting/style.
- Do not add docstrings or comments unless logic is non-obvious.
- Do not create README, docs, or markdown files unless explicitly asked.
- Do not add error handling for scenarios that cannot occur.
