import { useMutation } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Alert, Button as RBButton, Card, Col, Container, Form, Row } from 'react-bootstrap';
const Button = RBButton as any;
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { TopicPicker, getTopicValue, type TopicInputMode } from '@components/room/TopicPicker';
import { roomService } from '@services/roomService';
import type { CreateRoomRequest, DebateFormat, HostType, JudgeType } from '@/types';

// Import custom components
import { CreateRoomPresets } from '../../components/room/CreateRoomPresets';

// Import CSS
import '../../styles/create_room.css';

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const [selectedPresetKey, setSelectedPresetKey] = useState('');

  const [form, setForm] = useState<CreateRoomRequest>({
    title: '',
    motion: '',
    format: '1v1',
    hostType: 'human',
    judgeType: 'ai',
    judgeCount: 1,
    isPrivate: false,
    password: '',
  });

  const [topicMode, setTopicMode] = useState<TopicInputMode>('preset');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');

  const createMutation = useMutation({
    mutationFn: (motion: string) => roomService.create({ ...form, motion }),
    onSuccess: (response) => {
      const roomId = response.data.data._id;
      toast.success('Debate room created successfully');
      navigate(`/rooms/${roomId}/lobby`);
    },
    onError: () => toast.error('Could not create room'),
  });

  function updateField<K extends keyof CreateRoomRequest>(key: K, value: CreateRoomRequest[K]) {
    setSelectedPresetKey(''); // Reset preset selection on manual modification
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSelectPreset(preset: Partial<CreateRoomRequest> & { key: string }) {
    setSelectedPresetKey(preset.key);
    setForm((current) => ({
      ...current,
      format: preset.format ?? current.format,
      hostType: preset.hostType ?? current.hostType,
      judgeType: preset.judgeType ?? current.judgeType,
      judgeCount: preset.judgeCount ?? current.judgeCount,
      isPrivate: preset.isPrivate ?? current.isPrivate,
    }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const motion = getTopicValue(topicMode, selectedTopic, customTopic);
    if (!motion) {
      toast.error('Please choose or input a debate topic');
      return;
    }

    createMutation.mutate(motion);
  }

  return (
    <Container className="create-room-page-container">
      <Row className="justify-content-center">
        <Col xs={12}>
          {/* Header */}
          <div className="mb-4 d-flex align-items-center gap-3">
            <div
              className="rounded d-flex align-items-center justify-content-center bg-dark text-primary border border-secondary"
              style={{ width: '45px', height: '45px', fontSize: '1.4rem' }}
            >
              <i className="bi bi-shield-plus" />
            </div>
            <div>
              <h2 className="mb-1 text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Setup Debate Room
              </h2>
              <p className="text-secondary small mb-0">
                Configure your own debate match rules, topic motions, host options, and judges.
              </p>
            </div>
          </div>

          <Card className="create-room-card-premium text-white">
            <Card.Body className="p-0">
              <Form onSubmit={handleSubmit}>
                {/* Configuration presets */}
                <CreateRoomPresets
                  selectedPresetKey={selectedPresetKey}
                  onSelectPreset={handleSelectPreset}
                  disabled={createMutation.isPending}
                />

                {/* Section 1: Room Identification */}
                <div className="section-divider-title">1. Room Profile</div>

                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold">Room Title</Form.Label>
                  <Form.Control
                    value={form.title}
                    onChange={(event) => updateField('title', event.target.value)}
                    placeholder="e.g. Weekly Club Showdown or AI Ethics Debate"
                    required
                    className="compose-text-area"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold">Debate Topic / Motion</Form.Label>
                  <TopicPicker
                    mode={topicMode}
                    selectedTopic={selectedTopic}
                    customTopic={customTopic}
                    onModeChange={setTopicMode}
                    onSelectedTopicChange={setSelectedTopic}
                    onCustomTopicChange={setCustomTopic}
                    disabled={createMutation.isPending}
                  />
                </Form.Group>

                {/* Section 2: Match Parameters */}
                <div className="section-divider-title">2. Arena Parameters</div>

                <Row className="g-3">
                  <Col md={6}>
                    <Form.Label className="small fw-bold d-block">Debate Format</Form.Label>
                    <div className="d-flex gap-2">
                      {(['1v1', '3v3'] as DebateFormat[]).map((formatOption) => (
                        <Button
                          key={formatOption}
                          type="button"
                          variant={form.format === formatOption ? 'primary' : 'outline-primary'}
                          onClick={() => updateField('format', formatOption)}
                          className={`flex-grow-1 py-2 ${
                            form.format === formatOption ? 'text-black fw-bold' : 'text-primary'
                          }`}
                        >
                          {formatOption} Match
                        </Button>
                      ))}
                    </div>
                  </Col>

                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small fw-bold">Judge Seatings</Form.Label>
                      <Form.Select
                        value={form.judgeCount}
                        onChange={(event) =>
                          updateField('judgeCount', Number(event.target.value) as 1 | 3)
                        }
                        disabled={form.judgeType === 'ai'}
                        className="bg-dark text-white border-secondary rounded py-2"
                        style={{ cursor: 'pointer' }}
                      >
                        {form.judgeType === 'ai' ? (
                          <option value={1}>1 (AI Judge)</option>
                        ) : (
                          <>
                            <option value={1}>1 Judge Seat</option>
                            <option value={3}>3 Judges Seats</option>
                          </>
                        )}
                      </Form.Select>
                      {form.judgeType === 'ai' && (
                        <Form.Text className="text-muted small mt-1">
                          AI Judging is restricted to exactly 1 evaluator.
                        </Form.Text>
                      )}
                    </Form.Group>
                  </Col>
                </Row>

                <Row className="g-3 mt-2">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small fw-bold">Match Coordinator (Host)</Form.Label>
                      <Form.Select
                        value={form.hostType}
                        onChange={(event) =>
                          updateField('hostType', event.target.value as HostType)
                        }
                        className="bg-dark text-white border-secondary rounded py-2"
                        style={{ cursor: 'pointer' }}
                      >
                        <option value="human">Human Room Host</option>
                        <option value="ai">No Room Host (AI Managed)</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small fw-bold">Judging System</Form.Label>
                      <Form.Select
                        value={form.judgeType}
                        onChange={(event) => {
                          const next = event.target.value as JudgeType;
                          updateField('judgeType', next);
                          if (next === 'ai') updateField('judgeCount', 1);
                        }}
                        className="bg-dark text-white border-secondary rounded py-2"
                        style={{ cursor: 'pointer' }}
                      >
                        <option value="ai">AI Evaluator</option>
                        <option value="human">Human Panel Judges</option>
                      </Form.Select>
                      {form.judgeType === 'ai' && (
                        <Form.Text className="text-muted">AI Judge always uses exactly 1 judge.</Form.Text>
                      )}
                    </Form.Group>
                  </Col>
                </Row>

                {/* Section 3: Room Security */}
                <div className="section-divider-title">3. Privacy Configuration</div>

                <Form.Check
                  className="create-room-switch"
                  type="switch"
                  id="private-room"
                  label="Password Protected Private Lobby"
                  checked={form.isPrivate}
                  onChange={(event) => updateField('isPrivate', event.target.checked)}
                />

                {form.isPrivate && (
                  <Form.Group className="mb-3">
                    <Form.Label className="small fw-bold">Room Password</Form.Label>
                    <Form.Control
                      type="text"
                      value={form.password}
                      onChange={(event) => updateField('password', event.target.value)}
                      placeholder="Specify lobby code..."
                      required
                      className="compose-text-area"
                    />
                  </Form.Group>
                )}

                <Alert variant="info" className="bg-dark border-info text-info mt-4">
                  <i className="bi bi-info-circle-fill me-2" />
                  As the room owner, you will join the lobby automatically. Lock your debater
                  positions in the lobby before launching the debate stage.
                </Alert>

                <div className="d-flex justify-content-end mt-4 pt-3 border-top border-secondary">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="px-4 py-2 text-black fw-bold d-flex align-items-center gap-2"
                    style={{
                      background: 'var(--bs-primary)',
                      border: 'none',
                      fontFamily: 'Orbitron, sans-serif',
                      boxShadow: '0 0 15px rgba(0, 245, 255, 0.3)',
                    }}
                  >
                    {createMutation.isPending ? (
                      'Creating Lobby...'
                    ) : (
                      <>
                        <i className="bi bi-plus-lg fs-5" />
                        Create Lobby
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
