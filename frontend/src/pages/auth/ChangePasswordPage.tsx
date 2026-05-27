import { useState } from 'react';
import { Alert, Button, Card, Container, Form } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { authService } from '@services/authService';

export default function ChangePasswordPage() {
  const { t } = useTranslation('auth');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const schema = z.object({
    currentPassword: z.string().min(1, t('validation.currentPasswordRequired')),
    newPassword: z.string().min(6, t('validation.passwordMin')),
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('validation.passwordMismatch'),
    path: ['confirmPassword'],
  });

  type ChangePasswordForm = z.infer<typeof schema>;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ChangePasswordForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: ChangePasswordForm) => {
    setMessage('');
    setError('');
    setLoading(true);
    try {
      await authService.changePassword(data);
      reset();
      setMessage(t('changePassword.success'));
    } catch (err: any) {
      setError(err.response?.data?.message || t('changePassword.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="py-5">
      <Card className="mx-auto shadow-sm" style={{ maxWidth: 520 }}>
        <Card.Body className="p-4">
          <h3 className="text-center mb-4">{t('changePassword.title')}</h3>
          {message && <Alert variant="success">{message}</Alert>}
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit(onSubmit)}>
            <Form.Group className="mb-3">
              <Form.Label>{t('fields.currentPassword')}</Form.Label>
              <Form.Control type="password" isInvalid={!!errors.currentPassword} {...register('currentPassword')} />
              <Form.Control.Feedback type="invalid">{errors.currentPassword?.message}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('fields.newPassword')}</Form.Label>
              <Form.Control type="password" isInvalid={!!errors.newPassword} {...register('newPassword')} />
              <Form.Control.Feedback type="invalid">{errors.newPassword?.message}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('fields.confirmPassword')}</Form.Label>
              <Form.Control type="password" isInvalid={!!errors.confirmPassword} {...register('confirmPassword')} />
              <Form.Control.Feedback type="invalid">{errors.confirmPassword?.message}</Form.Control.Feedback>
            </Form.Group>
            <Button type="submit" className="w-100" disabled={loading}>{loading ? t('changePassword.submitting') : t('changePassword.submit')}</Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}
