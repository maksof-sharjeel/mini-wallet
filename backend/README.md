# Mini Wallet Backend

Backend NestJS API hai. Local demo ke liye JSON storage (`STORAGE_MODE=json`) use kar sakte hain. Prisma/PostgreSQL mode ke liye `STORAGE_MODE=postgres` aur `DATABASE_URL` configure karein. Dono modes mein JWT signing `JWT_SECRET` se hoti hai.

## Setup

PowerShell mein `backend` folder ke andar. Agar `.env` pehle se hai to usay overwrite na karein; bas `STORAGE_MODE="json"` add karein:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
npm install
npm run start:dev
```

`.env` mein apna random `JWT_SECRET` aur Google AI Studio se `GEMINI_API_KEY` rakhein (Google AI Studio → API keys → Create API key). Transaction description rewrite karne ke liye Gemini key required hai; key ke baghair AI operation clear configuration error dega. Gemini model `gemini-flash-latest` use hota hai. `STORAGE_MODE` unset ho ya `"json"` ho to local JSON demo chalta hai; is mode mein `DATABASE_URL` ki zaroorat nahi. PostgreSQL use karne se pehle `STORAGE_MODE="postgres"` set karein, valid `DATABASE_URL` dein, database create karein, phir yeh commands chalayen:

```powershell
npm run prisma:generate
npm run prisma:migrate
```

Repo mein initial migration pehle se maujood hai. API `http://localhost:3000` par chalegi aur frontend origin `.env` ke `FRONTEND_URL` se allow hota hai (local development: `http://localhost:3001`).

### Baghair PostgreSQL local demo

`.env` mein `STORAGE_MODE="json"` set karein, ya is key ko unset chhor dein. Is mode mein database URL ki zaroorat nahi; registration, login, wallet balance aur transaction history `backend/data/wallet.json` mein save hote hain. Optional `WALLET_JSON_PATH` se file location badal sakte hain. Har transaction ki sirf description Gemini ko bheji jati hai, amount, email ya JWT nahi. Yeh single-process, local learning/demo mode hai—production ya multiple backend instances ke liye nahi. JSON data file git se ignored hai.

Jab PostgreSQL use karna ho, `.env` mein `STORAGE_MODE="postgres"` set karein, valid `DATABASE_URL` dein, database par `npm run prisma:migrate` chalayen aur backend restart karein. JSON aur PostgreSQL data apne aap ek doosre mein copy nahi hota.

## API

Registration aur login ke baad protected routes ko `Authorization: Bearer <accessToken>` header chahiye.

| Method | Route | Kaam |
| --- | --- | --- |
| `POST` | `/auth/register` | `{ "email": "...", "password": "minimum 8 chars" }` se account banata hai |
| `POST` | `/auth/login` | Credentials verify karke JWT deta hai |
| `GET` | `/wallet/balance` | Logged-in user ka balance deta hai |
| `POST` | `/transactions/deposit` | `{ "amount": 20.00, "description": "Chai" }` deposit karta hai |
| `POST` | `/transactions/withdraw` | `{ "amount": 20.00, "description": "Chai" }` se funds available hon to amount withdraw karta hai |
| `POST` | `/transactions/transfer` | `{ "recipientEmail": "...", "amount": 20.00, "description": "Dinner" }` transfer karta hai |
| `GET` | `/transactions` | Logged-in user ki latest 100 transactions deta hai |

Har transaction request mein `description` 2 se 300 characters tak required hai. Gemini usay same language mein saaf karta hai; original note hi provider ko bheja jata hai, amount/email/JWT nahi. Deposit example: `{ "amount": 20.00, "description": "chai wagea" }`; history mein AI ka rewritten description aata hai. Amount positive hona chahiye aur maximum 2 decimal places ho sakte hain. Withdraw ya transfer ke liye balance kam ho to API `400` status aur `Insufficient funds` message deti hai. PostgreSQL mode mein balance aur transaction aik database transaction mein update hote hain; JSON demo mode mein har operation file ko atomically replace karta hai.

## Checks

```powershell
npm run build
npm run lint
npm test
npm run test:typecheck
```

PostgreSQL ke liye nayi migration transaction description column add karti hai. Database mein migration apply karne ke liye PostgreSQL mode mein `npm run prisma:migrate` chalayein.

`npm test` mocked storage aur Gemini unit tests chalata hai; is ke liye real API key ya running PostgreSQL zaroori nahi. JSON adapter ke tests temporary files istemal karte hain. `npm run test:typecheck` tests aur source dono ke TypeScript types check karta hai.

Unit tests valid deposit/withdraw/transfer par balance aur transaction behavior check karte hain; invalid amount, insufficient funds, self-transfer aur missing recipient par expected error verify karte hain. JSON adapter tests file persistence, concurrent local writes aur failed transfer rollback check karte hain.

Integration aur E2E tests aglay testing phases mein add honge.
