# CampusTime — Free Cloud Hosting & Deployment Guide

This guide walks through deploying the **CampusTime Smart College Timetable Management System** to production using 100% free-tier services suitable for a high-impact portfolio demonstration.

```
                  ┌───────────────────────────────┐
                  │       GitHub Repository       │
                  │ (Source Code & CI Integration)│
                  └───────────────┬───────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  │                               │
                  ▼                               ▼
       ┌─────────────────────┐         ┌─────────────────────┐
       │   Vercel Frontend   │         │   Render Backend    │
       │  React + Vite (SPA) │◄───────►│ Django REST + WSGI  │
       │ (campustime.vercel) │  HTTPS  │ (.onrender.com/api) │
       └─────────────────────┘         └──────────┬──────────┘
                                                  │
                                                  │ PostgreSQL (SSL)
                                                  ▼
                                       ┌─────────────────────┐
                                       │    Neon Database    │
                                       │ Serverless Postgres │
                                       └─────────────────────┘
```

---

## 1. Hosting Architecture & Free-Tier Plan

| Component | Service | Free Tier Allocation | Key Role |
|---|---|---|---|
| **Source Control** | **GitHub** | Unlimited public/private repositories | Version control and automated deployment triggers |
| **Backend API** | **Render** | 750 free instance hours/month | Django REST Framework, WhiteNoise static files, ReportLab PDF generation |
| **Database** | **Neon** | 0.5 GiB storage, serverless compute | Managed PostgreSQL 16 with SSL encryption |
| **Frontend UI** | **Vercel** | 100 GB bandwidth, unlimited deployments | Fast global CDN, single-page application rewrites |

---

## Phase 1: Push Source Code to GitHub

> [!IMPORTANT]
> Verify that no local `.env` files or `db.sqlite3` databases are tracked before pushing. The `.gitignore` is pre-configured to strictly exclude sensitive files.

### Step 1.1: Create a New GitHub Repository
1. Log in to [GitHub](https://github.com/).
2. Click **New Repository** (or visit [github.com/new](https://github.com/new)).
3. Repository name: `campustime` (or your preferred name).
4. Select **Public** (recommended for portfolio) or **Private**.
5. **DO NOT** initialize with a README, .gitignore, or license (these already exist locally).
6. Click **Create repository**.

### Step 1.2: Add Remote and Push Local Code
Open your terminal in `D:\Downloads\free-work\time_table_adgips` and execute:

```bash
# Verify current branch is main
git branch -M main

# Add your GitHub remote (replace with your actual GitHub username)
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/campustime.git

# Push the verified codebase
git push -u origin main
```

---

## Phase 2: Provision Free Neon PostgreSQL Database

### Step 2.1: Create Neon Project
1. Go to [Neon Console](https://console.neon.tech/) and sign up / sign in (using GitHub is recommended).
2. Click **Create Project**.
3. Settings:
   - **Project Name**: `campustime-db`
   - **Postgres Version**: `16` (or latest default)
   - **Region**: Select the region closest to your users or Render region (e.g., `US East (Ohio)` or `Frankfurt`).
4. Click **Create Project**.

### Step 2.2: Retrieve Connection String
1. In the Neon Project Dashboard, navigate to the **Connection Details** card.
2. Select **Connection string** and choose **Django** or **psycopg2**.
3. It will look like:
   ```
   postgresql://<USER>:<PASSWORD>@<ENDPOINT_ID>.neon.tech/neondb?sslmode=require
   ```
4. **Copy this string and keep it private.** Never commit this string or paste it into public forums.

---

## Phase 3: Deploy Django Backend on Render

You can deploy on Render using either the **Automated Blueprint** or the **Manual Dashboard** method.

### Option A: Manual Web Service Setup (Recommended)
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** > **Web Service**.
3. Connect your GitHub repository `campustime`.
4. Configure the service:
   - **Name**: `campustime-api`
   - **Region**: Match or choose near your Neon region (e.g., `Ohio (US East)`).
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python`
   - **Build Command**: `bash build.sh`
   - **Start Command**: `gunicorn campustime.wsgi:application --bind 0.0.0.0:$PORT`
   - **Instance Type**: `Free`

5. Expand **Advanced** and set **Health Check Path**: `/health/`

6. Under **Environment Variables**, add:
   | Key | Value | Notes |
   |---|---|---|
   | `PYTHON_VERSION` | `3.11.9` | Ensures compatible Python runtime |
   | `DEBUG` | `False` | Disables debug mode in production |
   | `SECRET_KEY` | *(Click "Generate" or paste a 50+ character random string)* | Cryptographic security |
   | `USE_SQLITE` | `False` | Forces PostgreSQL usage |
   | `DATABASE_URL` | `postgresql://<USER>:<PASSWORD>@<ENDPOINT_ID>.neon.tech/neondb?sslmode=require` | Your private Neon connection string |
   | `ALLOWED_HOSTS` | `localhost,127.0.0.1,.onrender.com` | Allows Render domain |
   | `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Temporary until Vercel URL is created |
   | `CSRF_TRUSTED_ORIGINS` | `http://localhost:5173,https://campustime-api.onrender.com` | Update with your actual Render URL |
   | `SCHEDULER_TIMEOUT_SECONDS` | `60` | Timetable CSP solver budget |
   | `SCHEDULER_MAX_BACKTRACK_STEPS` | `50000` | Timetable CSP search limit |

7. Click **Create Web Service**.
8. Render will run `bash build.sh` (pip install, `collectstatic` for WhiteNoise, and `migrate` for database schemas) and start Gunicorn.
9. Note your Render URL: `https://campustime-api.onrender.com`.

---

## Phase 4: Deploy React Frontend on Vercel

### Step 4.1: Import Project in Vercel
1. Log in to [Vercel](https://vercel.com/) (sign in with GitHub).
2. Click **Add New...** > **Project**.
3. Import the `campustime` repository from your GitHub account.

### Step 4.2: Configure Build & Output
1. **Framework Preset**: `Vite`
2. **Root Directory**: Click `Edit` and select `frontend`.
3. **Build & Output Settings**:
   - Build Command: `npm run build` (or default `tsc && vite build`)
   - Output Directory: `dist`
   - Install Command: `npm install`

### Step 4.3: Environment Variables
Add the following under **Environment Variables**:
| Key | Value | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `https://campustime-api.onrender.com/api/v1` | **Points to your deployed Render backend** |
| `VITE_APP_TITLE` | `CampusTime — Smart Timetable System` | Browser tab title |

4. Click **Deploy**.
5. Once complete, note your Vercel URL: `https://campustime-xxx.vercel.app`.

---

## Phase 5: Link CORS & CSRF Between Frontend & Backend

Now that your frontend has a live Vercel URL, authorize it in the Django backend:

1. In the **Render Dashboard**, go to your `campustime-api` Web Service > **Environment**.
2. Update `CORS_ALLOWED_ORIGINS`:
   ```
   http://localhost:5173,https://<YOUR-VERCEL-SUBDOMAIN>.vercel.app
   ```
3. Update `CSRF_TRUSTED_ORIGINS`:
   ```
   http://localhost:5173,https://<YOUR-VERCEL-SUBDOMAIN>.vercel.app,https://campustime-api.onrender.com
   ```
4. Click **Save Changes**. Render will automatically redeploy with the new allowed origins.

---

## Phase 6: Post-Deployment Data Setup

### Option 6.1: Seed Comprehensive Demo Academic Data (Fastest)
The codebase includes an atomic seed command that populates academic structures, departments, shifts, classrooms, faculty, workloads, and qualifications:

1. Open Render Dashboard > `campustime-api` > **Shell** tab.
2. Run:
   ```bash
   python manage.py seed_academic_data
   ```
3. This creates:
   - **Admin User**: Username `admin`, Password `AdminPass@123`
   - **Demo Faculty**: `dr.sharma`, `dr.verma`, `prof.kumar`, etc. (Password: `FacultyPass@123`)
   - **Demo Student**: Username `student1` (Password: `StudentPass@123`)
   - Departments: CSE, IT, ECE
   - Shifts & Period Slots
   - Classrooms & Laboratories
   - Section Subject Assignments & Availability Matrices

### Option 6.2: Create a Custom Superuser
If you prefer creating a custom administrator account from scratch:
1. In the Render **Shell** tab:
   ```bash
   python manage.py createsuperuser
   ```
2. Follow prompts for username, email, and password.

---

## Phase 7: Verification & Quality Assurance Checklist

Log into your live Vercel URL and test the full end-to-end lifecycle:

- [ ] **1. Authentication**:
  - Log in with `admin` / `AdminPass@123`.
  - Check that dashboard metrics and navigation load without console errors.
- [ ] **2. Faculty Management**:
  - Open **Faculty Management** (`/faculty`).
  - Click **Add Faculty** button.
  - Fill in instructor details, department, designation, and teaching limits.
  - Submit and confirm instructor appears in the table.
- [ ] **3. Faculty Qualifications & Availability**:
  - View instructor availability matrix (`/faculty/availability`).
  - Toggle a slot to Preferred or Blocked and save.
- [ ] **4. Subject Allocation**:
  - Open **Subject Allocations** (`/faculty/allocations`).
  - Verify qualified instructors are assigned to section curriculum subjects.
- [ ] **5. Timetable Generation**:
  - Open **Automatic Timetable Generator** (`/timetables/generate`).
  - Select Academic Year 2024-2025, Morning Shift, CSE, Semester 5.
  - Click **Run Automatic Timetable Generator**.
  - Verify solver finishes with status `OPTIMAL` or `FEASIBLE` with 0 constraint conflicts.
- [ ] **6. Timetable Publishing & PDF Export**:
  - Open the generated timetable grid.
  - Click **Publish Timetable**.
  - Click **Export PDF** and verify the ReportLab timetable PDF downloads cleanly.

---

## Phase 8: Troubleshooting Common Cloud Hosting Issues

### 1. Render Free Tier Sleep Behavior ("Spin-Down")
- **Symptom**: First API request takes 45–60 seconds to respond.
- **Cause**: Free Render Web Services spin down after 15 minutes of inactivity.
- **Fix**: Wait ~50 seconds for the container to wake up. Once awake, subsequent requests respond in under 150ms. (You can also use a free cron monitor like [UptimeRobot](https://uptimerobot.com) to ping `https://<YOUR-API>.onrender.com/health/` every 10 minutes during portfolio review periods).

### 2. CORS `Network Error` or Preflight Blocked
- **Symptom**: Frontend console shows `Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource`.
- **Cause**: `CORS_ALLOWED_ORIGINS` in Render does not exactly match your Vercel URL (e.g. missing `https://`, trailing slash, or wrong subdomain).
- **Fix**: In Render environment variables, verify `CORS_ALLOWED_ORIGINS` contains the exact Vercel protocol and host: `https://<app>.vercel.app` (without trailing slash).

### 3. Vercel 404 on Page Refresh
- **Symptom**: Navigating inside the app works, but pressing Refresh on `/faculty` or `/timetables` returns 404.
- **Cause**: Static CDN cannot find a file at `/faculty/index.html`.
- **Fix**: Resolved by `frontend/vercel.json`, which redirects all routes to `/index.html`.

### 4. Database Connection Refused or SSL Error
- **Symptom**: `OperationalError: connection to server failed: SSL error`.
- **Cause**: Neon requires TLS/SSL connection.
- **Fix**: Ensure your `DATABASE_URL` ends with `?sslmode=require`.

### 5. Frontend Still Requests `localhost:8000`
- **Symptom**: Production frontend errors out trying to call `http://127.0.0.1:8000`.
- **Cause**: `VITE_API_BASE_URL` was not set in Vercel before building, or the project was not rebuilt after adding it.
- **Fix**: In Vercel, go to **Settings** > **Environment Variables**, verify `VITE_API_BASE_URL`, then go to **Deployments** > click `...` on the latest deployment > **Redeploy**.
