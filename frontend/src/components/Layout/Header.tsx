import { memo } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
}

interface HeaderProps {
  apiStatus: string;
  user?: User | null;
  onLogout?: () => Promise<void>;
}

function Header({ apiStatus, user, onLogout }: HeaderProps) {
  const isOnline = apiStatus === 'ok';
  const isLoading = apiStatus === 'checking';

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo">
          <span className="logo-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </span>
          <span className="logo-text">Skyllswap</span>
        </div>
        <span className="header-tagline">Échange de compétences local</span>
      </div>

      <div className="header-right">
        {user ? (
          <div className="header-user">
            <span className="header-user-name">{user.name}</span>
            {onLogout && (
              <button className="header-logout" onClick={onLogout} title="Se déconnecter">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div
            className={`header-status ${isLoading ? 'header-status--loading' : !isOnline ? 'header-status--offline' : ''
              }`}
          >
            <span className="header-status__dot" />
            <span>{isLoading ? 'Connexion...' : isOnline ? 'En ligne' : 'Hors ligne'}</span>
          </div>
        )}
        <span className="header-meta">Paris</span>
      </div>
    </header>
  );
}

export default memo(Header);
