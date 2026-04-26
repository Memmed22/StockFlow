import { useEffect, useState } from 'react';
import { productsApi } from '../api/client';
import { useTranslation } from 'react-i18next';

export default function Products() {
  const { t } = useTranslation();
  const UNIT_TYPES = [
    { value: 0, label: t('products.units.0') },
    { value: 1, label: t('products.units.1') },
    { value: 2, label: t('products.units.2') },
    { value: 3, label: t('products.units.3') },
  ];

  const emptyForm = { name: '', barcode: '', sellingPrice: '', buyingPrice: '', unitType: 0, description: '' };
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const { data } = await productsApi.getAll(search || undefined);
    setProducts(data);
  };

  useEffect(() => { load(); }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = { ...form, sellingPrice: parseFloat(form.sellingPrice), buyingPrice: form.buyingPrice ? parseFloat(form.buyingPrice) : null, unitType: parseInt(form.unitType) };
    try {
      if (editId) { await productsApi.update(editId, payload); } else { await productsApi.create(payload); }
      setForm(emptyForm); setEditId(null); setShowForm(false); load();
    } catch (err) { setError(err.response?.data?.error || t('common.error')); }
  };

  const handleEdit = (p) => {
    setForm({ name: p.name, barcode: p.barcode, sellingPrice: String(p.sellingPrice), buyingPrice: p.buyingPrice != null ? String(p.buyingPrice) : '', unitType: p.unitType, description: p.description || '' });
    setEditId(p.id); setShowForm(true); setError('');
  };

  const handleDelete = async (id) => {
    if (!confirm(t('products.deleteConfirm'))) return;
    await productsApi.delete(id); load();
  };

  const handleCancel = () => { setForm(emptyForm); setEditId(null); setShowForm(false); setError(''); };
  const unitLabel = (unitType) => UNIT_TYPES.find(u => u.value === unitType)?.label ?? UNIT_TYPES[0].label;

  return (
    <div>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>{t('products.title')}</h2>
          <p style={s.subtitle}>{t('products.subtitle', { count: products.length })}</p>
        </div>
        <button style={s.primaryBtn} onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}>
          {t('products.addProduct')}
        </button>
      </div>

      {showForm && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>{editId ? t('products.editProduct') : t('products.newProduct')}</h3>
          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>{t('products.form.name')}</label>
              <input style={s.input} placeholder={t('products.form.namePlaceholder')} required value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>{t('products.form.barcode')}</label>
              <input style={s.input} placeholder={t('products.form.barcodePlaceholder')} required value={form.barcode}
                onChange={e => setForm({ ...form, barcode: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>{t('products.form.sellingPrice')}</label>
              <input style={s.input} placeholder="0.00" required type="number" step="0.01" min="0"
                value={form.sellingPrice} onChange={e => setForm({ ...form, sellingPrice: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>{t('products.form.buyingPrice')}</label>
              <input style={s.input} placeholder={t('products.form.optional')} type="number" step="0.01" min="0"
                value={form.buyingPrice} onChange={e => setForm({ ...form, buyingPrice: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>{t('products.form.unitType')}</label>
              <select style={s.input} value={form.unitType} onChange={e => setForm({ ...form, unitType: e.target.value })}>
                {UNIT_TYPES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>{t('products.form.description')}</label>
              <input style={s.input} placeholder={t('products.form.optional')} value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            {error && <div style={s.errorBox}>{error}</div>}
            <div style={{ ...s.field, flexDirection: 'row', gap: 8, gridColumn: '1 / -1' }}>
              <button style={s.successBtn} type="submit">{editId ? t('products.update') : t('products.save')}</button>
              <button style={s.ghostBtn} type="button" onClick={handleCancel}>{t('products.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      <div style={s.searchRow}>
        <input style={s.searchInput} placeholder={t('products.form.namePlaceholder') + '…'}
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>{t('products.col.name')}</th>
              <th style={s.th}>{t('products.col.barcode')}</th>
              <th style={s.th}>{t('products.col.unit')}</th>
              <th style={s.th}>{t('products.col.sellPrice')}</th>
              <th style={s.th}>{t('products.col.buyPrice')}</th>
              <th style={s.th}>{t('products.col.stock')}</th>
              <th style={s.th}>{t('products.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} style={s.tr}>
                <td style={{ ...s.td, fontWeight: 600, color: '#111827' }}>{p.name}</td>
                <td style={s.td}><code style={s.code}>{p.barcode}</code></td>
                <td style={s.td}>{unitLabel(p.unitType)}</td>
                <td style={{ ...s.td, fontWeight: 600 }}>{p.sellingPrice.toFixed(2)} ₾</td>
                <td style={{ ...s.td, color: '#6B7280' }}>{p.buyingPrice != null ? `${p.buyingPrice.toFixed(2)} ₾` : '—'}</td>
                <td style={s.td}>
                  <span style={{ ...s.stockBadge, background: p.stockQuantity <= 0 ? '#FEE2E2' : '#D1FAE5', color: p.stockQuantity <= 0 ? '#DC2626' : '#059669' }}>{p.stockQuantity}</span>
                </td>
                <td style={s.td}>
                  <button style={s.editBtn} onClick={() => handleEdit(p)}>{t('common.edit')}</button>
                  <button style={s.delBtn} onClick={() => handleDelete(p.id)}>{t('common.delete')}</button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (<tr><td colSpan={7} style={s.empty}>{t('products.noProducts')}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
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
  stockBadge: { display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 },
  empty: { padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 },
  editBtn: { background: '#FEF3C7', color: '#92400E', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', marginRight: 6, fontSize: 13, fontWeight: 600 },
  delBtn: { background: '#FEE2E2', color: '#B91C1C', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};
