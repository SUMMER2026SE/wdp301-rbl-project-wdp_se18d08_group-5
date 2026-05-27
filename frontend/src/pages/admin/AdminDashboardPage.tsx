import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, Col, Container, Form, Modal, Pagination, Row, Table } from 'react-bootstrap';
import type { AdminUser, BanDurationPreset, CustomBanDurationUnit } from '@/types';
import { LoadingScreen } from '@components/common/LoadingScreen';
import { userService } from '@services/userService';
import { useAuthStore } from '@stores/authStore';
import { formatDate, formatRelativeTime } from '@utils/formatters';

const moderationItems = [
  {
    title: 'User reports',
    description: 'Backend admin report endpoints are not available yet.',
    status: 'Backend pending',
  },
  {
    title: 'Room moderation',
    description: 'Kick/mute controls exist for debate hosts, but not as a dedicated admin dashboard tool yet.',
    status: 'Hybrid placeholder',
  },
  {
    title: 'AI debug tools',
    description: 'AI endpoints exist, but an admin-only monitoring surface is not exposed yet.',
    status: 'Hybrid placeholder',
  },
];

const systemItems = [
  {
    title: 'Role-based access',
    description: 'Frontend admin guard is live. Backend authorize(...) middleware already exists for future admin APIs.',
  },
  {
    title: 'Ranking oversight',
    description: 'Leaderboard and ranking flows are live; dedicated admin review actions can be connected later.',
  },
  {
    title: 'Operational health',
    description: 'Use this dashboard as the shell for future moderation, audit, and platform-control features.',
  },
];

const PAGE_SIZE = 10;
const durationOptions: Array<{ value: BanDurationPreset; label: string }> = [
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'custom', label: 'Custom' },
];
const customDurationUnits: CustomBanDurationUnit[] = ['minutes', 'hours', 'days'];

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

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'danger'; message: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [durationPreset, setDurationPreset] = useState<BanDurationPreset>('24h');
  const [customDurationValue, setCustomDurationValue] = useState('');
  const [customDurationUnit, setCustomDurationUnit] = useState<CustomBanDurationUnit>('hours');
  const [reason, setReason] = useState('');

  const queryParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
    }),
    [page, search],
  );

  const usersQuery = useQuery({
    queryKey: ['admin-users', queryParams],
    queryFn: async () => {
      const response = await userService.getAdminUsers(queryParams);
      return response.data;
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AdminUser['role'] }) => {
      const response = await userService.updateUserRole(userId, { role });
      return response.data.data;
    },
    onSuccess: (updatedUser) => {
      setFeedback({
        type: 'success',
        message: `Updated role for ${updatedUser.profile.displayName || updatedUser.username}.`,
      });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      setFeedback({
        type: 'danger',
        message: error.message || 'Failed to update user role.',
      });
    },
  });

  const banUserMutation = useMutation({
    mutationFn: async (user: AdminUser) => {
      const response = await userService.banUser(user._id, {
        durationPreset,
        customDurationValue: durationPreset === 'custom' ? Number(customDurationValue) : undefined,
        customDurationUnit: durationPreset === 'custom' ? customDurationUnit : undefined,
        reason: reason.trim() || undefined,
      });
      return response.data.data;
    },
    onSuccess: (updatedUser) => {
      setFeedback({
        type: 'success',
        message: `Banned ${updatedUser.profile.displayName || updatedUser.username}.`,
      });
      setSelectedUser(null);
      setReason('');
      setCustomDurationValue('');
      setDurationPreset('24h');
      setCustomDurationUnit('hours');
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      setFeedback({
        type: 'danger',
        message: error.message || 'Failed to ban user.',
      });
    },
  });

  const unbanUserMutation = useMutation({
    mutationFn: async (user: AdminUser) => {
      const response = await userService.unbanUser(user._id);
      return response.data.data;
    },
    onSuccess: (updatedUser) => {
      setFeedback({
        type: 'success',
        message: `Unbanned ${updatedUser.profile.displayName || updatedUser.username}.`,
      });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      setFeedback({
        type: 'danger',
        message: error.message || 'Failed to unban user.',
      });
    },
  });

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const rows = usersQuery.data?.data ?? [];
  const pagination = usersQuery.data?.pagination;
  const totalUsers = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  if (usersQuery.isLoading) {
    return <LoadingScreen />;
  }

  if (usersQuery.isError) {
    return (
      <Container className="py-4">
        <Alert variant="danger">{(usersQuery.error as Error).message || 'Unable to load admin users.'}</Alert>
      </Container>
    );
  }

  return (
    <>
      <Container className="py-4">
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
          <div>
            <h2 className="mb-1">
              <i className="bi bi-speedometer2 me-2" />
              Admin Dashboard
            </h2>
            <p className="text-muted mb-0">
              Hybrid admin workspace: live user management with clear placeholders for backend modules that are not exposed yet.
            </p>
          </div>
          <Badge bg="danger" className="align-self-start align-self-lg-center">
            {currentUser?.role === 'admin' ? 'Admin access' : 'Restricted'}
          </Badge>
        </div>

        {feedback && (
          <Alert variant={feedback.type} dismissible onClose={() => setFeedback(null)}>
            {feedback.message}
          </Alert>
        )}

        <Row className="g-3 mb-4">
          <Col md={4}>
            <Card className="shadow-sm h-100">
              <Card.Body>
                <div className="text-muted small mb-2">Accounts</div>
                <h3 className="mb-1">{totalUsers}</h3>
                <div className="text-muted">Live admin user records</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="shadow-sm h-100">
              <Card.Body>
                <div className="text-muted small mb-2">Moderation tools</div>
                <h3 className="mb-1">{moderationItems.length}</h3>
                <div className="text-muted">Scaffolded for future admin APIs</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="shadow-sm h-100">
              <Card.Body>
                <div className="text-muted small mb-2">System panels</div>
                <h3 className="mb-1">{systemItems.length}</h3>
                <div className="text-muted">Connected to current auth and role model</div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="g-4">
          <Col xl={8}>
            <Card className="shadow-sm h-100">
              <Card.Body>
                <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-3">
                  <div>
                    <h4 className="mb-1">User management</h4>
                    <p className="text-muted mb-0">Live admin table with search, pagination, role updates, and temporary bans.</p>
                  </div>
                  <Badge bg="success">Live</Badge>
                </div>

                <Form onSubmit={handleSearchSubmit} className="mb-3">
                  <div className="d-flex gap-2">
                    <Form.Control
                      type="search"
                      placeholder="Search by username, email, or display name"
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                    />
                    <Button type="submit" variant="primary">
                      Search
                    </Button>
                  </div>
                </Form>

                {rows.length === 0 ? (
                  <Alert variant="info" className="mb-0">No users found.</Alert>
                ) : (
                  <>
                    <div className="table-responsive">
                      <Table hover bordered>
                        <thead>
                          <tr>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Provider</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((entry) => {
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
                                <td>
                                  <Badge bg={entry.role === 'admin' ? 'danger' : 'secondary'}>{entry.role}</Badge>
                                </td>
                                <td>
                                  <Badge bg={providerBadgeVariant(entry.authProvider)}>{entry.authProvider}</Badge>
                                </td>
                                <td>
                                  <div className="d-flex flex-column gap-1">
                                    <Badge bg={status.variant} text={status.variant === 'warning' ? 'dark' : undefined}>
                                      {status.label}
                                    </Badge>
                                    <div className="text-muted small">{status.detail}</div>
                                    {entry.isBanned && entry.banReason && (
                                      <div className="small">Reason: {entry.banReason}</div>
                                    )}
                                  </div>
                                </td>
                                <td>{formatDate(entry.createdAt)}</td>
                                <td>
                                  <div className="d-flex flex-column gap-2">
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
                                        Unban
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
                                        Ban
                                      </Button>
                                    )}

                                    {isCurrentUser && (
                                      <div className="text-muted small">You cannot moderate your own account here.</div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>

                    <Pagination className="justify-content-center mb-0">
                      <Pagination.Prev disabled={page === 1} onClick={() => setPage((current) => current - 1)} />
                      <Pagination.Item active>{page}</Pagination.Item>
                      <Pagination.Next disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} />
                    </Pagination>
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col xl={4}>
            <Card className="shadow-sm mb-4">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h4 className="mb-0">Moderation & reports</h4>
                  <Badge bg="secondary">Backend pending</Badge>
                </div>
                <div className="d-flex flex-column gap-3">
                  {moderationItems.map((item) => (
                    <div key={item.title} className="border rounded p-3">
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <strong>{item.title}</strong>
                        <Badge bg="dark">{item.status}</Badge>
                      </div>
                      <div className="text-muted small">{item.description}</div>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>

            <Card className="shadow-sm">
              <Card.Body>
                <h4 className="mb-3">System overview</h4>
                <div className="d-flex flex-column gap-3">
                  {systemItems.map((item) => (
                    <Alert key={item.title} variant="info" className="mb-0">
                      <div className="fw-semibold mb-1">{item.title}</div>
                      <div className="small">{item.description}</div>
                    </Alert>
                  ))}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      <Modal show={selectedUser !== null} onHide={() => setSelectedUser(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Ban user</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            {selectedUser && (
              <div className="text-muted small">
                Account: <strong>{selectedUser.profile.displayName || selectedUser.username}</strong>
              </div>
            )}
          </div>

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
                {customDurationUnits.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
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
              placeholder="Optional moderation note"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setSelectedUser(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={
              banUserMutation.isPending
              || !selectedUser
              || (durationPreset === 'custom' && !customDurationValue.trim())
            }
            onClick={() => {
              if (!selectedUser) return;
              banUserMutation.mutate(selectedUser);
            }}
          >
            {banUserMutation.isPending ? 'Applying...' : 'Confirm ban'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
