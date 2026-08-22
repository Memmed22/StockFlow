import { useEffect, useState } from 'react';
import { cashClosingApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

const fmt = (dt) => new Date(dt).toLocaleString();
const currency = (n) => `${Number(n).toFixed(2)} ₾`;

const TYPE_CONFIG = {
  CashSale:     { key: 'Cash',    bg: '#D1FAE5', color: '#065F46' },
  DebitSale:    { key: 'Debit',   bg: '#FEF3C7', color: '#92400E' },
  Return:       { key: 'Return',  bg: '#FEE2E2', color: '#B91C1C' },
  CreditReturn: { key: 'CreditReturn', bg: '#EDE9FE', color: '#6D28D9' },
  Payment:      { key: 'Payment', bg: '#DBEAFE', color: '#1D4ED8' },
  Expense:      { key: 'Expense', bg: '#FFE4E6', color: '#9F1239' },
};

export default function CashClosing() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const fmtDate = (dt) => {
    const d = new Date(dt);
    return d.getTime() === new Date('0001-01-01').getTime() ? t('cashClosing.beginning') : d.toLocaleDateString();
  };
  const [tab, setTab] = useState('activity');
  const [preview, setPreview] = useState(null);
  const [openingStatus, setOpeningStatus] = useState(null);
  const [periodDetail, setPeriodDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [txSearch, setTxSearch] = useState('');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoadingPreview(true);
    try {
      const [prev, hist, opening, detail] = await Promise.all([
        cashClosingApi.preview(),
        cashClosingApi.getAll(),
        cashClosingApi.openingStatus(),
        cashClosingApi.currentPeriodDetail(),
      ]);
      setPreview(prev.data);
      setHistory(hist.data);
      setOpeningStatus(opening.data);
      setPeriodDetail(detail.data);
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

  const txQuery = txSearch.trim().toLowerCase();
  const filteredItems = periodDetail && txQuery
    ? periodDetail.items.filter(r =>
        (r.label ?? '').toLowerCase().includes(txQuery) || (r.barcode ?? '').toLowerCase().includes(txQuery))
    : periodDetail?.items ?? [];

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
                  <span style={{ ...s.periodValue, color: '#059669' }}>+{currency(openingStatus.amount)}</span>
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

      {/* Tab bar */}
      <div style={s.tabBar}>
        {['activity', 'close'].map(key => (
          <button key={key}
            style={{ ...s.tab, ...(tab === key ? s.activeTab : {}) }}
            onClick={() => setTab(key)}>
            {t(`cashClosing.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'close' && (
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
      )}

      {tab === 'activity' && periodDetail && (
        <>
          <div style={s.breakdownGrid}>
            <div style={s.card}>
              <h3 style={s.cardTitle}>{t('reports.closingDetail.breakdown')}</h3>
              {[
                { label: t('cashClosing.openingCash'), value: `+${currency(periodDetail.openingCash)}`, color: '#374151' },
                { label: t('reports.summary.cashSales'), value: `+${currency(periodDetail.cashSalesTotal)}`, color: '#059669' },
                { label: t('reports.summary.payments'), value: `+${currency(periodDetail.paymentsTotal)}`, color: '#1D4ED8' },
                { label: t('reports.summary.returns'), value: currency(periodDetail.returnsTotal), color: '#DC2626' },
                ...(periodDetail.expensesTotal < 0 ? [{ label: t('reports.summary.expenses'), value: currency(periodDetail.expensesTotal), color: '#9F1239' }] : []),
                ...(periodDetail.creditReturnsTotal !== 0 ? [{ label: t('reports.summary.creditReturns'), value: `${currency(Math.abs(periodDetail.creditReturnsTotal))} (${t('reports.notCash')})`, color: '#9CA3AF', muted: true }] : []),
                { label: t('reports.summary.debitSales'), value: `${currency(periodDetail.debitSalesTotal)} (${t('reports.notCash')})`, color: '#9CA3AF', muted: true },
              ].map((row, i) => (
                <div key={i} style={{ ...s.breakdownRow, opacity: row.muted ? 0.7 : 1 }}>
                  <span style={{ fontSize: 14, color: '#374151' }}>{row.label}</span>
                  <span style={{ fontWeight: 600, color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>
            <div style={s.card}>
              <h3 style={s.cardTitle}>{t('reports.closingDetail.totals')}</h3>
              <div style={{ ...s.breakdownRow, borderBottom: 'none' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{t('cashClosing.expectedCash')}</span>
                <span style={{ fontWeight: 800, fontSize: 22, color: '#4F46E5' }}>{currency(preview?.expectedCash ?? 0)}</span>
              </div>
            </div>
          </div>

          <div style={s.tableHeader}>
            <h3 style={s.sectionTitle}>{t('reports.closingDetail.transactions')}</h3>
            <input
              style={s.searchInput}
              placeholder={t('reports.searchTransactions')}
              value={txSearch}
              onChange={e => setTxSearch(e.target.value)}
            />
          </div>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>{t('reports.col.type')}</th>
                  <th style={s.th}>{t('reports.col.productDesc')}</th>
                  <th style={s.th}>{t('reports.col.barcode')}</th>
                  <th style={s.th}>{t('reports.col.customer')}</th>
                  <th style={s.th}>{t('reports.col.qty')}</th>
                  <th style={s.th}>{t('reports.col.unitPrice')}</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>{t('reports.col.total')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((r, i) => {
                  const cfg = TYPE_CONFIG[r.type] ?? { key: r.type, bg: '#F3F4F8', color: '#374151' };
                  const isDebit = r.type === 'DebitSale';
                  const isCreditReturn = r.type === 'CreditReturn';
                  const isReturnQty = r.type === 'Return' || isCreditReturn;
                  const isNegative = r.type === 'Return' || r.type === 'Expense' || isCreditReturn;
                  const notCash = isDebit || isCreditReturn;
                  return (
                    <tr key={i} style={{ ...s.tr, background: isDebit ? '#FFFBEB' : isCreditReturn ? '#F5F3FF' : r.type === 'Expense' ? '#FFF1F2' : undefined }}>
                      <td style={s.td}>
                        <span style={{ ...s.badge, background: cfg.bg, color: cfg.color }}>{t(`reports.types.${cfg.key}`)}</span>
                      </td>
                      <td style={{ ...s.td, fontWeight: 500, color: '#111827' }}>{r.label}</td>
                      <td style={s.td}>{r.barcode ? <code style={s.code}>{r.barcode}</code> : '—'}</td>
                      <td style={{ ...s.td, color: '#6B7280', fontSize: 13 }}>{r.customerName || (r.type === 'Payment' ? t('reports.unknownCustomer') : '—')}</td>
                      <td style={{ ...s.td, color: isNegative ? '#DC2626' : '#374151', fontWeight: isNegative ? 700 : 400 }}>
                        {r.quantity != null ? (isReturnQty ? r.quantity.toFixed(2) : `+${r.quantity.toFixed(2)}`) : '—'}
                      </td>
                      <td style={s.td}>{r.unitPrice != null ? `${r.unitPrice.toFixed(2)} ₾` : '—'}</td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: r.total < 0 ? '#DC2626' : isDebit ? '#92400E' : '#059669' }}>
                        {r.total >= 0 && !isNegative ? '+' : ''}{r.total.toFixed(2)} ₾
                        {notCash && <span style={s.notCashTag}>{t('reports.notCash')}</span>}
                      </td>
                    </tr>
                  );
                })}
                {filteredItems.length === 0 && (
                  <tr><td colSpan={7} style={s.empty}>
                    {txQuery ? t('reports.noData.transactionsSearch', { query: txSearch.trim() }) : t('reports.noData.transactions')}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'close' && (
        <>
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
        </>
      )}
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

  tabBar: { display: 'flex', gap: 4, marginBottom: 20, background: '#F3F4F8', borderRadius: 10, padding: 4, width: 'fit-content' },
  tab: { padding: '7px 16px', border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#6B7280', fontWeight: 500 },
  activeTab: { background: '#fff', color: '#111827', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },

  card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardTitle: { margin: '0 0 20px', fontSize: 15, fontWeight: 600, color: '#111827' },
  breakdownGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 },
  breakdownRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #F3F4F6' },
  badge: { display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  code: { background: '#F3F4F8', padding: '2px 6px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace', color: '#6B7280' },
  notCashTag: { fontSize: 10, color: '#92400E', background: '#FEF3C7', borderRadius: 4, padding: '1px 5px', marginLeft: 6, fontWeight: 600 },
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
  searchInput: { padding: '8px 14px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, width: 260, background: '#fff', boxSizing: 'border-box' },

  tableWrap: { background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  tr: { borderBottom: '1px solid #F3F4F6' },
  td: { padding: '12px 16px', fontSize: 14, color: '#374151' },
  empty: { padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 },
};
