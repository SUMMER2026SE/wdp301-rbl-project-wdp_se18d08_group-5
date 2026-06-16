import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { RankBadge } from '@components/ranking/RankBadge';
import { uploadAvatar, validateImageFile } from '@services/uploadService';
import { userService } from '@services/userService';
import { useAuthStore } from '@stores/authStore';
import type { User } from '@/types';

function getProfileInitial(profile: User) {
  const name = profile.profile.displayName || profile.username;
  return name.trim().charAt(0).toUpperCase() || 'U';
}

function ProfileAvatar({ profile, preview }: { profile: User; preview: string }) {
  const [hasError, setHasError] = useState(false);
  const avatar = preview || profile.profile.avatar;
  const shouldUseFallback = !avatar || hasError;

  useEffect(() => {
    setHasError(false);
  }, [avatar]);

  if (shouldUseFallback) {
    return (
      <span
        className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold mb-3"
        style={{
          width: 160,
          height: 160,
          fontSize: '3.5rem',
          color: '#0a0a0f',
          background: 'var(--gradient-neon)',
          border: '1px solid rgba(0, 245, 255, 0.45)',
          boxShadow: '0 0 24px rgba(0, 245, 255, 0.18)',
        }}
      >
        {getProfileInitial(profile)}
      </span>
    );
  }

  return (
    <img
      key={avatar}
      src={avatar}
      alt={profile.profile.displayName || profile.username}
      width={160}
      height={160}
      className="rounded-circle object-fit-cover mb-3"
      onError={() => setHasError(true)}
    />
  );
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object'
    && error !== null
    && 'response' in error
    && typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message;
  }

  return fallback;
}

export default function ProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user: currentUser, setUser } = useAuthStore();
  const { t } = useTranslation('profile');
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const isOwner = !!currentUser && currentUser._id === userId;

  const profileSchema = z.object({
    displayName: z.string().min(1, t('validation.displayNameRequired')).max(50, t('validation.displayNameMax')),
    avatar: z.string().optional().default(''),
    bio: z.string().max(500, t('validation.bioMax')),
    school: z.string().max(100, t('validation.schoolMax')),
    club: z.string().max(100, t('validation.clubMax')),
  });

  type ProfileForm = z.infer<typeof profileSchema>;

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });

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
      .catch((err: unknown) => setError(getRequestErrorMessage(err, t('messages.loadFailed'))))
      .finally(() => setLoading(false));
  }, [reset, t, userId]);

  const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !profile) return;

    const validation = validateImageFile(file, 5);
    if (!validation.isValid) {
      setAvatarError(t('validation.avatarFileInvalid'));
      return;
    }

    setAvatarUploading(true);
    setAvatarError('');
    setError('');
    setMessage('');

    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);

    try {
      const result = await uploadAvatar(file);
      const avatarUrl = result.avatar || result.url || '';
      if (!avatarUrl) {
        throw new Error(t('messages.avatarUploadNoUrl'));
      }

      const updatedUser = {
        ...profile,
        profile: {
          ...profile.profile,
          avatar: avatarUrl,
        },
      };

      setProfile(updatedUser);
      setValue('avatar', avatarUrl, { shouldDirty: true });
      if (isOwner) setUser(updatedUser);
      setAvatarPreview('');
      setMessage(t('messages.avatarUploadSuccess'));
    } catch (err: unknown) {
      setAvatarPreview('');
      setAvatarError(getRequestErrorMessage(err, t('messages.avatarUploadFailed')));
    } finally {
      URL.revokeObjectURL(objectUrl);
      setAvatarUploading(false);
    }
  };

  const onSubmit = async (data: ProfileForm) => {
    if (!userId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await userService.updateProfile(userId, data);
      const updatedUser = res.data.data;
      setProfile(updatedUser);
      reset({
        displayName: updatedUser.profile.displayName || updatedUser.username,
        avatar: updatedUser.profile.avatar || '',
        bio: updatedUser.profile.bio || '',
        school: updatedUser.profile.school || '',
        club: updatedUser.profile.club || '',
      });
      if (isOwner) setUser(updatedUser);
      setMessage(t('messages.updateSuccess'));
    } catch (err: unknown) {
      setError(getRequestErrorMessage(err, t('messages.updateFailed')));
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
              <ProfileAvatar profile={profile} preview={avatarPreview} />
              <h3>{profile.profile.displayName || profile.username}</h3>
              <p className="landing-subtitle mb-2">@{profile.username}</p>
              <div className="d-flex justify-content-center gap-2 flex-wrap mb-2">
                <Badge bg={profile.isEmailVerified ? 'success' : 'warning'}>{profile.isEmailVerified ? t('status.emailVerified') : t('status.emailUnverified')}</Badge>
                <RankBadge tier={profile.ranking.tier} />
              </div>
              <hr />
              <div className="d-flex justify-content-between"><span>{t('stats.elo')}</span><strong>{profile.ranking.elo}</strong></div>
              <div className="d-flex justify-content-between"><span>{t('stats.tier')}</span><strong>{profile.ranking.tier}</strong></div>
              <div className="d-flex justify-content-between"><span>{t('stats.winLoss')}</span><strong>{profile.stats.wins} / {profile.stats.losses}</strong></div>
              <div className="d-flex justify-content-between"><span>{t('stats.totalDebates')}</span><strong>{profile.stats.totalDebates}</strong></div>
              <Button
                onClick={() => navigate(`/profile/${profile._id}/history`)}
                variant="outline-primary"
                className="mt-3 w-100"
              >
                {t('actions.viewHistory')}
              </Button>
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
                    <input type="hidden" {...register('avatar')} />
                    <div className="d-flex flex-column flex-sm-row align-items-sm-center gap-2">
                      <Button
                        type="button"
                        variant="outline-primary"
                        disabled={avatarUploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <i className="bi bi-upload me-1" />
                        {avatarUploading ? t('actions.avatarUploading') : t('actions.avatarUpload')}
                      </Button>
                      <span className="text-muted small">{t('avatarUpload.hint')}</span>
                    </div>
                    <Form.Control
                      ref={fileInputRef}
                      className="d-none"
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleAvatarFileChange}
                    />
                    {avatarError && <div className="text-danger small mt-2">{avatarError}</div>}
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
