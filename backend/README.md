# Node.js Backend Setup

## Requirements
- Node.js (v18+ recommended)
- npm (comes with Node.js)

## Installation

1. Clone the repository:
   ```sh
   git clone <repo-url>
   cd EXPOSE/backend
   ```
2. Install dependencies:
   ```sh
   npm install
   ```

## Development

- Start the server in development mode (with auto-reload):
  ```sh
  npx nodemon src/index.ts
  ```
- Or, run TypeScript directly:
  ```sh
  npx ts-node src/index.ts
  ```

## Build (if needed)
- To compile TypeScript:
  ```sh
  npx tsc
  ```

## Notes
- All dependencies are listed in `package.json`.
- `node_modules/`, build outputs, and environment files are ignored by git (see `.gitignore`).
