import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Card, Container, Spinner } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { authService } from '@services/authService';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation('auth');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState(t('verifyEmail.loading'));

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage(t('verifyEmail.missingToken'));
      return;
    }

    authService
      .verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage(t('verifyEmail.success'));
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.message || t('verifyEmail.failed'));
      });
  }, [searchParams, t]);

  return (
    <Container className="py-5">
      <Card className="mx-auto shadow-sm" style={{ maxWidth: 520 }}>
        <Card.Body className="p-4 text-center">
          {status === 'loading' && <Spinner className="mb-3" />}
          <Alert variant={status === 'success' ? 'success' : status === 'error' ? 'danger' : 'info'}>{message}</Alert>
          <Link to="/login">{t('verifyEmail.backToLogin')}</Link>
        </Card.Body>
      </Card>
    </Container>
  );
}
