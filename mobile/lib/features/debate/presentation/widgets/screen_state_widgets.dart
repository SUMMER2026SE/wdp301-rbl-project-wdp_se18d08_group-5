import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/core/utils/adaptive_feedback.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/ios_debate_widgets.dart';

void showDebateSnack(BuildContext context, String message) {
  AdaptiveFeedback.showSnackBar(context, message: message);
}

Widget debateAsyncBody<T>({
  required AsyncValue<T> value,
  required Widget Function(T data) data,
  Future<void> Function()? onRetry,
}) {
  return value.when(
    loading: () => const Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: CircularProgressIndicator(),
      ),
    ),
    error: (error, _) => Builder(
      builder: (context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: DebateCard(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 54,
                  height: 54,
                  decoration: BoxDecoration(
                    color: DebateColors.rose.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(Icons.wifi_off, color: DebateColors.rose),
                ),
                const SizedBox(height: 14),
                Text(
                  'Không tải được dữ liệu',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 6),
                Text(
                  error.toString(),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                if (onRetry != null) ...[
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: onRetry,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Thử lại'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    ),
    data: data,
  );
}
