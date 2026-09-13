import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { syncApi } from '../api/client';

const POLL_MS = 5 * 60 * 1000;

export default function SyncStatusBanner() {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const { data } = await syncApi.status();
        if (!cancelled) setStatus(data);
      } catch {
        // Status is informational only — a failed poll just skips this round, no error UI.
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!status?.degraded) return null;

  const lastSuccess = status.lastSuccessUtc
    ? new Date(status.lastSuccessUtc).toLocaleString()
    : t('sync.banner.never');

  return (
    <div style={styles.bar}>
      {t('sync.banner.message', { lastSuccess })}
      {status.lastError ? ` (${status.lastError})` : ''}
    </div>
  );
}

const styles = {
  bar: {
    background: '#FEF3C7',
    borderBottom: '1px solid #FDE68A',
    color: '#92400E',
    fontSize: 13,
    fontWeight: 600,
    padding: '8px 24px',
    textAlign: 'center',
  },
};
