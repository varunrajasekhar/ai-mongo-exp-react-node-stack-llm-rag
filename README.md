# AI Study Assistant

Final case study implemented from the Day 1–5 Kitchen Assistant coursework: React + Vite, Node.js + Express, MongoDB + Mongoose, bcrypt/JWT authentication, and local Ollama chat and embeddings. This is a MERN application (React rather than Angular).

Learners ask general study questions and generate three practice questions. Admins additionally save private notes; relevant passages from only their own notes are supplied to the model. There are no hosted AI API keys or paid services required.

## Prerequisites

- Node.js 22.12+ and npm (Node 24 also works).
- MongoDB Community running locally, or a MongoDB Atlas connection string. No Atlas vector index is required: the course's small-data cosine search runs in Node.
- Ollama installed and running on the backend machine. Allow enough RAM/disk for your chosen models. The course model is `qwen2.5:7b`; for a smaller machine set `CHAT_MODEL=llama3.2:3b` after pulling it.

## Run locally

```bash
git clone https://github.com/varunrajasekhar/ai-mongo-exp-react-node-stack-llm-rag.git
cd ai-mongo-exp-react-node-stack-llm-rag
git switch feature/testing-ai-mean-llm
npm ci
cp backend/.env.example backend/.env
```

Edit `backend/.env`. Replace `JWT_SECRET` with a random value; generate one with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Start MongoDB using your operating system's service manager. Alternatively, with Docker installed:

```bash
docker run -d --name study-mongo -p 127.0.0.1:27017:27017 -v study-mongo-data:/data/db mongo:8
```

On subsequent runs use `docker start study-mongo`. Then prepare Ollama:

```bash
ollama serve
```

If the Ollama desktop app already runs the service, do not start a second copy. In another terminal:

```bash
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
npm run dev:api
```

Keep the API running. In a separate terminal from the repository root:

```bash
npm run dev:web
```

Open **http://localhost:5173**. The API listens at **http://localhost:3000**. Vite forwards `/api` requests to the API; no frontend environment file is needed. Register a learner and ask “What is photosynthesis?” The initial model load can take a few minutes.

### Enable an admin

Register your intended admin account through the UI first. Then run this trusted local command from the repository root:

```bash
npm run admin -w backend -- admin@example.com
```

Log out and log back in. You will see **AI Study**, **My Notes**, and **Add Note**. Public registration ignores any submitted `role`, so users cannot grant themselves admin access. Repeat with a second account to demonstrate privacy. The command uses the database configured in `backend/.env`; it does not create an account or set a password.

## Environment variables

All backend variables belong in `backend/.env`, which is ignored by Git.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Required MongoDB URI; local default example uses database `ai_study_assistant` |
| `JWT_SECRET` | Required random signing secret, at least 32 characters; example placeholder is rejected |
| `PORT` | API port, default `3000` |
| `FRONTEND_ORIGIN` | Allowed browser origin, default `http://localhost:5173` |
| `OLLAMA_URL` | Ollama base URL, default `http://127.0.0.1:11434` |
| `CHAT_MODEL` | Chat model, default `qwen2.5:7b` |
| `EMBED_MODEL` | Embedding model, default `nomic-embed-text` |
| `OLLAMA_TIMEOUT_MS` | Per-model-call timeout, default `180000` milliseconds |

If you change the API port, update the target in `frontend/vite.config.js`. If you change the embedding model, existing chunks are excluded from retrieval; re-create the notes with the new model. Never commit `.env` or real credentials.

## API

Send `Authorization: Bearer <token>` to protected endpoints. Registration and login return `{ token, user }`. JWTs expire after two hours; logout clears the browser session. Tokens are stored in sessionStorage, matching the course approach. Logout does not revoke an already issued JWT on the server.

| Method | Path | Access | Body / result |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | `{name,email,password}` → learner session |
| POST | `/auth/login` | Public | `{email,password}` → session |
| GET | `/auth/me` | Logged in | Current database-backed user and role |
| GET | `/notes` | Admin | Own indexed notes only |
| POST | `/notes` | Admin | `{title,subject,content}` → saved and indexed note |
| POST | `/study/ask` | Logged in | `{question,includePractice:false}` → answer, practiceQuestions, sources |
| POST | `/study/quiz` | Logged in | `{question}` → answer and exactly three practice questions |
| GET | `/health` | Public | API liveness; not a model readiness check |

Validation errors return 400, invalid credentials/tokens 401, non-admin note access 403, duplicate email 409, oversized bodies 413, and model failures 502. A source title means the note was supplied as context; it is not a guarantee that every statement is supported by the note.

## Project structure and course mapping

```text
backend/
  server.js                 Connect database before listening
  app.js                    Express routes and error handling
  db.js                     Mongoose connection
  controller/               Auth, role middleware, notes and study controllers
  models/                   User, Note, NoteChunk
  llm.js                    Ollama HTTP, embedding and structured chat validation
  rag.js                    Overlapping chunks and owner-scoped cosine retrieval
  scripts/promote-admin.js  Trusted local role provisioning
  test/app.test.js          HTTP integration and privacy tests
frontend/
  src/AuthContext.jsx       Session restore, login/logout and expiry handling
  src/App.jsx               Login, Register, AI Study, My Notes, Add Note
  src/api.js                API requests and bearer tokens
  src/style.css             Responsive styling
```

- Day 1: Express JSON endpoints, prompt constraints, local Ollama calls.
- Day 2: 500-character chunks with 100-character overlap; MongoDB embeddings; cosine similarity threshold 0.35 and top three passages.
- Day 3: React forms, state, loading/error/empty states, API calls.
- Day 4: Mongoose models, bcrypt password hashing, JWT middleware, role guards.
- Day 5: Ownership filters, private RAG and complete authenticated frontend integration.

The provided Day 1–4 PDFs and all five code archives informed this adaptation. No separate Day 5 PDF was attached. The original course archives are not copied into the repository.

## Privacy and persistence

The authenticated database user determines ownership; request body owner IDs and roles are never trusted. Admin retrieval first selects notes by `createdBy`, then loads only chunks belonging to those notes. Learner requests bypass retrieval entirely. Frontend guards are backed by API authorization. The embedding model runs locally alongside the chat model.

A note is embedded before persistence and is only visible after chunk insertion succeeds. Normal write failures trigger cleanup. An abrupt process/database failure can leave an unpublished record; unpublished records are excluded from listing and retrieval. This small coursework app uses a standalone-compatible publish flag instead of requiring MongoDB replica-set transactions.

## Verification

```bash
npm run test:unit
npm test
npm run build
```

The seven focused tests (`npm run test:unit`) use mocked database/model boundaries. The integration suite uses a real temporary MongoDB from `mongodb-memory-server` and a deterministic HTTP stand-in for Ollama. The first test run downloads a MongoDB binary and needs network access. Tests cover hashing, role escalation prevention, duplicate/invalid inputs, JWT validation, learner restrictions, two-admin isolation including forged owner IDs, quiz output and model failures. They do **not** verify model answer quality. Run the live-model walkthrough below on your machine before presenting.

`npm run build` produces `frontend/dist`. `npm run preview -w frontend` previews static assets only; local full-stack development uses the two `dev` commands above. A hosted deployment needs HTTPS, a reverse proxy for `/api`, SPA history fallback and authentication rate limiting; hosting is outside this assignment.

## Walkthrough and troubleshooting

Follow [docs/WALKTHROUGH.md](docs/WALKTHROUGH.md) for the learner/admin presentation and acceptance checklist.

- **Startup fails:** check MongoDB service/URI and replace the JWT placeholder. The API deliberately refuses to listen until the database connects.
- **502 while asking or saving:** start Ollama, run `ollama list`, and pull both configured models. Increase the timeout for slower machines. A failed embedding call does not report a note as saved.
- **API unreachable:** ensure both dev terminals are running and ports 3000/5173 are available.
- **Admin links absent:** promote the registered email in the correct database, then log in again.
- **No private sources:** add relevant notes under this admin, confirm the same embedding model is configured, and ask about their content. Irrelevant or low-similarity notes are intentionally excluded.
- **Session expires:** log in again; invalid sessions are cleared automatically.

### Verification environment

The frontend production build and seven focused tests passed in the coding environment. The integration suite could not start its MongoDB binary there (`open: Operation not permitted`); GitHub Actions runs the full suite on Ubuntu. No live Ollama inference was run in the coding environment. Check the Actions result and run the walkthrough with your local models before presenting.
