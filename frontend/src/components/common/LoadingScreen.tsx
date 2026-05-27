import { Spinner, Container } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

export function LoadingScreen() {
  const { t } = useTranslation('common');

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
      <div className="text-center">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3 text-muted">{t('loading')}</p>
      </div>
    </Container>
  );
}
