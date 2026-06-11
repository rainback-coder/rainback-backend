-- ═══════════════════════════════════════════════════════
-- RAINBACK — Complete Database Schema
-- Run this once on your PostgreSQL database
-- ═══════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── USERS ──────────────────────────────────────────────
-- Both restaurant owners and members share this table
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT,                          -- null if magic-link only
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','owner','admin')),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── RESTAURANTS ────────────────────────────────────────
CREATE TABLE restaurants (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  slug                  TEXT UNIQUE NOT NULL,    -- e.g. "doya-miami" for app.rainback.com/doya-miami
  neighborhood          TEXT NOT NULL,
  city                  TEXT NOT NULL,
  country               TEXT NOT NULL DEFAULT 'US',
  address               TEXT,
  cuisine               TEXT,
  instagram             TEXT,
  description           TEXT,
  cover_image_url       TEXT,
  logo_url              TEXT,
  -- Membership config
  membership_cap        INTEGER NOT NULL DEFAULT 200,
  membership_price      NUMERIC(10,2) NOT NULL DEFAULT 150.00,
  membership_duration   TEXT NOT NULL DEFAULT '1 year' CHECK (membership_duration IN ('1 year','6 months','season')),
  tier_name             TEXT NOT NULL DEFAULT 'Founding Member',
  -- Stripe
  stripe_account_id     TEXT,                   -- Stripe Connect account ID
  stripe_onboarded      BOOLEAN DEFAULT FALSE,
  -- Status
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paused','closed')),
  founded_year          INTEGER,
  founding_story        TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── PERKS ──────────────────────────────────────────────
CREATE TABLE perks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  sort_order      INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── MEMBERSHIPS (individual purchases) ────────────────
CREATE TABLE memberships (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  member_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  serial_number     INTEGER NOT NULL,           -- e.g. 37 (of 200)
  tier              TEXT NOT NULL DEFAULT 'Founding Member',
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled','refunded')),
  -- Payment
  stripe_payment_id TEXT,
  amount_paid       NUMERIC(10,2) NOT NULL,
  rainback_fee      NUMERIC(10,2) NOT NULL,
  restaurant_amount NUMERIC(10,2) NOT NULL,
  -- Dates
  purchased_at      TIMESTAMPTZ DEFAULT NOW(),
  valid_from        TIMESTAMPTZ DEFAULT NOW(),
  valid_until       TIMESTAMPTZ,
  renewed_at        TIMESTAMPTZ,
  -- Wallet pass
  pass_serial       TEXT UNIQUE DEFAULT uuid_generate_v4()::text,
  pass_auth_token   TEXT UNIQUE DEFAULT uuid_generate_v4()::text,
  pass_url          TEXT,
  UNIQUE(restaurant_id, serial_number)
);

-- ── CHECK-INS ──────────────────────────────────────────
CREATE TABLE check_ins (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  membership_id   UUID NOT NULL REFERENCES memberships(id) ON DELETE RESTRICT,
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  member_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  checked_in_at   TIMESTAMPTZ DEFAULT NOW(),
  method          TEXT DEFAULT 'qr' CHECK (method IN ('qr','nfc','manual')),
  party_size      INTEGER DEFAULT 1,
  notes           TEXT
);

-- ── EVENTS ─────────────────────────────────────────────
CREATE TABLE events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  event_date      TIMESTAMPTZ NOT NULL,
  capacity        INTEGER NOT NULL DEFAULT 20,
  audience        TEXT DEFAULT 'all' CHECK (audience IN ('all','founding')),
  status          TEXT DEFAULT 'published' CHECK (status IN ('draft','published','cancelled')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_rsvps (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_id   UUID REFERENCES memberships(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, member_id)
);

-- ── VOTES ──────────────────────────────────────────────
CREATE TABLE votes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  status          TEXT DEFAULT 'live' CHECK (status IN ('live','closed','draft')),
  closes_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vote_options (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id   UUID NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
  text      TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE vote_responses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id         UUID NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
  vote_option_id  UUID NOT NULL REFERENCES vote_options(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vote_id, member_id)
);

-- ── NOTES (restaurant → members) ──────────────────────
CREATE TABLE notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  audience        TEXT DEFAULT 'all' CHECK (audience IN ('all','founding','inactive')),
  sent_at         TIMESTAMPTZ,
  open_count      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── MENU DISHES ────────────────────────────────────────
CREATE TABLE menu_dishes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT DEFAULT 'Main' CHECK (category IN ('Starter','Main','Side','Dessert','Drink')),
  price           NUMERIC(8,2),
  -- Nutrition
  nutrition_mode  TEXT DEFAULT 'ai' CHECK (nutrition_mode IN ('ai','precise')),
  ai_ingredients  TEXT,                        -- free text for AI mode
  ai_portion      TEXT DEFAULT 'medium',
  kcal            INTEGER,
  protein_g       NUMERIC(6,1),
  fat_g           NUMERIC(6,1),
  carbs_g         NUMERIC(6,1),
  is_visible      BOOLEAN DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE menu_ingredients (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dish_id     UUID NOT NULL REFERENCES menu_dishes(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  grams       NUMERIC(8,1) NOT NULL,
  sort_order  INTEGER DEFAULT 0
);

-- ── WAITLIST ───────────────────────────────────────────
CREATE TABLE waitlist (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  name            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, email)
);

-- ── RESTAURANT APPLICATIONS (from landing page form) ──
CREATE TABLE restaurant_applications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_name     TEXT NOT NULL,
  neighborhood        TEXT,
  city                TEXT,
  cuisine             TEXT,
  instagram           TEXT,
  address             TEXT,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  role                TEXT,
  email               TEXT NOT NULL,
  phone               TEXT,
  referral            TEXT,
  membership_cap      INTEGER DEFAULT 200,
  membership_price    NUMERIC(10,2) DEFAULT 150,
  duration            TEXT DEFAULT '1 year',
  perks               TEXT,
  custom_perk         TEXT,
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','onboarded')),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ────────────────────────────────────────────
CREATE INDEX idx_memberships_member ON memberships(member_id);
CREATE INDEX idx_memberships_restaurant ON memberships(restaurant_id);
CREATE INDEX idx_memberships_status ON memberships(status);
CREATE INDEX idx_check_ins_member ON check_ins(member_id);
CREATE INDEX idx_check_ins_restaurant ON check_ins(restaurant_id);
CREATE INDEX idx_check_ins_date ON check_ins(checked_in_at DESC);
CREATE INDEX idx_events_restaurant ON events(restaurant_id);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_votes_restaurant ON votes(restaurant_id);
CREATE INDEX idx_menu_dishes_restaurant ON menu_dishes(restaurant_id);
CREATE INDEX idx_restaurants_slug ON restaurants(slug);
CREATE INDEX idx_restaurants_city ON restaurants(city);
CREATE INDEX idx_restaurants_status ON restaurants(status);

-- ── UPDATED_AT TRIGGER ─────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER restaurants_updated_at BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER menu_dishes_updated_at BEFORE UPDATE ON menu_dishes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Coordinates for the interactive map (added safely) ──
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS latitude  NUMERIC(10,7);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);

-- ═══════════════════════════════════════════════════════
-- Schema complete. Run: psql $DATABASE_URL -f schema.sql
-- ═══════════════════════════════════════════════════════
