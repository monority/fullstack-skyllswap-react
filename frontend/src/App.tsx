import { useState, useMemo, useCallback, lazy, Suspense } from 'react';

import { useApi, useApiInitialization } from './hooks/useApi';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { useMessaging } from './hooks/useMessaging';
import { useMatches } from './hooks/useMatches';
import { useDebounce } from './hooks/useDebounce';

import {
  AuthForm,
  ProfileForm,
  SkillsList,
  Header,
  Seo,
} from './components';

const MatchSection = lazy(() =>
  import('./components/Matches/MatchSection').then(m => ({ default: m.default }))
);
const MessagingPanel = lazy(() =>
  import('./components/Messaging/MessagingPanel').then(m => ({ default: m.default }))
);

import type { MatchFilters } from './types';

type DashboardSection = 'home' | 'matches' | 'skills' | 'profile' | 'messaging';

function SectionLoader() {
  return (
    <div className="section-loader" aria-live="polite">
      <span className="loader-spinner" />
      <span className="sr-only">Chargement...</span>
    </div>
  );
}

function App() {
  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState<DashboardSection>('home');

  const { apiStatus, skills, isLoading } = useApiInitialization();
  const { apiFetch } = useApi();
  const { currentUser, authResolved, login, register, logout } = useAuth(apiFetch);

  const {
    profileForm,
    updateProfileField,
    saveProfile,
    profileLoading,
    profileSaving,
    profileMessage,
    setProfileMessage,
  } = useProfile(currentUser, apiFetch, authResolved);

  const {
    conversations,
    activeConvId,
    selectConversation,
    convMessages,
    newMessage,
    setNewMessage,
    sendMessage,
    startConversation,
    messagesEndRef,
    isUnread,
    unreadCount,
    messagingSending,
  } = useMessaging(currentUser, authResolved, apiFetch);

  const {
    matchPreview,
    matchHintMessage,
    matchFilters,
    updateFilters,
    topMatches,
  } = useMatches(currentUser, authResolved, apiFetch);

  const debouncedQuery = useDebounce(query, 300);

  const profileOffersCount = profileForm.offersText
    .split(',')
    .map(item => item.trim())
    .filter(Boolean).length;

  const profileNeedsCount = profileForm.needsText
    .split(',')
    .map(item => item.trim())
    .filter(Boolean).length;

  const visibleSkills = useMemo(() => {
    const normalized = debouncedQuery.trim().toLowerCase();
    if (!normalized) return skills;
    return skills.filter(skill =>
      skill.title.toLowerCase().includes(normalized)
    );
  }, [skills, debouncedQuery]);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      const result = await login(email, password);
      if (result.success) setProfileMessage('');
      return result;
    },
    [login, setProfileMessage]
  );

  const handleRegister = useCallback(
    async (name: string, email: string, password: string) => {
      const result = await register(name, email, password);
      if (result.success) setProfileMessage('');
      return result;
    },
    [register, setProfileMessage]
  );

  const handleLogout = useCallback(async () => {
    await logout();
    setProfileMessage('');
  }, [logout, setProfileMessage]);

  const handleFiltersChange = useCallback(
    (filters: MatchFilters) => { updateFilters(filters); },
    [updateFilters]
  );

  const handleStartConversation = useCallback(
    async (matchId: number) => {
      await startConversation(matchId);
      setActiveSection('messaging');
    },
    [startConversation]
  );

  const nav = (section: DashboardSection) => () => setActiveSection(section);

  return (
    <>
      <Seo />
      <div className="page-wrapper">
        <Header
          apiStatus={apiStatus}
          user={currentUser}
          onLogout={handleLogout}
        />

        {currentUser ? (
          /* LOGGED IN */
          <main className="dashboard" aria-busy={isLoading || profileLoading}>

            {/* ── Sidebar ── */}
            <aside className="dashboard-sidebar">
              <div className="sidebar-identity">
                <div className="profile-header__avatar">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="profile-header__info">
                  <span className="profile-header__name">{currentUser.name}</span>
                  <span className="profile-header__email">{currentUser.email}</span>
                </div>
              </div>

              <nav className="sidebar-nav" aria-label="Navigation">
                <button
                  className={`sidebar-nav__link${activeSection === 'home' ? ' sidebar-nav__link--active' : ''}`}
                  onClick={nav('home')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  <span className="sidebar-nav__label">Accueil</span>
                </button>

                <button
                  className={`sidebar-nav__link${activeSection === 'matches' ? ' sidebar-nav__link--active' : ''}`}
                  onClick={nav('matches')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-5" />
                  </svg>
                  <span className="sidebar-nav__label">Matchs</span>
                </button>

                <button
                  className={`sidebar-nav__link${activeSection === 'skills' ? ' sidebar-nav__link--active' : ''}`}
                  onClick={nav('skills')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                  </svg>
                  <span className="sidebar-nav__label">Compétences</span>
                </button>

                <button
                  className={`sidebar-nav__link${activeSection === 'profile' ? ' sidebar-nav__link--active' : ''}`}
                  onClick={nav('profile')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                  <span className="sidebar-nav__label">Profil</span>
                </button>

                <button
                  className={`sidebar-nav__link${activeSection === 'messaging' ? ' sidebar-nav__link--active' : ''}`}
                  onClick={nav('messaging')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="sidebar-nav__label">Messagerie</span>
                  {unreadCount > 0 && (
                    <span className="sidebar-nav__badge">{unreadCount}</span>
                  )}
                </button>
              </nav>
            </aside>

            {/* ── Main ── */}
            <div className="dashboard-main">
              {activeSection === 'home' && (
                <div className="main-section">
                  <div className="main-section__header">Accueil</div>
                  <div className="main-section__body">
                    <div className="home-welcome">
                      <h2 className="home-welcome__title">Bonjour, {currentUser.name.split(' ')[0]}&nbsp;👋</h2>
                      <p className="home-welcome__sub">Voici un résumé de votre activité sur Skyllswap.</p>
                    </div>

                    <div className="home-stats">
                      <div className="home-stat-card home-stat-card--matches">
                        <div className="home-stat-card__top">
                          <span className="home-stat-card__icon" aria-hidden="true">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <path d="m8 12 3 3 5-5" />
                            </svg>
                          </span>
                          <span className="home-stat-card__label">Matchs disponibles</span>
                        </div>
                        <span className="home-stat-card__value">{topMatches.length}</span>
                      </div>
                      <div className="home-stat-card home-stat-card--skills">
                        <div className="home-stat-card__top">
                          <span className="home-stat-card__icon" aria-hidden="true">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 3v18" />
                              <path d="M5 8h14" />
                              <path d="M7 16h10" />
                            </svg>
                          </span>
                          <span className="home-stat-card__label">Compétences</span>
                        </div>
                        <span className="home-stat-card__value">{skills.length}</span>
                      </div>
                      <div className="home-stat-card home-stat-card--messages">
                        <div className="home-stat-card__top">
                          <span className="home-stat-card__icon" aria-hidden="true">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                          </span>
                          <span className="home-stat-card__label">Messages non lus</span>
                        </div>
                        <span className="home-stat-card__value">{unreadCount}</span>
                      </div>
                    </div>

                    <h3 className="home-section-title">Actions rapides</h3>
                    <div className="home-actions">
                      <button className="home-action-card" onClick={nav('matches')}>
                        <div className="home-action-card__icon">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-5" />
                          </svg>
                        </div>
                        <div className="home-action-card__body">
                          <span className="home-action-card__title">Mes matchs</span>
                          <span className="home-action-card__desc">
                            <span className="home-action-card__desc-text home-action-card__desc-text--desktop">Découvrez vos meilleurs profils compatibles</span>
                            <span className="home-action-card__desc-text home-action-card__desc-text--mobile">Profils compatibles</span>
                          </span>
                        </div>
                        <svg className="home-action-card__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>

                      <button className="home-action-card" onClick={nav('skills')}>
                        <div className="home-action-card__icon">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                          </svg>
                        </div>
                        <div className="home-action-card__body">
                          <span className="home-action-card__title">Compétences</span>
                          <span className="home-action-card__desc">
                            <span className="home-action-card__desc-text home-action-card__desc-text--desktop">Explorez toutes les compétences disponibles</span>
                            <span className="home-action-card__desc-text home-action-card__desc-text--mobile">Toutes les compétences</span>
                          </span>
                        </div>
                        <svg className="home-action-card__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>

                      <button className="home-action-card" onClick={nav('profile')}>
                        <div className="home-action-card__icon">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <div className="home-action-card__body">
                          <span className="home-action-card__title">Mon profil</span>
                          <span className="home-action-card__desc">
                            <span className="home-action-card__desc-text home-action-card__desc-text--desktop">Mettez à jour votre localisation et vos compétences</span>
                            <span className="home-action-card__desc-text home-action-card__desc-text--mobile">Mise à jour du profil</span>
                          </span>
                        </div>
                        <svg className="home-action-card__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>

                      <button className="home-action-card" onClick={nav('messaging')}>
                        <div className="home-action-card__icon">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                        </div>
                        <div className="home-action-card__body">
                          <span className="home-action-card__title">Messagerie
                            {unreadCount > 0 && <span className="home-action-card__badge">{unreadCount}</span>}
                          </span>
                          <span className="home-action-card__desc">
                            <span className="home-action-card__desc-text home-action-card__desc-text--desktop">Échangez avec vos partenaires</span>
                            <span className="home-action-card__desc-text home-action-card__desc-text--mobile">Échangez avec vos partenaires</span>
                          </span>
                        </div>
                        <svg className="home-action-card__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'matches' && (
                <div className="main-section">
                  <div className="main-section__header">Matchs</div>
                  <div className="main-section__body">
                    <Suspense fallback={<SectionLoader />}>
                      <MatchSection
                        currentUser={currentUser}
                        matchPreview={matchPreview}
                        topMatches={topMatches}
                        matchFilters={matchFilters}
                        onFiltersChange={handleFiltersChange}
                        onStartConversation={handleStartConversation}
                        hintMessage={matchHintMessage}
                      />
                    </Suspense>
                  </div>
                </div>
              )}

              {activeSection === 'skills' && (
                <div className="main-section">
                  <div className="main-section__header">Compétences</div>
                  <div className="main-section__body">
                    <SkillsList
                      skills={visibleSkills}
                      query={query}
                      onQueryChange={setQuery}
                      isLoading={isLoading}
                    />
                  </div>
                </div>
              )}

              {activeSection === 'profile' && (
                <div className="main-section">
                  <div className="main-section__header">Profil</div>
                  <div className="main-section__body">
                    <div className="profile-hero">
                      <div className="profile-hero__art" aria-hidden="true">
                        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                          <circle cx="32" cy="22" r="12" fill="currentColor" opacity="0.18" />
                          <path d="M14 52c2.5-10.5 11-16 18-16s15.5 5.5 18 16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                          <path d="M22 22l6 6 14-14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="profile-hero__body">
                        <p className="profile-hero__eyebrow">Profil public</p>
                        <h3 className="profile-hero__title">Optimisez votre carte d&apos;échange</h3>
                        <p className="profile-hero__text">
                          Votre ville, votre disponibilité et vos compétences servent à générer des matchs plus pertinents.
                        </p>
                        <div className="profile-hero__chips">
                          <span className="profile-hero__chip">Ville: {profileForm.city || 'Non renseignée'}</span>
                          <span className="profile-hero__chip">Disponibilité: {profileForm.availability || 'À définir'}</span>
                        </div>
                      </div>
                      <div className="profile-hero__stats">
                        <div className="profile-hero__stat profile-hero__stat--offers">
                          <span className="profile-hero__stat-value">{profileOffersCount}</span>
                          <span className="profile-hero__stat-label">Compétences proposées</span>
                        </div>
                        <div className="profile-hero__stat profile-hero__stat--needs">
                          <span className="profile-hero__stat-value">{profileNeedsCount}</span>
                          <span className="profile-hero__stat-label">Compétences recherchées</span>
                        </div>
                      </div>
                    </div>

                    <div className="profile-header">
                      <div className="profile-header__avatar">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="profile-header__info">
                        <span className="profile-header__name">{currentUser.name}</span>
                        <span className="profile-header__email">{currentUser.email}</span>
                      </div>
                    </div>
                    <ProfileForm
                      form={profileForm}
                      onUpdateField={updateProfileField}
                      onSave={saveProfile}
                      loading={profileLoading}
                      saving={profileSaving}
                      message={profileMessage}
                    />
                  </div>
                </div>
              )}

              {activeSection === 'messaging' && (
                <div className="main-section main-section--messaging">
                  <Suspense fallback={<SectionLoader />}>
                    <MessagingPanel
                      currentUser={currentUser}
                      conversations={conversations}
                      activeConvId={activeConvId}
                      onSelectConversation={selectConversation}
                      messages={convMessages}
                      newMessage={newMessage}
                      onNewMessageChange={setNewMessage}
                      onSendMessage={sendMessage}
                      messagesEndRef={messagesEndRef}
                      isUnread={isUnread}
                      sending={messagingSending}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          </main>
        ) : (
          /* NOT LOGGED IN */
          <main className="auth-landing" aria-busy={isLoading}>
            <div className="auth-landing-inner">
              <div className="auth-landing-brand">
                <div className="auth-logo__title">

                  <div className="auth-logo">
                    <img src="/logo-brand.svg" alt="Skyllswap" width="28" height="28" />
                  </div>
                  <h1>Skyllswap</h1>
                </div>

                <p>Échangez vos compétences,<br />apprenez ensemble.</p>
                <ul className="auth-bullets">
                  <li>
                    <span className="auth-bullets__icon">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </span>
                    Trouvez des partenaires d'apprentissage locaux
                  </li>
                  <li>
                    <span className="auth-bullets__icon">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                      </svg>
                    </span>
                    Proposez ce que vous maîtrisez, demandez ce que vous voulez apprendre
                  </li>
                  <li>
                    <span className="auth-bullets__icon">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </span>
                    Échangez directement par messagerie
                  </li>
                </ul>
              </div>

              <div className="auth-landing-card">
                <AuthForm
                  onLogin={handleLogin}
                  onRegister={handleRegister}
                  loading={false}
                />
              </div>
            </div>

            <div className="auth-health-module">
              <div className="auth-health-module__card">
                <div className="auth-health-module__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                    <line x1="6" y1="6" x2="6.01" y2="6" />
                    <line x1="6" y1="18" x2="6.01" y2="18" />
                  </svg>
                </div>
                <div className="auth-health-module__body">
                  <div className="auth-health-module__top">
                    <span className="auth-health-module__title">Statut du serveur</span>
                    <div className={`auth-health-module__pill${apiStatus === 'ok' ? ' auth-health-module__pill--on' : apiStatus === 'checking' ? ' auth-health-module__pill--checking' : ' auth-health-module__pill--off'}`}>
                      <span className={`auth-health-module__dot${apiStatus === 'ok' ? ' auth-health-module__dot--on' : apiStatus === 'checking' ? ' auth-health-module__dot--checking' : ' auth-health-module__dot--off'}`} />
                      {apiStatus === 'ok' ? 'Opérationnel' : apiStatus === 'down' ? 'Hors ligne' : 'Vérification...'}
                    </div>
                  </div>
                  <div className="auth-health-module__details">
                    <div className="auth-health-module__detail">
                      <span className="auth-health-module__detail-label">Service</span>
                      <span className="auth-health-module__detail-value">API Skyllswap</span>
                    </div>
                    <div className="auth-health-module__divider" />
                    <div className="auth-health-module__detail">
                      <span className="auth-health-module__detail-label">Statut</span>
                      <span className="auth-health-module__detail-value">{apiStatus === 'ok' ? 'En ligne' : apiStatus === 'down' ? 'Hors ligne' : 'Vérification...'}</span>
                    </div>
                    <div className="auth-health-module__divider" />
                    <div className="auth-health-module__detail">
                      <span className="auth-health-module__detail-label">Rafraîchissement</span>
                      <span className="auth-health-module__detail-value">Toutes les 10 secondes</span>
                    </div>
                  </div>
                </div>
                <div className={`auth-health-module__bar${apiStatus === 'ok' ? ' auth-health-module__bar--on' : apiStatus === 'checking' ? ' auth-health-module__bar--checking' : ' auth-health-module__bar--off'}`} />
              </div>
            </div>
          </main>
        )}
      </div>
    </>
  );
}

export default App;
