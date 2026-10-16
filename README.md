# Mini Wallet

Mini Wallet learning project hai. `backend` NestJS + Prisma API hai; `frontend` Next.js app hai. Dono apne alag terminal aur alag `npm` commands se chalate hain.

## Pehli dafa setup

1. Local demo default JSON file storage use karta hai; PostgreSQL/database chalane ki zaroorat nahi.
2. Backend terminal:

   ```powershell
   Set-Location C:\www\mini-wallet\backend
   if (-not (Test-Path .env)) { Copy-Item .env.example .env }
   notepad .env
   # .env mein JWT_SECRET aur Google AI Studio ka GEMINI_API_KEY set karein.
   # STORAGE_MODE absent ho to JSON demo chalta hai; DATABASE_URL zaroori nahi.
   npm install
   npm run start:dev
   ```

   PostgreSQL mode chahiye ho to PostgreSQL chalayen, `mini_wallet` database banayein, `.env` mein `STORAGE_MODE="postgres"` aur valid `DATABASE_URL` set karke yeh commands chalayein:

   ```powershell
   npm run prisma:generate
   npm run prisma:migrate
   ```

3. Frontend ke liye doosra terminal khol kar:

   ```powershell
   Set-Location C:\www\mini-wallet\frontend
   Copy-Item .env.example .env.local
   npm install
   npm run dev
   ```

JSON demo mein PostgreSQL ya `DATABASE_URL` ki zaroorat nahi. Frontend `http://localhost:3001` aur backend `http://localhost:3000` par hoga. API routes aur frontend setup ki tafseel [backend guide](./backend/README.md) aur [frontend guide](./frontend/README.md) mein hai.

Login ke baad deposit/withdraw form mein amount ke saath description bhi likhein; Gemini us description ko rewrite karke transaction history mein save karta hai. Is ke liye backend `.env` mein apni `GEMINI_API_KEY` set karein. Key Google AI Studio mein API Keys section se banayi ja sakti hai—key ko chat mein share na karein.

## Tests ko kaise samjhein aur chalayein

Har test command us app ke folder mein chalti hai jiska test hai. Backend ke unit tests frontend se alag hain aur PostgreSQL ki zaroorat nahi rakhte: service tests storage ko mock karte hain, aur JSON storage tests temporary file istemal karte hain.

```powershell
Set-Location C:\www\mini-wallet\backend
npm test
```

Output mein tamam test suites aur tests `passed` hon to backend unit tests pass hue. `FAIL` aaye to Jest test ka naam aur expected/received values batata hai; pehle woh test case dekhein, phir service fix karein. `npm run test:watch` changes ke baad tests automatic dobara chalata hai. Source aur test TypeScript check karne ke liye `npm run test:typecheck`.

Frontend ke static checks:

```powershell
Set-Location C:\www\mini-wallet\frontend
npm run lint
npm run typecheck
npm run build
```

Frontend Jest/Vitest aur Playwright tests abhi add nahi hue. Woh Phase 5 ka kaam hain. Backend integration tests, jo real separate PostgreSQL test database istemal karenge, Phase 3 mein abhi pending hain.
