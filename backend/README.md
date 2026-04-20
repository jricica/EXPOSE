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

## DB Schema Transition (Legacy -> Prisma Migrate)

- **Fuente principal del esquema**: `prisma/migrations/*` + `prisma/schema.prisma`.
- **Deploy/start**: `npm start` ejecuta primero `prisma migrate deploy` (script `prestart`).
- **Bootstrap local/transicional**: `npm run db:init`
  - crea la base (`CREATE DATABASE IF NOT EXISTS`)
  - si detecta esquema legacy sin historial Prisma, marca baseline de `20260420000000_init`
  - aplica migraciones versionadas con `prisma migrate deploy`
- **Datos de prueba**: `npm run db:seed` (se mantiene fuera de migraciones).

## DynamoDB Like Strategy

- Data model:
  - `TABLES.POST_LIKES` stores one item per `(postId, userId)` to guarantee idempotency by user.
  - `TABLES.FEED` stores the aggregated `likes` counter on each post.
- Idempotent API:
  - `PUT /api/posts/:id/like` with body `{ "liked": true|false }` is the canonical endpoint.
  - Repeating the same desired state does not duplicate likes or over-decrement counters.
  - The response returns authoritative server state: `{ "likes": number, "likedByMe": boolean }`.
- Consistency:
  - Like/unlike uses a single `TransactWrite` touching both tables.
  - `liked=true`: conditional `Put` in `POST_LIKES` + counter increment in `FEED`.
  - `liked=false`: conditional `Delete` in `POST_LIKES` + counter decrement in `FEED`.
  - This keeps per-user state and aggregate counter synchronized at transaction granularity.
  - After transaction, API reads both records with `ConsistentRead` to return committed final state under retries and high concurrency.
- Cost optimization:
  - No pre-read is required for the idempotent path; it attempts the target state directly.
  - Only one read (`findById`) is used to return the latest counter and validate post existence.
  - Legacy `POST /api/posts/:id/like` (toggle) is kept for compatibility, but `PUT` is recommended for retries and mobile/network instability.

## Mensajes Directos (MVP)

- Crear o recuperar conversacion directa:
  - `POST /api/conversations/direct`
  - Body: `{ "participantUserId": 42 }`
  - Response `201`:
    ```json
    {
      "conversationId": "10#42",
      "type": "direct",
      "participantIds": [10, 42],
      "participants": [
        { "userId": 10, "joinedAt": "2026-04-19T18:00:00.000Z" },
        { "userId": 42, "joinedAt": "2026-04-19T18:00:00.000Z" }
      ],
      "createdAt": "2026-04-19T18:00:00.000Z",
      "updatedAt": "2026-04-19T18:00:00.000Z"
    }
    ```

- Enviar mensaje a una conversacion:
  - `POST /api/conversations/:conversationId/messages`
  - Body: `{ "content": "Hola" }`
  - Response `201`:
    ```json
    {
      "conversationId": "10#42",
      "messageId": "1713559200000#f6a0f4f2-2f88-4f14-8f1e-7bda59f5f615",
      "senderId": 10,
      "receiverId": 42,
      "content": "Hola",
      "createdAt": "2026-04-19T18:01:00.000Z",
      "readAt": null
    }
    ```

- Listar historial con paginacion por cursor:
  - `GET /api/conversations/:conversationId/messages?limit=30&cursorMessageId=...`
  - Response `200`:
    ```json
    {
      "messages": [
        {
          "conversationId": "10#42",
          "messageId": "1713559200000#f6a0f4f2-2f88-4f14-8f1e-7bda59f5f615",
          "senderId": 10,
          "receiverId": 42,
          "content": "Hola",
          "createdAt": "2026-04-19T18:01:00.000Z",
          "readAt": null
        }
      ],
      "pagination": {
        "limit": 30,
        "nextCursorMessageId": "1713559100000#7f6bd0db-28d9-4c64-8ad6-2ed6db9ea1bd"
      }
    }
    ```

- Seguridad:
  - Solo participantes de la conversacion pueden listar o enviar mensajes.
  - `403` para accesos no autorizados.
