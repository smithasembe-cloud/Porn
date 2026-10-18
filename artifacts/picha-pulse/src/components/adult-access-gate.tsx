import { useState, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';

const CONFIRMATION_KEY = 'picha-pulse-adult-confirmed';

function hasConfirmedAge() {
  try {
    return sessionStorage.getItem(CONFIRMATION_KEY) === 'yes';
  } catch {
    return false;
  }
}

export function AdultAccessGate({ children }: { children: ReactNode }) {
  const [confirmed, setConfirmed] = useState(hasConfirmedAge);
  const [declined, setDeclined] = useState(false);

  const confirmAge = () => {
    try {
      sessionStorage.setItem(CONFIRMATION_KEY, 'yes');
    } catch {
      // Keep the confirmation for this mounted page if storage is blocked.
    }
    setConfirmed(true);
  };

  if (confirmed) return children;

  return (
    <main className="adult-gate">
      <section className="adult-gate-card" aria-labelledby="adult-gate-title">
        <div className="adult-gate-mark" aria-hidden="true">18+</div>
        <p className="adult-gate-eyebrow">Picha Pulse · Adults only</p>
        <h1 id="adult-gate-title" className="adult-gate-title">
          {declined ? 'Access is closed.' : 'This site is for adults.'}
        </h1>
        {declined ? (
          <>
            <p className="adult-gate-copy">You said you are under 18. Please close this tab to leave.</p>
            <button
              onClick={() => setDeclined(false)}
              data-testid="button-age-gate-return"
              className="adult-gate-secondary"
            >
              Return to age check
            </button>
          </>
        ) : (
          <>
            <div className="adult-gate-notice">
              <CircleAlert size={19} aria-hidden="true" />
              <p>This community may contain nudity and other adult images or videos.</p>
            </div>
            <p className="adult-gate-copy">
              Continue only if you are at least 18 and viewing this content is allowed where you are.
            </p>
            <div className="adult-gate-actions">
              <button
                onClick={confirmAge}
                data-testid="button-age-gate-confirm"
                className="adult-gate-primary"
              >
                I am 18 or older — continue
              </button>
              <button
                onClick={() => setDeclined(true)}
                data-testid="button-age-gate-decline"
                className="adult-gate-secondary"
              >
                I am under 18 — leave
              </button>
            </div>
            <p className="adult-gate-disclaimer">
              This is a self-declared age check, not identity or age verification.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
