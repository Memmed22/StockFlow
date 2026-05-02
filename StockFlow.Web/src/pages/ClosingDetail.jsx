import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { reportsApi } from '../api/client';
import { useTranslation } from 'react-i18next';

const TYPE_CONFIG = {
  OpeningCash: { key: 'OpeningCash', bg: '#ECFDF5', color: '#065F46' },
  CashSale:    { key: 'Cash',        bg: '#D1FAE5', color: '#065F46' },
  DebitSale:   { key: 'Debit',       bg: '#FEF3C7', color: '#92400E' },
  Return:      { key: 'Return',      bg: '#FEE2E2', color: '#B91C1C' },
  Payment:     { key: 'Payment',     bg: '#DBEAFE', color: '#1D4ED8' },
  Expense:     { key: 'Expense',     bg: '#FFE4E6', color: '#9F1239' },
};

const currency = (n) => `${Number(n).toFixed(2)} ₾`;

export default function ClosingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    reportsApi.getClosingDetail(id)
      .then(r => setData(r.data))
      .catch(() => setError(t('common.error')))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={s.loading}>{t('common.loading')}</div>;
  if (error) return <div style={s.errorBox}>{error}</div>;
  if (!data) return null;

  const fromLabel = new Date(data.fromDate).getTime() === new Date('0001-01-01').getTime()
    ? t('cashClosing.beginning') : new Date(data.fromDate).toLocaleString();
  const toLabel = new Date(data.toDate).toLocaleString();

  const diffColor = data.difference < 0 ? '#B91C1C' : data.difference > 0 ? '#065F46' : '#374151';

  return (
    <div>
      {/* Back + title */}
      <div style={s.pageHeader}>
        <button style={s.backBtn} onClick={() => navigate('/reports', { state: { tab: 'closings' } })}>{t('common.back')}</button>
        <div>
          <h2 style={s.title}>{t('reports.closingDetail.title')} #{data.id}</h2>
          <p style={s.subtitle}>
            {t('reports.closingDetail.cashier')}: <strong>{data.username}</strong>
            &nbsp;·&nbsp;
            {new Date(data.createdAt).toLocaleString()}
            {data.note && <>&nbsp;·&nbsp;<em style={{ color: '#6B7280' }}>{data.note}</em></>}
          </p>
        </div>
      </div>

      {/* Period + financial summary */}
      <div style={s.summaryGrid}>
        {/* Period card */}
        <div style={{ ...s.card, gridColumn: '1 / -1' }}>
          <h3 style={s.cardTitle}>{t('reports.closingDetail.period')}</h3>
          <div style={s.periodRow}>
            <div style={s.periodItem}>
              <span style={s.periodLabel}>{t('cashClosing.periodFrom')}</span>
              <span style={s.periodValue}>{fromLabel}</span>
            </div>
            <span style={s.arrow}>→</span>
            <div style={s.periodItem}>
              <span style={s.periodLabel}>{t('cashClosing.periodTo')}</span>
              <span style={s.periodValue}>{toLabel}</span>
            </div>
          </div>
        </div>

        {/* Breakdown card */}
        <div style={s.card}>
          <h3 style={s.cardTitle}>{t('reports.closingDetail.breakdown')}</h3>
          {[
            { label: t('cashClosing.openingCash'),         value: currency(data.openingCash),        color: '#374151' },
            { label: t('reports.summary.cashSales'),       value: `+${currency(data.cashSalesTotal)}`, color: '#059669' },
            { label: t('reports.summary.debitSales'),      value: `+${currency(data.debitSalesTotal)}`, color: '#92400E', muted: true },
            { label: t('reports.summary.payments'),        value: `+${currency(data.paymentsTotal)}`, color: '#1D4ED8' },
            { label: t('reports.summary.returns'),         value: currency(data.returnsTotal),       color: '#DC2626' },
            ...(data.expensesTotal < 0 ? [{ label: t('reports.summary.expenses'), value: currency(data.expensesTotal), color: '#9F1239' }] : []),
          ].map((row, i) => (
            <div key={i} style={{ ...s.breakdownRow, opacity: row.muted ? 0.7 : 1 }}>
              <span style={{ fontSize: 14, color: '#374151' }}>{row.label}</span>
              <span style={{ fontWeight: 600, color: row.color }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Totals card */}
        <div style={s.card}>
          <h3 style={s.cardTitle}>{t('reports.closingDetail.totals')}</h3>
          <div style={s.breakdownRow}>
            <span style={{ fontSize: 14, color: '#374151' }}>{t('cashClosing.expectedCash')}</span>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#4F46E5' }}>{currency(data.expectedCash)}</span>
          </div>
          <div style={s.breakdownRow}>
            <span style={{ fontSize: 14, color: '#374151' }}>{t('cashClosing.countedCash')}</span>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#111827' }}>{currency(data.countedCash)}</span>
          </div>
          <div style={{ ...s.breakdownRow, borderTop: '2px solid #E5E7EB', marginTop: 8, paddingTop: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{t('cashClosing.col.difference')}</span>
            <span style={{ fontWeight: 800, fontSize: 22, color: diffColor }}>
              {data.difference >= 0 ? '+' : ''}{currency(data.difference)}
            </span>
          </div>
        </div>
      </div>

      {/* Transaction list */}
      <h3 style={s.sectionTitle}>{t('reports.closingDetail.transactions')}</h3>
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
            {data.items.map((r, i) => {
              const cfg = TYPE_CONFIG[r.type] ?? { key: r.type, bg: '#F3F4F8', color: '#374151' };
              const isNegative = r.type === 'Return' || r.type === 'Expense';
              const isDebit = r.type === 'DebitSale';
              return (
                <tr key={i} style={{ ...s.tr, background: isDebit ? '#FFFBEB' : r.type === 'Expense' ? '#FFF1F2' : undefined }}>
                  <td style={s.td}>
                    <span style={{ ...s.badge, background: cfg.bg, color: cfg.color }}>
                      {t(`reports.types.${cfg.key}`)}
                    </span>
                  </td>
                  <td style={{ ...s.td, fontWeight: 500, color: '#111827' }}>{r.label}</td>
                  <td style={{ ...s.td, color: '#6B7280', fontSize: 13 }}>{r.customerName || '—'}</td>
                  <td style={{ ...s.td, color: isNegative ? '#DC2626' : '#374151', fontWeight: isNegative ? 700 : 400 }}>
                    {r.quantity != null ? (r.type === 'Return' ? r.quantity.toFixed(2) : `+${r.quantity.toFixed(2)}`) : '—'}
                  </td>
                  <td style={s.td}>{r.unitPrice != null ? `${r.unitPrice.toFixed(2)} ₾` : '—'}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: r.total < 0 ? '#DC2626' : isDebit ? '#92400E' : '#059669' }}>
                    {r.total >= 0 && !isNegative ? '+' : ''}{r.total.toFixed(2)} ₾
                    {isDebit && <span style={s.notCashTag}>{t('reports.notCash')}</span>}
                  </td>
                </tr>
              );
            })}
            {data.items.length === 0 && (
              <tr><td colSpan={6} style={s.empty}>{t('reports.noData.transactions')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s = {
  loading: { padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 15 },
  errorBox: { background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B91C1C' },
  pageHeader: { display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 },
  backBtn: { background: '#F3F4F8', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151', flexShrink: 0, marginTop: 2 },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#6B7280' },
  summaryGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 },
  card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '18px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardTitle: { margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' },
  periodRow: { display: 'flex', alignItems: 'center', gap: 20 },
  periodItem: { display: 'flex', flexDirection: 'column', gap: 3 },
  periodLabel: { fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' },
  periodValue: { fontSize: 15, fontWeight: 600, color: '#111827' },
  arrow: { fontSize: 20, color: '#A5B4FC', fontWeight: 300 },
  breakdownRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #F3F4F6' },
  sectionTitle: { fontSize: 16, fontWeight: 600, color: '#111827', margin: '0 0 12px' },
  tableWrap: { background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  tr: { borderBottom: '1px solid #F3F4F6' },
  td: { padding: '12px 16px', fontSize: 14, color: '#374151' },
  badge: { display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  notCashTag: { fontSize: 10, color: '#92400E', background: '#FEF3C7', borderRadius: 4, padding: '1px 5px', marginLeft: 6, fontWeight: 600 },
  empty: { padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 },
};
