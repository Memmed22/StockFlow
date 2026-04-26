import { useEffect, useState } from 'react';
import { cashClosingApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

const fmt = (dt) => new Date(dt).toLocaleString();
const currency = (n) => `${Number(n).toFixed(2)} ₾`;

export default function CashClosing() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const fmtDate = (dt) => {
    const d = new Date(dt);
    return d.getTime() === new Date('0001-01-01').getTime() ? t('cashClosing.beginning') : d.toLocaleDateString();
  };
  const [preview, setPreview] = useState(null);
  const [openingStatus, setOpeningStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoadingPreview(true);
    try {
      const [prev, hist, opening] = await Promise.all([
        cashClosingApi.preview(),
        cashClosingApi.getAll(),
        cashClosingApi.openingStatus(),
      ]);
      setPreview(prev.data);
      setHistory(hist.data);
      setOpeningStatus(opening.data);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    const countedNum = parseFloat(counted);
    if (isNaN(countedNum) || countedNum < 0) {
      setError('Enter a valid counted cash amount (≥ 0).');
      return;
    }
    setLoading(true);
    try {
      const { data } = await cashClosingApi.create({ userId: user.id, countedCash: countedNum, note: note || null });
      const tgStatus = data.telegramError ? ` (Telegram: ${data.telegramError})` : t('cashClosing.telegramOk');
      setMessage(t('cashClosing.successMsg') + tgStatus);
      setCounted('');
      setNote('');
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const diff = preview ? parseFloat(counted || 0) - preview.expectedCash : 0;
  const diffColor = diff < 0 ? '#B91C1C' : diff > 0 ? '#065F46' : '#374151';

  return (
    <div>
      <div style={s.pageHeader}>
        <h2 style={s.title}>{t('cashClosing.title')}</h2>
        <p style={s.subtitle}>{t('cashClosing.subtitle')}</p>
      </div>

      {/* Period Summary */}
      {!loadingPreview && preview && (
        <div style={s.periodCard}>
          <div style={s.periodRow}>
            <div style={s.periodItem}>
              <span style={s.periodLabel}>{t('cashClosing.periodFrom')}</span>
              <span style={s.periodValue}>{fmtDate(preview.fromDate)}</span>
            </div>
            <div style={s.periodArrow}>→</div>
            <div style={s.periodItem}>
              <span style={s.periodLabel}>{t('cashClosing.periodTo')}</span>
              <span style={s.periodValue}>{fmtDate(preview.toDate)}</span>
            </div>
            <div style={s.periodDivider} />
            {openingStatus?.hasOpeningCash && (
              <>
                <div style={s.periodItem}>
                  <span style={s.periodLabel}>{t('cashClosing.openingCash')}</span>
                  <span style={{ ...s.periodValue, color: '#059669' }}>{currency(openingStatus.amount)}</span>
                </div>
                <div style={s.periodDivider} />
              </>
            )}
            <div style={s.periodItem}>
              <span style={s.periodLabel}>{t('cashClosing.expectedCash')}</span>
              <span style={{ ...s.periodValue, color: '#4F46E5', fontSize: 22, fontWeight: 700 }}>
                {currency(preview.expectedCash)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Closing Form */}
      <div style={s.card}>
        <h3 style={s.cardTitle}>{t('cashClosing.recordClosing')}</h3>
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.twoCol}>
            <div style={s.field}>
              <label style={s.label}>{t('cashClosing.countedCash')}</label>
              <input
                style={s.input}
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 440.00"
                value={counted}
                onChange={e => setCounted(e.target.value)}
                required
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>{t('common.note')}</label>
              <input
                style={s.input}
                placeholder={t('cashClosing.notePlaceholder')}
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>

          {/* Live difference preview */}
          {counted !== '' && preview && (
            <div style={{ ...s.diffBox, borderColor: diff < 0 ? '#FECACA' : diff > 0 ? '#6EE7B7' : '#E5E7EB' }}>
              <span style={s.diffLabel}>{t('cashClosing.diff.label')}</span>
              <span style={{ ...s.diffValue, color: diffColor }}>
                {diff >= 0 ? '+' : ''}{currency(diff)}
              </span>
              {diff === 0 && <span style={s.diffNote}>{t('cashClosing.diff.perfect')}</span>}
              {diff < 0 && <span style={s.diffNote}>{t('cashClosing.diff.short')}</span>}
              {diff > 0 && <span style={s.diffNote}>{t('cashClosing.diff.overage')}</span>}
            </div>
          )}

          {message && <div style={s.successBox}>{message}</div>}
          {error && <div style={s.errorBox}>{error}</div>}

          <button style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? t('cashClosing.saving') : t('cashClosing.confirmClosing')}
          </button>
        </form>
      </div>

      {/* History */}
      <div style={s.tableHeader}>
        <div>
          <h3 style={s.sectionTitle}>{t('cashClosing.history.title')}</h3>
          <p style={s.sectionSub}>{t('cashClosing.history.subtitle', { count: history.length })}</p>
        </div>
      </div>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>{t('cashClosing.col.from')}</th>
              <th style={s.th}>{t('cashClosing.col.to')}</th>
              <th style={s.th}>{t('cashClosing.col.expected')}</th>
              <th style={s.th}>{t('cashClosing.col.counted')}</th>
              <th style={s.th}>{t('cashClosing.col.difference')}</th>
              <th style={s.th}>{t('cashClosing.col.by')}</th>
              <th style={s.th}>{t('cashClosing.col.note')}</th>
            </tr>
          </thead>
          <tbody>
            {history.map(h => {
              const d = h.difference;
              const dColor = d < 0 ? '#B91C1C' : d > 0 ? '#065F46' : '#374151';
              return (
                <tr key={h.id} style={s.tr}>
                  <td style={{ ...s.td, fontSize: 13, color: '#6B7280' }}>{fmtDate(h.fromDate)}</td>
                  <td style={{ ...s.td, fontSize: 13, color: '#6B7280' }}>{fmt(h.toDate)}</td>
                  <td style={{ ...s.td, fontWeight: 600 }}>{currency(h.expectedCash)}</td>
                  <td style={{ ...s.td, fontWeight: 600 }}>{currency(h.countedCash)}</td>
                  <td style={{ ...s.td, fontWeight: 700, color: dColor }}>
                    {d >= 0 ? '+' : ''}{currency(d)}
                  </td>
                  <td style={s.td}>{h.username}</td>
                  <td style={{ ...s.td, color: '#6B7280' }}>{h.note || '—'}</td>
                </tr>
              );
            })}
            {history.length === 0 && (
              <tr>
                <td colSpan={7} style={s.empty}>{t('cashClosing.history.noHistory')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s = {
  pageHeader: { marginBottom: 24 },
  title: { margin: 0, fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#6B7280' },

  periodCard: {
    background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
    border: '1px solid #C7D2FE',
    borderRadius: 12,
    padding: '20px 28px',
    marginBottom: 24,
  },
  periodRow: { display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' },
  periodItem: { display: 'flex', flexDirection: 'column', gap: 4 },
  periodLabel: { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' },
  periodValue: { fontSize: 16, fontWeight: 600, color: '#111827' },
  periodArrow: { fontSize: 20, color: '#A5B4FC', fontWeight: 300 },
  periodDivider: { width: 1, height: 40, background: '#C7D2FE', margin: '0 8px' },

  card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardTitle: { margin: '0 0 20px', fontSize: 15, fontWeight: 600, color: '#111827' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, background: '#F9FAFB', color: '#111827', boxSizing: 'border-box', width: '100%' },

  diffBox: { display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderRadius: 8, border: '1px solid', background: '#FAFAFA' },
  diffLabel: { fontSize: 13, fontWeight: 600, color: '#6B7280' },
  diffValue: { fontSize: 20, fontWeight: 700 },
  diffNote: { fontSize: 12, color: '#9CA3AF', marginLeft: 'auto' },

  successBox: { background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#065F46', fontWeight: 500 },
  errorBox: { background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B91C1C', fontWeight: 500 },
  submitBtn: { background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 600, fontSize: 15, alignSelf: 'flex-start' },

  tableHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  sectionTitle: { margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' },
  sectionSub: { margin: '3px 0 0', fontSize: 12, color: '#9CA3AF' },

  tableWrap: { background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  tr: { borderBottom: '1px solid #F3F4F6' },
  td: { padding: '12px 16px', fontSize: 14, color: '#374151' },
  empty: { padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 },
};
