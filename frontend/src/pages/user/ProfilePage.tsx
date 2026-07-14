import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button as RBButton,
  Card,
  Col,
  Container,
  Form,
  ProgressBar,
  Row,
  Spinner,
} from 'react-bootstrap';

const Button = RBButton as any;

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { RankBadge } from '@components/ranking/RankBadge';
import { uploadAvatar, validateImageFile } from '@services/uploadService';
import { userService } from '@services/userService';
import { useAuthStore } from '@stores/authStore';
import type { User } from '@/types';

type MetricTone = 'cyan' | 'green' | 'pink' | 'purple' | 'yellow';

function getProfileInitial(profile: User) {
  const name = profile.profile.displayName || profile.username;
  return name.trim().charAt(0).toUpperCase() || 'U';
}

function getDisplayName(profile: User) {
  return profile.profile.displayName || profile.username;
}

function getCleanText(value?: string | null) {
  return value?.trim() || '';
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value || 0);
}

function formatShortDate(date?: string) {
  if (!date) return '';

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return '';

  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate);
}

function getWinRate(profile: User) {
  const decidedDebates = profile.stats.wins + profile.stats.losses;
  if (decidedDebates === 0) return 0;
  return Math.round((profile.stats.wins / decidedDebates) * 100);
}

function getAverageScore(profile: User) {
  const avgScore =
    profile.stats.avgScore ||
    (profile.stats.totalDebates > 0 ? profile.stats.totalScore / profile.stats.totalDebates : 0);
  return Number.isFinite(avgScore) ? avgScore : 0;
}

function getProfileCompletion(profile: User) {
  const fields = [
    getDisplayName(profile),
    profile.profile.avatar,
    profile.profile.bio,
    profile.profile.school,
    profile.profile.club,
  ];
  const completedFields = fields.filter((field) => getCleanText(field).length > 0).length;
  return Math.round((completedFields / fields.length) * 100);
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
      <span className="profile-avatar rounded-circle d-inline-flex align-items-center justify-content-center fw-bold">
        {getProfileInitial(profile)}
      </span>
    );
  }

  return (
    <img
      key={avatar}
      src={avatar}
      alt={getDisplayName(profile)}
      width={144}
      height={144}
      className="profile-avatar rounded-circle object-fit-cover"
      onError={() => setHasError(true)}
    />
  );
}

function MetricCard({
  icon,
  label,
  value,
  helper,
  tone = 'cyan',
}: {
  icon: string;
  label: string;
  value: string | number;
  helper?: string;
  tone?: MetricTone;
}) {
  return (
    <Card className={`profile-metric-card profile-metric-${tone} h-100 shadow-sm`}>
      <Card.Body>
        <div className="profile-metric-icon">
          <i className={`bi ${icon}`} />
        </div>
        <span className="profile-metric-label">{label}</span>
        <strong className="profile-metric-value">{value}</strong>
        {helper && <span className="profile-metric-helper">{helper}</span>}
      </Card.Body>
    </Card>
  );
}

function InfoRow({
  icon,
  label,
  value,
  emptyLabel,
}: {
  icon: string;
  label: string;
  value?: string | number | null;
  emptyLabel: string;
}) {
  const hasValue = value !== undefined && value !== null && String(value).trim().length > 0;

  return (
    <div className="profile-info-row">
      <span className="profile-info-icon">
        <i className={`bi ${icon}`} />
      </span>
      <div>
        <span>{label}</span>
        <strong className={hasValue ? undefined : 'text-muted'}>
          {hasValue ? value : emptyLabel}
        </strong>
      </div>
    </div>
  );
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message ===
      'string'
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
    displayName: z
      .string()
      .min(1, t('validation.displayNameRequired'))
      .max(50, t('validation.displayNameMax')),
    avatar: z.string().optional().default(''),
    bio: z.string().max(500, t('validation.bioMax')),
    school: z.string().max(100, t('validation.schoolMax')),
    club: z.string().max(100, t('validation.clubMax')),
  });

  type ProfileForm = z.infer<typeof profileSchema>;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError('');
    userService
      .getProfile(userId)
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

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
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
    return (
      <Container className="py-5 text-center">
        <Spinner />
      </Container>
    );
  }

  if (!profile) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error || t('messages.notFound')}</Alert>
      </Container>
    );
  }

  const displayName = getDisplayName(profile);
  const bio = getCleanText(profile.profile.bio);
  const school = getCleanText(profile.profile.school);
  const club = getCleanText(profile.profile.club);
  const winRate = getWinRate(profile);
  const avgScore = getAverageScore(profile);
  const decidedDebates = profile.stats.wins + profile.stats.losses;
  const otherResults = Math.max(profile.stats.totalDebates - decidedDebates, 0);
  const profileCompletion = getProfileCompletion(profile);
  const memberSince = formatShortDate(profile.createdAt);
  const emptyLabel = t('states.notUpdated', { ns: 'common' });

  return (
    <Container className="profile-page py-4">
      <div className="profile-page-header mb-4">
        <div>
          <Badge className="profile-kicker mb-2" bg="secondary">
            {isOwner ? t('hero.ownerKicker') : t('hero.publicKicker')}
          </Badge>
          <h2 className="mb-1">{t('hero.title', { name: displayName })}</h2>
          <p className="text-muted mb-0">
            {isOwner ? t('hero.ownerSubtitle') : t('hero.publicSubtitle', { name: displayName })}
          </p>
        </div>
        <div className="profile-header-actions">
          <Button
            onClick={() => navigate(`/profile/${profile._id}/history`)}
            variant="outline-primary"
          >
            <i className="bi bi-clock-history me-2" />
            {t('actions.viewHistory')}
          </Button>
          <Button onClick={() => navigate('/leaderboard')} variant="outline-light">
            <i className="bi bi-trophy me-2" />
            {t('actions.viewLeaderboard')}
          </Button>
        </div>
      </div>

      <Row className="g-4">
        <Col lg={4}>
          <Card className="profile-identity-card shadow-sm">
            <Card.Body>
              <div className="profile-avatar-shell">
                <ProfileAvatar profile={profile} preview={avatarPreview} />
              </div>
              <div className="text-center">
                <h3 className="mb-1">{displayName}</h3>
                <p className="profile-username mb-3">@{profile.username}</p>
              </div>

              <div className="d-flex justify-content-center gap-2 flex-wrap mb-4">
                <Badge bg={profile.isEmailVerified ? 'success' : 'warning'}>
                  <i
                    className={`bi ${profile.isEmailVerified ? 'bi-patch-check' : 'bi-exclamation-triangle'} me-1`}
                  />
                  {profile.isEmailVerified
                    ? t('status.emailVerified')
                    : t('status.emailUnverified')}
                </Badge>
                <RankBadge tier={profile.ranking.tier} />
              </div>

              <div className="profile-completion-box">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>{t('stats.profileCompletion')}</span>
                  <strong>{profileCompletion}%</strong>
                </div>
                <ProgressBar now={profileCompletion} aria-label={t('stats.profileCompletion')} />
              </div>

              <div className="profile-info-list">
                <InfoRow
                  icon="bi-calendar2-week"
                  label={t('stats.memberSince')}
                  value={memberSince}
                  emptyLabel={emptyLabel}
                />
                <InfoRow
                  icon="bi-mortarboard"
                  label={t('fields.school')}
                  value={school}
                  emptyLabel={emptyLabel}
                />
                <InfoRow
                  icon="bi-people"
                  label={t('fields.club')}
                  value={club}
                  emptyLabel={emptyLabel}
                />
                <InfoRow
                  icon="bi-person-badge"
                  label={t('stats.role')}
                  value={profile.role}
                  emptyLabel={emptyLabel}
                />
              </div>

              <div className="profile-sidebar-actions">
                {isOwner && (
                  <>
                    <Button
                      onClick={() => navigate('/matchmaking')}
                      variant="primary"
                      className="w-100"
                    >
                      <i className="bi bi-lightning-charge me-2" />
                      {t('actions.startRankQueue')}
                    </Button>
                    <Button
                      onClick={() => navigate('/change-password')}
                      variant="outline-light"
                      className="w-100"
                    >
                      <i className="bi bi-key me-2" />
                      {t('actions.changePassword')}
                    </Button>
                  </>
                )}
                <Button
                  onClick={() => navigate(`/profile/${profile._id}/history`)}
                  variant="outline-primary"
                  className="w-100"
                >
                  <i className="bi bi-clock-history me-2" />
                  {t('actions.viewHistory')}
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={8}>
          <Row className="g-3 mb-4">
            <Col sm={6} xl={3}>
              <MetricCard
                icon="bi-lightning-charge"
                label={t('stats.elo')}
                value={formatNumber(profile.ranking.elo)}
                helper={t('stats.seasonPointsValue', {
                  points: formatNumber(profile.ranking.seasonPoints),
                })}
              />
            </Col>
            <Col sm={6} xl={3}>
              <MetricCard
                icon="bi-trophy"
                label={t('stats.winRate')}
                value={`${winRate}%`}
                helper={t('stats.decidedDebates', { count: decidedDebates })}
                tone="green"
              />
            </Col>
            <Col sm={6} xl={3}>
              <MetricCard
                icon="bi-chat-square-text"
                label={t('stats.totalDebates')}
                value={formatNumber(profile.stats.totalDebates)}
                helper={t('stats.winLossValue', {
                  wins: profile.stats.wins,
                  losses: profile.stats.losses,
                })}
                tone="purple"
              />
            </Col>
            <Col sm={6} xl={3}>
              <MetricCard
                icon="bi-graph-up-arrow"
                label={t('stats.avgScore')}
                value={avgScore.toFixed(1)}
                helper={t('stats.totalScoreValue', {
                  score: formatNumber(profile.stats.totalScore),
                })}
                tone="yellow"
              />
            </Col>
          </Row>

          <Row className="g-4">
            <Col xl={7}>
              <Card className="profile-panel shadow-sm h-100">
                <Card.Body>
                  <div className="profile-section-heading">
                    <div>
                      <span>
                        {isOwner ? t('sections.editProfile') : t('sections.publicProfile')}
                      </span>
                      <h4>{isOwner ? t('form.title') : t('details.title')}</h4>
                    </div>
                  </div>

                  {error && <Alert variant="danger">{error}</Alert>}
                  {message && <Alert variant="success">{message}</Alert>}

                  {isOwner ? (
                    <Form onSubmit={handleSubmit(onSubmit)} className="profile-form">
                      <Form.Group className="mb-3">
                        <Form.Label>{t('fields.displayName')}</Form.Label>
                        <Form.Control
                          isInvalid={!!errors.displayName}
                          {...register('displayName')}
                        />
                        <Form.Control.Feedback type="invalid">
                          {errors.displayName?.message}
                        </Form.Control.Feedback>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>{t('fields.avatar')}</Form.Label>
                        <input type="hidden" {...register('avatar')} />
                        <div className="profile-upload-row">
                          <Button
                            type="button"
                            variant="outline-primary"
                            disabled={avatarUploading}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <i className="bi bi-upload me-2" />
                            {avatarUploading
                              ? t('actions.avatarUploading')
                              : t('actions.avatarUpload')}
                          </Button>
                          <span>{t('avatarUpload.hint')}</span>
                        </div>
                        <Form.Control
                          ref={fileInputRef}
                          className="d-none"
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          onChange={handleAvatarFileChange}
                        />
                        {avatarError && <div className="text-danger small mt-2">{avatarError}</div>}
                        <Form.Control.Feedback type="invalid">
                          {errors.avatar?.message}
                        </Form.Control.Feedback>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>{t('fields.bio')}</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={5}
                          placeholder={t('form.bioPlaceholder')}
                          isInvalid={!!errors.bio}
                          {...register('bio')}
                        />
                        <Form.Control.Feedback type="invalid">
                          {errors.bio?.message}
                        </Form.Control.Feedback>
                      </Form.Group>

                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>{t('fields.school')}</Form.Label>
                            <Form.Control
                              placeholder={t('form.schoolPlaceholder')}
                              isInvalid={!!errors.school}
                              {...register('school')}
                            />
                            <Form.Control.Feedback type="invalid">
                              {errors.school?.message}
                            </Form.Control.Feedback>
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>{t('fields.club')}</Form.Label>
                            <Form.Control
                              placeholder={t('form.clubPlaceholder')}
                              isInvalid={!!errors.club}
                              {...register('club')}
                            />
                            <Form.Control.Feedback type="invalid">
                              {errors.club?.message}
                            </Form.Control.Feedback>
                          </Form.Group>
                        </Col>
                      </Row>

                      <div className="d-flex flex-wrap gap-2">
                        <Button type="submit" disabled={saving}>
                          <i className="bi bi-check2-circle me-2" />
                          {saving
                            ? t('actions.saving', { ns: 'common' })
                            : t('actions.save', { ns: 'common' })}
                        </Button>
                        <Button
                          type="button"
                          variant="outline-light"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={avatarUploading}
                        >
                          <i className="bi bi-image me-2" />
                          {t('actions.updateAvatar')}
                        </Button>
                      </div>
                    </Form>
                  ) : (
                    <div className="profile-detail-stack">
                      <div className="profile-bio-box">
                        <span>{t('fields.bio')}</span>
                        <p className={bio ? undefined : 'text-muted'}>{bio || emptyLabel}</p>
                      </div>
                      <InfoRow
                        icon="bi-mortarboard"
                        label={t('fields.school')}
                        value={school}
                        emptyLabel={emptyLabel}
                      />
                      <InfoRow
                        icon="bi-people"
                        label={t('fields.club')}
                        value={club}
                        emptyLabel={emptyLabel}
                      />
                      <InfoRow
                        icon="bi-person"
                        label={t('fields.displayName')}
                        value={displayName}
                        emptyLabel={emptyLabel}
                      />
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>

            <Col xl={5}>
              <div className="profile-side-stack">
                <Card className="profile-panel shadow-sm">
                  <Card.Body>
                    <div className="profile-section-heading profile-section-heading-compact">
                      <div>
                        <span>{t('sections.activity')}</span>
                        <h4>{t('activity.title')}</h4>
                      </div>
                    </div>

                    <div className="profile-winrate-box">
                      <div className="d-flex justify-content-between align-items-end mb-2">
                        <div>
                          <span>{t('stats.winRate')}</span>
                          <p className="mb-0">{t('activity.winRateHint')}</p>
                        </div>
                        <strong>{winRate}%</strong>
                      </div>
                      <ProgressBar now={winRate} aria-label={t('stats.winRate')} />
                    </div>

                    <div className="profile-result-grid">
                      <div>
                        <span>{t('stats.wins')}</span>
                        <strong className="text-neon-green">{profile.stats.wins}</strong>
                      </div>
                      <div>
                        <span>{t('stats.losses')}</span>
                        <strong className="text-neon-pink">{profile.stats.losses}</strong>
                      </div>
                      <div>
                        <span>{t('stats.otherResults')}</span>
                        <strong>{otherResults}</strong>
                      </div>
                    </div>
                  </Card.Body>
                </Card>

                {isOwner && (
                  <Card className="profile-panel shadow-sm">
                    <Card.Body>
                      <div className="profile-section-heading profile-section-heading-compact">
                        <div>
                          <span>{t('sections.account')}</span>
                          <h4>{t('account.title')}</h4>
                        </div>
                      </div>

                      <div className="profile-info-list profile-info-list-tight">
                        <InfoRow
                          icon="bi-shield-check"
                          label={t('account.emailStatus')}
                          value={
                            profile.isEmailVerified
                              ? t('status.emailVerified')
                              : t('status.emailUnverified')
                          }
                          emptyLabel={emptyLabel}
                        />
                        <InfoRow
                          icon="bi-box-arrow-in-right"
                          label={t('account.provider')}
                          value={profile.authProvider}
                          emptyLabel={emptyLabel}
                        />
                        <InfoRow
                          icon="bi-calendar-check"
                          label={t('stats.memberSince')}
                          value={memberSince}
                          emptyLabel={emptyLabel}
                        />
                      </div>
                    </Card.Body>
                  </Card>
                )}
              </div>
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
}
