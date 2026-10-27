
## Prerequisites

Varun Notes: Node 23 or above LTS versions have package issues due to Mac version and node version creating problems in local package installations.

- Node.js 22.12+ and npm (Node 24 also works but has some critical failures down the lane with more package additions).
- Ollama installed and running on the backend machine. Allow enough RAM/disk for your chosen models. The course model is `qwen2.5:7b`; for a smaller machine set `CHAT_MODEL=llama3.2:3b` after pulling it (my MAC device can support upto Qwen, just for sake of usages, used llama3.2).

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

Start MongoDB using your operating system's service manager.

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
| GET | `/health` | Public | API liveness; not a model readiness check 

## Verification

```bash
npm run build
```


`npm run build` produces `frontend/dist`. `npm run preview -w frontend` previews static assets only; local full-stack development uses the two `dev` commands above. A hosted deployment needs HTTPS, a reverse proxy for `/api`, SPA history fallback and authentication rate limiting; hosting is outside this assignment.
