import { Link, useNavigate } from 'react-router-dom';
import { Navbar, Nav, Container, Button, NavDropdown, Image, Dropdown } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { authService } from '@services/authService';
import i18n from '@/i18n';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/i18n/config';

const languageLabels: Record<AppLanguage, string> = {
  en: 'navbar:language.en',
  vi: 'navbar:language.vi',
  ja: 'navbar:language.ja',
};

export function AppNavbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation(['navbar']);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } finally {
      logout();
      navigate('/');
    }
  };

  const handleLanguageChange = (language: AppLanguage) => {
    void i18n.changeLanguage(language);
  };

  const currentLanguage = (SUPPORTED_LANGUAGES.includes(i18n.language as AppLanguage)
    ? i18n.language
    : 'en') as AppLanguage;

  return (
    <Navbar expand="lg" sticky="top" className="navbar-dark">
      <Container>
        <Navbar.Brand as={Link} to="/">
          <i className="bi bi-chat-square-quote me-2" />
          {t('brand')}
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="main-nav" style={{ borderColor: 'rgba(0,245,255,0.4)' }} />
        <Navbar.Collapse id="main-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/matches">
              <i className="bi bi-broadcast me-1" />
              {t('links.liveMatches')}
            </Nav.Link>
            <Nav.Link as={Link} to="/leaderboard">
              <i className="bi bi-trophy me-1" />
              {t('links.leaderboard')}
            </Nav.Link>
            {isAuthenticated && (
              <>
                <Nav.Link as={Link} to="/matchmaking">
                  <i className="bi bi-lightning me-1" />
                  {t('links.rank')}
                </Nav.Link>
                <Nav.Link as={Link} to="/rooms/create">
                  <i className="bi bi-plus-circle me-1" />
                  {t('links.createRoom')}
                </Nav.Link>
              </>
            )}
          </Nav>

          <Nav className="align-items-lg-center gap-2">
            <Dropdown align="end">
              <Dropdown.Toggle variant="outline-primary" size="sm" id="language-switcher" className="px-3">
                <i className="bi bi-translate me-2" />
                {t(languageLabels[currentLanguage])}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Header>{t('language.label')}</Dropdown.Header>
                {SUPPORTED_LANGUAGES.map((language) => (
                  <Dropdown.Item
                    key={language}
                    active={language === currentLanguage}
                    onClick={() => handleLanguageChange(language)}
                  >
                    {t(languageLabels[language])}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>

            {isAuthenticated && user ? (
              <NavDropdown
                title={
                  <span className="d-inline-flex align-items-center gap-2">
                    {user.profile.avatar ? (
                      <>
                        <Image
                          src={user.profile.avatar}
                          alt={user.profile.displayName || user.username}
                          width={24}
                          height={24}
                          roundedCircle
                          style={{ objectFit: 'cover' }}
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                            const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = 'inline-flex';
                          }}
                        />
                        <span
                          className="rounded-circle align-items-center justify-content-center"
                          style={{
                            width: 24,
                            height: 24,
                            display: 'none',
                            color: 'var(--bs-primary)',
                            border: '1px solid var(--border-neon)',
                            background: 'rgba(0, 245, 255, 0.08)',
                          }}
                        >
                          <i className="bi bi-person-fill" />
                        </span>
                      </>
                    ) : (
                      <span
                        className="rounded-circle d-inline-flex align-items-center justify-content-center"
                        style={{
                          width: 24,
                          height: 24,
                          color: 'var(--bs-primary)',
                          border: '1px solid var(--border-neon)',
                          background: 'rgba(0, 245, 255, 0.08)',
                        }}
                      >
                        <i className="bi bi-person-fill" />
                      </span>
                    )}
                    <span>{user.profile.displayName || user.username}</span>
                  </span>
                }
                id="user-dropdown"
                align="end"
              >
                <NavDropdown.Item as={Link} to={`/profile/${user._id}`}>
                  <i className="bi bi-person me-2" />
                  {t('links.profile')}
                </NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-2" />
                  {t('links.logout')}
                </NavDropdown.Item>
              </NavDropdown>
            ) : (
              <div className="d-flex gap-2">
                <Button as={Link as any} to="/login" variant="outline-primary" size="sm" className="px-3">
                  {t('links.login')}
                </Button>
                <Button as={Link as any} to="/register" variant="primary" size="sm" className="px-3">
                  {t('links.register')}
                </Button>
              </div>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
