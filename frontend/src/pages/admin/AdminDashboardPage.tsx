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

const durationOptions: Array<{ value: BanDurationPreset; label: string }> = [
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'custom', label: 'Custom' },
];
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

function userStatus(entry: AdminUser) {
  if (entry.isBanned) {
    return {
      label: 'Banned',
      variant: 'danger' as const,
      detail: entry.bannedUntil ? `Until ${formatDate(entry.bannedUntil)} (${formatRelativeTime(entry.bannedUntil)})` : 'Ban active',
    };
  }

  return entry.isEmailVerified
    ? { label: 'Active', variant: 'success' as const, detail: 'Verified account' }
    : { label: 'Pending', variant: 'warning' as const, detail: 'Email not verified' };
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
  const [activeTab, setActiveTab] = useState('overview');
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
              Admin Dashboard
            </h2>
            <p className="text-muted mb-0">Accounts, rooms, reports, and platform moderation.</p>
          </div>
          <Badge bg={currentUser?.role === 'admin' ? 'danger' : 'secondary'} className="align-self-start align-self-lg-center">
            {currentUser?.role === 'admin' ? 'Admin access' : 'Restricted'}
          </Badge>
        </div>

        {feedback && (
          <Alert variant={feedback.type} dismissible onClose={() => setFeedback(null)}>
            {feedback.message}
          </Alert>
        )}

        {overviewQuery.isError && (
          <Alert variant="danger">{getErrorMessage(overviewQuery.error, 'Unable to load admin overview.')}</Alert>
        )}

        <Tabs activeKey={activeTab} onSelect={(key) => setActiveTab(key || 'overview')} className="mb-4">
          <Tab eventKey="overview" title={<span><i className="bi bi-grid-1x2 me-1" />Overview</span>}>
            {overview && (
              <div className="d-flex flex-column gap-4">
                <Row className="g-3">
                  <Col md={3}><MetricCard icon="bi-people" label="Users" value={overview.users.total} /></Col>
                  <Col md={3}><MetricCard icon="bi-camera-video" label="Rooms" value={overview.rooms.total} tone="info" /></Col>
                  <Col md={3}><MetricCard icon="bi-flag" label="Open reports" value={overview.reports.open + overview.reports.reviewing} tone="danger" /></Col>
                  <Col md={3}><MetricCard icon="bi-chat-left-text" label="Toxic messages" value={overview.moderation.toxicMessages} tone="warning" /></Col>
                </Row>

                <Row className="g-4">
                  <Col lg={4}>
                    <Card className="shadow-sm h-100">
                      <Card.Body>
                        <h4 className="mb-3">User Health</h4>
                        <ListGroup variant="flush">
                          <ListGroup.Item className="d-flex justify-content-between bg-transparent text-light px-0">
                            <span>Admins</span><Badge bg="danger">{overview.users.admins}</Badge>
                          </ListGroup.Item>
                          <ListGroup.Item className="d-flex justify-content-between bg-transparent text-light px-0">
                            <span>Banned</span><Badge bg="warning">{overview.users.banned}</Badge>
                          </ListGroup.Item>
                          <ListGroup.Item className="d-flex justify-content-between bg-transparent text-light px-0">
                            <span>Pending verification</span><Badge bg="secondary">{overview.users.pendingVerification}</Badge>
                          </ListGroup.Item>
                          <ListGroup.Item className="d-flex justify-content-between bg-transparent text-light px-0">
                            <span>New today</span><Badge bg="success">{overview.users.newToday}</Badge>
                          </ListGroup.Item>
                        </ListGroup>
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col lg={4}>
                    <Card className="shadow-sm h-100">
                      <Card.Body>
                        <h4 className="mb-3">Room Flow</h4>
                        <div className="d-flex flex-wrap gap-2">
                          {roomStatuses.map((status) => (
                            <Badge key={status} bg={roomStatusVariant(status)} className="text-uppercase">
                              {status}: {overview.rooms[status]}
                            </Badge>
                          ))}
                          <Badge bg="info">rank: {overview.rooms.rank}</Badge>
                          <Badge bg="secondary">custom: {overview.rooms.custom}</Badge>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col lg={4}>
                    <Card className="shadow-sm h-100">
                      <Card.Body>
                        <h4 className="mb-3">Report Queue</h4>
                        <div className="d-flex flex-wrap gap-2">
                          {reportStatuses.map((status) => (
                            <Badge key={status} bg={reportStatusVariant(status)} className="text-uppercase">
                              {status}: {overview.reports[status]}
                            </Badge>
                          ))}
                          <Badge bg="warning">yellow cards: {overview.moderation.yellowCards}</Badge>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                <Row className="g-4">
                  <Col lg={6}>
                    <Card className="shadow-sm h-100">
                      <Card.Body>
                        <h4 className="mb-3">Recent Rooms</h4>
                        <div className="table-responsive">
                          <Table hover>
                            <tbody>
                              {overview.recentRooms.map((room) => (
                                <tr key={room._id}>
                                  <td>
                                    <div className="fw-semibold">{room.title || room.motion || 'Untitled room'}</div>
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
                        <h4 className="mb-3">Recent Reports</h4>
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

          <Tab eventKey="users" title={<span><i className="bi bi-people me-1" />Users</span>}>
            <Card className="shadow-sm">
              <Card.Body>
                <Form onSubmit={handleUserSearchSubmit} className="mb-3">
                  <Row className="g-2">
                    <Col lg={5}>
                      <Form.Control
                        type="search"
                        placeholder="Search username, email, display name"
                        value={userSearchInput}
                        onChange={(event) => setUserSearchInput(event.target.value)}
                      />
                    </Col>
                    <Col sm={6} lg={2}>
                      <Form.Select value={userRole} onChange={(event) => {
                        setUserPage(1);
                        setUserRole(event.target.value as 'all' | AdminUser['role']);
                      }}>
                        <option value="all">All roles</option>
                        <option value="user">Users</option>
                        <option value="admin">Admins</option>
                      </Form.Select>
                    </Col>
                    <Col sm={6} lg={2}>
                      <Form.Select value={userStatusFilter} onChange={(event) => {
                        setUserPage(1);
                        setUserStatusFilter(event.target.value as 'all' | 'active' | 'banned' | 'pending');
                      }}>
                        <option value="all">All status</option>
                        <option value="active">Active</option>
                        <option value="banned">Banned</option>
                        <option value="pending">Pending</option>
                      </Form.Select>
                    </Col>
                    <Col lg={3}>
                      <ButtonGroup className="w-100">
                        <Button type="submit" variant="primary"><i className="bi bi-search me-1" />Search</Button>
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
                  <Alert variant="danger">{getErrorMessage(usersQuery.error, 'Unable to load users.')}</Alert>
                ) : users.length === 0 ? (
                  <Alert variant="info" className="mb-0">No users found.</Alert>
                ) : (
                  <>
                    <div className="table-responsive">
                      <Table hover bordered>
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Provider</th>
                            <th>Status</th>
                            <th>Ranking</th>
                            <th>Joined</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((entry) => {
                            const isCurrentUser = entry._id === currentUser?._id;
                            const isUpdatingRole = updateRoleMutation.isPending && updateRoleMutation.variables?.userId === entry._id;
                            const isUpdatingBan = (banUserMutation.isPending && banUserMutation.variables?._id === entry._id)
                              || (unbanUserMutation.isPending && unbanUserMutation.variables?._id === entry._id);
                            const status = userStatus(entry);

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
                                    {entry.isBanned && entry.banReason && <div className="small">Reason: {entry.banReason}</div>}
                                  </div>
                                </td>
                                <td>
                                  <div>{entry.ranking?.elo ?? 1000} ELO</div>
                                  <div className="text-muted small">{entry.ranking?.tier ?? 'Novice'}</div>
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
                                      <option value="user">user</option>
                                      <option value="admin">admin</option>
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
                                        <i className="bi bi-unlock me-1" />Unban
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
                                        <i className="bi bi-slash-circle me-1" />Ban
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

          <Tab eventKey="rooms" title={<span><i className="bi bi-camera-video me-1" />Rooms</span>}>
            <Card className="shadow-sm">
              <Card.Body>
                <Form onSubmit={handleRoomSearchSubmit} className="mb-3">
                  <Row className="g-2">
                    <Col lg={4}>
                      <Form.Control
                        type="search"
                        placeholder="Search title, motion, participant"
                        value={roomSearchInput}
                        onChange={(event) => setRoomSearchInput(event.target.value)}
                      />
                    </Col>
                    <Col sm={4} lg={2}>
                      <Form.Select value={roomStatus} onChange={(event) => {
                        setRoomPage(1);
                        setRoomStatus(event.target.value as 'all' | RoomStatus);
                      }}>
                        <option value="all">All status</option>
                        {roomStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </Form.Select>
                    </Col>
                    <Col sm={4} lg={2}>
                      <Form.Select value={roomType} onChange={(event) => {
                        setRoomPage(1);
                        setRoomType(event.target.value as 'all' | RoomType);
                      }}>
                        <option value="all">All types</option>
                        {roomTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                      </Form.Select>
                    </Col>
                    <Col sm={4} lg={2}>
                      <Form.Select value={roomFormat} onChange={(event) => {
                        setRoomPage(1);
                        setRoomFormat(event.target.value as 'all' | DebateFormat);
                      }}>
                        <option value="all">All formats</option>
                        {debateFormats.map((format) => <option key={format} value={format}>{format}</option>)}
                      </Form.Select>
                    </Col>
                    <Col lg={2}>
                      <Button type="submit" variant="primary" className="w-100">
                        <i className="bi bi-search me-1" />Search
                      </Button>
                    </Col>
                  </Row>
                </Form>

                {roomsQuery.isLoading ? (
                  <LoadingScreen />
                ) : roomsQuery.isError ? (
                  <Alert variant="danger">{getErrorMessage(roomsQuery.error, 'Unable to load rooms.')}</Alert>
                ) : rooms.length === 0 ? (
                  <Alert variant="info" className="mb-0">No rooms found.</Alert>
                ) : (
                  <>
                    <div className="table-responsive">
                      <Table hover bordered>
                        <thead>
                          <tr>
                            <th>Room</th>
                            <th>Status</th>
                            <th>Type</th>
                            <th>People</th>
                            <th>Host / Judge</th>
                            <th>Created</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rooms.map((room) => {
                            const roomBusy = updateRoomStatusMutation.isPending && updateRoomStatusMutation.variables?.room._id === room._id;
                            const chatBusy = viewerChatMutation.isPending && viewerChatMutation.variables?._id === room._id;

                            return (
                              <tr key={room._id}>
                                <td>
                                  <div className="fw-semibold">{room.title || room.motion || 'Untitled room'}</div>
                                  <div className="text-muted small">{room.motion || 'No motion set'}</div>
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
                                  <div>{room.participantCount} participants</div>
                                  <div className="text-muted small">{room.debaterCount} debaters · {room.mutedCount} muted</div>
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

          <Tab eventKey="reports" title={<span><i className="bi bi-flag me-1" />Reports</span>}>
            <Card className="shadow-sm">
              <Card.Body>
                <Form onSubmit={handleReportSearchSubmit} className="mb-3">
                  <Row className="g-2">
                    <Col lg={5}>
                      <Form.Control
                        type="search"
                        placeholder="Search reports"
                        value={reportSearchInput}
                        onChange={(event) => setReportSearchInput(event.target.value)}
                      />
                    </Col>
                    <Col sm={6} lg={2}>
                      <Form.Select value={reportStatus} onChange={(event) => {
                        setReportPage(1);
                        setReportStatus(event.target.value as 'all' | ReportStatus);
                      }}>
                        <option value="all">All status</option>
                        {reportStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </Form.Select>
                    </Col>
                    <Col sm={6} lg={2}>
                      <Form.Select value={reportTargetType} onChange={(event) => {
                        setReportPage(1);
                        setReportTargetType(event.target.value as 'all' | ReportTargetType);
                      }}>
                        <option value="all">All targets</option>
                        {reportTargetTypes.map((targetType) => <option key={targetType} value={targetType}>{targetType}</option>)}
                      </Form.Select>
                    </Col>
                    <Col lg={3}>
                      <Button type="submit" variant="primary" className="w-100">
                        <i className="bi bi-search me-1" />Search
                      </Button>
                    </Col>
                  </Row>
                </Form>

                {reportsQuery.isLoading ? (
                  <LoadingScreen />
                ) : reportsQuery.isError ? (
                  <Alert variant="danger">{getErrorMessage(reportsQuery.error, 'Unable to load reports.')}</Alert>
                ) : reports.length === 0 ? (
                  <Alert variant="info" className="mb-0">No reports found.</Alert>
                ) : (
                  <>
                    <div className="table-responsive">
                      <Table hover bordered>
                        <thead>
                          <tr>
                            <th>Report</th>
                            <th>Target</th>
                            <th>Status</th>
                            <th>Reporter</th>
                            <th>Created</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reports.map((report) => (
                            <tr key={report._id}>
                              <td>
                                <div className="fw-semibold text-capitalize">{formatReportReason(report.reason)}</div>
                                <div className="text-muted small">{report.details || report.messageSnippet || 'No details'}</div>
                              </td>
                              <td>
                                <Badge bg="secondary">{report.targetType}</Badge>
                                <div className="small mt-1">{report.reportedUserName || report.roomTitle || report.messageSnippet || 'Unlinked'}</div>
                              </td>
                              <td>
                                <Badge bg={reportStatusVariant(report.status)}>{report.status}</Badge>
                                <div className="text-muted small">{report.resolution}</div>
                              </td>
                              <td>{report.reporterName}</td>
                              <td>{formatDate(report.createdAt)}</td>
                              <td>
                                <Button size="sm" variant="outline-primary" onClick={() => openReportModal(report)}>
                                  <i className="bi bi-eye me-1" />Review
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
          <Modal.Title>Ban User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <div className="mb-3 text-muted small">
              Account: <strong>{selectedUser.profile.displayName || selectedUser.username}</strong>
            </div>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Duration</Form.Label>
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
                placeholder="Value"
              />
              <Form.Select value={customDurationUnit} onChange={(event) => setCustomDurationUnit(event.target.value as CustomBanDurationUnit)}>
                {customDurationUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </Form.Select>
            </div>
          )}

          <Form.Group>
            <Form.Label>Reason</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Moderation note"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setSelectedUser(null)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={banUserMutation.isPending || !selectedUser || (durationPreset === 'custom' && !customDurationValue.trim())}
            onClick={() => {
              if (!selectedUser) return;
              banUserMutation.mutate(selectedUser);
            }}
          >
            {banUserMutation.isPending ? 'Applying...' : 'Confirm ban'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal size="lg" show={selectedRoom !== null} onHide={() => setSelectedRoom(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Room Moderation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!detailedRoom ? (
            <LoadingScreen />
          ) : (
            <div className="d-flex flex-column gap-3">
              <div>
                <h4 className="mb-1">{detailedRoom.title || detailedRoom.motion || 'Untitled room'}</h4>
                <div className="text-muted small">
                  {detailedRoom.roomType} · {detailedRoom.format} · phase {detailedRoom.currentPhase}
                </div>
              </div>

              <Row className="g-2">
                <Col sm={4}><MetricCard icon="bi-people" label="Participants" value={detailedRoom.participantCount} /></Col>
                <Col sm={4}><MetricCard icon="bi-mic-mute" label="Muted" value={detailedRoom.mutedCount} tone="warning" /></Col>
                <Col sm={4}><MetricCard icon="bi-chat-left" label="Viewer Chat" value={detailedRoom.viewerChatEnabled ? 'On' : 'Off'} tone={detailedRoom.viewerChatEnabled ? 'success' : 'secondary'} /></Col>
              </Row>

              {roomDetailQuery.data?.toxicMessages.length ? (
                <Alert variant="warning" className="mb-0">
                  <div className="fw-semibold mb-2">Toxic messages</div>
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
                      <th>Participant</th>
                      <th>Role</th>
                      <th>Team</th>
                      <th>Slot</th>
                      <th>State</th>
                      <th>Actions</th>
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
                          <td>{participant.muted ? <Badge bg="warning">muted</Badge> : <Badge bg="success">clear</Badge>}</td>
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
              <i className="bi bi-box-arrow-up-right me-1" />Open room
            </Button>
          )}
          <Button variant="outline-secondary" onClick={() => setSelectedRoom(null)}>Close</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={selectedReport !== null} onHide={() => setSelectedReport(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Review Report</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedReport && (
            <div className="d-flex flex-column gap-3">
              <Alert variant="info" className="mb-0">
                <div className="fw-semibold text-capitalize">{formatReportReason(selectedReport.reason)}</div>
                <div className="small">{selectedReport.details || selectedReport.messageSnippet || 'No details'}</div>
                <div className="small mt-2">
                  Reporter: {selectedReport.reporterName} · Target: {selectedReport.reportedUserName || selectedReport.roomTitle || selectedReport.targetType}
                </div>
              </Alert>

              <Form.Group>
                <Form.Label>Status</Form.Label>
                <Form.Select value={reportEditStatus} onChange={(event) => setReportEditStatus(event.target.value as ReportStatus)}>
                  {reportStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </Form.Select>
              </Form.Group>

              <Form.Group>
                <Form.Label>Resolution</Form.Label>
                <Form.Select value={reportResolution} onChange={(event) => setReportResolution(event.target.value as ReportResolution)}>
                  {reportResolutions.map((resolution) => <option key={resolution} value={resolution}>{resolution}</option>)}
                </Form.Select>
              </Form.Group>

              {reportResolution === 'banned' && (
                <>
                  <Form.Group>
                    <Form.Label>Ban duration</Form.Label>
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
                        placeholder="Value"
                      />
                      <Form.Select value={reportCustomDurationUnit} onChange={(event) => setReportCustomDurationUnit(event.target.value as CustomBanDurationUnit)}>
                        {customDurationUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                      </Form.Select>
                    </div>
                  )}
                </>
              )}

              <Form.Group>
                <Form.Label>Admin note</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={reportAdminNote}
                  onChange={(event) => setReportAdminNote(event.target.value)}
                  placeholder="Resolution note"
                />
              </Form.Group>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setSelectedReport(null)}>Cancel</Button>
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
            {updateReportMutation.isPending ? 'Saving...' : 'Save review'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
