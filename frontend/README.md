# Mini Wallet Frontend

Next.js frontend login/register aur wallet dashboard deta hai. API server ka URL `.env.local` ke `NEXT_PUBLIC_API_URL` se configure hota hai.

## Setup

PowerShell mein `frontend` folder ke andar:

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Frontend `http://localhost:3001` par chalega. Backend ko alag terminal mein `http://localhost:3000` par chalayen; backend setup ke liye `../backend/README.md` dekhein. Backend `.env` mein `FRONTEND_URL="http://localhost:3001"` rakhein.

Transaction note likhne ke liye backend `.env` mein `GEMINI_API_KEY` configure hona chahiye. Note Gemini ko rewrite ke liye bheja jata hai; amount aur account details nahi bheje jate.

Account banane ke liye login screen par `Create an account` select karein. Login/register se mila JWT browser ke `localStorage` mein rakha jata hai aur protected API requests ke `Authorization: Bearer ...` header mein bheja jata hai.

## Checks

```powershell
npm run lint
npm run typecheck
npm run build
```

Zod form schemas `src/lib/validation.ts` mein hain. Frontend unit aur browser E2E tests Phase 5 mein add honge.
