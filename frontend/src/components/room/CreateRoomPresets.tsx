import type { CreateRoomRequest, DebateFormat, HostType, JudgeType } from '@/types';

interface PresetItem {
  key: string;
  title: string;
  desc: string;
  format: DebateFormat;
  hostType: HostType;
  judgeType: JudgeType;
  judgeCount: 1 | 3;
  isPrivate: boolean;
}

const PRESETS: PresetItem[] = [
  {
    key: 'ai-duel',
    title: 'AI Practice Arena',
    desc: 'Instant 1v1 training mode. Zero overhead with an AI host and AI judge.',
    format: '1v1',
    hostType: 'ai',
    judgeType: 'ai',
    judgeCount: 1,
    isPrivate: false,
  },
  {
    key: 'human-league',
    title: '3v3 League Championship',
    desc: 'Traditional competitive structure featuring human hosts and 3 human judges.',
    format: '3v3',
    hostType: 'human',
    judgeType: 'human',
    judgeCount: 3,
    isPrivate: false,
  },
  {
    key: 'private-training',
    title: 'Locked Sparring Room',
    desc: 'Password-locked 1v1 duel room for team training and practice sessions.',
    format: '1v1',
    hostType: 'ai',
    judgeType: 'ai',
    judgeCount: 1,
    isPrivate: true,
  },
];

interface CreateRoomPresetsProps {
  selectedPresetKey: string;
  onSelectPreset: (preset: Partial<CreateRoomRequest> & { key: string }) => void;
  disabled?: boolean;
}

export function CreateRoomPresets({
  selectedPresetKey,
  onSelectPreset,
  disabled = false,
}: CreateRoomPresetsProps) {
  return (
    <div className="presets-group-wrapper">
      <span className="console-label d-block mb-1">Room Setup Templates</span>
      <p className="small text-muted mb-3">
        Choose a configuration preset to populate matching parameters instantly.
      </p>

      <div className="presets-grid">
        {PRESETS.map((preset) => {
          const isSelected = selectedPresetKey === preset.key;
          return (
            <div
              key={preset.key}
              onClick={() => !disabled && onSelectPreset(preset)}
              className={`preset-card-item ${isSelected ? 'selected' : ''}`}
              style={{ pointerEvents: disabled ? 'none' : 'auto' }}
            >
              <h5 className="preset-title">{preset.title}</h5>
              <p className="preset-desc">{preset.desc}</p>
              <div className="preset-meta-row">
                <span className="preset-meta-badge">{preset.format}</span>
                <span className="preset-meta-badge">{preset.hostType} host</span>
                <span className="preset-meta-badge">{preset.judgeType} judge</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
