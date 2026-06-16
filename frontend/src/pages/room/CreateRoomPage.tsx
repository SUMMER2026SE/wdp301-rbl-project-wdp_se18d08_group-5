import { useMutation } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Alert, Button, ButtonGroup, Card, Col, Container, Form, Row } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { TopicPicker, getTopicValue, type TopicInputMode } from '@components/room/TopicPicker';
import { roomService } from '@services/roomService';
import type { CreateRoomRequest, DebateFormat, HostType, JudgeType } from '@/types';

export default function CreateRoomPage() {
  const navigate = useNavigate();
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
      toast.success('Room created');
      navigate(`/rooms/${roomId}/lobby`);
    },
    onError: () => toast.error('Could not create room'),
  });

  function updateField<K extends keyof CreateRoomRequest>(key: K, value: CreateRoomRequest[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const motion = getTopicValue(topicMode, selectedTopic, customTopic);
    if (!motion) {
      toast.error('Choose or type a debate topic');
      return;
    }

    createMutation.mutate(motion);
  }

  return (
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col lg={8}>
          <h2 className="mb-3">Create Debate Room</h2>
          <Card>
            <Card.Body>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Room title</Form.Label>
                  <Form.Control value={form.title} onChange={(event) => updateField('title', event.target.value)} required />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Debate topic</Form.Label>
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

                <Row className="g-3">
                  <Col md={6}>
                    <Form.Label>Format</Form.Label>
                    <ButtonGroup className="w-100">
                      {(['1v1', '3v3'] as DebateFormat[]).map((format) => (
                        <Button
                          key={format}
                          type="button"
                          variant={form.format === format ? 'primary' : 'outline-primary'}
                          onClick={() => updateField('format', format)}
                        >
                          {format}
                        </Button>
                      ))}
                    </ButtonGroup>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Judge count</Form.Label>
                      <Form.Select value={form.judgeCount} onChange={(event) => updateField('judgeCount', Number(event.target.value))}>
                        {[1, 2, 3].map((count) => <option key={count} value={count}>{count}</option>)}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Row className="g-3 mt-1">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Host</Form.Label>
                      <Form.Select value={form.hostType} onChange={(event) => updateField('hostType', event.target.value as HostType)}>
                        <option value="human">Human</option>
                        <option value="ai">AI</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Judge</Form.Label>
                      <Form.Select value={form.judgeType} onChange={(event) => updateField('judgeType', event.target.value as JudgeType)}>
                        <option value="ai">AI</option>
                        <option value="human">Human</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Check
                  className="my-3"
                  type="switch"
                  id="private-room"
                  label="Private room"
                  checked={form.isPrivate}
                  onChange={(event) => updateField('isPrivate', event.target.checked)}
                />

                {form.isPrivate && (
                  <Form.Group className="mb-3">
                    <Form.Label>Password</Form.Label>
                    <Form.Control value={form.password} onChange={(event) => updateField('password', event.target.value)} required />
                  </Form.Group>
                )}

                <Alert variant="info">The owner joins automatically. Pick and lock debater positions in the lobby before starting.</Alert>

                <Button type="submit" disabled={createMutation.isPending}>
                  <i className="bi bi-plus-lg me-2" />
                  Create Room
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
