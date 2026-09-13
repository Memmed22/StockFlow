import { useEffect, useState } from 'react';
import { updateApi, syncApi } from '../api/client';
import { useTranslation } from 'react-i18next';
import Users from './Users';

export default function Settings() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('update');

  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const [syncStatus, setSyncStatus] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [syncNowLoading, setSyncNowLoading] = useState(false);
  const [restoringBlob, setRestoringBlob] = useState(null);
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    if (tab !== 'sync') return;
    loadSyncStatus();
    loadSnapshots();
  }, [tab]);

  const loadSyncStatus = async () => {
    try {
      const { data } = await syncApi.status();
      setSyncStatus(data);
    } catch (err) {
      setSyncError(err.response?.data?.error || t('common.error'));
    }
  };

  const loadSnapshots = async () => {
    setSnapshotsLoading(true);
    try {
      const { data } = await syncApi.snapshots();
      setSnapshots(data);
    } catch {
      // admin-only; leave list empty if unavailable
    } finally {
      setSnapshotsLoading(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncNowLoading(true);
    setSyncError('');
    try {
      const { data } = await syncApi.syncNow();
      setSyncStatus(data);
      await loadSnapshots();
    } catch (err) {
      setSyncError(err.response?.data?.error || t('common.error'));
    } finally {
      setSyncNowLoading(false);
    }
  };

  const handleRestore = async (blobName) => {
    if (!confirm(t('settings.sync.restoreConfirm'))) return;
    setRestoringBlob(blobName);
    setSyncError('');
    try {
      await syncApi.restore(blobName);
      setTimeout(() => window.location.reload(), 8000);
    } catch (err) {
      setSyncError(err.response?.data?.error || t('common.error'));
      setRestoringBlob(null);
    }
  };

  const handleCheck = async () => {
    setChecking(true);
    setError('');
    setResult(null);
    try {
      const { data } = await updateApi.check();
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setChecking(false);
    }
  };

  const handleApply = async () => {
    if (!result?.downloadUrl) return;
    setApplying(true);
    setError('');
    try {
      await updateApi.apply(result.downloadUrl);
      setTimeout(() => window.location.reload(), 8000);
    } catch (err) {
      setError(err.response?.data?.error || t('common.error'));
      setApplying(false);
    }
  };

  return (
    <div>
      <div style={s.header}>
        <h2 style={s.title}>{t('settings.title')}</h2>
      </div>

      <div style={s.tabBar}>
        {['update', 'sync', 'users'].map(key => (
          <button key={key}
            style={{ ...s.tab, ...(tab === key ? s.activeTab : {}) }}
            onClick={() => setTab(key)}>
            {t(`settings.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'update' && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>{t('settings.update.title')}</h3>

          {applying ? (
            <div style={s.updatingBox}>{t('settings.update.applying')}</div>
          ) : (
            <>
              <button style={s.primaryBtn} onClick={handleCheck} disabled={checking}>
                {checking ? t('settings.update.checking') : t('settings.update.checkButton')}
              </button>

              {error && <div style={s.errorBox}>{error}</div>}

              {result && (
                <div style={s.resultBox}>
                  <p style={s.versionLine}>
                    {t('settings.update.current')}: <strong>{result.currentVersion}</strong>
                    {' · '}
                    {t('settings.update.latest')}: <strong>{result.latestVersion}</strong>
                  </p>

                  {result.updateAvailable ? (
                    <>
                      {result.releaseNotes && <pre style={s.notes}>{result.releaseNotes}</pre>}
                      <button style={s.successBtn} onClick={handleApply}>
                        {t('settings.update.applyButton')}
                      </button>
                    </>
                  ) : (
                    <p style={s.upToDate}>{t('settings.update.upToDate')}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'sync' && (
        <div style={s.card}>
          <h3 style={s.cardTitle}>{t('settings.sync.title')}</h3>

          {restoringBlob ? (
            <div style={s.updatingBox}>{t('settings.sync.restoring')}</div>
          ) : (
            <>
              {syncStatus && (
                <p style={s.versionLine}>
                  {t('settings.sync.lastSuccess')}: <strong>
                    {syncStatus.lastSuccessUtc ? new Date(syncStatus.lastSuccessUtc).toLocaleString() : t('settings.sync.never')}
                  </strong>
                  {' · '}
                  {syncStatus.degraded
                    ? <span style={s.degradedTag}>{t('settings.sync.degraded')}</span>
                    : <span style={s.healthyTag}>{t('settings.sync.healthy')}</span>}
                </p>
              )}

              <button style={s.primaryBtn} onClick={handleSyncNow} disabled={syncNowLoading}>
                {syncNowLoading ? t('settings.sync.syncing') : t('settings.sync.syncNowButton')}
              </button>

              {syncError && <div style={s.errorBox}>{syncError}</div>}

              <div style={s.resultBox}>
                <h4 style={s.snapshotsTitle}>{t('settings.sync.snapshotsTitle')}</h4>
                {snapshotsLoading ? (
                  <p style={s.upToDate}>{t('common.loading')}</p>
                ) : snapshots.length === 0 ? (
                  <p style={s.versionLine}>{t('settings.sync.noSnapshots')}</p>
                ) : (
                  <table style={s.snapshotsTable}>
                    <tbody>
                      {snapshots.map(snap => (
                        <tr key={snap.blobName}>
                          <td style={s.snapshotCell}>{snap.blobName}</td>
                          <td style={{ ...s.snapshotCell, color: '#6B7280' }}>
                            {snap.createdUtc ? new Date(snap.createdUtc).toLocaleString() : ''}
                          </td>
                          <td style={{ ...s.snapshotCell, textAlign: 'right' }}>
                            <button style={s.restoreBtn} onClick={() => handleRestore(snap.blobName)}>
                              {t('settings.sync.restoreButton')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'users' && <Users />}
    </div>
  );
}

const s = {
  header: { marginBottom: 16 },
  title: { margin: 0, fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' },
  tabBar: { display: 'flex', gap: 4, marginBottom: 20, background: '#F3F4F8', borderRadius: 10, padding: 4, width: 'fit-content' },
  tab: { padding: '7px 16px', border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#6B7280', fontWeight: 500 },
  activeTab: { background: '#fff', color: '#111827', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardTitle: { margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#111827' },
  primaryBtn: { background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  successBtn: { background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontWeight: 600, marginTop: 12 },
  errorBox: { background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B91C1C', marginTop: 12 },
  resultBox: { marginTop: 16, paddingTop: 16, borderTop: '1px solid #F3F4F6' },
  versionLine: { margin: 0, fontSize: 14, color: '#374151' },
  notes: { marginTop: 12, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12, fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', fontFamily: 'inherit' },
  upToDate: { marginTop: 8, fontSize: 14, color: '#059669', fontWeight: 600 },
  updatingBox: { background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 8, padding: '14px 16px', fontSize: 14, color: '#3730A3', fontWeight: 600 },
  degradedTag: { color: '#B91C1C', fontWeight: 700 },
  healthyTag: { color: '#059669', fontWeight: 700 },
  snapshotsTitle: { margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#111827' },
  snapshotsTable: { width: '100%', fontSize: 13, borderCollapse: 'collapse' },
  snapshotCell: { padding: '6px 0', borderTop: '1px solid #F3F4F6' },
  restoreBtn: { background: '#fff', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
};
