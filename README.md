# Carnival Scoring — Backend (API + Database)

A multi-tenant Node.js + Express API with PostgreSQL for the school cross country
carnival app. Each school is an isolated tenant; users log in and have a role
(**admin**, **scorer**, or **viewer**). Built to deploy onto the Azure
**Web App + Database** you created.

## What's inside

```
carnival-backend/
├─ db/schema.sql        # all tables (schools, users, factions, students, results, participation)
├─ src/
│  ├─ server.js         # Express app; serves /api and the built frontend from /public
│  ├─ db.js             # PostgreSQL connection pool
│  ├─ auth.js           # password hashing, login tokens, role checks
│  ├─ migrate.js        # creates the tables (npm run migrate)
│  ├─ seed.js           # optional demo data (npm run seed)
│  └─ routes/           # auth, factions, students, results, participation, settings, scoreboard
├─ .env.example
└─ package.json
```

## Run it locally

1. Install Node 20+ and a local PostgreSQL (or point at any Postgres).
2. `cp .env.example .env` and set `DATABASE_URL` and a `JWT_SECRET`.
3. `npm install`
4. `npm run migrate`   – creates the tables
5. `npm run seed`      – (optional) demo school + students. Login: `demo@demo.test` / `changeme123`
6. `npm start`         – API on http://localhost:8080  (check `/api/health`)

## Deploy to your Azure Web App + Database

1. Push this folder to a **GitHub repo**.
2. In the Azure Portal, open your **PostgreSQL** resource → **Connect** / connection
   strings, and copy the connection string (URL form).
3. Open your **App Service** → **Configuration** → **Application settings** and add:
   - `DATABASE_URL` = that connection string (ensure it ends with `?sslmode=require`)
   - `JWT_SECRET` = a long random string
     (generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
4. App Service → **Deployment Center** → connect your GitHub repo + branch. It will
   build and deploy automatically on every push.
5. Create the tables: App Service → **SSH** → `npm run migrate`.
6. Browse to `https://<your-app-name>.azurewebsites.net/api/health` → should return `{ "ok": true }`.

> The database is private to the App Service, so migrations are run from inside it (SSH).
> Never commit `.env` or share `JWT_SECRET` / database passwords.

## Roles

| Role    | Can do |
|---------|--------|
| admin   | everything: setup, factions, roster, add users, enter results |
| scorer  | enter results and participation |
| viewer  | read-only (tally, champions, qualifiers) |

## API reference

All routes are under `/api`. Send `Authorization: Bearer <token>` for everything
except register/login. Every request is automatically scoped to the caller's school.

**Auth**
- `POST /auth/register` `{ schoolName, email, password, name }` → creates a school + admin, returns `{ token, user, school }`
- `POST /auth/login` `{ email, password }` → `{ token, user }`
- `GET  /auth/me` → `{ user, school }`
- `POST /auth/users` *(admin)* `{ email, password, name, role }` → add a colleague
- `GET  /auth/users` *(admin)* → list users

**Factions**
- `GET /factions` · `POST /factions` *(admin)* · `PUT /factions/:id` *(admin)* · `DELETE /factions/:id` *(admin)*

**Students**
- `GET /students` · `POST /students` *(admin)* · `POST /students/bulk` *(admin)* `[ {name,year_group,gender,faction_id} ]`
- `PUT /students/:id` *(admin)* · `DELETE /students/:id` *(admin)*

**Results** (placements)
- `GET /results`
- `PUT /results` *(admin/scorer)* `{ year_group, gender, place, student_id }` – set/replace a place
- `DELETE /results` *(admin/scorer)* `{ year_group, gender, place }` – clear a place

**Participation**
- `GET /participation`
- `PUT /participation` *(admin/scorer)* `{ year_group, gender, faction_id, count }`

**Settings**
- `GET /settings` → `{ name, carnival_name, settings }`
- `PUT /settings` *(admin)* `{ name?, carnival_name?, settings? }`

**Scoreboard** (computed)
- `GET /scoreboard/tally` → faction totals (placement + participation), sorted
- `GET /scoreboard/champions` → 1st & 2nd per race
- `GET /scoreboard/qualifiers` → top-N per race

## Next step

The frontend (the React app) still talks to browser storage. To make it multi-user,
point it at this API: on login, store the token; replace the local load/save calls
with `fetch` calls to these endpoints, sending the token. Drop the built frontend
into a `/public` folder here and the same App Service serves both.
