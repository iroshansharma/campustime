# CampusTime — Smart College Timetable Management System

CampusTime is a production-minded, full-stack timetable generation and management system built with **Django REST Framework**, **PostgreSQL**, and **React (Vite + TypeScript + Tailwind CSS)**. It features an automated **Constraint Satisfaction Problem (CSP)** scheduling engine that generates conflict-free schedules across multiple shifts, departments, semesters, sections, faculty availability parameters, and lab room constraints.

---

## Key Highlights

- **Constraint-Based Scheduling Engine**: Backtracking CSP algorithm with Most Constrained Variable (MRV) heuristic, conflict graph diagnostics, and consecutive lab slot placement.
- **Independent Verification**: Separate schedule validator guaranteeing zero room, teacher, or section double-booking.
- **Multi-Shift & Multi-Department**: Clean partitioning of Shift I (Morning), Shift II (Evening), breaks, and elective/lab requirements.
- **Role-Based Access Control**: Strict backend-enforced roles for **Admin**, **Faculty**, and **Student**.
- **Interactive Timetable Studio**: Weekly grid view with filtering by Section, Faculty, Room, Shift, plus manual slot-level editing with server re-validation.
- **Lifecycle Management**: Multi-state workflows (`DRAFT` → `REVIEW` → `PUBLISHED` → `ARCHIVED`) with revision history and audit logging.
- **Export & Reports**: Section and faculty timetables exported to high-resolution printable PDFs.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.10+, Django 5.x, Django REST Framework, SimpleJWT |
| **Frontend** | React 18/19, TypeScript, Vite, Tailwind CSS, Lucide React |
| **Database** | PostgreSQL (with automatic SQLite fallback for zero-dependency local dev) |
| **Testing** | Pytest-Django, Vitest |
| **Styling** | Modern Data-Dense UI adhering to WCAG AA accessibility |

---

## Directory Structure

```text
time_table_adgips/
├── .env.example              # Sample environment configuration
├── .gitignore                # Git ignore rules for Python & Node
├── PROJECT_PLAN.md           # Master architectural specification & roadmap
├── README.md                 # Project guide & quickstart
├── backend/                  # Django project root
│   ├── campustime/           # Settings, WSGI/ASGI, URLs
│   ├── apps/
│   │   ├── accounts/         # Users, roles, authentication
│   │   ├── academics/        # College, shifts, departments, semesters, sections, subjects
│   │   ├── faculty/          # Teacher profiles, qualifications, availability matrix
│   │   ├── rooms/            # Classrooms, labs, capacities, availability
│   │   ├── timetables/       # Timetable instances, entries, draft/publish lifecycle
│   │   ├── scheduling/       # CSP engine, heuristics, diagnostics, validator
│   │   └── audit/            # Change history and audit logs
│   ├── manage.py
│   └── requirements.txt
└── frontend/                 # React + Vite + TypeScript application
    ├── src/
    │   ├── components/       # UI primitives, Timetable grid, Layout
    │   ├── pages/            # Admin dashboard, academic setup, wizard, editor
    │   ├── services/         # REST API clients
    │   └── types/            # TypeScript interfaces
    ├── package.json
    └── tailwind.config.js
```

---

## Getting Started

### Prerequisites
- **Python**: 3.10 or higher
- **Node.js**: v18 or higher (v24.x recommended)
- **Database**: PostgreSQL (optional in local dev: SQLite fallback works automatically out of the box if PostgreSQL service is not configured)
- **Git**

### 1. Environment Configuration

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Review database credentials in `.env`. By default:
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/campustime_db
```
*Note: If PostgreSQL is not running locally, the backend gracefully falls back to `db.sqlite3` with an informational log.*

---

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Seed sample academic data (idempotent, verified)
python manage.py seed_academic_data

# Run development server
python manage.py runserver
```
The REST API will be available at `http://127.0.0.1:8000/api/v1/`.

### Demo Accounts Created by Seeder:
| Role | Username | Email | Default Password | Notes |
|---|---|---|---|---|
| **Admin** | `admin` | `admin@campustime.local` | `AdminPass@123` | Full academic and timetable permissions |
| **Faculty** | `dr.sharma` | `dr.sharma@campustime.local` | `FacultyPass@123` | Professor, CSE Department |
| **Faculty** | `dr.verma` | `dr.verma@campustime.local` | `FacultyPass@123` | Associate Professor, CSE Department |
| **Faculty** | `prof.kumar` | `prof.kumar@campustime.local` | `FacultyPass@123` | Assistant Professor, CSE Department |
| **Student** | `student1` | `student1@campustime.local` | `StudentPass@123` | CSE Sem 5 Section A |

---

## REST API Reference (`/api/v1/`)

Interactive Swagger UI documentation is available at:
```text
http://127.0.0.1:8000/api/v1/schema/swagger-ui/
```
OpenAPI 3 schema definition:
```text
http://127.0.0.1:8000/api/v1/schema/?format=json
```

### Authentication Endpoints
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/v1/auth/token/` | Obtain access & refresh JWT tokens + user profile | Public |
| `POST` | `/api/v1/auth/token/refresh/` | Refresh expired access token | Public |
| `GET` | `/api/v1/auth/me/` | Fetch authenticated user's role & linked profiles | Authenticated (`Bearer <token>`) |

#### Example Login Request:
```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "AdminPass@123"}'
```

#### Example Token Response:
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@campustime.local",
    "first_name": "Campus",
    "last_name": "Administrator",
    "role": "ADMIN",
    "is_staff": true,
    "faculty_profile": null,
    "student_profile": null
  }
}
```

### Academic Management Endpoints
All modifying requests (`POST`, `PUT`, `PATCH`, `DELETE`) require `Role=ADMIN`. `GET` is accessible to authenticated Faculty and Students.

| Endpoint | Supported Operations | Query Filters |
|---|---|---|
| `/api/v1/academics/colleges/` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `search` |
| `/api/v1/academics/academic-years/` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `?college=<id>&is_current=true` |
| `/api/v1/academics/shifts/` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `?college=<id>&is_active=true` |
| `/api/v1/academics/working-days/` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `?college=<id>&is_active=true` |
| `/api/v1/academics/period-slots/` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `?shift=<id>&day_of_week=MON&is_break=false` |
| `/api/v1/academics/departments/` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `?college=<id>&is_active=true` |
| `/api/v1/academics/semesters/` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `?academic_year=<id>&department=<id>&shift=<id>` |
| `/api/v1/academics/sections/` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `?semester=<id>&department=<id>` |
| `/api/v1/academics/subjects/` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `?department=<id>&subject_type=THEORY` |


### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install npm dependencies
npm install

# Start Vite dev server
npm run dev
```
The application will be accessible at `http://localhost:5173/`.

---

## 10-Step Administration Flow

1. **College & Academic Years**: Define institution details and active academic years.
2. **Working Days & Shifts**: Configure Shift I / Shift II timings, period durations, and break slots.
3. **Departments & Semesters**: Create academic departments, semesters, and student sections.
4. **Faculty Profiles & Availability**: Add teachers and define their weekly time availability slots.
5. **Subjects & Qualifications**: Register subjects (theory vs. lab) and map qualified instructors.
6. **Section Allocations**: Allocate subject-faculty assignments per section.
7. **Curriculum Requirements**: Set weekly periods required and consecutive lab duration requirements.
8. **Classrooms & Labs**: Add rooms, seat capacities, and lab equipment designations.
9. **Generation Settings**: Set generator parameters, optimization priorities, and locked slots.
10. **Generate, Review & Publish**: Run the CSP engine, review conflict diagnostics, refine entries, and publish.

---

## Running Tests

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
npm run test
```

---

## License & Attribution
Designed and built for collegiate institutions. Released under the MIT License.
