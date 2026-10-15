# Mini Wallet Backend

Backend NestJS API hai. PostgreSQL connection `DATABASE_URL` se, aur JWT signing `JWT_SECRET` se configure hoti hai.

## Setup

PowerShell mein `backend` folder ke andar:

```powershell
Copy-Item .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

`migrate dev` se pehle `.env` mein sahi PostgreSQL URL set karein aur database create karein. Repo mein initial migration pehle se maujood hai. API `http://localhost:3000` par chalegi aur frontend origin `.env` ke `FRONTEND_URL` se allow hota hai (local development: `http://localhost:3001`). `JWT_SECRET` ko development ke bahar strong random secret se replace karein.

## API

Registration aur login ke baad protected routes ko `Authorization: Bearer <accessToken>` header chahiye.

| Method | Route | Kaam |
| --- | --- | --- |
| `POST` | `/auth/register` | `{ "email": "...", "password": "minimum 8 chars" }` se account banata hai |
| `POST` | `/auth/login` | Credentials verify karke JWT deta hai |
| `GET` | `/wallet/balance` | Logged-in user ka balance deta hai |
| `POST` | `/transactions/deposit` | `{ "amount": 20.00 }` deposit karta hai |
| `POST` | `/transactions/withdraw` | Funds available hon to amount withdraw karta hai |
| `POST` | `/transactions/transfer` | `{ "recipientEmail": "...", "amount": 20.00 }` transfer karta hai |
| `GET` | `/transactions` | Logged-in user ki latest 100 transactions deta hai |

Amount positive hona chahiye aur maximum 2 decimal places ho sakte hain. Withdraw ya transfer ke liye balance kam ho to API `400` status aur `Insufficient funds` message deti hai. Har balance update aur transaction record aik database transaction mein hota hai.

## Checks

```powershell
npm run build
npm run lint
npm test
npm run test:typecheck
```

`npm test` mocked Prisma ke saath unit tests chalata hai; is ke liye running PostgreSQL zaroori nahi. `npm run test:typecheck` tests aur source dono ke TypeScript types check karta hai.

Unit tests valid deposit/withdraw/transfer par balance aur transaction calls check karte hain; invalid amount, insufficient funds, self-transfer aur missing recipient par expected error aur database calls na hone ko verify karte hain. Balance/history tests formatting, missing user aur latest 100 records ki limit check karte hain. In mein se koi bhi regression test fail karega agar corresponding wallet behavior toot jaye.

Integration aur E2E tests aglay testing phases mein add honge.
