import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi } from '../api/client';
import { useTranslation } from 'react-i18next';

export default function Customers() {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', phoneNumber: '', description: '' });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  const load = async (q) => {
    setLoading(true);
    try {
      const { data } = await customersApi.getAll(q);
      setCustomers(data);
    } catch { setError(t('customers.errors.load')); }
    finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    const q = e.target.value;
    setSearch(q);
    clearTimeout(window._custDebounce);
    window._custDebounce = setTimeout(() => load(q || undefined), 300);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      await customersApi.create(form);
      setForm({ name: '', phoneNumber: '', description: '' });
      setShowForm(false);
      load(search || undefined);
    } catch (err) {
      setFormError(err.response?.data?.error || t('customers.errors.create'));
    }
  };

  const totalDebt = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);

  return (
    <div>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>{t('customers.title')}</h2>
          <p style={s.subtitle}>{customers.length} · {t('customers.outstandingDebt')}: <strong style={{ color: totalDebt > 0 ? '#DC2626' : '#059669' }}>{totalDebt.toFixed(2)} ₾</strong></p>
        </div>
        <button style={s.primaryBtn} onClick={() => setShowForm(v => !v)}>
          {showForm ? t('customers.cancel') : t('customers.newCustomer')}
        </button>
      </div>

      {showForm && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>{t('customers.newCustomerTitle')}</h3>
          <form onSubmit={handleCreate} style={s.formRow}>
            <div style={s.field}>
              <label style={s.label}>{t('customers.form.name')}</label>
              <input style={s.input} required placeholder={t('customers.form.namePlaceholder')}
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>{t('customers.form.phone')}</label>
              <input style={s.input} required placeholder={t('customers.form.phonePlaceholder')}
                value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} />
            </div>
            <div style={{ ...s.field, flex: 2 }}>
              <label style={s.label}>{t('customers.form.description')}</label>
              <input style={s.input} placeholder={t('customers.form.descriptionPlaceholder')}
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button style={s.successBtn} type="submit">{t('customers.create')}</button>
            </div>
          </form>
          {formError && <div style={{ ...s.errorBox, marginTop: 12 }}>{formError}</div>}
        </div>
      )}

      <div style={s.searchRow}>
        <input style={s.searchInput} placeholder={t('customers.searchPlaceholder')}
          value={search} onChange={handleSearch} />
      </div>

      {error && <div style={s.errorBox}>{error}</div>}

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>{t('customers.col.name')}</th>
              <th style={s.th}>{t('customers.col.phone')}</th>
              <th style={s.th}>{t('customers.col.description')}</th>
              <th style={s.th}>{t('customers.col.balance')}</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id} style={s.tr}>
                <td style={{ ...s.td, fontWeight: 600, color: '#111827' }}>{c.name}</td>
                <td style={s.td}>{c.phoneNumber}</td>
                <td style={{ ...s.td, color: '#6B7280' }}>{c.description || '—'}</td>
                <td style={s.td}>
                  <span style={{ ...s.balanceBadge, background: c.balance > 0 ? '#FEE2E2' : '#D1FAE5', color: c.balance > 0 ? '#DC2626' : '#059669' }}>
                    {c.balance.toFixed(2)} ₾
                  </span>
                </td>
                <td style={s.td}>
                  <button style={s.viewBtn} onClick={() => navigate(`/customers/${c.id}`)}>{t('customers.view')}</button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && !loading && (
              <tr><td colSpan={5} style={s.empty}>{t('customers.noCustomers')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
  title: { margin: 0, fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#6B7280' },
  primaryBtn: { background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 14, flexShrink: 0 },
  successBtn: { background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' },

  card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardTitle: { margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#111827' },
  formRow: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  field: { display: 'flex', flexDirection: 'column', gap: 5, flex: 1 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, width: '100%', background: '#F9FAFB', boxSizing: 'border-box', color: '#111827' },
  errorBox: { background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B91C1C', fontWeight: 500 },

  searchRow: { marginBottom: 16 },
  searchInput: { padding: '9px 14px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, width: 300, background: '#fff', boxSizing: 'border-box' },

  tableWrap: { background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  tr: { borderBottom: '1px solid #F3F4F6' },
  td: { padding: '12px 16px', fontSize: 14, color: '#374151' },
  balanceBadge: { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 },
  empty: { padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 },
  viewBtn: { background: '#EEF2FF', color: '#4F46E5', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
};
