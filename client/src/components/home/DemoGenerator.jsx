import { useState } from 'react';
import { Link } from 'react-router-dom';
import { demoDocTypes } from '../../lib/docTypes';
import { generateDocument } from '../../lib/generateDocument';
import { checkDemoRateLimit } from '../../lib/demoRateLimit';

const DEMO_PREVIEW_CHAR_LIMIT = 500;

function DemoGenerator() {
  const [activeDoc, setActiveDoc] = useState(demoDocTypes[0]);
  const [promptText, setPromptText] = useState(demoDocTypes[0].prompt);
  const [generatedText, setGeneratedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);

  const selectDoc = (doc) => {
    setActiveDoc(doc);
    setPromptText(doc.prompt);
    setGeneratedText('');
    setError('');
    setShowSignupPrompt(false);
  };

  const runDemoGeneration = async () => {
    setError('');
    setShowSignupPrompt(false);

    // TODO: client-side only — see lib/demoRateLimit.js for why this isn't a
    // real safeguard and what to replace it with before relying on it in prod.
    const rateLimit = checkDemoRateLimit();
    if (!rateLimit.allowed) {
      setError(`You've reached the demo limit for this hour. Try again in about ${rateLimit.minutesLeft} minute(s), or sign up for unlimited access.`);
      setShowSignupPrompt(true);
      return;
    }

    setLoading(true);
    setGeneratedText('');

    try {
      const content = await generateDocument({ prompt: promptText, documentType: activeDoc.title });
      const truncated =
        content.length > DEMO_PREVIEW_CHAR_LIMIT ? `${content.slice(0, DEMO_PREVIEW_CHAR_LIMIT).trim()}…` : content;
      setGeneratedText(truncated);
      setShowSignupPrompt(true);
    } catch (err) {
      console.error('Demo generation failed', err);
      setError('There was a problem generating the demo document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="demo" className="demo-wrap">
      <div className="demo-card">
        <div className="demo-bar">
          <span className="demo-dot" />
          <span className="demo-dot" />
          <span className="demo-dot" />
        </div>
        <div className="demo-inner">
          <div className="demo-sidebar">
            <div className="demo-sidebar-label">Demo document types</div>
            {demoDocTypes.map((doc) => (
              <button
                key={doc.id}
                className={`doc-item ${doc.id === activeDoc.id ? 'active' : ''}`}
                onClick={() => selectDoc(doc)}
              >
                <span className="doc-icon">{doc.label}</span>
                <span>{doc.title}</span>
              </button>
            ))}
          </div>
          <div className="demo-main">
            <div className="demo-prompt-label">Describe your document</div>
            <textarea
              className="demo-prompt-box"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={5}
              style={{ width: '100%', fontFamily: 'inherit', fontSize: '0.95rem' }}
            />
            <button className="generate-btn" onClick={runDemoGeneration} disabled={loading}>
              {loading ? 'Generating…' : 'Generate document'}
            </button>

            {error && <p className="auth-error">{error}</p>}

            {generatedText && (
              <div className="demo-output">
                <h4 className="demo-output-title">Preview</h4>
                <p>{generatedText}</p>
                <p className="demo-watermark">
                  This is a demo preview — sign up to generate the full, downloadable document.
                </p>
              </div>
            )}

            {showSignupPrompt && (
              <div className="demo-signup-prompt">
                <p>Like what you see? Create a free account to generate unlimited, full-length documents and save them.</p>
                <Link to="/login" className="btn-primary">
                  Sign Up Free
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DemoGenerator;
