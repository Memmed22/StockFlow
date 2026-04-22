import { useEffect, useState } from 'react';
import { usersApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

const emptyForm = { username: '', password: '', role: 'Cashier' };

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = () => usersApi.getAll().then(r => setUsers(r.data));

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await usersApi.create(form);
      setSuccess(`User "${form.username}" created successfully.`);
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error creating user.');
    }
  };

  const handleDelete = async (id) => {
    if (id === currentUser.id) { setError("You can't delete your own account."); return; }
    if (!confirm('Delete this user?')) return;
    await usersApi.delete(id);
    load();
  };

  return (
    <div>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>User Management</h2>
          <p style={s.subtitle}>{users.length} user{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button style={s.primaryBtn} onClick={() => { setShowForm(true); setForm(emptyForm); setError(''); setSuccess(''); }}>
          + Add User
        </button>
      </div>

      {success && <div style={s.successBox}>{success}</div>}

      {showForm && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>New User</h3>
          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Username *</label>
              <input style={s.input} required placeholder="Username" value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Password *</label>
              <input style={s.input} type="password" required placeholder="Password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Role</label>
              <select style={s.input} value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="Cashier">Cashier</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            {error && <div style={{ ...s.errorBox, gridColumn: '1 / -1' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
              <button style={s.successBtn} type="submit">Create User</button>
              <button style={s.ghostBtn} type="button" onClick={() => { setShowForm(false); setError(''); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Username</th>
              <th style={s.th}>Role</th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={s.tr}>
                <td style={s.td}>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{u.username}</span>
                  {u.id === currentUser.id && <span style={s.youBadge}>you</span>}
                </td>
                <td style={s.td}>
                  <span style={{ ...s.roleBadge, background: u.role === 'Admin' ? '#EEF2FF' : '#D1FAE5', color: u.role === 'Admin' ? '#4F46E5' : '#059669' }}>
                    {u.role}
                  </span>
                </td>
                <td style={s.td}>
                  {u.id !== currentUser.id && (
                    <button style={s.delBtn} onClick={() => handleDelete(u.id)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={3} style={s.empty}>No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={s.hint}>
        <strong>Cashier</strong> — POS and Returns only.&nbsp;&nbsp;
        <strong>Admin</strong> — full access to all modules.
      </div>
    </div>
  );
}

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { margin: 0, fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#6B7280' },
  primaryBtn: { background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  successBtn: { background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontWeight: 600 },
  ghostBtn: { background: '#F3F4F8', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontWeight: 500 },

  successBox: { background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#065F46', fontWeight: 500, marginBottom: 20 },
  errorBox: { background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B91C1C', fontWeight: 500 },

  card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 24, maxWidth: 520, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardTitle: { margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#111827' },
  form: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, background: '#F9FAFB', color: '#111827', boxSizing: 'border-box', width: '100%' },

  tableWrap: { background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 20 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  tr: { borderBottom: '1px solid #F3F4F6' },
  td: { padding: '12px 16px', fontSize: 14, color: '#374151' },
  roleBadge: { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  youBadge: { marginLeft: 8, fontSize: 11, color: '#9CA3AF', background: '#F3F4F8', padding: '2px 7px', borderRadius: 10, fontStyle: 'italic' },
  empty: { padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 },
  delBtn: { background: '#FEE2E2', color: '#B91C1C', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  hint: { background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#6B7280', lineHeight: 1.7 },
};
