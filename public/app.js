const app = document.querySelector('#app');
const statuses = ['To Do', 'In Progress', 'Done'];
const priorities = ['Low', 'Medium', 'High'];

const state = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  projects: [],
  selectedProjectId: localStorage.getItem('selectedProjectId'),
  project: null,
  members: [],
  tasks: [],
  dashboard: null,
  authMode: 'login',
  selectedRole: localStorage.getItem('selectedRole') || 'Admin',
  screen: localStorage.getItem('token') ? 'app' : 'landing',
  page: 'dashboard',
  error: ''
};

const icons = {
  dashboard: '<svg viewBox="0 0 24 24"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg>',
  projects: '<svg viewBox="0 0 24 24"><path d="M3 7h6l2 3h10v9H3z"/><path d="M3 7v-2h7l2 2"/></svg>',
  tasks: '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/></svg>',
  members: '<svg viewBox="0 0 24 24"><path d="M16 11a4 4 0 1 0-8 0"/><path d="M4 20a8 8 0 0 1 16 0"/><path d="M19 8v6M22 11h-6"/></svg>',
  reports: '<svg viewBox="0 0 24 24"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5M12 16V8M16 16v-9"/></svg>',
  trophy: '<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M6 5H3v2a4 4 0 0 0 4 4M18 5h3v2a4 4 0 0 1-4 4M12 13v4M8 20h8"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>'
};

app.addEventListener('click', (event) => {
  const authButton = event.target.closest('[data-auth]');
  if (!authButton) return;
  state.authMode = authButton.dataset.auth;
  state.screen = 'auth';
  state.error = '';
  render();
});

function saveSession(payload) {
  state.token = payload.token;
  state.user = payload.user;
  state.screen = 'app';
  localStorage.setItem('token', payload.token);
  localStorage.setItem('user', JSON.stringify(payload.user));
  localStorage.setItem('selectedRole', state.selectedRole);
}

function logout() {
  localStorage.clear();
  Object.assign(state, {
    token: null,
    user: null,
    projects: [],
    selectedProjectId: null,
    project: null,
    members: [],
    tasks: [],
    dashboard: null,
    screen: 'landing',
    page: 'dashboard'
  });
  render();
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed.');
  return data;
}

async function loadProjects() {
  const data = await api('/api/projects');
  state.projects = data.projects;
  if (!state.projects.some((project) => project.id === state.selectedProjectId)) {
    state.selectedProjectId = state.projects[0]?.id || null;
  }
  if (state.selectedProjectId) localStorage.setItem('selectedProjectId', state.selectedProjectId);
  await loadProject();
}

async function loadProject() {
  if (!state.selectedProjectId) {
    Object.assign(state, { project: null, members: [], tasks: [], dashboard: null });
    render();
    return;
  }
  const [detail, tasks, dashboard] = await Promise.all([
    api(`/api/projects/${state.selectedProjectId}`),
    api(`/api/projects/${state.selectedProjectId}/tasks`),
    api(`/api/projects/${state.selectedProjectId}/dashboard`)
  ]);
  state.project = detail.project;
  state.members = detail.members;
  state.tasks = tasks.tasks;
  state.dashboard = dashboard;
  render();
}

function setError(error) {
  state.error = error.message || String(error);
  render();
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function compactStatus(status) {
  return status.replace(/\s/g, '');
}

function logo() {
  return '<span class="logo-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20.8 3.2C12.4 3 6.1 6.7 3.8 13.1c-1 2.8-.7 5.2.8 7 5.4-.8 9.8-4.2 12.6-9.8-1.1 5-3.5 8.6-7.1 10.8 8.5.1 13.1-8.1 10.7-17.9z"/></svg></span>';
}

function landingView() {
  app.innerHTML = `
    <section class="landing">
      <header class="landing-nav">
        <div class="brand">${logo()}<strong>TeamFlow</strong></div>
        <nav>
          <button class="link-button" data-auth="login">Sign In</button>
          <button data-auth="signup">Create Account</button>
        </nav>
      </header>
      <div class="landing-hero">
        <div class="hero-copy">
          <span class="feature-pill"><span></span> Team task management app</span>
          <h1>Manage Team<br><span>Tasks Smarter</span></h1>
          <p>Create projects, invite members, assign priority tasks, and track To Do, In Progress, Done, and overdue work from one role-based dashboard.</p>
          <div class="hero-actions">
            <button data-auth="signup">Create Admin Account</button>
            <button class="secondary" data-auth="login">Login as Member</button>
          </div>
        </div>
        <div class="hero-preview task-preview" aria-label="Team task dashboard preview">
          <div class="window-dots"><span></span><span></span><span></span><strong>Project Dashboard</strong></div>
          <div class="preview-stats">
            <div><strong>18</strong><span>Total tasks</span></div>
            <div><strong>7</strong><span>In progress</span></div>
            <div><strong>3</strong><span>Overdue</span></div>
          </div>
          <div class="preview-board">
            <section>
              <h4>To Do</h4>
              <article><b>Design dashboard UI</b><span>Assigned to Asha</span></article>
              <article><b>Prepare README</b><span>Due tomorrow</span></article>
            </section>
            <section>
              <h4>In Progress</h4>
              <article class="active"><b>Build auth APIs</b><span>High priority</span></article>
              <article><b>Add role checks</b><span>Admin review</span></article>
            </section>
            <section>
              <h4>Done</h4>
              <article><b>Create project schema</b><span>Completed</span></article>
            </section>
          </div>
          <div class="preview-footer">
            <span>${icons.members} Admin adds members</span>
            <span>${icons.reports} Reports update live</span>
          </div>
        </div>
      </div>
      <section class="landing-features" id="features">
        ${['Role based access', 'Project workspaces', 'Task dashboards'].map((title, index) => `
          <article class="panel">
            <span class="feature-icon">${[icons.members, icons.projects, icons.reports][index]}</span>
            <h3>${title}</h3>
            <p>${['Admins manage teams while members focus on assigned work.', 'Create projects, invite members, and keep context together.', 'Track status, assignees, and overdue tasks in seconds.'][index]}</p>
          </article>`).join('')}
      </section>
    </section>`;

}

function authView() {
  const isSignup = state.authMode === 'signup';
  app.innerHTML = `
    <section class="auth">
      <div class="auth-art art-left"></div>
      <div class="auth-art art-right"></div>
      <div class="panel auth-card">
        <button class="back-link" type="button" id="backHome">Back to home</button>
        <div class="auth-brand">${logo()}<strong>TeamFlow</strong></div>
        <div class="auth-copy">
          <h1>${isSignup ? 'Create your workspace' : 'Welcome back'}</h1>
          <p>Plan projects, assign tasks, and track team progress from one calm dashboard.</p>
        </div>
        ${state.error ? `<div class="notice">${escapeHtml(state.error)}</div>` : ''}
        <div class="auth-tabs">
          <button type="button" data-mode="login" aria-pressed="${!isSignup}">Login</button>
          <button type="button" data-mode="signup" aria-pressed="${isSignup}">Signup</button>
        </div>
        <div class="role-picker" aria-label="Choose role">
          <span>Role</span>
          <div>
            <button type="button" data-role="Admin" aria-pressed="${state.selectedRole === 'Admin'}">Admin</button>
            <button type="button" data-role="Member" aria-pressed="${state.selectedRole === 'Member'}">Member</button>
          </div>
          <small>${isSignup ? 'Choose how you want to start after registration.' : 'Choose which workspace view you want after login.'}</small>
        </div>
        <form id="authForm" class="form-grid">
          ${isSignup ? '<label>Name<input name="name" autocomplete="name" required minlength="2" placeholder="Your name"></label>' : ''}
          <label>Email<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" required minlength="6" placeholder="Minimum 6 characters"></label>
          <button>${isSignup ? 'Create account' : 'Continue'}</button>
        </form>
        <p class="auth-note">Secure role-based access for admins and team members.</p>
      </div>
    </section>`;

  app.querySelector('#backHome').addEventListener('click', () => {
    state.screen = 'landing';
    render();
  });
  app.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => {
    state.authMode = button.dataset.mode;
    state.error = '';
    render();
  }));
  app.querySelectorAll('[data-role]').forEach((button) => button.addEventListener('click', () => {
    state.selectedRole = button.dataset.role;
    localStorage.setItem('selectedRole', state.selectedRole);
    render();
  }));
  app.querySelector('#authForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login';
      saveSession(await api(endpoint, { method: 'POST', body: JSON.stringify(formData(event.target)) }));
      state.error = '';
      await loadProjects();
    } catch (error) {
      setError(error);
    }
  });
}

function shellView() {
  const role = currentRole();
  app.innerHTML = `
    <section class="shell">
      <aside class="app-nav">
        <div class="brand nav-brand">${logo()}<strong>TeamFlow</strong></div>
        ${roleCard()}
        <nav class="nav-links" aria-label="Workspace sections">
          ${navButton('dashboard', 'Dashboard')}
          ${navButton('projects', 'Projects')}
          ${navButton('tasks', role === 'Admin' ? 'Tasks' : 'My Tasks')}
          ${navButton('members', role === 'Admin' ? 'Members' : 'Team')}
          ${navButton('reports', role === 'Admin' ? 'Reports' : 'My Reports')}
        </nav>
        ${role === 'Admin' ? projectQuickCreate() : memberHelpCard()}
      </aside>
      <div class="layout">
        <header class="topbar">
          <div class="top-actions">
            <span class="top-icon" title="Achievements">${icons.trophy}</span>
            <span class="top-icon" title="Notifications">${icons.bell}</span>
          </div>
          <div class="session-pill"><span>${new Date().getFullYear()} Workspace</span><strong>${role}</strong></div>
          <div class="user-pill"><span>${escapeHtml(state.user.name)}</span><button class="secondary" id="logout">Logout</button></div>
        </header>
        <section class="main">
          ${state.error ? `<div class="notice">${escapeHtml(state.error)}</div>` : ''}
          ${state.project ? pageView() : emptyState()}
        </section>
      </div>
    </section>`;

  bindShell();
}

function currentRole() {
  return state.project?.role || state.selectedRole || 'Member';
}

function isAdminProject() {
  return currentRole() === 'Admin';
}

function roleCard() {
  if (!state.project) {
    return '<div class="role-card"><strong>No project selected</strong><span>Create a project to become Admin.</span></div>';
  }
  if (isAdminProject()) {
    return `
      <div class="role-card admin">
        <strong>Admin Console</strong>
        <span>You can add members, assign tasks, and manage the full project.</span>
      </div>`;
  }
  return `
    <div class="role-card member">
      <strong>Member Workspace</strong>
      <span>You can view this project and update only your assigned tasks.</span>
    </div>`;
}

function memberHelpCard() {
  return `
    <div class="member-help">
      <strong>Member access</strong>
      <span>Ask an Admin to add your registered email to a project. After that your assigned tasks appear here.</span>
    </div>`;
}

function navButton(page, label) {
  return `<button class="${state.page === page ? 'active' : ''}" data-page="${page}"><span class="nav-icon">${icons[page]}</span>${label}</button>`;
}

function projectQuickCreate() {
  return `
    <form id="projectForm" class="quick-create form-grid">
      <h3>New project</h3>
      <label>Name<input name="name" required minlength="2" placeholder="Project name"></label>
      <label>Description<textarea name="description" placeholder="Short description"></textarea></label>
      <button>Create</button>
    </form>`;
}

function emptyState() {
  if (currentRole() === 'Member') {
    return `
      <div class="panel empty welcome-empty member-empty">
        <h2>Waiting for project access</h2>
        <p>You are logged in as a Member. An Admin must add your email to a project before your dashboard appears.</p>
      </div>`;
  }
  return `
    <div class="panel empty welcome-empty">
      <h2>Create your first project</h2>
      <p>Use the sidebar form to start a workspace. The creator becomes Admin automatically.</p>
    </div>`;
}

function pageView() {
  if (state.page === 'projects') return projectsPage();
  if (state.page === 'tasks') return tasksPage();
  if (state.page === 'members') return membersPage();
  if (state.page === 'reports') return reportsPage();
  return dashboardPage();
}

function projectHero() {
  const admin = isAdminProject();
  return `
    <div class="project-hero">
      <div class="section-head">
        <span class="mode-label">${admin ? 'Admin Console' : 'Member Workspace'}</span>
        <h1>${escapeHtml(state.project.name)}</h1>
        <div class="hero-tags">
          <span>${state.project.role}</span>
          <span>${state.members.length} members</span>
          <span>${admin ? `${state.tasks.length} team tasks` : `${state.tasks.length} assigned tasks`}</span>
        </div>
        <p>${admin ? 'Manage the complete project workspace, team members, and task assignments.' : 'Focus mode: you are seeing only the work assigned to you in this project.'} ${escapeHtml(state.project.description || '')}</p>
      </div>
      <div class="mentor-card">
        <span class="muted">${admin ? 'Your permissions' : 'Member permissions'}</span>
        <strong>${escapeHtml(state.members.find((member) => member.role === 'Admin')?.name || state.user.name)}</strong>
        <span>${admin ? 'Create tasks, invite users, remove members' : 'View project, update assigned task status'}</span>
      </div>
    </div>`;
}

function dashboardPage() {
  return `${projectHero()}${dashboardView()}<div class="columns">${statuses.map((status) => taskColumn(status)).join('')}</div>`;
}

function projectsPage() {
  return `
    <div class="page-head"><h1>Projects</h1><p>Switch between your assigned project workspaces.</p></div>
    <div class="project-strip">
      ${state.projects.map((project) => `
        <button class="project-row ${project.id === state.selectedProjectId ? 'active' : ''}" data-project="${project.id}">
          <span class="project-icon">${icons.projects}</span>
          <strong>${escapeHtml(project.name)}</strong>
          <small>${project.role} / ${project.task_count} tasks</small>
        </button>`).join('') || '<div class="empty">No projects yet.</div>'}
    </div>
    ${projectHero()}`;
}

function tasksPage() {
  const isAdmin = isAdminProject();
  return `
    <div class="page-head">
      <span class="mode-label">${isAdmin ? 'Admin task management' : 'Member task view'}</span>
      <h1>${isAdmin ? 'Tasks' : 'My Assigned Tasks'}</h1>
      <p>${isAdmin ? 'Create, assign, and move tasks through the workflow.' : 'Members can update status for assigned tasks only. Admin-only create, delete, and reassignment controls are hidden.'}</p>
    </div>
    <div class="columns">${statuses.map((status) => taskColumn(status)).join('')}</div>
    ${isAdmin ? `<div class="single-panel">${taskForm()}</div>` : ''}`;
}

function membersPage() {
  const isAdmin = isAdminProject();
  return `
    <div class="page-head">
      <span class="mode-label">${isAdmin ? 'Admin member management' : 'Team directory'}</span>
      <h1>${isAdmin ? 'Members' : 'Project Team'}</h1>
      <p>${isAdmin ? 'Manage project access and team roles.' : 'Members can view the team list, but cannot add or remove project users.'}</p>
    </div>
    <div class="single-panel">${memberPanel()}</div>`;
}

function reportsPage() {
  const byStatus = Object.fromEntries((state.dashboard?.tasksByStatus || []).map((item) => [item.status, item.count]));
  const total = Math.max(state.dashboard?.totalTasks || 0, 1);
  return `
    <div class="page-head">
      <span class="mode-label">${isAdminProject() ? 'Team reporting' : 'Personal reporting'}</span>
      <h1>${isAdminProject() ? 'Reports' : 'My Reports'}</h1>
      <p>${isAdminProject() ? 'Quick progress overview for demos and evaluation.' : 'Your report shows only tasks assigned to you in this project.'}</p>
    </div>
    ${dashboardView()}
    <div class="panel report-card">
      <h3>Status distribution</h3>
      ${statuses.map((status) => {
        const count = byStatus[status] || 0;
        return `<div class="report-row"><span>${status}</span><div><i style="width:${(count / total) * 100}%"></i></div><strong>${count}</strong></div>`;
      }).join('')}
    </div>`;
}

function dashboardView() {
  const statusCount = Object.fromEntries((state.dashboard?.tasksByStatus || []).map((item) => [item.status, item.count]));
  return `
    <div class="dashboard-grid">
      <div class="stats">
        <div class="panel stat"><span class="muted">Total tasks</span><strong>${state.dashboard?.totalTasks || 0}</strong></div>
        <div class="panel stat"><span class="muted">To Do</span><strong>${statusCount['To Do'] || 0}</strong></div>
        <div class="panel stat"><span class="muted">In Progress</span><strong>${statusCount['In Progress'] || 0}</strong></div>
        <div class="panel stat"><span class="muted">Overdue</span><strong>${state.dashboard?.overdueTasks || 0}</strong></div>
      </div>
      <div class="panel per-user">
        <h3>Tasks per user</h3>
        ${(state.dashboard?.tasksPerUser || []).map((item) => `
          <div><span>${escapeHtml(item.name)}</span><strong>${item.count} task${item.count === 1 ? '' : 's'}</strong></div>`).join('') || '<span class="muted">No assigned tasks yet.</span>'}
      </div>
    </div>`;
}

function taskColumn(status) {
  const tasks = state.tasks.filter((task) => task.status === status);
  return `<div class="panel column"><h3 class="${compactStatus(status)}"><span></span>${status}</h3>${tasks.map(taskCard).join('') || '<div class="empty">No tasks</div>'}</div>`;
}

function taskCard(task) {
  const isAdmin = isAdminProject();
  const canUpdate = isAdmin || task.assigned_to === state.user.id;
  return `
    <article class="panel task">
      <div class="task-title"><strong>${escapeHtml(task.title)}</strong><span class="pill ${task.priority}">${task.priority}</span></div>
      <span class="muted">${escapeHtml(task.description || 'No description')}</span>
      <div class="task-meta"><span>${escapeHtml(task.assignee_name)}</span><span>Due ${new Date(task.due_date).toLocaleDateString()}</span></div>
      ${canUpdate ? `<label>Status<select data-task-status="${task.id}">${statuses.map((status) => `<option ${task.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label>` : ''}
      ${isAdmin ? `<button class="danger" data-delete-task="${task.id}">Delete task</button>` : ''}
    </article>`;
}

function taskForm() {
  return `
    <form id="taskForm" class="panel form-grid">
      <h3>Create task</h3>
      <label>Title<input name="title" required minlength="2" placeholder="Task title"></label>
      <label>Description<textarea name="description" placeholder="Task details"></textarea></label>
      <label>Due date<input name="dueDate" type="date" required></label>
      <label>Priority<select name="priority">${priorities.map((priority) => `<option>${priority}</option>`).join('')}</select></label>
      <label>Assignee<select name="assignedTo">${state.members.map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join('')}</select></label>
      <button>Create task</button>
    </form>`;
}

function memberPanel() {
  const isAdmin = isAdminProject();
  return `
    <div class="panel form-grid">
      <h3>Members</h3>
      <div class="members">
        ${state.members.map((member) => `
          <div class="member">
            <span><strong>${escapeHtml(member.name)}</strong><br><span class="muted">${escapeHtml(member.email)}</span></span>
            <span class="pill">${member.role}</span>
            ${isAdmin && member.id !== state.user.id ? `<button class="danger" data-remove-member="${member.id}">Remove</button>` : ''}
          </div>`).join('')}
      </div>
      ${isAdmin ? `<form id="memberForm" class="form-grid"><label>User email<input name="email" type="email" required placeholder="member@example.com"></label><label>Role<select name="role"><option>Member</option><option>Admin</option></select></label><button>Add or update member</button></form>` : ''}
    </div>`;
}

function bindShell() {
  app.querySelector('#logout').addEventListener('click', logout);
  app.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => {
    state.page = button.dataset.page;
    state.error = '';
    render();
  }));
  app.querySelectorAll('[data-project]').forEach((button) => button.addEventListener('click', async () => {
    state.selectedProjectId = button.dataset.project;
    localStorage.setItem('selectedProjectId', state.selectedProjectId);
    state.error = '';
    await loadProject().catch(setError);
  }));
  app.querySelector('#projectForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/api/projects', { method: 'POST', body: JSON.stringify(formData(event.target)) });
      event.target.reset();
      await loadProjects();
    } catch (error) {
      setError(error);
    }
  });
  app.querySelectorAll('[data-task-status]').forEach((select) => select.addEventListener('change', async () => {
    try {
      await api(`/api/projects/${state.selectedProjectId}/tasks/${select.dataset.taskStatus}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) });
      await loadProject();
    } catch (error) {
      setError(error);
    }
  }));
  app.querySelector('#taskForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api(`/api/projects/${state.selectedProjectId}/tasks`, { method: 'POST', body: JSON.stringify(formData(event.target)) });
      event.target.reset();
      await loadProject();
    } catch (error) {
      setError(error);
    }
  });
  app.querySelector('#memberForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api(`/api/projects/${state.selectedProjectId}/members`, { method: 'POST', body: JSON.stringify(formData(event.target)) });
      event.target.reset();
      await loadProject();
    } catch (error) {
      setError(error);
    }
  });
  app.querySelectorAll('[data-remove-member]').forEach((button) => button.addEventListener('click', async () => {
    try {
      await api(`/api/projects/${state.selectedProjectId}/members/${button.dataset.removeMember}`, { method: 'DELETE' });
      await loadProject();
    } catch (error) {
      setError(error);
    }
  }));
  app.querySelectorAll('[data-delete-task]').forEach((button) => button.addEventListener('click', async () => {
    try {
      await api(`/api/projects/${state.selectedProjectId}/tasks/${button.dataset.deleteTask}`, { method: 'DELETE' });
      await loadProject();
    } catch (error) {
      setError(error);
    }
  }));
}

function render() {
  if (!state.token && state.screen === 'landing') landingView();
  else if (!state.token) authView();
  else shellView();
}

if (state.token) {
  loadProjects().catch((error) => {
    logout();
    state.error = error.message;
    render();
  });
} else {
  render();
}
