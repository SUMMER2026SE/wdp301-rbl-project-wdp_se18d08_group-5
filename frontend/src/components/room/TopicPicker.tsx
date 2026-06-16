import { useMemo, useState } from 'react';
import { Button, ButtonGroup, Dropdown, Form } from 'react-bootstrap';
import { DEBATE_TOPICS } from '@utils/debateTopics';

const MAX_VISIBLE_TOPICS = 30;

export type TopicInputMode = 'preset' | 'custom';

interface TopicPickerProps {
  mode: TopicInputMode;
  selectedTopic: string;
  customTopic: string;
  onModeChange: (mode: TopicInputMode) => void;
  onSelectedTopicChange: (topic: string) => void;
  onCustomTopicChange: (topic: string) => void;
  disabled?: boolean;
}

export function getTopicValue(mode: TopicInputMode, selectedTopic: string, customTopic: string) {
  return (mode === 'preset' ? selectedTopic : customTopic).trim();
}

export function TopicPicker({
  mode,
  selectedTopic,
  customTopic,
  onModeChange,
  onSelectedTopicChange,
  onCustomTopicChange,
  disabled = false,
}: TopicPickerProps) {
  const [search, setSearch] = useState('');

  const filteredTopics = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return DEBATE_TOPICS.slice(0, MAX_VISIBLE_TOPICS);

    return DEBATE_TOPICS.filter((topic) => topic.toLowerCase().includes(query)).slice(0, MAX_VISIBLE_TOPICS);
  }, [search]);

  return (
    <div>
      <ButtonGroup className="w-100 mb-3">
        <Button
          type="button"
          variant={mode === 'preset' ? 'primary' : 'outline-primary'}
          onClick={() => onModeChange('preset')}
          disabled={disabled}
        >
          Seed Topics
        </Button>
        <Button
          type="button"
          variant={mode === 'custom' ? 'primary' : 'outline-primary'}
          onClick={() => onModeChange('custom')}
          disabled={disabled}
        >
          Custom Topic
        </Button>
      </ButtonGroup>

      {mode === 'preset' ? (
        <Dropdown className="w-100">
          <Dropdown.Toggle
            variant={selectedTopic ? 'outline-primary' : 'outline-secondary'}
            className="w-100 d-flex align-items-center justify-content-between text-start"
            disabled={disabled}
          >
            <span className="text-truncate">{selectedTopic || 'Choose a seeded topic'}</span>
          </Dropdown.Toggle>
          <Dropdown.Menu className="w-100 p-2">
            <Form.Control
              size="sm"
              className="mb-2"
              placeholder="Search topics"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoFocus
            />
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {filteredTopics.length ? (
                filteredTopics.map((topic) => (
                  <Dropdown.Item
                    key={topic}
                    as="button"
                    active={selectedTopic === topic}
                    onClick={(event) => {
                      event.preventDefault();
                      onSelectedTopicChange(topic);
                    }}
                    className="text-wrap"
                  >
                    {topic}
                  </Dropdown.Item>
                ))
              ) : (
                <Dropdown.ItemText>No matching topics</Dropdown.ItemText>
              )}
            </div>
          </Dropdown.Menu>
        </Dropdown>
      ) : (
        <Form.Control
          as="textarea"
          rows={3}
          maxLength={240}
          placeholder="Type a custom debate topic"
          value={customTopic}
          onChange={(event) => onCustomTopicChange(event.target.value)}
          disabled={disabled}
        />
      )}
    </div>
  );
}
