import 'dotenv/config';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from './db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  console.error('DATABASE_URL and JWT_SECRET are required.');
  process.exit(1);
}

const pool = createPool();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const signToken = (user) => jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
const cleanUser = (user) => ({ id: user.id, name: user.name, email: user.email, createdAt: user.created_at });
const required = (value) => typeof value === 'string' && value.trim().length > 0;

function assertUuid(value, field = 'id') {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '')) {
    const error = new Error(`Invalid ${field}.`);
    error.status = 400;
    throw error;
  }
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [payload.id]);
    if (!rows[0]) return res.status(401).json({ message: 'User no longer exists.' });
    req.user = rows[0];
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

async function getMembership(projectId, userId) {
  const { rows } = await pool.query(
    'SELECT project_id, user_id, role FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  );
  return rows[0];
}

async function requireMember(req, res, next) {
  try {
    assertUuid(req.params.projectId, 'project id');
    const membership = await getMembership(req.params.projectId, req.user.id);
    if (!membership) return res.status(403).json({ message: 'You are not a member of this project.' });
    req.membership = membership;
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdmin(req, res, next) {
  if (req.membership?.role !== 'Admin') return res.status(403).json({ message: 'Admin access required.' });
  next();
}

app.post('/api/auth/signup', asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!required(name) || !required(email) || !required(password)) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });

  const passwordHash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, lower($2), $3) RETURNING id, name, email, created_at',
    [name.trim(), email.trim(), passwordHash]
  );
  res.status(201).json({ user: cleanUser(rows[0]), token: signToken(rows[0]) });
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!required(email) || !required(password)) return res.status(400).json({ message: 'Email and password are required.' });

  const { rows } = await pool.query('SELECT * FROM users WHERE email = lower($1)', [email.trim()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }
  res.json({ user: cleanUser(user), token: signToken(user) });
}));

app.get('/api/me', auth, (req, res) => res.json({ user: cleanUser(req.user) }));

app.get('/api/users', auth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, email FROM users ORDER BY name ASC');
  res.json({ users: rows });
}));

app.get('/api/projects', auth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.description, pm.role, p.created_at,
      COUNT(t.id)::int AS task_count
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE pm.user_id = $1
     GROUP BY p.id, pm.role
     ORDER BY p.created_at DESC`,
    [req.user.id]
  );
  res.json({ projects: rows });
}));

app.post('/api/projects', auth, asyncHandler(async (req, res) => {
  const { name, description = '' } = req.body;
  if (!required(name)) return res.status(400).json({ message: 'Project name is required.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const project = await client.query(
      'INSERT INTO projects (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), description.trim(), req.user.id]
    );
    await client.query('INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)', [
      project.rows[0].id,
      req.user.id,
      'Admin'
    ]);
    await client.query('COMMIT');
    res.status(201).json({ project: { ...project.rows[0], role: 'Admin', task_count: 0 } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.get('/api/projects/:projectId', auth, requireMember, asyncHandler(async (req, res) => {
  const project = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.projectId]);
  const members = await pool.query(
    `SELECT u.id, u.name, u.email, pm.role, pm.joined_at
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1
     ORDER BY pm.role ASC, u.name ASC`,
    [req.params.projectId]
  );
  res.json({ project: { ...project.rows[0], role: req.membership.role }, members: members.rows });
}));

app.post('/api/projects/:projectId/members', auth, requireMember, requireAdmin, asyncHandler(async (req, res) => {
  const { email, role = 'Member' } = req.body;
  if (!required(email)) return res.status(400).json({ message: 'Member email is required.' });
  if (!['Admin', 'Member'].includes(role)) return res.status(400).json({ message: 'Invalid member role.' });

  const user = await pool.query('SELECT id FROM users WHERE email = lower($1)', [email.trim()]);
  if (!user.rows[0]) return res.status(404).json({ message: 'No registered user found with that email.' });

  const { rows } = await pool.query(
    `INSERT INTO project_members (project_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING project_id, user_id, role`,
    [req.params.projectId, user.rows[0].id, role]
  );
  res.status(201).json({ member: rows[0] });
}));

app.delete('/api/projects/:projectId/members/:userId', auth, requireMember, requireAdmin, asyncHandler(async (req, res) => {
  assertUuid(req.params.userId, 'user id');
  if (req.params.userId === req.user.id) return res.status(400).json({ message: 'Admins cannot remove themselves.' });

  await pool.query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [req.params.projectId, req.params.userId]);
  res.status(204).end();
}));

app.get('/api/projects/:projectId/tasks', auth, requireMember, asyncHandler(async (req, res) => {
  const params = [req.params.projectId];
  let memberFilter = '';
  if (req.membership.role !== 'Admin') {
    params.push(req.user.id);
    memberFilter = 'AND t.assigned_to = $2';
  }
  const { rows } = await pool.query(
    `SELECT t.*, assignee.name AS assignee_name, creator.name AS creator_name
     FROM tasks t
     JOIN users assignee ON assignee.id = t.assigned_to
     JOIN users creator ON creator.id = t.created_by
     WHERE t.project_id = $1 ${memberFilter}
     ORDER BY t.due_date ASC, t.created_at DESC`,
    params
  );
  res.json({ tasks: rows });
}));

app.post('/api/projects/:projectId/tasks', auth, requireMember, requireAdmin, asyncHandler(async (req, res) => {
  const { title, description = '', dueDate, priority = 'Medium', assignedTo } = req.body;
  if (!required(title) || !required(dueDate) || !required(assignedTo)) {
    return res.status(400).json({ message: 'Title, due date, and assignee are required.' });
  }
  if (!['Low', 'Medium', 'High'].includes(priority)) return res.status(400).json({ message: 'Invalid priority.' });
  const assignee = await getMembership(req.params.projectId, assignedTo);
  if (!assignee) return res.status(400).json({ message: 'Assignee must be a project member.' });

  const { rows } = await pool.query(
    `INSERT INTO tasks (project_id, title, description, due_date, priority, assigned_to, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [req.params.projectId, title.trim(), description.trim(), dueDate, priority, assignedTo, req.user.id]
  );
  res.status(201).json({ task: rows[0] });
}));

app.patch('/api/projects/:projectId/tasks/:taskId', auth, requireMember, asyncHandler(async (req, res) => {
  assertUuid(req.params.taskId, 'task id');
  const existing = await pool.query('SELECT * FROM tasks WHERE id = $1 AND project_id = $2', [req.params.taskId, req.params.projectId]);
  const task = existing.rows[0];
  if (!task) return res.status(404).json({ message: 'Task not found.' });
  if (req.membership.role !== 'Admin' && task.assigned_to !== req.user.id) {
    return res.status(403).json({ message: 'Members can update only their assigned tasks.' });
  }

  const next = {
    title: req.membership.role === 'Admin' && required(req.body.title) ? req.body.title.trim() : task.title,
    description: req.membership.role === 'Admin' && typeof req.body.description === 'string' ? req.body.description.trim() : task.description,
    dueDate: req.membership.role === 'Admin' && required(req.body.dueDate) ? req.body.dueDate : task.due_date,
    priority: req.membership.role === 'Admin' && ['Low', 'Medium', 'High'].includes(req.body.priority) ? req.body.priority : task.priority,
    assignedTo: req.membership.role === 'Admin' && req.body.assignedTo ? req.body.assignedTo : task.assigned_to,
    status: ['To Do', 'In Progress', 'Done'].includes(req.body.status) ? req.body.status : task.status
  };

  if (next.assignedTo !== task.assigned_to) {
    const assignee = await getMembership(req.params.projectId, next.assignedTo);
    if (!assignee) return res.status(400).json({ message: 'Assignee must be a project member.' });
  }

  const { rows } = await pool.query(
    `UPDATE tasks
     SET title = $1, description = $2, due_date = $3, priority = $4, assigned_to = $5, status = $6, updated_at = now()
     WHERE id = $7 AND project_id = $8
     RETURNING *`,
    [next.title, next.description, next.dueDate, next.priority, next.assignedTo, next.status, req.params.taskId, req.params.projectId]
  );
  res.json({ task: rows[0] });
}));

app.delete('/api/projects/:projectId/tasks/:taskId', auth, requireMember, requireAdmin, asyncHandler(async (req, res) => {
  assertUuid(req.params.taskId, 'task id');
  await pool.query('DELETE FROM tasks WHERE id = $1 AND project_id = $2', [req.params.taskId, req.params.projectId]);
  res.status(204).end();
}));

app.get('/api/projects/:projectId/dashboard', auth, requireMember, asyncHandler(async (req, res) => {
  const visibility = req.membership.role === 'Admin' ? '' : 'AND t.assigned_to = $2';
  const params = req.membership.role === 'Admin' ? [req.params.projectId] : [req.params.projectId, req.user.id];
  const [total, byStatus, perUser, overdue] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM tasks t WHERE t.project_id = $1 ${visibility}`, params),
    pool.query(`SELECT status, COUNT(*)::int AS count FROM tasks t WHERE t.project_id = $1 ${visibility} GROUP BY status`, params),
    pool.query(
      `SELECT u.name, COUNT(t.id)::int AS count
       FROM tasks t JOIN users u ON u.id = t.assigned_to
       WHERE t.project_id = $1 ${visibility}
       GROUP BY u.name
       ORDER BY count DESC`,
      params
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM tasks t
       WHERE t.project_id = $1 ${visibility} AND t.status != 'Done' AND t.due_date < CURRENT_DATE`,
      params
    )
  ]);
  res.json({
    totalTasks: total.rows[0].count,
    tasksByStatus: byStatus.rows,
    tasksPerUser: perUser.rows,
    overdueTasks: overdue.rows[0].count
  });
}));

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found.' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((error, req, res, next) => {
  if (error.code === '23505') return res.status(409).json({ message: 'A record with this value already exists.' });
  if (error.code === '23514') return res.status(400).json({ message: 'One or more values failed validation.' });
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || 'Something went wrong.' });
});

app.listen(port, () => {
  console.log(`Team task app listening on port ${port}`);
});
