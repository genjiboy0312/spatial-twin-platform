# Setup Commands

```bash
docker compose up -d postgres redis

cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m pytest
uvicorn app.main:app --reload --port 8000

cd ..\frontend
npm install
npm run test
npm run build
npm run dev
```
