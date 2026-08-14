import { useEffect } from 'react';
import { usePreferences } from '../../context/PreferencesContext';
import DocumentContent from './DocumentContent';

// Read-only. No edit capability here at all -- the "Edit" button below
// closes this modal and hands off to AppShell's existing edit-in-place
// flow (startEditDoc) rather than duplicating a save path here, so
// there's exactly one place in the app that knows how to save a document.
function DocumentViewModal({ doc, onClose, onEdit, onDownloadPdf, pdfLoading, pdfError }) {
  const { t } = usePreferences();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!doc) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{doc.title}</h3>
          <button type="button" className="modal-close" aria-label={t('dashboard_closeView')} onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <DocumentContent content={doc.content} />
        </div>
        {pdfError && <p className="auth-error">{pdfError}</p>}
        <div className="modal-footer auth-actions">
          <button className="btn-primary" disabled={pdfLoading} onClick={onDownloadPdf}>
            {pdfLoading ? t('dashboard_downloadingPdf') : t('dashboard_downloadPdf')}
          </button>
          <button className="btn-secondary" onClick={onEdit}>
            {t('dashboard_editDocument')}
          </button>
          <button className="secondary" onClick={onClose}>
            {t('dashboard_closeView')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DocumentViewModal;
