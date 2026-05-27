import { Row, Col, Card, Button, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';

const sectionDelayClasses = ['landing-animate-delay-1', 'landing-animate-delay-2', 'landing-animate-delay-3', 'landing-animate-delay-4'] as const;

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();
  const { t } = useTranslation('home');

  const primaryCta = isAuthenticated
    ? { to: '/matchmaking', label: t('cta.primaryAuth'), icon: 'bi bi-lightning' }
    : { to: '/register', label: t('cta.primaryGuest'), icon: 'bi bi-rocket-takeoff' };

  const secondaryCta = isAuthenticated
    ? { to: '/rooms/create', label: t('cta.secondaryAuth'), icon: 'bi bi-plus-circle' }
    : { to: '/matches', label: t('cta.secondaryGuest'), icon: 'bi bi-play-circle' };

  const entryPoints = [
    {
      key: 'start',
      ctaTo: '/matchmaking',
      ctaIcon: 'bi bi-people-fill',
      stats: [
        { label: t('sections.start.stats.modes'), value: t('sections.start.stats.modesValue') },
        { label: t('sections.start.stats.access'), value: t('sections.start.stats.accessValue') },
      ],
    },
    {
      key: 'ai',
      ctaTo: '/matches',
      ctaIcon: 'bi bi-robot',
      stats: [
        { label: t('sections.ai.stats.analysis'), value: t('sections.ai.stats.analysisValue') },
        { label: t('sections.ai.stats.detection'), value: t('sections.ai.stats.detectionValue') },
      ],
    },
    {
      key: 'progress',
      ctaTo: '/leaderboard',
      ctaIcon: 'bi bi-trophy',
      stats: [
        { label: t('sections.progress.stats.tracking'), value: t('sections.progress.stats.trackingValue') },
        { label: t('sections.progress.stats.improvement'), value: t('sections.progress.stats.improvementValue') },
      ],
    },
    {
      key: 'community',
      ctaTo: '/matches',
      ctaIcon: 'bi bi-broadcast',
      stats: [
        { label: t('sections.community.stats.watch'), value: t('sections.community.stats.watchValue') },
        { label: t('sections.community.stats.explore'), value: t('sections.community.stats.exploreValue') },
      ],
    },
  ] as const;

  return (
    <div className="landing-page">
      <section className="landing-hero py-5 py-lg-6">
        <Row className="align-items-center g-5">
          <Col lg={6}>
            <Badge bg="secondary" className="landing-kicker landing-animate-fade-up mb-3">
              {t('hero.kicker')}
            </Badge>
            <h1 className="landing-title landing-animate-fade-up landing-animate-delay-1 mb-3">{t('hero.title')}</h1>
            <p className="landing-subtitle landing-animate-fade-up landing-animate-delay-2 mb-4">{t('hero.subtitle')}</p>
            <div className="landing-hero-actions landing-animate-fade-up landing-animate-delay-3 d-flex flex-column flex-sm-row gap-3">
              <Button as={Link as any} to={primaryCta.to} variant="primary" size="lg" className="landing-interactive-lift">
                <i className={`${primaryCta.icon} me-2`} />
                {primaryCta.label}
              </Button>
              <Button as={Link as any} to={secondaryCta.to} variant="outline-primary" size="lg" className="landing-interactive-lift">
                <i className={`${secondaryCta.icon} me-2`} />
                {secondaryCta.label}
              </Button>
            </div>
          </Col>

          <Col lg={6}>
            <div className="landing-showcase landing-animate-fade-up landing-animate-delay-2">
              <div className="landing-showcase-panel landing-showcase-panel-primary landing-soft-glow">
                <span className="landing-panel-label">{t('showcase.liveRoom')}</span>
                <h2>{t('showcase.liveTitle')}</h2>
                <p>{t('showcase.liveCopy')}</p>
                <div className="landing-showcase-stats">
                  <div>
                    <span>{t('showcase.format')}</span>
                    <strong>1v1 / 3v3</strong>
                  </div>
                  <div>
                    <span>{t('showcase.judge')}</span>
                    <strong>AI + Ranking</strong>
                  </div>
                  <div>
                    <span>{t('showcase.queue')}</span>
                    <strong>Live Matchmaking</strong>
                  </div>
                </div>
              </div>

              <div className="landing-showcase-panel landing-showcase-panel-secondary landing-soft-glow landing-animate-fade-up landing-animate-delay-4">
                <span className="landing-panel-label">{t('showcase.playerSnapshot')}</span>
                <div className="landing-mini-stats">
                  <div>
                    <span>{t('showcase.elo')}</span>
                    <strong>1480</strong>
                  </div>
                  <div>
                    <span>{t('showcase.winRate')}</span>
                    <strong>64%</strong>
                  </div>
                  <div>
                    <span>{t('showcase.feedback')}</span>
                    <strong>{t('showcase.strengths')}</strong>
                  </div>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </section>

      {entryPoints.map((section, index) => {
        const imageFirst = index % 2 === 0;
        const delayClass = sectionDelayClasses[index % sectionDelayClasses.length];
        const baseKey = `sections.${section.key}` as const;
        const bullets = t(`${baseKey}.bullets`, { returnObjects: true }) as string[];

        return (
          <section key={section.key} className={`landing-section landing-animate-fade-up ${delayClass} py-5`}>
            <Row className="align-items-center g-4 g-lg-5 flex-lg-row">
              <Col lg={6} className={imageFirst ? 'order-lg-1' : 'order-lg-2'}>
                <div className="landing-feature-panel landing-interactive-lift h-100">
                  <span className="landing-panel-label">{t(`${baseKey}.eyebrow`)}</span>
                  <h2 className="landing-section-title">{t(`${baseKey}.panelTitle`)}</h2>
                  <p className="landing-section-copy">{t(`${baseKey}.panelDetail`)}</p>
                  <div className="landing-feature-stats">
                    {section.stats.map((stat) => (
                      <div key={stat.label} className="landing-feature-stat">
                        <span>{stat.label}</span>
                        <strong>{stat.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </Col>

              <Col lg={6} className={imageFirst ? 'order-lg-2' : 'order-lg-1'}>
                <div className="landing-section-copy-wrap">
                  <h2 className="landing-section-title">{t(`${baseKey}.title`)}</h2>
                  <p className="landing-section-copy">{t(`${baseKey}.description`)}</p>
                  <ul className="landing-bullets list-unstyled mb-4">
                    {bullets.map((bullet) => (
                      <li key={bullet}>
                        <i className="bi bi-check-circle-fill me-2" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <Button as={Link as any} to={section.ctaTo} variant="outline-primary" className="landing-interactive-lift">
                    <i className={`${section.ctaIcon} me-2`} />
                    {t(`${baseKey}.cta`)}
                  </Button>
                </div>
              </Col>
            </Row>
          </section>
        );
      })}

      <section className="landing-final-cta landing-animate-fade-up landing-animate-delay-3 py-5">
        <Card className="landing-final-cta-card landing-soft-glow border-0 shadow-sm">
          <Card.Body className="text-center py-5 px-4 px-lg-5">
            <h2 className="landing-final-title mb-3">{t('finalCta.title')}</h2>
            <p className="landing-final-copy mb-4">{t('finalCta.copy')}</p>
            <div className="d-flex flex-column flex-sm-row justify-content-center gap-3">
              <Button as={Link as any} to={primaryCta.to} variant="primary" size="lg" className="landing-interactive-lift">
                <i className={`${primaryCta.icon} me-2`} />
                {primaryCta.label}
              </Button>
              <Button as={Link as any} to={secondaryCta.to} variant="outline-primary" size="lg" className="landing-interactive-lift">
                <i className={`${secondaryCta.icon} me-2`} />
                {secondaryCta.label}
              </Button>
            </div>
          </Card.Body>
        </Card>
      </section>
    </div>
  );
}
