import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Col, Container, Form, Image, Row, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { userService } from '@services/userService';
import { useAuthStore } from '@stores/authStore';
import type { User } from '@/types';

const fallbackAvatar = 'https://via.placeholder.com/160?text=User';

export default function ProfilePage() {
  const { userId } = useParams();
  const { user: currentUser, setUser } = useAuthStore();
  const { t } = useTranslation('profile');
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isOwner = !!currentUser && currentUser._id === userId;

  const profileSchema = z.object({
    displayName: z.string().min(1, t('validation.displayNameRequired')).max(50, t('validation.displayNameMax')),
    avatar: z.union([z.string().url(t('validation.avatarInvalid')), z.literal('')]),
    bio: z.string().max(500, t('validation.bioMax')),
    school: z.string().max(100, t('validation.schoolMax')),
    club: z.string().max(100, t('validation.clubMax')),
  });

  type ProfileForm = z.infer<typeof profileSchema>;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError('');
    userService.getProfile(userId)
      .then((res) => {
        const user = res.data.data;
        setProfile(user);
        reset({
          displayName: user.profile.displayName || user.username,
          avatar: user.profile.avatar || '',
          bio: user.profile.bio || '',
          school: user.profile.school || '',
          club: user.profile.club || '',
        });
      })
      .catch((err) => setError(err.response?.data?.message || t('messages.loadFailed')))
      .finally(() => setLoading(false));
  }, [reset, t, userId]);

  const onSubmit = async (data: ProfileForm) => {
    if (!userId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await userService.updateProfile(userId, data);
      setProfile(res.data.data);
      if (isOwner) setUser(res.data.data);
      setMessage(t('messages.updateSuccess'));
    } catch (err: any) {
      setError(err.response?.data?.message || t('messages.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Container className="py-5 text-center"><Spinner /></Container>;
  }

  if (!profile) {
    return <Container className="py-5"><Alert variant="danger">{error || t('messages.notFound')}</Alert></Container>;
  }

  return (
    <Container className="py-4">
      <Row className="g-4">
        <Col lg={4}>
          <Card className="shadow-sm">
            <Card.Body className="text-center">
              <Image
                src={profile.profile.avatar || fallbackAvatar}
                roundedCircle
                width={160}
                height={160}
                className="object-fit-cover mb-3"
                onError={(event) => {
                  if (event.currentTarget.src !== fallbackAvatar) {
                    event.currentTarget.src = fallbackAvatar;
                  }
                }}
              />
              <h3>{profile.profile.displayName || profile.username}</h3>
              <p className="text-muted mb-2">@{profile.username}</p>
              <Badge bg={profile.isEmailVerified ? 'success' : 'warning'}>{profile.isEmailVerified ? t('status.emailVerified') : t('status.emailUnverified')}</Badge>
              <hr />
              <div className="d-flex justify-content-between"><span>{t('stats.elo')}</span><strong>{profile.ranking.elo}</strong></div>
              <div className="d-flex justify-content-between"><span>{t('stats.tier')}</span><strong>{profile.ranking.tier}</strong></div>
              <div className="d-flex justify-content-between"><span>{t('stats.winLoss')}</span><strong>{profile.stats.wins} / {profile.stats.losses}</strong></div>
              <div className="d-flex justify-content-between"><span>{t('stats.totalDebates')}</span><strong>{profile.stats.totalDebates}</strong></div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={8}>
          <Card className="shadow-sm">
            <Card.Body>
              <h4 className="mb-3">{t('title')}</h4>
              {error && <Alert variant="danger">{error}</Alert>}
              {message && <Alert variant="success">{message}</Alert>}

              {isOwner ? (
                <Form onSubmit={handleSubmit(onSubmit)}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('fields.displayName')}</Form.Label>
                    <Form.Control isInvalid={!!errors.displayName} {...register('displayName')} />
                    <Form.Control.Feedback type="invalid">{errors.displayName?.message}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('fields.avatar')}</Form.Label>
                    <Form.Control isInvalid={!!errors.avatar} {...register('avatar')} />
                    <Form.Control.Feedback type="invalid">{errors.avatar?.message}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('fields.bio')}</Form.Label>
                    <Form.Control as="textarea" rows={4} isInvalid={!!errors.bio} {...register('bio')} />
                    <Form.Control.Feedback type="invalid">{errors.bio?.message}</Form.Control.Feedback>
                  </Form.Group>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>{t('fields.school')}</Form.Label>
                        <Form.Control isInvalid={!!errors.school} {...register('school')} />
                        <Form.Control.Feedback type="invalid">{errors.school?.message}</Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>{t('fields.club')}</Form.Label>
                        <Form.Control isInvalid={!!errors.club} {...register('club')} />
                        <Form.Control.Feedback type="invalid">{errors.club?.message}</Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                  </Row>
                  <Button type="submit" disabled={saving}>{saving ? t('actions.saving', { ns: 'common' }) : t('actions.save', { ns: 'common' })}</Button>
                </Form>
              ) : (
                <div>
                  <p><strong>{t('fields.bio')}:</strong> {profile.profile.bio || t('states.notUpdated', { ns: 'common' })}</p>
                  <p><strong>{t('fields.school')}:</strong> {profile.profile.school || t('states.notUpdated', { ns: 'common' })}</p>
                  <p><strong>{t('fields.club')}:</strong> {profile.profile.club || t('states.notUpdated', { ns: 'common' })}</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
