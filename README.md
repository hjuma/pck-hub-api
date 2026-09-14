# PC-Kenya Knowledge Hub API Server

A Node.js & TypeScript API Server tailored for deployment on **Vercel Serverless Functions**. It facilitates seamless metadata synchronization for Population Council Kenya's Knowledge Hub publications.

---

## 🚀 Features

* **Incremental Sync Engine**: Employs deterministic cursor pagination (`updatedAt ASC, id ASC`) preventing duplicate records or missed gaps.
* **OpenAPI 3.1 Contract**: Full interactive specification located at `/v1/openapi.json`.
* **State of the Art Security**: Token-based Bearer Authentication (`Bearer pck_test_token_2026`) ensuring robust server-to-server security.
* **Resilience Framework**: Rate limiting support returning standard `429 Too Many Requests` + `Retry-After` header. Standardized JSON errors with unique `correlationId` tracking keys.
* **Targeted Mock Repository**: Representative records satisfying all required synchronization edge cases (normal, missing optional, multi-author/topic, restricted access, and withdrawn tombstoned records).

---

## 🛠️ Quick Start

### 1. Installation
```bash
npm install
```

### 2. Local Development
Start the hot-reloading development server on `http://localhost:3000`:
```bash
npm run dev
```

### 3. Running Automated Tests
Execute the native Node.js test runner covering 10 distinct test scenarios:
```bash
npx tsx --test api/index.test.ts
```

### 4. Build
Compile TypeScript to standard JavaScript under `/dist`:
```bash
npm run build
```

---

## 🌐 API Contract Reference

### Base Path: `/v1`

| Method | Route | Description |
|---|---|---|
| `GET` | `/v1/publications` | Retrieves deterministic, paginated publication records. Supports `updatedSince` filter & opaque Base64 `cursor`. |
| `GET` | `/v1/publications/:id` | Returns a single publication matching the specified key. |
| `GET` | `/v1/taxonomies` | Return controlled lists of topics, resource types, language and geographies. |
| `GET` | `/v1/openapi.json` | Serves the OpenAPI 3.1.0 interactive schema. |

---

## ☁️ Vercel Deployment

To deploy this project as stateless Serverless Functions in Vercel, simply run:

```bash
vercel
```

The route redirection mapping is configured within `vercel.json` to route all incoming `/v1/*` paths to our main Serverless Function wrapper (`api/index.ts`). Ensure to set the environment variable `PCK_API_TOKEN` inside your Vercel Dashboard for production authentication security.
# pck-hub-api
