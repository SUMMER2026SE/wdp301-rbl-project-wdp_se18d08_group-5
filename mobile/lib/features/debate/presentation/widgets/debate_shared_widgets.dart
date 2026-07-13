import 'package:flutter/material.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/domain/entities/debate_entities.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/ios_debate_widgets.dart';
import 'package:go_router/go_router.dart';

class DebateStatTile extends StatelessWidget {
  const DebateStatTile({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
        decoration: BoxDecoration(
          color: DebateColors.canvas,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: DebateColors.line),
        ),
        child: Column(
          children: [
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: DebateColors.ink,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(
                context,
              ).textTheme.labelMedium?.copyWith(color: DebateColors.muted),
            ),
          ],
        ),
      ),
    );
  }
}

class DebateRoomTile extends StatelessWidget {
  const DebateRoomTile({super.key, required this.room});

  final DebateRoomModel room;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: DebateCard(
        onTap: () => context.push('/rooms/${room.id}/lobby'),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: DebateColors.accent.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.forum, color: DebateColors.accent),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    room.title.isEmpty ? 'Phòng debate' : room.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    room.motion.isEmpty ? room.status : room.motion,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                DebatePill(label: room.format),
                const SizedBox(height: 8),
                const Icon(Icons.chevron_right, color: DebateColors.muted),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class DebateRoomHeader extends StatelessWidget {
  const DebateRoomHeader({super.key, required this.room});

  final DebateRoomModel room;

  @override
  Widget build(BuildContext context) {
    return DebateCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  color: DebateColors.indigo.withValues(alpha: 0.11),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(Icons.campaign, color: DebateColors.indigo),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      room.title.isEmpty ? 'Debate room' : room.title,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      room.motion.isEmpty ? 'Chưa có motion.' : room.motion,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              DebatePill(label: room.format, icon: Icons.people_alt),
              DebatePill(label: room.status, icon: Icons.circle),
              DebatePill(
                label: room.judgeType.isEmpty ? 'judge' : room.judgeType,
                icon: Icons.gavel,
                color: DebateColors.indigo,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class DebateScoreSlider extends StatelessWidget {
  const DebateScoreSlider({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final double value;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            DebatePill(label: '${value.round()}'),
          ],
        ),
        Slider(
          value: value,
          min: 0,
          max: 30,
          divisions: 30,
          onChanged: onChanged,
        ),
      ],
    );
  }
}
