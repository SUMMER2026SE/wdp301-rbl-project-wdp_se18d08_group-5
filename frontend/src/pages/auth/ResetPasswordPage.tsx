import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, Container, Form } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { authService } from '@services/authService';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation('auth');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const schema = z.object({
    password: z.string().min(6, t('validation.passwordMin')),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('validation.passwordMismatch'),
    path: ['confirmPassword'],
  });

  type ResetPasswordForm = z.infer<typeof schema>;

  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: ResetPasswordForm) => {
    const token = searchParams.get('token');
    if (!token) {
      setError(t('resetPassword.missingToken'));
      return;
    }

    setMessage('');
    setError('');
    setLoading(true);
    try {
      await authService.resetPassword({ token, ...data });
      setMessage(t('resetPassword.success'));
    } catch (err: any) {
      setError(err.response?.data?.message || t('resetPassword.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="py-5">
      <Card className="mx-auto shadow-sm" style={{ maxWidth: 520 }}>
        <Card.Body className="p-4">
          <h3 className="text-center mb-4">{t('resetPassword.title')}</h3>
          {message && <Alert variant="success">{message}</Alert>}
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit(onSubmit)}>
            <Form.Group className="mb-3">
              <Form.Label>{t('fields.newPassword')}</Form.Label>
              <Form.Control type="password" isInvalid={!!errors.password} {...register('password')} />
              <Form.Control.Feedback type="invalid">{errors.password?.message}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('fields.confirmPassword')}</Form.Label>
              <Form.Control type="password" isInvalid={!!errors.confirmPassword} {...register('confirmPassword')} />
              <Form.Control.Feedback type="invalid">{errors.confirmPassword?.message}</Form.Control.Feedback>
            </Form.Group>
            <Button type="submit" className="w-100" disabled={loading}>{loading ? t('resetPassword.submitting') : t('resetPassword.submit')}</Button>
          </Form>
          <div className="text-center mt-3"><Link to="/login">{t('resetPassword.backToLogin', { defaultValue: t('verifyEmail.backToLogin') })}</Link></div>
        </Card.Body>
      </Card>
    </Container>
  );
}
