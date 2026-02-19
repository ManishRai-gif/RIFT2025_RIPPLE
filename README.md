# Autonomous DevOps Agent

An autonomous DevOps agent that analyzes failing tests, proposes fixes using LLM (Gemini), and runs tests in Docker. Includes a React dashboard for monitoring.

## Architecture

```
+------------------+     REST      +------------------+
|  React Dashboard | <-----------> |  Express Backend |
|  (Vite)          |   /api/*      |  (Node.js)       |
+------------------+               +------------------+
                                          |
                                          v
                                 +------------------+
                                 |  Agent Pipeline  |
                                 +------------------+
                                          |
        +----------------+----------------+----------------+
        |                |                |                |
        v                v                v                v
+------------+   +------------+   +------------+   +------------+
|  Analyzer  |   |  Fix Agent |   |  Test Agent|   |  Git Agent |
|  (Gemini)  |   |  (Gemini)  |   |  (Docker)  |   |  (simple-  |
|            |   |            |   |            |   |   git)     |
+------------+   +------------+   +------------+   +------------+
```

## Live Deployment

- **Frontend**: Deploy to Vercel (connect repo, set root to `frontend`)
- **Backend**: Deploy to Railway (connect repo, set root to `backend`)

## Installation

### Prerequisites

- Node.js 18+
- Docker (for test execution)
- Gemini API key (free tier)

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env and add GEMINI_API_KEY
npm install
npm start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

Create `.env` in `/backend`:

```
GEMINI_API_KEY=your_key_here
RETRY_LIMIT=5
PORT=3001
```

- `GEMINI_API_KEY` (required): Get from [Google AI Studio](https://makersuite.google.com/app/apikey). Free tier is sufficient.
- `RETRY_LIMIT` (optional): Max fix iterations per run. Default: 5.
- `PORT` (optional): Server port. Default: 3001.

For Railway: open your project → Variables → add `GEMINI_API_KEY` and `RETRY_LIMIT`.

### Docker Setup

The agent runs tests inside Docker containers. Ensure Docker is installed and the daemon is running:

```bash
docker info
```

Backend must have access to Docker socket when using docker-compose (socket is mounted).

### API Key Setup

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Set `GEMINI_API_KEY=your_key` in backend `.env`
4. On Railway: Variables → Add Variable → `GEMINI_API_KEY` → paste key

## Railway Deployment

1. Create a new project on [Railway](https://railway.app)
2. Connect your Git repository
3. Set root directory to `backend`
4. Add variables: `GEMINI_API_KEY`, `RETRY_LIMIT` (optional)
5. Deploy

Railway will detect the Node.js app and run `npm start`.

## Vercel Deployment (Frontend)

1. Import project on [Vercel](https://vercel.com)
2. Set root directory to `frontend`
3. Add environment variable: `VITE_API_URL` = your Railway backend URL (e.g. `https://your-app.railway.app`)
4. Deploy

## Usage Example

1. Start backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npm run dev`
3. Open http://localhost:5173
4. Enter a local repository path (e.g. `/Users/you/projects/my-app`)
5. Optionally set team name and leader name for branch format
6. Click "Run Agent"

The agent will create a branch `TEAMNAME_LEADERNAME_AI_Fix`, run tests in Docker, analyze failures with Gemini, apply fixes, and commit until tests pass or retry limit is reached.

## Supported Bug Types

- Syntax errors in JavaScript/TypeScript
- Logic errors in test files and source code
- Missing imports or exports
- Assertion mismatches
- Common npm test script failures (Jest, Mocha)

## Known Limitations

- Works with local repository paths only (no remote clone in this version)
- Docker must be installed and running
- Gemini free tier has rate limits
- Does not modify `package.json` for security
- Best suited for Node.js projects with `npm test`

## Scoring

- Base: 100
- +10 if run completes in under 5 minutes
- -2 per commit above 20

## Branch Format

`TEAM_NAME_LEADER_NAME_AI_Fix`

- Uppercase
- Spaces → underscores
- No special characters
- Ends with `_AI_Fix`

## Project Structure

```
/frontend          React dashboard (Vite)
/backend           Express API + agents
  /agents          analyzerAgent, testAgent, fixAgent, gitAgent, ciAgent, orchestrator
  /utils           gemini, dockerRunner, logger
  results.json     Generated after each run
```

## Team

Autonomous DevOps Agent - Open Source
