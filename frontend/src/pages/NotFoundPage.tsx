import { Container, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFoundPage() {
  const { t } = useTranslation('common');

  return (
    <Container className="text-center py-5">
      <h1 className="display-1 fw-bold text-muted">404</h1>
      <p className="lead">{t('errors.notFound')}</p>
      <Button as={Link as any} to="/" variant="primary">
        {t('actions.backToHome')}
      </Button>
    </Container>
  );
}
