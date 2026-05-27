import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Form, Button, Alert, Container, Row, Col } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { authService } from '@services/authService';

export default function RegisterPage() {
  const { t } = useTranslation('auth');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const registerSchema = z
    .object({
      username: z.string().min(3, t('validation.usernameMin')).max(20, t('validation.usernameMax')),
      email: z.string().email(t('validation.emailInvalid')),
      password: z.string().min(6, t('validation.passwordMin')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confirmPassword'],
    });

  type RegisterForm = z.infer<typeof registerSchema>;

  const {
    register: reg,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await authService.register(data);
      setSuccess(t('register.success'));
    } catch (err: any) {
      setError(err.response?.data?.message || t('register.failed'));
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
              <h3 className="text-center mb-4">{t('register.title')}</h3>

              {error && <Alert variant="danger">{error}</Alert>}
              {success && <Alert variant="success">{success}</Alert>}

              <Form onSubmit={handleSubmit(onSubmit)}>
                <Form.Group className="mb-3">
                  <Form.Label>{t('fields.username')}</Form.Label>
                  <Form.Control placeholder="username" isInvalid={!!errors.username} {...reg('username')} />
                  <Form.Control.Feedback type="invalid">{errors.username?.message}</Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>{t('fields.email')}</Form.Label>
                  <Form.Control type="email" placeholder="you@example.com" isInvalid={!!errors.email} {...reg('email')} />
                  <Form.Control.Feedback type="invalid">{errors.email?.message}</Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>{t('fields.password')}</Form.Label>
                  <Form.Control type="password" placeholder="••••••" isInvalid={!!errors.password} {...reg('password')} />
                  <Form.Control.Feedback type="invalid">{errors.password?.message}</Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>{t('fields.confirmPassword')}</Form.Label>
                  <Form.Control type="password" placeholder="••••••" isInvalid={!!errors.confirmPassword} {...reg('confirmPassword')} />
                  <Form.Control.Feedback type="invalid">{errors.confirmPassword?.message}</Form.Control.Feedback>
                </Form.Group>

                <Button type="submit" variant="primary" className="w-100" disabled={loading}>
                  {loading ? t('register.submitting') : t('register.submit')}
                </Button>
              </Form>

              <p className="text-center mt-3 mb-0">
                {t('register.haveAccount')} <Link to="/login">{t('login.submit')}</Link>
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
