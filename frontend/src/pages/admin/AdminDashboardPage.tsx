import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  ButtonGroup,
  Card,
  Col,
  Container,
  Form,
  ListGroup,
  Modal,
  Pagination,
  Row,
  Stack,
  Tab,
  Table,
  Tabs,
} from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import type {
  AdminReport,
  AdminRoom,
  AdminUser,
  BanDurationPreset,
  CustomBanDurationUnit,
  DebateFormat,
  ReportResolution,
  ReportStatus,
  ReportTargetType,
  RoomStatus,
  RoomType,
} from '@/types';
import { LoadingScreen } from '@components/common/LoadingScreen';
import { adminService } from '@services/adminService';
import { useAuthStore } from '@stores/authStore';
import { formatDate, formatRelativeTime } from '@utils/formatters';

const PAGE_SIZE = 10;

const customDurationUnits: CustomBanDurationUnit[] = ['minutes', 'hours', 'days'];
const roomStatuses: RoomStatus[] = ['waiting', 'ready', 'active', 'paused', 'completed', 'cancelled'];
const roomTypes: RoomType[] = ['rank', 'custom'];
const debateFormats: DebateFormat[] = ['1v1', '3v3'];
const reportStatuses: ReportStatus[] = ['open', 'reviewing', 'resolved', 'dismissed'];
const reportTargetTypes: ReportTargetType[] = ['user', 'message', 'room', 'debate', 'other'];
const reportResolutions: ReportResolution[] = ['none', 'warned', 'muted', 'banned', 'dismissed'];

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function providerBadgeVariant(provider: AdminUser['authProvider']) {
  return provider === 'google' ? 'info' : 'secondary';
}

function userStatus(entry: AdminUser, t: (key: string) => string) {
  if (entry.isBanned) {
    return {
      label: t('users.role.banned'),
      variant: 'danger' as const,
      detail: entry.bannedUntil ? `${t('users.until')} ${formatDate(entry.bannedUntil)} (${formatRelativeTime(entry.bannedUntil)})` : t('users.banActive'),
    };
  }

  return entry.isEmailVerified
    ? { label: t('users.active'), variant: 'success' as const, detail: t('users.verifiedAccount') }
    : { label: t('users.pending'), variant: 'warning' as const, detail: t('users.emailNotVerified') };
}

function roomStatusVariant(status: RoomStatus) {
  const variants: Record<RoomStatus, string> = {
    waiting: 'secondary',
    ready: 'info',
    active: 'success',
    paused: 'warning',
    completed: 'primary',
    cancelled: 'danger',
  };
  return variants[status];
}

function reportStatusVariant(status: ReportStatus) {
  const variants: Record<ReportStatus, string> = {
    open: 'danger',
    reviewing: 'warning',
    resolved: 'success',
    dismissed: 'secondary',
  };
  return variants[status];
}

function roomTargetPath(room: AdminRoom) {
  return room.status === 'waiting' || room.status === 'ready'
    ? `/rooms/${room._id}/lobby`
    : `/debate/${room._id}`;
}

function formatReportReason(reason: AdminReport['reason']) {
  return reason.replace(/_/g, ' ');
}

function MetricCard({
  icon,
  label,
  value,
  tone = 'primary',
}: {
  icon: string;
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <Card className="shadow-sm h-100">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start gap-3">
          <div>
            <div className="text-muted small mb-2">{label}</div>
            <h3 className="mb-0">{value}</h3>
          </div>
          <Badge bg={tone} className="fs-6">
            <i className={`bi ${icon}`} />
          </Badge>
        </div>
      </Card.Body>
    </Card>
  );
}

function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <Pagination className="justify-content-center mb-0">
      <Pagination.Prev disabled={page === 1} onClick={() => onChange(page - 1)} />
      <Pagination.Item active>{page}</Pagination.Item>
      <Pagination.Next disabled={page >= totalPages} onClick={() => onChange(page + 1)} />
    </Pagination>
  );
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const { t } = useTranslation('admin');
  const [activeTab, setActiveTab] = useState('overview');

  const durationOptions: Array<{ value: BanDurationPreset; label: string }> = [
    { value: '1h', label: t('ban.durationHours', { count: 1 }) },
    { value: '24h', label: t('ban.durationHours', { count: 24 }) },
    { value: '7d', label: t('ban.durationDays', { count: 7 }) },
    { value: '30d', label: t('ban.durationDays', { count: 30 }) },
    { value: 'custom', label: t('ban.customDuration') },
  ];
  const [feedback, setFeedback] = useState<{ type: 'success' | 'danger'; message: string } | null>(null);

  const [userPage, setUserPage] = useState(1);
  const [userSearchInput, setUserSearchInput] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userRole, setUserRole] = useState<'all' | AdminUser['role']>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'banned' | 'pending'>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [durationPreset, setDurationPreset] = useState<BanDurationPreset>('24h');
  const [customDurationValue, setCustomDurationValue] = useState('');
  const [customDurationUnit, setCustomDurationUnit] = useState<CustomBanDurationUnit>('hours');
  const [reason, setReason] = useState('');

  const [roomPage, setRoomPage] = useState(1);
  const [roomSearchInput, setRoomSearchInput] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [roomStatus, setRoomStatus] = useState<'all' | RoomStatus>('all');
  const [roomType, setRoomType] = useState<'all' | RoomType>('all');
  const [roomFormat, setRoomFormat] = useState<'all' | DebateFormat>('all');
  const [selectedRoom, setSelectedRoom] = useState<AdminRoom | null>(null);

  const [reportPage, setReportPage] = useState(1);
  const [reportSearchInput, setReportSearchInput] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [reportStatus, setReportStatus] = useState<'all' | ReportStatus>('all');
  const [reportTargetType, setReportTargetType] = useState<'all' | ReportTargetType>('all');
  const [selectedReport, setSelectedReport] = useState<AdminReport | null>(null);
  const [reportEditStatus, setReportEditStatus] = useState<ReportStatus>('reviewing');
  const [reportResolution, setReportResolution] = useState<ReportResolution>('none');
  const [reportAdminNote, setReportAdminNote] = useState('');
  const [reportBanPreset, setReportBanPreset] = useState<BanDurationPreset>('24h');
  const [reportCustomDurationValue, setReportCustomDurationValue] = useState('');
  const [reportCustomDurationUnit, setReportCustomDurationUnit] = useState<CustomBanDurationUnit>('hours');

  const invalidateAdminData = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-room-detail'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
  };

  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const response = await adminService.getOverview();
      return response.data.data;
    },
  });

  const userQueryParams = useMemo(
    () => ({
      page: userPage,
      limit: PAGE_SIZE,
      search: userSearch || undefined,
      role: userRole === 'all' ? undefined : userRole,
      status: userStatusFilter === 'all' ? undefined : userStatusFilter,
    }),
    [userPage, userRole, userSearch, userStatusFilter],
  );

  const usersQuery = useQuery({
    queryKey: ['admin-users', userQueryParams],
    queryFn: async () => {
      const response = await adminService.getUsers(userQueryParams);
      return response.data;
    },
    enabled: activeTab === 'users',
  });

  const roomQueryParams = useMemo(
    () => ({
      page: roomPage,
      limit: PAGE_SIZE,
      search: roomSearch || undefined,
      status: roomStatus === 'all' ? undefined : roomStatus,
      roomType: roomType === 'all' ? undefined : roomType,
      format: roomFormat === 'all' ? undefined : roomFormat,
    }),
    [roomFormat, roomPage, roomSearch, roomStatus, roomType],
  );

  const roomsQuery = useQuery({
    queryKey: ['admin-rooms', roomQueryParams],
    queryFn: async () => {
      const response = await adminService.getRooms(roomQueryParams);
      return response.data;
    },
    enabled: activeTab === 'rooms',
  });

  const roomDetailQuery = useQuery({
    queryKey: ['admin-room-detail', selectedRoom?._id],
    queryFn: async () => {
      const response = await adminService.getRoom(selectedRoom!._id);
      return response.data.data;
    },
    enabled: Boolean(selectedRoom),
  });

  const reportQueryParams = useMemo(
    () => ({
      page: reportPage,
      limit: PAGE_SIZE,
      search: reportSearch || undefined,
      status: reportStatus === 'all' ? undefined : reportStatus,
      targetType: reportTargetType === 'all' ? undefined : reportTargetType,
    }),
    [reportPage, reportSearch, reportStatus, reportTargetType],
  );

  const reportsQuery = useQuery({
    queryKey: ['admin-reports', reportQueryParams],
    queryFn: async () => {
      const response = await adminService.getReports(reportQueryParams);
      return response.data;
    },
    enabled: activeTab === 'reports',
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AdminUser['role'] }) => {
      const response = await adminService.updateUserRole(userId, { role });
      return response.data.data;
    },
    onSuccess: (updatedUser) => {
      setFeedback({ type: 'success', message: `Updated role for ${updatedUser.profile.displayName || updatedUser.username}.` });
      invalidateAdminData();
    },
    onError: (error: unknown) => {
      setFeedback({ type: 'danger', message: getErrorMessage(error, 'Failed to update user role.') });
    },
  });

  const banUserMutation = useMutation({
    mutationFn: async (user: AdminUser) => {
      const response = await adminService.banUser(user._id, {
        durationPreset,
        customDurationValue: durationPreset === 'custom' ? Number(customDurationValue) : undefined,
        customDurationUnit: durationPreset === 'custom' ? customDurationUnit : undefined,
        reason: reason.trim() || undefined,
      });
      return response.data.data;
    },
    onSuccess: (updatedUser) => {
      setFeedback({ type: 'success', message: `Banned ${updatedUser.profile.displayName || updatedUser.username}.` });
      setSelectedUser(null);
      setReason('');
      setCustomDurationValue('');
      setDurationPreset('24h');
      setCustomDurationUnit('hours');
      invalidateAdminData();
    },
    onError: (error: unknown) => {
      setFeedback({ type: 'danger', message: getErrorMessage(error, 'Failed to ban user.') });
    },
  });

  const unbanUserMutation = useMutation({
    mutationFn: async (user: AdminUser) => {
      const response = await adminService.unbanUser(user._id);
      return response.data.data;
    },
    onSuccess: (updatedUser) => {
      setFeedback({ type: 'success', message: `Unbanned ${updatedUser.profile.displayName || updatedUser.username}.` });
      invalidateAdminData();
    },
    onError: (error: unknown) => {
      setFeedback({ type: 'danger', message: getErrorMessage(error, 'Failed to unban user.') });
    },
  });

  const updateRoomStatusMutation = useMutation({
    mutationFn: async ({ room, status }: { room: AdminRoom; status: RoomStatus }) => {
      const response = await adminService.updateRoomStatus(room._id, status, 'Updated from admin dashboard');
      return response.data.data;
    },
    onSuccess: (room) => {
      setFeedback({ type: 'success', message: `Room status changed to ${room.status}.` });
      setSelectedRoom((current) => (current?._id === room._id ? room : current));
      invalidateAdminData();
    },
    onError: (error: unknown) => {
      setFeedback({ type: 'danger', message: getErrorMessage(error, 'Failed to update room status.') });
    },
  });

  const viewerChatMutation = useMutation({
    mutationFn: async (room: AdminRoom) => {
      const response = await adminService.setViewerChat(room._id, !room.viewerChatEnabled);
      return response.data.data;
    },
    onSuccess: (room) => {
      setSelectedRoom((current) => (current?._id === room._id ? room : current));
      setFeedback({ type: 'success', message: `Viewer chat ${room.viewerChatEnabled ? 'enabled' : 'disabled'}.` });
      invalidateAdminData();
    },
    onError: (error: unknown) => {
      setFeedback({ type: 'danger', message: getErrorMessage(error, 'Failed to update viewer chat.') });
    },
  });

  const kickParticipantMutation = useMutation({
    mutationFn: async ({ room, userId }: { room: AdminRoom; userId: string }) => {
      const response = await adminService.kickParticipant(room._id, userId, 'Removed from admin dashboard');
      return response.data.data;
    },
    onSuccess: (room) => {
      setSelectedRoom(room);
      setFeedback({ type: 'success', message: 'Participant removed from room.' });
      invalidateAdminData();
    },
    onError: (error: unknown) => {
      setFeedback({ type: 'danger', message: getErrorMessage(error, 'Failed to remove participant.') });
    },
  });

  const muteParticipantMutation = useMutation({
    mutationFn: async ({ room, userId, muted }: { room: AdminRoom; userId: string; muted: boolean }) => {
      const response = await adminService.muteParticipant(room._id, userId, muted, 'Updated from admin dashboard');
      return response.data.data;
    },
    onSuccess: (room) => {
      setSelectedRoom(room);
      setFeedback({ type: 'success', message: 'Participant moderation updated.' });
      invalidateAdminData();
    },
    onError: (error: unknown) => {
      setFeedback({ type: 'danger', message: getErrorMessage(error, 'Failed to update participant moderation.') });
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: async (report: AdminReport) => {
      const response = await adminService.updateReport(report._id, {
        status: reportEditStatus,
        resolution: reportResolution,
        adminNote: reportAdminNote.trim(),
        ban: reportResolution === 'banned'
          ? {
            durationPreset: reportBanPreset,
            customDurationValue: reportBanPreset === 'custom' ? Number(reportCustomDurationValue) : undefined,
            customDurationUnit: reportBanPreset === 'custom' ? reportCustomDurationUnit : undefined,
            reason: reportAdminNote.trim() || report.details || undefined,
          }
          : undefined,
      });
      return response.data.data.report;
    },
    onSuccess: (report) => {
      setFeedback({ type: 'success', message: `Report marked ${report.status}.` });
      setSelectedReport(null);
      setReportAdminNote('');
      setReportResolution('none');
      setReportEditStatus('reviewing');
      setReportBanPreset('24h');
      setReportCustomDurationValue('');
      invalidateAdminData();
    },
    onError: (error: unknown) => {
      setFeedback({ type: 'danger', message: getErrorMessage(error, 'Failed to update report.') });
    },
  });

  const handleUserSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUserPage(1);
    setUserSearch(userSearchInput.trim());
  };

  const handleRoomSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRoomPage(1);
    setRoomSearch(roomSearchInput.trim());
  };

  const handleReportSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReportPage(1);
    setReportSearch(reportSearchInput.trim());
  };

  const openReportModal = (report: AdminReport) => {
    setSelectedReport(report);
    setReportEditStatus(report.status === 'open' ? 'reviewing' : report.status);
    setReportResolution(report.resolution || 'none');
    setReportAdminNote(report.adminNote || '');
  };

  const overview = overviewQuery.data;
  const users = usersQuery.data?.data ?? [];
  const userPagination = usersQuery.data?.pagination;
  const rooms = roomsQuery.data?.data ?? [];
  const roomPagination = roomsQuery.data?.pagination;
  const reports = reportsQuery.data?.data ?? [];
  const reportPagination = reportsQuery.data?.pagination;
  const detailedRoom = roomDetailQuery.data?.room ?? selectedRoom;

  if (overviewQuery.isLoading && !overview) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Container className="py-4">
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
          <div>
            <h2 className="mb-1">
              <i className="bi bi-shield-lock me-2" />
              {t('dashboardTitle')}
            </h2>
            <p className="text-muted mb-0">{t('dashboardSubtitle')}</p>
          </div>
          <Badge bg={currentUser?.role === 'admin' ? 'danger' : 'secondary'} className="align-self-start align-self-lg-center">
            {currentUser?.role === 'admin' ? t('users.adminAccess') : t('users.restricted')}
          </Badge>
        </div>

        {feedback && (
          <Alert variant={feedback.type} dismissible onClose={() => setFeedback(null)}>
            {feedback.message}
          </Alert>
        )}

        {overviewQuery.isError && (
          <Alert variant="danger">{getErrorMessage(overviewQuery.error, t('errors.unableToLoadOverview'))}</Alert>
        )}

        <Tabs activeKey={activeTab} onSelect={(key) => setActiveTab(key || 'overview')} className="mb-4">
          <Tab eventKey="overview" title={<span><i className="bi bi-grid-1x2 me-1" />{t('overview.title')}</span>}>
            {overview && (
              <div className="d-flex flex-column gap-4">
                <Row className="g-3">
                  <Col md={3}><MetricCard icon="bi-people" label={t('users.title')} value={overview.users.total} /></Col>
                  <Col md={3}><MetricCard icon="bi-camera-video" label={t('rooms.title')} value={overview.rooms.total} tone="info" /></Col>
                  <Col md={3}><MetricCard icon="bi-flag" label={t('reports.openReports')} value={overview.reports.open + overview.reports.reviewing} tone="danger" /></Col>
                  <Col md={3}><MetricCard icon="bi-chat-left-text" label={t('reports.toxicMessages')} value={overview.moderation.toxicMessages} tone="warning" /></Col>
                </Row>

                <Row className="g-4">
                  <Col lg={4}>
                    <Card className="shadow-sm h-100">
                      <Card.Body>
                        <h4 className="mb-3">{t('users.active')}</h4>
                        <ListGroup variant="flush">
                          <ListGroup.Item className="d-flex justify-content-between bg-transparent text-light px-0">
                            <span>{t('users.role.admin')}</span><Badge bg="danger">{overview.users.admins}</Badge>
                          </ListGroup.Item>
                          <ListGroup.Item className="d-flex justify-content-between bg-transparent text-light px-0">
                            <span>{t('users.banned')}</span><Badge bg="warning">{overview.users.banned}</Badge>
                          </ListGroup.Item>
                          <ListGroup.Item className="d-flex justify-content-between bg-transparent text-light px-0">
                            <span>{t('users.pending')}</span><Badge bg="secondary">{overview.users.pendingVerification}</Badge>
                          </ListGroup.Item>
                          <ListGroup.Item className="d-flex justify-content-between bg-transparent text-light px-0">
                            <span>{t('users.verifiedAccount')}</span><Badge bg="success">{overview.users.newToday}</Badge>
                          </ListGroup.Item>
                        </ListGroup>
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col lg={4}>
                    <Card className="shadow-sm h-100">
                      <Card.Body>
                        <h4 className="mb-3">{t('rooms.title')}</h4>
                        <div className="d-flex flex-wrap gap-2">
                          {roomStatuses.map((status) => (
                            <Badge key={status} bg={roomStatusVariant(status)} className="text-uppercase">
                              {status}: {overview.rooms[status]}
                            </Badge>
                          ))}
                          <Badge bg="info">{t('rooms.allTypes')}: {overview.rooms.rank}</Badge>
                          <Badge bg="secondary">{t('rooms.allFormats')}: {overview.rooms.custom}</Badge>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col lg={4}>
                    <Card className="shadow-sm h-100">
                      <Card.Body>
                        <h4 className="mb-3">{t('reports.title')}</h4>
                        <div className="d-flex flex-wrap gap-2">
                          {reportStatuses.map((status) => (
                            <Badge key={status} bg={reportStatusVariant(status)} className="text-uppercase">
                              {status}: {overview.reports[status]}
                            </Badge>
                          ))}
                          <Badge bg="warning">{t('reports.toxicMessages')}: {overview.moderation.yellowCards}</Badge>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                <Row className="g-4">
                  <Col lg={6}>
                    <Card className="shadow-sm h-100">
                      <Card.Body>
                        <h4 className="mb-3">{t('rooms.title')}</h4>
                        <div className="table-responsive">
                          <Table hover>
                            <tbody>
                              {overview.recentRooms.map((room) => (
                                <tr key={room._id}>
                                  <td>
                                    <div className="fw-semibold">{room.title || room.motion || t('rooms.untitledRoom')}</div>
                                    <div className="text-muted small">{room.format} · {room.roomType}</div>
                                  </td>
                                  <td><Badge bg={roomStatusVariant(room.status)}>{room.status}</Badge></td>
                                  <td className="text-end">
                                    <Button size="sm" variant="outline-primary" onClick={() => navigate(roomTargetPath(room))}>
                                      <i className="bi bi-box-arrow-up-right" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col lg={6}>
                    <Card className="shadow-sm h-100">
                      <Card.Body>
                        <h4 className="mb-3">{t('reports.title')}</h4>
                        <div className="table-responsive">
                          <Table hover>
                            <tbody>
                              {overview.recentReports.map((report) => (
                                <tr key={report._id}>
                                  <td>
                                    <div className="fw-semibold">{formatReportReason(report.reason)}</div>
                                    <div className="text-muted small">
                                      {report.reportedUserName || report.roomTitle || report.targetType}
                                    </div>
                                  </td>
                                  <td><Badge bg={reportStatusVariant(report.status)}>{report.status}</Badge></td>
                                  <td className="text-end">
                                    <Button size="sm" variant="outline-primary" onClick={() => {
                                      setActiveTab('reports');
                                      openReportModal(report);
                                    }}>
                                      <i className="bi bi-eye" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </div>
            )}
          </Tab>

          <Tab eventKey="users" title={<span><i className="bi bi-people me-1" />{t('users.title')}</span>}>
            <Card className="shadow-sm">
              <Card.Body>
                <Form onSubmit={handleUserSearchSubmit} className="mb-3">
                  <Row className="g-2">
                    <Col lg={5}>
                      <Form.Control
                        type="search"
                        placeholder={t('users.searchPlaceholder')}
                        value={userSearchInput}
                        onChange={(event) => setUserSearchInput(event.target.value)}
                      />
                    </Col>
                    <Col sm={6} lg={2}>
                      <Form.Select value={userRole} onChange={(event) => {
                        setUserPage(1);
                        setUserRole(event.target.value as 'all' | AdminUser['role']);
                      }}>
                        <option value="all">{t('users.allRoles')}</option>
                        <option value="user">{t('users.role.user')}</option>
                        <option value="admin">{t('users.role.admin')}</option>
                      </Form.Select>
                    </Col>
                    <Col sm={6} lg={2}>
                      <Form.Select value={userStatusFilter} onChange={(event) => {
                        setUserPage(1);
                        setUserStatusFilter(event.target.value as 'all' | 'active' | 'banned' | 'pending');
                      }}>
                        <option value="all">{t('users.allStatus')}</option>
                        <option value="active">{t('users.active')}</option>
                        <option value="banned">{t('users.banned')}</option>
                        <option value="pending">{t('users.pending')}</option>
                      </Form.Select>
                    </Col>
                    <Col lg={3}>
                      <ButtonGroup className="w-100">
                        <Button type="submit" variant="primary"><i className="bi bi-search me-1" />{t('users.search')}</Button>
                        <Button variant="outline-light" onClick={() => {
                          setUserSearchInput('');
                          setUserSearch('');
                          setUserRole('all');
                          setUserStatusFilter('all');
                          setUserPage(1);
                        }}>
                          <i className="bi bi-x-lg" />
                        </Button>
                      </ButtonGroup>
                    </Col>
                  </Row>
                </Form>

                {usersQuery.isLoading ? (
                  <LoadingScreen />
                ) : usersQuery.isError ? (
                  <Alert variant="danger">{getErrorMessage(usersQuery.error, t('users.loadingError'))}</Alert>
                ) : users.length === 0 ? (
                  <Alert variant="info" className="mb-0">{t('users.noUsers')}</Alert>
                ) : (
                  <>
                    <div className="table-responsive">
                      <Table hover bordered>
                        <thead>
                          <tr>
                            <th>{t('users.columns.user')}</th>
                            <th>{t('users.columns.email')}</th>
                            <th>{t('users.columns.role')}</th>
                            <th>{t('users.columns.provider')}</th>
                            <th>{t('users.columns.status')}</th>
                            <th>{t('users.columns.ranking')}</th>
                            <th>{t('users.columns.joined')}</th>
                            <th>{t('users.columns.actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((entry) => {
                            const isCurrentUser = entry._id === currentUser?._id;
                            const isUpdatingRole = updateRoleMutation.isPending && updateRoleMutation.variables?.userId === entry._id;
                            const isUpdatingBan = (banUserMutation.isPending && banUserMutation.variables?._id === entry._id)
                              || (unbanUserMutation.isPending && unbanUserMutation.variables?._id === entry._id);
                            const status = userStatus(entry, t);

                            return (
                              <tr key={entry._id}>
                                <td>
                                  <div className="fw-semibold">{entry.profile.displayName || entry.username}</div>
                                  <div className="text-muted small">@{entry.username}</div>
                                </td>
                                <td>{entry.email}</td>
                                <td><Badge bg={entry.role === 'admin' ? 'danger' : 'secondary'}>{entry.role}</Badge></td>
                                <td><Badge bg={providerBadgeVariant(entry.authProvider)}>{entry.authProvider}</Badge></td>
                                <td>
                                  <div className="d-flex flex-column gap-1">
                                    <Badge bg={status.variant} text={status.variant === 'warning' ? 'dark' : undefined}>{status.label}</Badge>
                                    <div className="text-muted small">{status.detail}</div>
                                    {entry.isBanned && entry.banReason && <div className="small">{t('ban.reason')}: {entry.banReason}</div>}
                                  </div>
                                </td>
                                <td>
                                  <div>{entry.ranking?.elo ?? 1000} ELO</div>
                                  <div className="text-muted small">{entry.ranking?.tier ?? t('users.pending')}</div>
                                </td>
                                <td>{formatDate(entry.createdAt)}</td>
                                <td>
                                  <Stack gap={2}>
                                    <Form.Select
                                      size="sm"
                                      value={entry.role}
                                      disabled={isCurrentUser || isUpdatingRole || isUpdatingBan}
                                      onChange={(event) => {
                                        const nextRole = event.target.value as AdminUser['role'];
                                        if (nextRole === entry.role) return;
                                        setFeedback(null);
                                        updateRoleMutation.mutate({ userId: entry._id, role: nextRole });
                                      }}
                                    >
                                      <option value="user">{t('users.role.user')}</option>
                                      <option value="admin">{t('users.role.admin')}</option>
                                    </Form.Select>

                                    {entry.isBanned ? (
                                      <Button
                                        size="sm"
                                        variant="outline-success"
                                        disabled={isCurrentUser || isUpdatingBan}
                                        onClick={() => {
                                          setFeedback(null);
                                          unbanUserMutation.mutate(entry);
                                        }}
                                      >
                                        <i className="bi bi-unlock me-1" />{t('users.unban')}
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline-danger"
                                        disabled={isCurrentUser || isUpdatingBan}
                                        onClick={() => {
                                          setFeedback(null);
                                          setSelectedUser(entry);
                                        }}
                                      >
                                        <i className="bi bi-slash-circle me-1" />{t('users.ban')}
                                      </Button>
                                    )}
                                  </Stack>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                    <Pager page={userPage} totalPages={userPagination?.totalPages ?? 1} onChange={setUserPage} />
                  </>
                )}
              </Card.Body>
            </Card>
          </Tab>

          <Tab eventKey="rooms" title={<span><i className="bi bi-camera-video me-1" />{t('rooms.title')}</span>}>
            <Card className="shadow-sm">
              <Card.Body>
                <Form onSubmit={handleRoomSearchSubmit} className="mb-3">
                  <Row className="g-2">
                    <Col lg={4}>
                      <Form.Control
                        type="search"
                        placeholder={t('rooms.searchPlaceholder')}
                        value={roomSearchInput}
                        onChange={(event) => setRoomSearchInput(event.target.value)}
                      />
                    </Col>
                    <Col sm={4} lg={2}>
                      <Form.Select value={roomStatus} onChange={(event) => {
                        setRoomPage(1);
                        setRoomStatus(event.target.value as 'all' | RoomStatus);
                      }}>
                        <option value="all">{t('rooms.allStatus')}</option>
                        {roomStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </Form.Select>
                    </Col>
                    <Col sm={4} lg={2}>
                      <Form.Select value={roomType} onChange={(event) => {
                        setRoomPage(1);
                        setRoomType(event.target.value as 'all' | RoomType);
                      }}>
                        <option value="all">{t('rooms.allTypes')}</option>
                        {roomTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                      </Form.Select>
                    </Col>
                    <Col sm={4} lg={2}>
                      <Form.Select value={roomFormat} onChange={(event) => {
                        setRoomPage(1);
                        setRoomFormat(event.target.value as 'all' | DebateFormat);
                      }}>
                        <option value="all">{t('rooms.allFormats')}</option>
                        {debateFormats.map((format) => <option key={format} value={format}>{format}</option>)}
                      </Form.Select>
                    </Col>
                    <Col lg={2}>
                      <Button type="submit" variant="primary" className="w-100">
                        <i className="bi bi-search me-1" />{t('rooms.search')}
                      </Button>
                    </Col>
                  </Row>
                </Form>

                {roomsQuery.isLoading ? (
                  <LoadingScreen />
                ) : roomsQuery.isError ? (
                  <Alert variant="danger">{getErrorMessage(roomsQuery.error, t('rooms.loadingError'))}</Alert>
                ) : rooms.length === 0 ? (
                  <Alert variant="info" className="mb-0">{t('rooms.noRooms')}</Alert>
                ) : (
                  <>
                    <div className="table-responsive">
                      <Table hover bordered>
                        <thead>
                          <tr>
                            <th>{t('rooms.columns.room')}</th>
                            <th>{t('rooms.columns.status')}</th>
                            <th>{t('rooms.columns.type')}</th>
                            <th>{t('rooms.columns.people')}</th>
                            <th>{t('rooms.columns.hostJudge')}</th>
                            <th>{t('rooms.columns.created')}</th>
                            <th>{t('rooms.columns.actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rooms.map((room) => {
                            const roomBusy = updateRoomStatusMutation.isPending && updateRoomStatusMutation.variables?.room._id === room._id;
                            const chatBusy = viewerChatMutation.isPending && viewerChatMutation.variables?._id === room._id;

                            return (
                              <tr key={room._id}>
                                <td>
                                  <div className="fw-semibold">{room.title || room.motion || t('rooms.untitledRoom')}</div>
                                  <div className="text-muted small">{room.motion || t('rooms.noMotionSet')}</div>
                                </td>
                                <td>
                                  <Form.Select
                                    size="sm"
                                    value={room.status}
                                    disabled={roomBusy}
                                    onChange={(event) => updateRoomStatusMutation.mutate({
                                      room,
                                      status: event.target.value as RoomStatus,
                                    })}
                                  >
                                    {roomStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                                  </Form.Select>
                                </td>
                                <td>
                                  <Badge bg={roomStatusVariant(room.status)}>{room.status}</Badge>
                                  <div className="text-muted small mt-1">{room.roomType} · {room.format}</div>
                                </td>
                                <td>
                                  <div>{room.participantCount} {t('rooms.participants')}</div>
                                  <div className="text-muted small">{room.debaterCount} debaters · {room.mutedCount} {t('rooms.muted')}</div>
                                </td>
                                <td>
                                  <div>{room.hostName || room.hostType}</div>
                                  <div className="text-muted small">{room.judgeAssignedCount}/{room.judgeCount} judges · {room.judgeType}</div>
                                </td>
                                <td>{formatDate(room.createdAt)}</td>
                                <td>
                                  <ButtonGroup size="sm">
                                    <Button variant="outline-primary" onClick={() => setSelectedRoom(room)}>
                                      <i className="bi bi-sliders" />
                                    </Button>
                                    <Button
                                      variant={room.viewerChatEnabled ? 'outline-warning' : 'outline-success'}
                                      disabled={chatBusy}
                                      onClick={() => viewerChatMutation.mutate(room)}
                                    >
                                      <i className={`bi ${room.viewerChatEnabled ? 'bi-chat-left-dots' : 'bi-chat-left'}`} />
                                    </Button>
                                    <Button variant="outline-light" onClick={() => navigate(roomTargetPath(room))}>
                                      <i className="bi bi-box-arrow-up-right" />
                                    </Button>
                                  </ButtonGroup>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                    <Pager page={roomPage} totalPages={roomPagination?.totalPages ?? 1} onChange={setRoomPage} />
                  </>
                )}
              </Card.Body>
            </Card>
          </Tab>

          <Tab eventKey="reports" title={<span><i className="bi bi-flag me-1" />{t('reports.title')}</span>}>
            <Card className="shadow-sm">
              <Card.Body>
                <Form onSubmit={handleReportSearchSubmit} className="mb-3">
                  <Row className="g-2">
                    <Col lg={5}>
                      <Form.Control
                        type="search"
                        placeholder={t('reports.searchPlaceholder')}
                        value={reportSearchInput}
                        onChange={(event) => setReportSearchInput(event.target.value)}
                      />
                    </Col>
                    <Col sm={6} lg={2}>
                      <Form.Select value={reportStatus} onChange={(event) => {
                        setReportPage(1);
                        setReportStatus(event.target.value as 'all' | ReportStatus);
                      }}>
                        <option value="all">{t('reports.allStatus')}</option>
                        {reportStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </Form.Select>
                    </Col>
                    <Col sm={6} lg={2}>
                      <Form.Select value={reportTargetType} onChange={(event) => {
                        setReportPage(1);
                        setReportTargetType(event.target.value as 'all' | ReportTargetType);
                      }}>
                        <option value="all">{t('reports.allTargets')}</option>
                        {reportTargetTypes.map((targetType) => <option key={targetType} value={targetType}>{targetType}</option>)}
                      </Form.Select>
                    </Col>
                    <Col lg={3}>
                      <Button type="submit" variant="primary" className="w-100">
                        <i className="bi bi-search me-1" />{t('reports.search')}
                      </Button>
                    </Col>
                  </Row>
                </Form>

                {reportsQuery.isLoading ? (
                  <LoadingScreen />
                ) : reportsQuery.isError ? (
                  <Alert variant="danger">{getErrorMessage(reportsQuery.error, t('reports.loadingError'))}</Alert>
                ) : reports.length === 0 ? (
                  <Alert variant="info" className="mb-0">{t('reports.noReports')}</Alert>
                ) : (
                  <>
                    <div className="table-responsive">
                      <Table hover bordered>
                        <thead>
                          <tr>
                            <th>{t('reports.columns.report')}</th>
                            <th>{t('reports.columns.target')}</th>
                            <th>{t('reports.columns.status')}</th>
                            <th>{t('reports.columns.reporter')}</th>
                            <th>{t('reports.columns.created')}</th>
                            <th>{t('reports.columns.actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reports.map((report) => (
                            <tr key={report._id}>
                              <td>
                                <div className="fw-semibold text-capitalize">{formatReportReason(report.reason)}</div>
                                <div className="text-muted small">{report.details || report.messageSnippet || t('reports.noDetails')}</div>
                              </td>
                              <td>
                                <Badge bg="secondary">{report.targetType}</Badge>
                                <div className="small mt-1">{report.reportedUserName || report.roomTitle || report.messageSnippet || t('reports.target')}</div>
                              </td>
                              <td>
                                <Badge bg={reportStatusVariant(report.status)}>{report.status}</Badge>
                                <div className="text-muted small">{report.resolution}</div>
                              </td>
                              <td>{report.reporterName}</td>
                              <td>{formatDate(report.createdAt)}</td>
                              <td>
                                <Button size="sm" variant="outline-primary" onClick={() => openReportModal(report)}>
                                  <i className="bi bi-eye me-1" />{t('reports.review')}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                    <Pager page={reportPage} totalPages={reportPagination?.totalPages ?? 1} onChange={setReportPage} />
                  </>
                )}
              </Card.Body>
            </Card>
          </Tab>
        </Tabs>
      </Container>

      <Modal show={selectedUser !== null} onHide={() => setSelectedUser(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{t('ban.title')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <div className="mb-3 text-muted small">
              {t('ban.account')}: <strong>{selectedUser.profile.displayName || selectedUser.username}</strong>
            </div>
          )}

          <Form.Group className="mb-3">
            <Form.Label>{t('ban.duration')}</Form.Label>
            <Form.Select value={durationPreset} onChange={(event) => setDurationPreset(event.target.value as BanDurationPreset)}>
              {durationOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Form.Select>
          </Form.Group>

          {durationPreset === 'custom' && (
            <div className="d-flex gap-2 mb-3">
              <Form.Control
                type="number"
                min={1}
                max={365}
                value={customDurationValue}
                onChange={(event) => setCustomDurationValue(event.target.value)}
                placeholder={t(`ban.customPlaceholder${customDurationUnit.charAt(0).toUpperCase() + customDurationUnit.slice(1)}`)}
              />
              <Form.Select value={customDurationUnit} onChange={(event) => setCustomDurationUnit(event.target.value as CustomBanDurationUnit)}>
                {customDurationUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </Form.Select>
            </div>
          )}

          <Form.Group>
            <Form.Label>{t('ban.reason')}</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t('ban.reasonPlaceholder')}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setSelectedUser(null)}>{t('ban.cancel')}</Button>
          <Button
            variant="danger"
            disabled={banUserMutation.isPending || !selectedUser || (durationPreset === 'custom' && !customDurationValue.trim())}
            onClick={() => {
              if (!selectedUser) return;
              banUserMutation.mutate(selectedUser);
            }}
          >
            {banUserMutation.isPending ? t('ban.applying') : t('ban.confirmBan')}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal size="lg" show={selectedRoom !== null} onHide={() => setSelectedRoom(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{t('ban.roomModeration')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!detailedRoom ? (
            <LoadingScreen />
          ) : (
            <div className="d-flex flex-column gap-3">
              <div>
                <h4 className="mb-1">{detailedRoom.title || detailedRoom.motion || t('rooms.untitledRoom')}</h4>
                <div className="text-muted small">
                  {detailedRoom.roomType} · {detailedRoom.format} · {t('rooms.phase')} {detailedRoom.currentPhase}
                </div>
              </div>

              <Row className="g-2">
                <Col sm={4}><MetricCard icon="bi-people" label={t('rooms.participants')} value={detailedRoom.participantCount} /></Col>
                <Col sm={4}><MetricCard icon="bi-mic-mute" label={t('rooms.muted')} value={detailedRoom.mutedCount} tone="warning" /></Col>
                <Col sm={4}><MetricCard icon="bi-chat-left" label={t('rooms.viewerChat')} value={detailedRoom.viewerChatEnabled ? t('rooms.on') : t('rooms.off')} tone={detailedRoom.viewerChatEnabled ? 'success' : 'secondary'} /></Col>
              </Row>

              {roomDetailQuery.data?.toxicMessages.length ? (
                <Alert variant="warning" className="mb-0">
                  <div className="fw-semibold mb-2">{t('reports.toxicMessages')}</div>
                  {roomDetailQuery.data.toxicMessages.map((message) => (
                    <div key={message._id} className="small">
                      <strong>{message.senderName}:</strong> {message.content}
                    </div>
                  ))}
                </Alert>
              ) : null}

              <div className="table-responsive">
                <Table hover bordered className="mb-0">
                  <thead>
                    <tr>
                      <th>{t('ban.participant')}</th>
                      <th>{t('ban.role')}</th>
                      <th>{t('ban.team')}</th>
                      <th>{t('ban.slot')}</th>
                      <th>{t('ban.state')}</th>
                      <th>{t('ban.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailedRoom.participants.map((participant) => {
                      const participantBusy = (kickParticipantMutation.isPending && kickParticipantMutation.variables?.userId === participant.userId)
                        || (muteParticipantMutation.isPending && muteParticipantMutation.variables?.userId === participant.userId);

                      return (
                        <tr key={participant.userId}>
                          <td>
                            <div className="fw-semibold">{participant.username}</div>
                            <div className="text-muted small">{participant.userId}</div>
                          </td>
                          <td><Badge bg={participant.roomRole === 'host' ? 'danger' : 'secondary'}>{participant.roomRole}</Badge></td>
                          <td>{participant.team || '-'}</td>
                          <td>{participant.speakerSlot || '-'}</td>
                          <td>{participant.muted ? <Badge bg="warning">{t('ban.muted')}</Badge> : <Badge bg="success">{t('ban.clear')}</Badge>}</td>
                          <td>
                            <ButtonGroup size="sm">
                              <Button
                                variant={participant.muted ? 'outline-success' : 'outline-warning'}
                                disabled={participantBusy}
                                onClick={() => muteParticipantMutation.mutate({
                                  room: detailedRoom,
                                  userId: participant.userId,
                                  muted: !participant.muted,
                                })}
                              >
                                <i className={`bi ${participant.muted ? 'bi-mic' : 'bi-mic-mute'}`} />
                              </Button>
                              <Button
                                variant="outline-danger"
                                disabled={participantBusy}
                                onClick={() => kickParticipantMutation.mutate({ room: detailedRoom, userId: participant.userId })}
                              >
                                <i className="bi bi-person-x" />
                              </Button>
                            </ButtonGroup>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {detailedRoom && (
            <Button variant="outline-primary" onClick={() => navigate(roomTargetPath(detailedRoom))}>
              <i className="bi bi-box-arrow-up-right me-1" />{t('rooms.openRoom')}
            </Button>
          )}
          <Button variant="outline-secondary" onClick={() => setSelectedRoom(null)}>{t('ban.close')}</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={selectedReport !== null} onHide={() => setSelectedReport(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{t('reviewReport.title')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedReport && (
            <div className="d-flex flex-column gap-3">
              <Alert variant="info" className="mb-0">
                <div className="fw-semibold text-capitalize">{formatReportReason(selectedReport.reason)}</div>
                <div className="small">{selectedReport.details || selectedReport.messageSnippet || t('reports.noDetails')}</div>
                <div className="small mt-2">
                  {t('reports.reporter')}: {selectedReport.reporterName} · {t('reports.target')}: {selectedReport.reportedUserName || selectedReport.roomTitle || selectedReport.targetType}
                </div>
              </Alert>

              <Form.Group>
                <Form.Label>{t('reviewReport.status')}</Form.Label>
                <Form.Select value={reportEditStatus} onChange={(event) => setReportEditStatus(event.target.value as ReportStatus)}>
                  {reportStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </Form.Select>
              </Form.Group>

              <Form.Group>
                <Form.Label>{t('reviewReport.resolution')}</Form.Label>
                <Form.Select value={reportResolution} onChange={(event) => setReportResolution(event.target.value as ReportResolution)}>
                  {reportResolutions.map((resolution) => <option key={resolution} value={resolution}>{resolution}</option>)}
                </Form.Select>
              </Form.Group>

              {reportResolution === 'banned' && (
                <>
                  <Form.Group>
                    <Form.Label>{t('ban.duration')}</Form.Label>
                    <Form.Select value={reportBanPreset} onChange={(event) => setReportBanPreset(event.target.value as BanDurationPreset)}>
                      {durationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Form.Select>
                  </Form.Group>
                  {reportBanPreset === 'custom' && (
                    <div className="d-flex gap-2">
                      <Form.Control
                        type="number"
                        min={1}
                        max={365}
                        value={reportCustomDurationValue}
                        onChange={(event) => setReportCustomDurationValue(event.target.value)}
                        placeholder={t(`ban.customPlaceholder${reportCustomDurationUnit.charAt(0).toUpperCase() + reportCustomDurationUnit.slice(1)}`)}
                      />
                      <Form.Select value={reportCustomDurationUnit} onChange={(event) => setReportCustomDurationUnit(event.target.value as CustomBanDurationUnit)}>
                        {customDurationUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                      </Form.Select>
                    </div>
                  )}
                </>
              )}

              <Form.Group>
                <Form.Label>{t('reviewReport.adminNote')}</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={reportAdminNote}
                  onChange={(event) => setReportAdminNote(event.target.value)}
                  placeholder={t('reviewReport.adminNotePlaceholder')}
                />
              </Form.Group>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setSelectedReport(null)}>{t('reviewReport.cancel')}</Button>
          <Button
            variant="primary"
            disabled={
              updateReportMutation.isPending
              || !selectedReport
              || (reportResolution === 'banned' && reportBanPreset === 'custom' && !reportCustomDurationValue.trim())
            }
            onClick={() => {
              if (!selectedReport) return;
              updateReportMutation.mutate(selectedReport);
            }}
          >
            {updateReportMutation.isPending ? t('reviewReport.saving') : t('reviewReport.saveReview')}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
