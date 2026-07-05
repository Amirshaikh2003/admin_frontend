# PDF Question Extractor GUI

React + TSX frontend for the existing FastAPI backend.

## Run

1. Start the backend from `backend`:
   `uvicorn app.main:app --reload`
2. Start this frontend:
   `npm.cmd install`
   `npm.cmd run dev`
3. Open `http://127.0.0.1:5173`.

The frontend calls `http://127.0.0.1:8000/api/extract-questions`,
`http://127.0.0.1:8000/api/question-paper`, and
`http://127.0.0.1:8000/api/answer` through the Vite `/api` proxy.

The API base URL is configured in `.env`:

`VITE_API_BASE_URL=/api`

The academic import helper is proxied through:

`VITE_ADMIN_API_BASE_URL=/admin-api`
