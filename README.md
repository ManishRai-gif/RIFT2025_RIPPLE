# Ripple DevOps Agent

An autonomous DevOps agent that analyzes failing tests, proposes fixes using AI (Gemini), and runs tests in isolated Docker containers. Includes a React dashboard for monitoring.

---

## What This Agent Does

**Ripple DevOps Agent** automates the process of fixing failing tests in a codebase:

1. **Accepts a GitHub URL** (e.g. `https://github.com/user/repo`) or a local path – clones the repo if URL
2. **Creates a branch** in format `TEAM_LEADER_AI_Fix`
3. **Runs tests** inside a Docker container (safe, isolated)
4. **If tests fail**, uses Gemini AI to:
   - Analyze the failure output
   - Identify the root cause and file to fix
   - Propose a code fix
   - Apply the fix and commit
5. **Repeats** until tests pass or retry limit is reached
6. **Generates a report** (score, fixes applied, timeline) shown in the dashboard

**Use case**: You have a Node.js project on GitHub with failing `npm test`. Paste the GitHub URL (e.g. `https://github.com/owner/repo`); the agent clones it and iteratively fixes bugs until tests pass or it gives up.

---

## Deployed on Vercel (Frontend + Backend)

You have both frontend and backend on Vercel. Follow these steps to make it work.

### Step 1: Get a Gemini API Key (Free)

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Create API Key**
4. Copy the key (starts with `AIza...`)

### Step 2: Add Environment Variables in Vercel

You need **two Vercel projects** (one for frontend, one for backend) or a monorepo setup. Add variables as follows.

#### Backend Project (API)

1. Open [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **backend** project
3. Go to **Settings** → **Environment Variables**
4. Add:

| Name | Value | Environments |
|------|-------|--------------|
| `GEMINI_API_KEY` | `your_gemini_api_key_here` | Production, Preview |
| `RETRY_LIMIT` | `5` | Production, Preview (optional) |

5. Click **Save**

#### Frontend Project (Dashboard)

1. Select your **frontend** project
2. Go to **Settings** → **Environment Variables**
3. Add:

| Name | Value | Environments |
|------|-------|--------------|
| `VITE_API_URL` | `https://your-backend-url.vercel.app` | Production, Preview |

Replace `your-backend-url.vercel.app` with your actual backend deployment URL (e.g. from Vercel after deploying the backend).

4. Click **Save**

### Step 3: Redeploy After Adding Variables

- Vercel does **not** apply new env vars to existing deployments.
- Go to **Deployments** → click **⋯** on the latest → **Redeploy**
- Or push a small commit to trigger a new deploy

### Step 4: Verify

1. Open your **frontend** URL
2. Dashboard should load (may show "No results yet")
3. Backend must be reachable: `https://your-backend.vercel.app/api/health` should return `{"ok":true,...}`

---

## Vercel Backend: What Works

The backend **can run on Vercel** with these behaviors:

- **Results storage**: Uses `/tmp` (writable); never writes under `/var/task`.
- **Timeout**: `vercel.json` sets `maxDuration: 300` (5 minutes). Hobby/Pro plans support this.
- **Tests**: On Vercel there is no Docker. The backend uses a **local test runner** (e.g. `npm test` in the cloned repo). **Node.js repos are fully supported.** Python/Go/Rust may fail on Vercel if those runtimes are not available in the function environment.
- **Run time**: A full run (clone → tests → AI fixes → repeat) usually takes **1–5 minutes**. The frontend polls `GET /api/results` until `ci_status` is `PASSED` or `FAILED`.

**For Docker isolation and all languages**, host the backend on Railway, Render, or Fly.io and set `VITE_API_URL` to that backend.

---

## Environment Variables Reference

### Backend (`.env` or Vercel / Railway / Render)

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | From [Google AI Studio](https://makersuite.google.com/app/apikey). Free tier works. |
| `RETRY_LIMIT` | No | Max fix iterations per run. Default: `5`. |
| `PORT` | No | Server port. Default: `3001`. Vercel sets this automatically. |

### Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes (for production) | Full backend URL, e.g. `https://your-backend.vercel.app`. No trailing slash. |

**Local dev**: Create `frontend/.env` with `VITE_API_URL=http://localhost:3001` (or omit if backend runs on 3001).

---

## Local Setup (Full Agent)

For full agent runs (including Docker), run locally:

### Prerequisites

- Node.js 18+
- Docker Desktop (for test execution)
- Gemini API key

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env: add GEMINI_API_KEY=your_key
npm install
npm start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Enter a **local repo path** (e.g. `/Users/you/projects/my-app`) and click **Run Agent**.

---

## Architecture

```
+------------------------+     REST      +------------------------+
|  React Dashboard       | <-----------> |  Express Backend       |
|  (Vercel)              |   /api/*      |  (Vercel / Railway)    |
+------------------------+               +------------------------+
                                                  |
                                                  v
                                         +------------------+
                                         |  Agent Pipeline  |
                                         +------------------+
                                                  |
     +----------------+----------------+----------+----------+
     |                |                |                     |
     v                v                v                     v
+----------+   +------------+   +------------+   +----------------+
| Analyzer |   | Fix Agent  |   | Test Agent |   | Git Agent      |
| (Gemini) |   | (Gemini)   |   | (Docker)   |   | (simple-git)   |
+----------+   +------------+   +------------+   +----------------+
```

---

## Vercel Deployment (Summary)

### Frontend

1. Connect repo to Vercel
2. **Root Directory**: `frontend`
3. **Framework Preset**: Vite (auto-detected)
4. Add `VITE_API_URL` = backend URL
5. Deploy

### Backend

1. New Vercel project, connect same repo
2. **Root Directory**: `backend`
3. Add `GEMINI_API_KEY` and optionally `RETRY_LIMIT`
4. Deploy

---

## Scoring

- Base: **100**
- +10 if run completes in under 5 minutes
- -2 per commit above 20

## Branch Format

`TEAM_NAME_LEADER_NAME_AI_Fix` — uppercase, underscores, ends with `_AI_Fix`.

## Supported Bug Types

- Syntax errors (JavaScript/TypeScript)
- Logic errors in source and tests
- Missing imports/exports
- Assertion mismatches
- Jest/Mocha test failures

## Where results and logs are saved

- **Backend**: Every run writes to `backend/results.json`. The file is updated during the run (so the dashboard can show progress) and again at the end with the final result.
- **Contents**: `repo`, `branch`, `ci_status`, `fixes`, `timeline`, **`run_log`** (each step: tests, analysis, file/line, fix applied, commit), and score breakdown.
- **Dashboard**: The frontend polls `GET /api/results` and displays that data; the Run Log section shows the same `run_log` (checks and updates).
- **Git**: The agent only **commits locally** on the new branch (`TEAM_LEADER_AI_Fix`). It does **not** push to GitHub and does **not** change `main`. For a **local path** run, the developer sees the new branch and commits in their repo. No GitHub token is required.

## Project Structure

```
/frontend          React dashboard (Vite)
/backend           Express API + agents
  /agents          analyzerAgent, testAgent, fixAgent, gitAgent, ciAgent, orchestrator
  /utils           gemini, dockerRunner, logger
  results.json     Generated after each run (includes run_log)
```

## Team

Ripple DevOps Agent – Open Source
