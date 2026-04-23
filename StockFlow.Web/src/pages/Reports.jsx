import { useEffect, useState } from 'react';
import { reportsApi } from '../api/client';
import { useTranslation } from 'react-i18next';

const TYPE_CONFIG = {
  CashSale:  { key: 'Cash',    bg: '#D1FAE5', color: '#065F46' },
  DebitSale: { key: 'Debit',   bg: '#FEF3C7', color: '#92400E' },
  Return:    { key: 'Return',  bg: '#FEE2E2', color: '#B91C1C' },
  Payment:   { key: 'Payment', bg: '#DBEAFE', color: '#1D4ED8' },
};

const TAB_KEYS = ['detailed', 'daily', 'users', 'stock'];

export default function Reports() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('detailed');
  const [dailySales, setDailySales] = useState([]);
  const [userSales, setUserSales] = useState([]);
  const [stockReport, setStockReport] = useState([]);
  const [detailed, setDetailed] = useState(null);
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchAll(from, to); }, []);

  const fetchAll = async (fromDate, toDate) => {
    setLoading(true); setError('');
    try {
      const [daily, users, stock, det] = await Promise.all([
        reportsApi.dailySales(fromDate, toDate),
        reportsApi.salesPerUser(fromDate, toDate),
        reportsApi.stock(),
        reportsApi.detailed(fromDate, toDate),
      ]);
      setDailySales(daily.data);
      setUserSales(users.data);
      setStockReport(stock.data);
      setDetailed(det.data);
    } catch (err) {
      setError(err.response?.data?.error || t('reports.noData.reports'));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => fetchAll(from, to);

  return (
    <div>
      <div style={s.pageHeader}>
        <h2 style={s.title}>{t('reports.title')}</h2>
        <p style={s.subtitle}>{t('reports.subtitle')}</p>
      </div>

      {/* Tab bar */}
      <div style={s.tabBar}>
        {TAB_KEYS.map(key => (
          <button key={key}
            style={{ ...s.tab, ...(tab === key ? s.activeTab : {}) }}
            onClick={() => setTab(key)}>
            {t(`reports.tabs.${key}`)}
          </button>
        ))}
      </div>

      {/* Date filter */}
      {tab !== 'stock' && (
        <div style={s.filters}>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>{t('common.from')}</label>
            <input type="date" style={s.dateInput} value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>{t('common.to')}</label>
            <input type="date" style={s.dateInput} value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button style={s.applyBtn} onClick={handleApply} disabled={loading}>
            {loading ? t('reports.loading') : t('reports.apply')}
          </button>
        </div>
      )}

      {tab === 'stock' && (
        <div style={{ marginBottom: 16 }}>
          <button style={s.applyBtn} onClick={() => fetchAll(from, to)} disabled={loading}>
            {loading ? t('reports.loading') : t('reports.refresh')}
          </button>
        </div>
      )}

      {error && <div style={s.errorBox}>{error}</div>}

      {/* ── Detailed Sales ── */}
      {tab === 'detailed' && detailed && (
        <>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>{t('reports.col.type')}</th>
                  <th style={s.th}>{t('reports.col.productDesc')}</th>
                  <th style={s.th}>{t('reports.col.customer')}</th>
                  <th style={s.th}>{t('reports.col.qty')}</th>
                  <th style={s.th}>{t('reports.col.unitPrice')}</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>{t('reports.col.total')}</th>
                </tr>
              </thead>
              <tbody>
                {detailed.items.map((r, i) => {
                  const cfg = TYPE_CONFIG[r.type] ?? { key: r.type, bg: '#F3F4F8', color: '#374151' };
                  const isDebit = r.type === 'DebitSale';
                  const isReturn = r.type === 'Return';
                  return (
                    <tr key={i} style={{ ...s.tr, background: isDebit ? '#FFFBEB' : undefined }}>
                      <td style={s.td}>
                        <span style={{ ...s.badge, background: cfg.bg, color: cfg.color }}>{t(`reports.types.${cfg.key}`)}</span>
                      </td>
                      <td style={{ ...s.td, fontWeight: 500, color: '#111827' }}>{r.label}</td>
                      <td style={{ ...s.td, color: '#6B7280', fontSize: 13 }}>{r.customerName || '—'}</td>
                      <td style={{ ...s.td, color: isReturn ? '#DC2626' : '#374151', fontWeight: isReturn ? 700 : 400 }}>
                        {r.quantity != null ? (isReturn ? r.quantity.toFixed(2) : `+${r.quantity.toFixed(2)}`) : '—'}
                      </td>
                      <td style={s.td}>{r.unitPrice != null ? `${r.unitPrice.toFixed(2)} ₾` : '—'}</td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: r.total < 0 ? '#DC2626' : isDebit ? '#92400E' : '#059669' }}>
                        {r.total >= 0 && !isReturn ? '+' : ''}{r.total.toFixed(2)} ₾
                        {isDebit && <span style={s.notCashTag}>{t('reports.notCash')}</span>}
                      </td>
                    </tr>
                  );
                })}
                {detailed.items.length === 0 && !loading && (
                  <tr><td colSpan={6} style={s.empty}>{t('reports.noData.transactions')}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {detailed.items.length > 0 && (
            <div style={s.summaryCard}>
              <h4 style={s.summaryTitle}>{t('reports.summary.title')}</h4>
              {[
                { key: 'cashSales', value: `+${detailed.summary.cashSalesTotal.toFixed(2)} ₾`, color: '#059669' },
                { key: 'debitSales', value: `+${detailed.summary.debitSalesTotal.toFixed(2)} ₾`, color: '#92400E', muted: true },
                { key: 'payments', value: `+${detailed.summary.paymentsTotal.toFixed(2)} ₾`, color: '#1D4ED8' },
                { key: 'returns', value: `${detailed.summary.returnsTotal.toFixed(2)} ₾`, color: '#DC2626' },
              ].map(row => (
                <div key={row.key} style={{ ...s.summaryRow, opacity: row.muted ? 0.7 : 1 }}>
                  <span style={s.summaryLabel}>{t(`reports.summary.${row.key}`)}</span>
                  <span style={{ fontWeight: 600, color: row.color }}>{row.value}</span>
                </div>
              ))}
              <div style={s.cashTotalRow}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{t('reports.summary.cashTotal')}</span>
                <span style={{ fontWeight: 800, fontSize: 22, color: detailed.summary.cashTotal >= 0 ? '#059669' : '#DC2626' }}>
                  {detailed.summary.cashTotal.toFixed(2)} ₾
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Daily Summary ── */}
      {tab === 'daily' && (
        <>
          <div style={s.infoBar}>
            {t('reports.infoRevenue')}: <strong>{dailySales.reduce((s, r) => s + r.totalRevenue, 0).toFixed(2)} ₾</strong>
            &nbsp;·&nbsp;
            {t('reports.infoTransactions')}: <strong>{dailySales.reduce((s, r) => s + r.transactionCount, 0)}</strong>
          </div>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>{t('reports.col.date')}</th>
                  <th style={s.th}>{t('reports.col.transactions')}</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>{t('reports.col.totalRevenue')}</th>
                </tr>
              </thead>
              <tbody>
                {dailySales.map((r, i) => (
                  <tr key={i} style={s.tr}>
                    <td style={{ ...s.td, fontWeight: 600, color: '#111827' }}>{new Date(r.date).toLocaleDateString()}</td>
                    <td style={s.td}>{r.transactionCount}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: '#059669' }}>{r.totalRevenue.toFixed(2)} ₾</td>
                  </tr>
                ))}
                {dailySales.length === 0 && !loading && (
                  <tr><td colSpan={3} style={s.empty}>{t('reports.noData.sales')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Sales per User ── */}
      {tab === 'users' && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>{t('reports.col.cashier')}</th>
                <th style={s.th}>{t('reports.col.transactions')}</th>
                <th style={{ ...s.th, textAlign: 'right' }}>{t('reports.col.totalRevenue')}</th>
              </tr>
            </thead>
            <tbody>
              {userSales.map((r, i) => (
                <tr key={i} style={s.tr}>
                  <td style={{ ...s.td, fontWeight: 600, color: '#111827' }}>{r.username}</td>
                  <td style={s.td}>{r.transactionCount}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: '#059669' }}>{r.totalRevenue.toFixed(2)} ₾</td>
                </tr>
              ))}
              {userSales.length === 0 && !loading && (
                <tr><td colSpan={3} style={s.empty}>{t('reports.noData.users')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Stock Report ── */}
      {tab === 'stock' && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>{t('reports.col.product')}</th>
                <th style={s.th}>{t('reports.col.barcode')}</th>
                <th style={{ ...s.th, textAlign: 'right' }}>{t('reports.col.currentStock')}</th>
              </tr>
            </thead>
            <tbody>
              {stockReport.map((r, i) => (
                <tr key={i} style={s.tr}>
                  <td style={{ ...s.td, fontWeight: 600, color: '#111827' }}>{r.productName}</td>
                  <td style={s.td}><code style={s.code}>{r.barcode}</code></td>
                  <td style={{ ...s.td, textAlign: 'right' }}>
                    <span style={{ fontWeight: 700, color: r.quantity <= 0 ? '#DC2626' : '#059669' }}>{r.quantity}</span>
                  </td>
                </tr>
              ))}
              {stockReport.length === 0 && !loading && (
                <tr><td colSpan={3} style={s.empty}>{t('reports.noData.products')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

const s = {
  pageHeader: { marginBottom: 24 },
  title: { margin: 0, fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#6B7280' },

  tabBar: { display: 'flex', gap: 4, marginBottom: 20, background: '#F3F4F8', borderRadius: 10, padding: 4, width: 'fit-content' },
  tab: { padding: '7px 16px', border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#6B7280', fontWeight: 500 },
  activeTab: { background: '#fff', color: '#111827', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },

  filters: { display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 20 },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 5 },
  filterLabel: { fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' },
  dateInput: { padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, background: '#fff', color: '#111827' },
  applyBtn: { background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14, flexShrink: 0 },

  errorBox: { background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B91C1C', marginBottom: 16 },
  infoBar: { background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 16px', fontSize: 14, color: '#065F46', marginBottom: 16 },

  tableWrap: { background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 24 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  tr: { borderBottom: '1px solid #F3F4F6' },
  td: { padding: '12px 16px', fontSize: 14, color: '#374151' },
  badge: { display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  code: { background: '#F3F4F8', padding: '2px 6px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace', color: '#6B7280' },
  notCashTag: { fontSize: 10, color: '#92400E', background: '#FEF3C7', borderRadius: 4, padding: '1px 5px', marginLeft: 6, fontWeight: 600 },
  empty: { padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 },

  summaryCard: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px 24px', maxWidth: 440, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  summaryTitle: { margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F3F4F6', fontSize: 14 },
  summaryLabel: { color: '#374151' },
  cashTotalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, marginTop: 6, borderTop: '2px solid #E5E7EB' },
};
