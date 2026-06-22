import 'package:flutter/material.dart';

/// Status chip widget
class StatusChip extends StatelessWidget {
  final String label;
  final bool isActive;
  final Color color;

  const StatusChip({
    super.key,
    required this.label,
    required this.isActive,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: isActive
            ? color.withValues(alpha: 0.2)
            : Colors.grey.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isActive ? color : Colors.grey.withValues(alpha: 0.3),
          width: 2,
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: isActive ? color : Colors.grey,
          fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
          fontSize: 12,
        ),
      ),
    );
  }
}
