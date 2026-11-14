import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { customersApi } from '../api/client';
import { useTranslation } from 'react-i18next';

const STATUSES = ['all', 'debt', 'settled', 'credit'];
const STATUS_COLORS = {
  all: { bg: '#EEF2FF', fg: '#4F46E5' },
  debt: { bg: '#FEE2E2', fg: '#DC2626' },
  settled: { bg: '#D1FAE5', fg: '#059669' },
  credit: { bg: '#DBEAFE', fg: '#2563EB' },
};

// Compare in cents so floating point noise (e.g. 0.0000001) counts as settled.
const balanceSign = (b) => Math.sign(Math.round(b * 100));
const matchesStatus = (b, status) =>
  status === 'debt' ? balanceSign(b) > 0
    : status === 'settled' ? balanceSign(b) === 0
    : status === 'credit' ? balanceSign(b) < 0
    : true;
const statusOf = (b) => (balanceSign(b) > 0 ? 'debt' : balanceSign(b) < 0 ? 'credit' : 'settled');
const parseAmount = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));

export default function Customers() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [form, setForm] = useState({ name: '', phoneNumber: '', description: '' });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const navigate = useNavigate();

  // Filters live in the URL so they survive navigating to a customer and back.
  const status = STATUSES.includes(params.get('status')) ? params.get('status') : 'all';
  const minRaw = params.get('min') ?? '';
  const maxRaw = params.get('max') ?? '';
  const sort = params.get('sort') ?? '';

  const setParam = (key, value) => {
    setParams(prev => {
      const p = new URLSearchParams(prev);
      if (value === '' || value == null || (key === 'status' && value === 'all')) p.delete(key);
      else p.set(key, value);
      return p;
    }, { replace: true });
  };

  const min = parseAmount(minRaw);
  const max = parseAmount(maxRaw);
  const rangeInvalid = min !== null && max !== null && min > max;

  const inRange = useMemo(() => customers.filter(c =>
    rangeInvalid || ((min === null || c.balance >= min) && (max === null || c.balance <= max))
  ), [customers, min, max, rangeInvalid]);

  const counts = useMemo(() => Object.fromEntries(
    STATUSES.map(st => [st, inRange.filter(c => matchesStatus(c.balance, st)).length])
  ), [inRange]);

  const visible = useMemo(() => {
    const list = inRange.filter(c => matchesStatus(c.balance, status));
    const [field, dir] = sort.split('-');
    if (field === 'balance') list.sort((a, b) => (a.balance - b.balance) * (dir === 'asc' ? 1 : -1));
    else if (field === 'name') list.sort((a, b) => a.name.localeCompare(b.name) * (dir === 'desc' ? -1 : 1));
    return list;
  }, [inRange, status, sort]);

  const toggleSort = (field) => {
    const first = field === 'balance' ? 'desc' : 'asc';
    const second = first === 'desc' ? 'asc' : 'desc';
    const next = sort === `${field}-${first}` ? `${field}-${second}` : sort === `${field}-${second}` ? '' : `${field}-${first}`;
    setParam('sort', next);
  };
  const sortArrow = (field) => sort === `${field}-asc` ? ' ↑' : sort === `${field}-desc` ? ' ↓' : '';
  const ariaSort = (field) => sort === `${field}-asc` ? 'ascending' : sort === `${field}-desc` ? 'descending' : 'none';

  const filtersActive = status !== 'all' || minRaw !== '' || maxRaw !== '' || search !== '';
  const clearFilters = () => {
    const hadSearch = search !== '';
    setSearch('');
    setParams(prev => {
      const p = new URLSearchParams();
      if (prev.get('sort')) p.set('sort', prev.get('sort'));
      return p;
    }, { replace: true });
    if (hadSearch) load();
  };
  const visibleDebt = visible.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);

  const load = async (q) => {
    setLoading(true);
    try {
      const { data } = await customersApi.getAll(q);
      setCustomers(data);
    } catch { setError(t('customers.errors.load')); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(params.get('q') || undefined); }, []);

  const handleSearch = (e) => {
    const q = e.target.value;
    setSearch(q);
    setParam('q', q);
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

      <div style={s.filterBar}>
        <input style={s.searchInput} placeholder={t('customers.searchPlaceholder')}
          value={search} onChange={handleSearch} />

        <div style={s.chips} role="group" aria-label={t('customers.col.balance')}>
          {STATUSES.map(st => {
            const active = status === st;
            const c = STATUS_COLORS[st];
            return (
              <button key={st} type="button" aria-pressed={active}
                style={{ ...s.chip, ...(active ? { background: c.bg, color: c.fg, border: `1px solid ${c.fg}` } : null) }}
                onClick={() => setParam('status', st)}>
                {t(`customers.filter.${st}`)}
                <span style={{ ...s.chipCount, ...(active ? { background: c.fg, color: '#fff' } : null) }}>{counts[st]}</span>
              </button>
            );
          })}
        </div>

        <div style={s.rangeGroup} title={rangeInvalid ? t('customers.filter.rangeInvalid') : undefined}>
          <span style={s.rangeLabel}>{t('customers.filter.range')}</span>
          <div style={{ ...s.amountBox, ...(rangeInvalid ? s.amountBoxError : null) }}>
            <input style={s.amountInput} type="number" step="0.01" inputMode="decimal"
              placeholder={t('customers.filter.min')} aria-label={t('customers.filter.min')}
              value={minRaw} onChange={e => setParam('min', e.target.value)} />
            <span style={s.currency}>₾</span>
          </div>
          <span style={s.rangeDash}>–</span>
          <div style={{ ...s.amountBox, ...(rangeInvalid ? s.amountBoxError : null) }}>
            <input style={s.amountInput} type="number" step="0.01" inputMode="decimal"
              placeholder={t('customers.filter.max')} aria-label={t('customers.filter.max')}
              value={maxRaw} onChange={e => setParam('max', e.target.value)} />
            <span style={s.currency}>₾</span>
          </div>
        </div>

        {filtersActive && (
          <button type="button" style={s.clearBtn} onClick={clearFilters}>✕ {t('customers.filter.clear')}</button>
        )}
      </div>

      {(filtersActive || rangeInvalid) && (
        <div style={s.resultMeta}>
          {rangeInvalid
            ? <span style={{ color: '#DC2626', fontWeight: 600 }}>{t('customers.filter.rangeInvalid')}</span>
            : <>
                {t('customers.filter.showing', { shown: visible.length, total: customers.length })}
                {' · '}{t('customers.filter.totalInView')}:{' '}
                <strong style={{ color: visibleDebt > 0 ? '#DC2626' : '#059669' }}>{visibleDebt.toFixed(2)} ₾</strong>
              </>}
        </div>
      )}

      {error && <div style={s.errorBox}>{error}</div>}

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th} aria-sort={ariaSort('name')}>
                <button type="button" style={s.sortBtn} onClick={() => toggleSort('name')}>{t('customers.col.name')}{sortArrow('name')}</button>
              </th>
              <th style={s.th}>{t('customers.col.phone')}</th>
              <th style={s.th}>{t('customers.col.description')}</th>
              <th style={s.th} aria-sort={ariaSort('balance')}>
                <button type="button" style={s.sortBtn} onClick={() => toggleSort('balance')}>{t('customers.col.balance')}{sortArrow('balance')}</button>
              </th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(c => (
              <tr key={c.id} style={s.tr}>
                <td style={{ ...s.td, fontWeight: 600, color: '#111827' }}>{c.name}</td>
                <td style={s.td}>{c.phoneNumber}</td>
                <td style={{ ...s.td, color: '#6B7280' }}>{c.description || '—'}</td>
                <td style={s.td}>
                  <span style={{ ...s.balanceBadge, background: STATUS_COLORS[statusOf(c.balance)].bg, color: STATUS_COLORS[statusOf(c.balance)].fg }}>
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
            {customers.length > 0 && visible.length === 0 && (
              <tr><td colSpan={5} style={s.empty}>
                {t('customers.filter.noMatch')}{' '}
                <button type="button" style={s.linkBtn} onClick={clearFilters}>{t('customers.filter.clear')}</button>
              </td></tr>
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

  filterBar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 },
  searchInput: { padding: '9px 14px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, width: 300, background: '#fff', boxSizing: 'border-box' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 20, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  chipCount: { minWidth: 20, padding: '1px 6px', borderRadius: 10, background: '#F3F4F6', color: '#6B7280', fontSize: 11, fontWeight: 700, textAlign: 'center' },
  rangeGroup: { display: 'flex', alignItems: 'center', gap: 6 },
  rangeLabel: { fontSize: 12, fontWeight: 600, color: '#6B7280', marginRight: 2 },
  rangeDash: { color: '#9CA3AF' },
  amountBox: { display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', paddingRight: 10 },
  amountBoxError: { border: '1px solid #DC2626', background: '#FEF2F2' },
  amountInput: { width: 84, padding: '8px 4px 8px 10px', border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#111827' },
  currency: { fontSize: 13, color: '#9CA3AF' },
  clearBtn: { background: 'none', border: 'none', color: '#6B7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '6px 4px' },
  resultMeta: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  sortBtn: { background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', cursor: 'pointer' },
  linkBtn: { background: 'none', border: 'none', color: '#4F46E5', fontWeight: 600, cursor: 'pointer', fontSize: 14, padding: 0 },

  tableWrap: { background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  tr: { borderBottom: '1px solid #F3F4F6' },
  td: { padding: '12px 16px', fontSize: 14, color: '#374151' },
  balanceBadge: { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 },
  empty: { padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 },
  viewBtn: { background: '#EEF2FF', color: '#4F46E5', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
};
