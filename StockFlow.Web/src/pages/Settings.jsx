import { useState } from 'react';
import { updateApi } from '../api/client';
import { useTranslation } from 'react-i18next';

export default function Settings() {
  const { t } = useTranslation();

  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

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
    </div>
  );
}

const s = {
  header: { marginBottom: 16 },
  title: { margin: 0, fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' },
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
};
