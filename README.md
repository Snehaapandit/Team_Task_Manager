# TeamFlow Tasks - Team Task Management Web Application

A full-stack Team Task Management Web Application where users can create projects, add team members, assign tasks, update task status, and track project progress through a clean role-based dashboard.

This project is built for a real-world collaborative workflow, similar to a simplified Trello or Asana, with Admin and Member access levels.


# FEATURES


## User Authentication

- Signup with name, email, and password
- Secure login using JWT authentication
- Password hashing with bcrypt
- Protected REST API routes

## Role-Based Access

- Admin and Member project roles
- Project creator automatically becomes Admin
- Admin can manage project members and tasks
- Member can view project details and update only assigned tasks

## Project Management

- Create new projects
- View assigned projects
- Add registered users to projects by email
- Remove project members as Admin

## Task Management

- Create tasks with:
  - Title
  - Description
  - Due date
  - Priority
  - Assignee

- Task status support:
  - To Do
  - In Progress
  - Done

- Admin can create, assign, delete, and manage tasks
- Members can update status of their assigned tasks only

## Dashboard

- Total tasks
- Tasks by status
- Tasks per user
- Overdue tasks
- Separate Admin Console and Member Workspace UI

## Frontend UI

- Modern landing page
- Login/Register screen with role selection
- Sidebar dashboard navigation
- Separate pages for:
  - Dashboard
  - Projects
  - Tasks
  - Members
  - Reports

- Responsive design with clean cards, task columns, and project previews


# TECH STACK


Frontend   : HTML, CSS, Vanilla JavaScript  
Backend    : Node.js, Express.js  
Database   : PostgreSQL  
Auth       : JWT + bcryptjs  
Deployment : Railway  


# PREREQUISITES


- Node.js >= 20
- npm
- PostgreSQL for production
- Railway account for deployment
- GitHub repository

For quick local development, the app also supports an in-memory database using `memory://local`.


# SETUP INSTRUCTIONS


## 1. Clone The Repository

```bash
git clone <your-repo-url>
cd Team_Task_Manager
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Create Environment File

Copy the example file:

```bash
cp .env.example .env
```

For local testing, use:

```env
PORT=3000
DATABASE_URL=memory://local
JWT_SECRET=replace-with-a-long-random-secret
NODE_ENV=development
```

The in-memory database is useful for testing, but data resets when the server restarts.

## 4. Start The Application

```bash
npm start
```

Local app will run on:

```text
http://localhost:3000
```

## 5. PostgreSQL Setup For Persistent Local Database

If you want persistent local data, use PostgreSQL and update `.env`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/team_tasks
JWT_SECRET=replace-with-a-long-random-secret
NODE_ENV=development
```

Then initialize the schema:

```bash
npm run db:init
```


# PROJECT STRUCTURE


```text
Team_Task_Manager/
|
|-- public/
|   |-- index.html
|   |-- styles.css
|   |-- app.js
|
|-- src/
|   |-- server.js
|   |
|   |-- db/
|       |-- init.js
|       |-- pool.js
|       |-- schema.sql
|
|-- .env.example
|-- .gitignore
|-- docker-compose.yml
|-- package.json
|-- railway.json
|-- README.md
```

## Folder Details

`public/`  
Contains the complete frontend UI.

`src/server.js`  
Main Express server with REST APIs, authentication, role checks, and static frontend serving.

`src/db/schema.sql`  
PostgreSQL database schema for users, projects, project members, and tasks.

`src/db/init.js`  
Initializes the production PostgreSQL database schema.

`src/db/pool.js`  
Creates the database connection. Supports PostgreSQL in production and in-memory DB locally.

`railway.json`  
Railway deployment configuration.


# DATABASE DESIGN


## users

Stores registered users.

Fields include:
- id
- name
- email
- password_hash
- created_at

## projects

Stores project information.

Fields include:
- id
- name
- description
- created_by
- created_at

## project_members

Connects users with projects and stores their role.

Roles:
- Admin
- Member

## tasks

Stores project tasks.

Fields include:
- id
- project_id
- title
- description
- due_date
- priority
- status
- assigned_to
- created_by
- created_at
- updated_at


# API ENDPOINTS


## AUTH

```text
POST   /api/auth/signup       Register a new user
POST   /api/auth/login        Login user
GET    /api/me                Get current logged-in user
GET    /api/users             List registered users
```

## PROJECTS

```text
GET    /api/projects                   Get projects for logged-in user
POST   /api/projects                   Create a new project
GET    /api/projects/:projectId        Get project details and members
```

## MEMBERS

```text
POST    /api/projects/:projectId/members             Add or update project member
DELETE  /api/projects/:projectId/members/:userId     Remove project member
```

## TASKS

```text
GET     /api/projects/:projectId/tasks               Get project tasks
POST    /api/projects/:projectId/tasks               Create task
PATCH   /api/projects/:projectId/tasks/:taskId       Update task/status
DELETE  /api/projects/:projectId/tasks/:taskId       Delete task
```

## DASHBOARD

```text
GET     /api/projects/:projectId/dashboard           Get dashboard statistics
```


# ROLE FLOW


## Admin Flow

1. Signup or login as Admin.
2. Create a project.
3. Admin becomes project owner automatically.
4. Add registered users as Members.
5. Create tasks and assign them to members.
6. Track team progress from the dashboard.

## Member Flow

1. Signup or login as Member.
2. Wait for Admin to add your email to a project.
3. View assigned project.
4. Update status of assigned tasks.
5. Track personal task progress from Member Workspace.


# RAILWAY DEPLOYMENT


## 1. Push Code To GitHub

```bash
git add .
git commit -m "Initial team task management app"
git push -u origin main
```

## 2. Create Railway Project

1. Open Railway.
2. Click New Project.
3. Select Deploy from GitHub repo.
4. Choose this repository.

## 3. Add PostgreSQL

1. In the Railway project, click New.
2. Select Database.
3. Choose PostgreSQL.
4. Wait until the database is online.

## 4. Add Environment Variables

Open the Node app service variables and add:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=your-production-jwt-secret
NODE_ENV=production
```

Do not use `memory://local` in production.

## 5. Deploy

Railway uses `railway.json`:

```bash
npm run db:init && npm start
```

Successful logs should show:

```text
Database schema is ready.
Team task app listening on port <PORT>
```

## 6. Generate Public Domain

In Railway:

1. Open the app service.
2. Go to Settings.
3. Go to Networking.
4. Generate a public domain.
5. Use the port shown in logs, for example `8080`.


