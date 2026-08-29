import { useEffect, useState } from 'react';
import { companiesApi } from '../api/client';
import { useTranslation } from 'react-i18next';

export default function Companies() {
  const { t } = useTranslation();

  const emptyForm = { name: '', code: '', contactPerson: '', phoneNumber: '', description: '' };
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const { data } = await companiesApi.getAll(search || undefined);
    setCompanies(data);
  };

  useEffect(() => { load(); }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editId) { await companiesApi.update(editId, form); } else { await companiesApi.create(form); }
      setForm(emptyForm); setEditId(null); setShowForm(false); load();
    } catch (err) { setError(err.response?.data?.error || t('common.error')); }
  };

  const handleEdit = (c) => {
    setForm({ name: c.name, code: c.code, contactPerson: c.contactPerson || '', phoneNumber: c.phoneNumber || '', description: c.description || '' });
    setEditId(c.id); setShowForm(true); setError('');
  };

  const handleDelete = async (id) => {
    if (!confirm(t('companies.deleteConfirm'))) return;
    try {
      await companiesApi.delete(id);
      load();
    } catch (err) {
      alert(err.response?.data?.error || t('common.error'));
    }
  };

  const handleCancel = () => { setForm(emptyForm); setEditId(null); setShowForm(false); setError(''); };

  return (
    <div>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>{t('companies.title')}</h2>
          <p style={s.subtitle}>{t('companies.subtitle', { count: companies.length })}</p>
        </div>
        <button style={s.primaryBtn} onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}>
          {t('companies.addCompany')}
        </button>
      </div>

      {showForm && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>{editId ? t('companies.editCompany') : t('companies.newCompany')}</h3>
          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>{t('companies.form.name')}</label>
              <input style={s.input} placeholder={t('companies.form.namePlaceholder')} required value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>{t('companies.form.code')}</label>
              <input style={s.input} placeholder={t('companies.form.codePlaceholder')} required value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>{t('companies.form.contactPerson')}</label>
              <input style={s.input} placeholder={t('companies.form.contactPersonPlaceholder')} value={form.contactPerson}
                onChange={e => setForm({ ...form, contactPerson: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>{t('companies.form.phone')}</label>
              <input style={s.input} placeholder={t('companies.form.phonePlaceholder')} value={form.phoneNumber}
                onChange={e => setForm({ ...form, phoneNumber: e.target.value })} />
            </div>
            <div style={{ ...s.field, gridColumn: '1 / -1' }}>
              <label style={s.label}>{t('companies.form.description')}</label>
              <input style={s.input} placeholder={t('companies.form.optional')} value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            {error && <div style={s.errorBox}>{error}</div>}
            <div style={{ ...s.field, flexDirection: 'row', gap: 8, gridColumn: '1 / -1' }}>
              <button style={s.successBtn} type="submit">{editId ? t('companies.update') : t('companies.save')}</button>
              <button style={s.ghostBtn} type="button" onClick={handleCancel}>{t('companies.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      <div style={s.searchRow}>
        <input style={s.searchInput} placeholder={t('companies.searchPlaceholder')}
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>{t('companies.col.name')}</th>
              <th style={s.th}>{t('companies.col.code')}</th>
              <th style={s.th}>{t('companies.col.contactPerson')}</th>
              <th style={s.th}>{t('companies.col.phone')}</th>
              <th style={s.th}>{t('companies.col.description')}</th>
              <th style={s.th}>{t('companies.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(c => (
              <tr key={c.id} style={s.tr}>
                <td style={{ ...s.td, fontWeight: 600, color: '#111827' }}>{c.name}</td>
                <td style={s.td}><code style={s.code}>{c.code}</code></td>
                <td style={s.td}>{c.contactPerson || '—'}</td>
                <td style={s.td}>{c.phoneNumber || '—'}</td>
                <td style={{ ...s.td, color: '#6B7280' }}>{c.description || '—'}</td>
                <td style={s.td}>
                  <button style={s.editBtn} onClick={() => handleEdit(c)}>{t('common.edit')}</button>
                  <button style={s.delBtn} onClick={() => handleDelete(c.id)}>{t('common.delete')}</button>
                </td>
              </tr>
            ))}
            {companies.length === 0 && (<tr><td colSpan={6} style={s.empty}>{t('companies.noCompanies')}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { margin: 0, fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#6B7280' },
  primaryBtn: { background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 14, flexShrink: 0 },
  successBtn: { background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontWeight: 600 },
  ghostBtn: { background: '#F3F4F8', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontWeight: 500 },
  card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardTitle: { margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#111827' },
  form: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, width: '100%', background: '#F9FAFB', boxSizing: 'border-box', color: '#111827' },
  errorBox: { background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B91C1C', gridColumn: '1 / -1' },
  searchRow: { marginBottom: 16 },
  searchInput: { padding: '9px 14px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, width: 300, background: '#fff', boxSizing: 'border-box' },
  tableWrap: { background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  tr: { borderBottom: '1px solid #F3F4F6' },
  td: { padding: '12px 16px', fontSize: 14, color: '#374151' },
  code: { background: '#F3F4F8', padding: '2px 6px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace', color: '#6B7280' },
  empty: { padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 },
  editBtn: { background: '#FEF3C7', color: '#92400E', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', marginRight: 6, fontSize: 13, fontWeight: 600 },
  delBtn: { background: '#FEE2E2', color: '#B91C1C', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};
