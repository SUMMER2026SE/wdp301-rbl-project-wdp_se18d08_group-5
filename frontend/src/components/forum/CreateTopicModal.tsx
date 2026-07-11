import React, { useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';

interface CreateTopicModalProps {
  show: boolean;
  onHide: () => void;
  onSubmit: (data: { title: string; description?: string }) => void;
  isPending: boolean;
}

const PRESET_IDEAS = [
  'Artificial Intelligence will replace human programmers',
  'Social media does more harm than good to teenagers',
  'Remote working is superior to office working',
  'Cryptocurrency is the future of global finance',
];

export function CreateTopicModal({ show, onHide, onSubmit, isPending }: CreateTopicModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handlePresetClick = (idea: string) => {
    setTitle(idea);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 8) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
    });
    // Reset state
    setTitle('');
    setDescription('');
  };

  return (
    <Modal show={show} onHide={onHide} centered contentClassName="forum-modal-content">
      <Form onSubmit={handleFormSubmit}>
        <Modal.Header closeButton className="forum-modal-header">
          <Modal.Title className="h5 text-white">Create a Debate Topic</Modal.Title>
        </Modal.Header>
        <Modal.Body className="forum-modal-body">
          {/* Inspiration Prompts */}
          <div className="mb-4">
            <span className="small text-muted d-block mb-2">
              Need ideas? Select a trending prompt:
            </span>
            <div className="ideas-tags-row">
              {PRESET_IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  className="idea-tag-btn"
                  onClick={() => handlePresetClick(idea)}
                >
                  {idea.length > 35 ? `${idea.substring(0, 35)}...` : idea}
                </button>
              ))}
            </div>
          </div>

          <Form.Group className="mb-3">
            <Form.Label className="small fw-bold">Topic Title</Form.Label>
            <Form.Control
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              minLength={8}
              maxLength={200}
              placeholder="e.g. Gen Z is redefining workplace values"
              required
              autoFocus
              className="compose-text-area"
            />
            <div className="d-flex justify-content-between mt-1">
              <Form.Text className="text-muted">Minimum 8 characters.</Form.Text>
              <span className="small text-muted">{title.length}/200</span>
            </div>
          </Form.Group>

          <Form.Group>
            <Form.Label className="small fw-bold">
              Short Description <span className="text-muted">(optional)</span>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide background context or initial questions to spark the discussion..."
              className="compose-text-area"
            />
            <div className="text-end mt-1">
              <span className="small text-muted">{description.length}/1000</span>
            </div>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="forum-modal-footer">
          <Button variant="outline-secondary" onClick={onHide} className="px-4 py-2 border-0">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="px-4 py-2 text-black fw-bold"
            disabled={isPending || title.trim().length < 8}
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            {isPending ? 'Publishing...' : 'Launch Topic'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
