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

## DynamoDB Like Strategy

- Data model:
  - `TABLES.POST_LIKES` stores one item per `(postId, userId)` to guarantee idempotency by user.
  - `TABLES.FEED` stores the aggregated `likes` counter on each post.
- Idempotent API:
  - `PUT /api/posts/:id/like` with body `{ "liked": true|false }` is the canonical endpoint.
  - Repeating the same desired state does not duplicate likes or over-decrement counters.
- Consistency:
  - Like/unlike uses a single `TransactWrite` touching both tables.
  - `liked=true`: conditional `Put` in `POST_LIKES` + counter increment in `FEED`.
  - `liked=false`: conditional `Delete` in `POST_LIKES` + counter decrement in `FEED`.
  - This keeps per-user state and aggregate counter synchronized at transaction granularity.
- Cost optimization:
  - No pre-read is required for the idempotent path; it attempts the target state directly.
  - Only one read (`findById`) is used to return the latest counter and validate post existence.
  - Legacy `POST /api/posts/:id/like` (toggle) is kept for compatibility, but `PUT` is recommended for retries and mobile/network instability.
