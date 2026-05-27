import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Card, Form, Button, Alert, Container, Row, Col } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { authService } from '@services/authService';
import { ENV } from '@/config/env';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: { theme: string; size: string; width?: number }) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const { t } = useTranslation('auth');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleInitializedRef = useRef(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const loginSchema = z.object({
    email: z.string().email(t('validation.emailInvalid')),
    password: z.string().min(6, t('validation.passwordMin')),
  });

  type LoginForm = z.infer<typeof loginSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const handleGoogleCredential = useCallback(async ({ credential }: { credential: string }) => {
    setError('');
    try {
      const res = await authService.googleLogin({ idToken: credential });
      const { user, accessToken, refreshToken } = res.data.data;
      login(user, accessToken, refreshToken);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || t('login.googleFailed'));
    }
  }, [from, login, navigate, t]);

  useEffect(() => {
    if (!ENV.GOOGLE_CLIENT_ID) return;

    const renderGoogleButton = () => {
      if (!window.google || !googleButtonRef.current || googleInitializedRef.current) return;
      googleInitializedRef.current = true;
      window.google.accounts.id.initialize({
        client_id: ENV.GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large', width: 240 });
    };

    if (window.google) {
      renderGoogleButton();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener('load', renderGoogleButton, { once: true });
      return () => existingScript.removeEventListener('load', renderGoogleButton);
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', renderGoogleButton, { once: true });
    document.body.appendChild(script);

    return () => script.removeEventListener('load', renderGoogleButton);
  }, [handleGoogleCredential]);

  const onSubmit = async (data: LoginForm) => {
    setError('');
    setLoading(true);
    try {
      const res = await authService.login(data);
      const { user, accessToken, refreshToken } = res.data.data;
      login(user, accessToken, refreshToken);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || t('login.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Row className="justify-content-center">
        <Col md={5}>
          <Card className="shadow-sm mt-5">
            <Card.Body className="p-4">
              <h3 className="text-center mb-4">{t('login.title')}</h3>

              {error && <Alert variant="danger">{error}</Alert>}

              <Form onSubmit={handleSubmit(onSubmit)}>
                <Form.Group className="mb-3">
                  <Form.Label>{t('fields.email')}</Form.Label>
                  <Form.Control type="email" placeholder="you@example.com" isInvalid={!!errors.email} {...register('email')} />
                  <Form.Control.Feedback type="invalid">{errors.email?.message}</Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>{t('fields.password')}</Form.Label>
                  <Form.Control type="password" placeholder="••••••" isInvalid={!!errors.password} {...register('password')} />
                  <Form.Control.Feedback type="invalid">{errors.password?.message}</Form.Control.Feedback>
                </Form.Group>

                <div className="text-end mb-3">
                  <Link to="/forgot-password">{t('login.forgotPassword')}</Link>
                </div>

                <Button type="submit" variant="primary" className="w-100" disabled={loading}>
                  {loading ? t('login.submitting') : t('login.submit')}
                </Button>
              </Form>

              {ENV.GOOGLE_CLIENT_ID && (
                <>
                  <div className="text-center text-muted my-3">{t('login.or')}</div>
                  <div ref={googleButtonRef} className="d-flex justify-content-center" />
                </>
              )}

              <p className="text-center mt-3 mb-0">
                {t('login.noAccount')} <Link to="/register">{t('register.submit')}</Link>
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
