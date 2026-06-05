# 🌧 Rainback — Backend API

Private membership platform for independent restaurants.

---

## Stack

| Layer | Tech |
|-------|------|
| API server | Node.js 18+ + Fastify |
| Database | PostgreSQL 15+ |
| Auth | JWT (30-day tokens) |
| Payments | Stripe Connect |
| Wallet | Apple PassKit + Google Wallet |
| Email | Nodemailer (Gmail / Resend) |
| Hosting | Railway (API + DB) + Vercel (frontend) |

---

## Quick Start (local development)

### 1. Prerequisites

```bash
# Check you have Node 18+
node --version

# Check you have PostgreSQL running
psql --version
```

### 2. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/rainback-backend.git
cd rainback-backend
npm install
```

### 3. Create your .env file

```bash
cp .env.example .env
```

Open `.env` and fill in:
- `DATABASE_URL` — your local PostgreSQL URL
- `JWT_SECRET` — run `openssl rand -hex 64` to generate one
- `STRIPE_SECRET_KEY` — from stripe.com/dashboard (use test key for dev)
- `STRIPE_WEBHOOK_SECRET` — from Stripe CLI (see step 5)
- `SMTP_USER` + `SMTP_PASS` — your Gmail + App Password (or Resend)

### 4. Create database and run migrations

```bash
# Create the database (if it doesn't exist)
createdb rainback

# Run schema — creates all tables
npm run db:migrate
```

You should see: `✓ Schema applied successfully`

### 5. Start Stripe webhook listener (separate terminal)

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3001/webhooks/stripe
```

Copy the webhook secret (`whsec_...`) into your `.env` as `STRIPE_WEBHOOK_SECRET`

### 6. Start the server

```bash
npm run dev
```

You should see:
```
🌧  Rainback API running on port 3001
   Health: http://localhost:3001/health
```

---

## API Routes Reference

### Auth
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/signup` | None | Create account |
| POST | `/api/auth/login` | None | Email + password login |
| POST | `/api/auth/otp/send` | None | Send OTP to email |
| POST | `/api/auth/otp/verify` | None | Verify OTP, get token |
| GET  | `/api/auth/me` | Token | Get current user |
| PATCH| `/api/auth/me` | Token | Update profile |

### Restaurants
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET  | `/api/restaurants` | None | List active restaurants |
| GET  | `/api/restaurants/:slug` | None | Single restaurant + perks |
| POST | `/api/restaurants` | Owner | Create restaurant |
| PATCH| `/api/restaurants/:id` | Owner | Update restaurant |
| POST | `/api/restaurants/:id/stripe-connect` | Owner | Get Stripe onboarding link |
| POST | `/api/restaurants/apply` | None | Landing page application |

### Memberships
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/memberships/intent` | Member | Create Stripe PaymentIntent |
| POST | `/api/memberships/purchase` | Member | Confirm purchase, generate pass |
| GET  | `/api/memberships/mine` | Member | Get all my memberships |
| GET  | `/api/memberships/:id/pass` | Member | Get wallet pass URL |
| GET  | `/api/memberships/restaurant/:id` | Owner | List all members |

### Dashboard (owner)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/dashboard/:restaurantId` | Owner | All KPIs, tonight, activity |
| GET | `/api/dashboard/:restaurantId/sales-chart` | Owner | 30-day sales data |

### Events
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET  | `/api/events/restaurant/:id` | Member | Upcoming events |
| POST | `/api/events/:restaurantId` | Owner | Create event |
| POST | `/api/events/:eventId/rsvp` | Member | RSVP |
| DELETE | `/api/events/:eventId/rsvp` | Member | Cancel RSVP |
| GET  | `/api/events/:restaurantId/all` | Owner | All events |

### Votes / Notes / Menu / Check-in
Same pattern — see `/src/routes/combined.js`

### Webhooks
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/webhooks/stripe` | Stripe event handler |

---

## Deploy to Railway

### First time

1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Add PostgreSQL plugin (click + → PostgreSQL)
4. Railway auto-sets `DATABASE_URL` in your environment
5. Add all other env vars from `.env.example` in Railway's Variables tab
6. Railway deploys automatically on every git push

### Environment variables to add in Railway

Copy every variable from `.env.example` into Railway → Variables. The most important:

```
NODE_ENV=production
JWT_SECRET=<your 64-char secret>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=https://rainback.com
API_URL=https://your-railway-url.railway.app
SMTP_USER=miamirainback@gmail.com
SMTP_PASS=<gmail app password>
```

### Custom domain (optional)

In Railway → Settings → Domains → add `api.rainback.com`
Then in Cloudflare → DNS → add CNAME pointing to Railway URL.

---

## Apple PassKit Setup

This is needed for wallet passes. Do this after Railway is live.

### 1. Create a Pass Type ID

1. Go to [developer.apple.com](https://developer.apple.com)
2. Certificates, Identifiers & Profiles → Identifiers → +
3. Pass Type IDs → Continue
4. Description: "Rainback Membership Pass"
5. Identifier: `pass.com.rainback.membership`
6. Register

### 2. Create the certificate

1. On your Mac, open Keychain Access
2. Keychain Access → Certificate Assistant → Request Certificate from CA
3. Save to disk as `CertificateSigningRequest.certSigningRequest`
4. Back in developer.apple.com → your Pass Type ID → Create Certificate
5. Upload the `.certSigningRequest` file
6. Download the generated `.cer` file
7. Double-click it to add to Keychain

### 3. Export the files

```bash
# Export signerCert.pem
openssl x509 -in PassCertificate.cer -out signerCert.pem

# Export signerKey.pem from Keychain
# In Keychain: right-click your Pass cert → Export → .p12
openssl pkcs12 -in YourCert.p12 -nocerts -nodes -out signerKey.pem

# Download WWDR certificate from Apple:
# https://developer.apple.com/certificationauthority/AppleWWDRCAG4.cer
openssl x509 -in AppleWWDRCAG4.cer -out wwdr.pem
```

### 4. Add to Railway

Upload all three `.pem` files to your Railway project under `/passes/certs/`
Or add them as base64 environment variables.

---

## Stripe Connect Setup

### Enable Connect

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Connect → Settings → Enable
3. Platform profile → select "Platform that provides services to businesses"
4. Go live when ready (test mode works for development)

### Webhook events to enable

In Stripe Dashboard → Webhooks → Add endpoint:
- URL: `https://your-api.railway.app/webhooks/stripe`
- Events: `payment_intent.succeeded`, `account.updated`

---

## Frontend Connection

Once the API is live, update the HTML shells to point to your API:

```javascript
// At the top of each shell, replace:
const API_BASE = 'http://localhost:3001'

// With your production URL:
const API_BASE = 'https://your-api.railway.app'
```

All `TODO: GET /api/...` comments in the shells map directly to routes above.

---

## Project Structure

```
rainback-backend/
├── src/
│   ├── index.js              ← Fastify server
│   ├── db/
│   │   ├── schema.sql        ← All database tables
│   │   ├── client.js         ← PostgreSQL connection
│   │   └── migrate.js        ← Run schema
│   ├── routes/
│   │   ├── auth.js           ← Signup, login, OTP
│   │   ├── restaurants.js    ← Restaurant CRUD
│   │   ├── memberships.js    ← Purchase + passes
│   │   ├── dashboard.js      ← Owner KPIs
│   │   ├── combined.js       ← Events, votes, notes, menu, checkin
│   │   └── stripe-webhook.js ← Payment confirmations
│   ├── services/
│   │   ├── stripe.js         ← Stripe Connect
│   │   ├── passkit.js        ← Apple Wallet pass generation
│   │   └── email.js          ← Transactional email
│   └── middleware/
│       └── auth.js           ← JWT verification
├── passes/
│   ├── template/pass.json    ← Wallet card design
│   └── certs/                ← Apple certificates (not in git)
├── .env.example              ← Environment variable template
├── railway.toml              ← Railway deployment config
├── vercel.json               ← Vercel frontend config
└── package.json
```

---

## Polsia: Getting This Running

**Exact steps in order:**

```bash
# 1. Clone the repo
git clone <repo-url> && cd rainback-backend

# 2. Install dependencies
npm install

# 3. Copy env file and fill in values
cp .env.example .env
# Edit .env — minimum needed to start:
# DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY

# 4. Run migrations
npm run db:migrate

# 5. Start dev server
npm run dev

# 6. Test health check
curl http://localhost:3001/health
# Should return: {"status":"ok","ts":"..."}

# 7. Test signup
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234","firstName":"Test","lastName":"User"}'
# Should return: {"token":"...","user":{...}}
```

If anything fails, check:
1. Is PostgreSQL running? (`pg_isready`)
2. Is DATABASE_URL correct?
3. Did migrations run? (check for tables with `\dt` in psql)

---

*Built by Claude for Matteo Caprioli · Rainback · May 2026*
