import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Container, Form } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { authService } from '@services/authService';

export default function ForgotPasswordPage() {
  const { t } = useTranslation('auth');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const schema = z.object({
    email: z.string().email(t('validation.emailInvalid')),
  });

  type ForgotPasswordForm = z.infer<typeof schema>;

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setMessage('');
    setError('');
    setLoading(true);
    try {
      const res = await authService.forgotPassword(data);
      setMessage(res.data.message || t('forgotPassword.success'));
    } catch (err: any) {
      setError(err.response?.data?.message || t('forgotPassword.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="py-5">
      <Card className="mx-auto shadow-sm" style={{ maxWidth: 520 }}>
        <Card.Body className="p-4">
          <h3 className="text-center mb-4">{t('forgotPassword.title')}</h3>
          {message && <Alert variant="success">{message}</Alert>}
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit(onSubmit)}>
            <Form.Group className="mb-3">
              <Form.Label>{t('fields.email')}</Form.Label>
              <Form.Control type="email" isInvalid={!!errors.email} {...register('email')} />
              <Form.Control.Feedback type="invalid">{errors.email?.message}</Form.Control.Feedback>
            </Form.Group>
            <Button type="submit" className="w-100" disabled={loading}>{loading ? t('forgotPassword.submitting') : t('forgotPassword.submit')}</Button>
          </Form>
          <div className="text-center mt-3"><Link to="/login">{t('verifyEmail.backToLogin')}</Link></div>
        </Card.Body>
      </Card>
    </Container>
  );
}
