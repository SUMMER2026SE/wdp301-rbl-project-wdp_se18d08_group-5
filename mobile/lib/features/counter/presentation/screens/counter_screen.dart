import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/presentation/providers/counter_provider.dart';
import 'package:intl/intl.dart';

import '../widgets/status_chip.dart';

/// Counter screen
class CounterScreen extends ConsumerWidget {
  const CounterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final counterState = ref.watch(counterProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Counter'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.read(counterProvider.notifier).reset();
            },
            tooltip: 'Reset Counter',
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Counter value display
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: theme.colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Text(
                    'Counter Value',
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: theme.colorScheme.onPrimaryContainer,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    '${counterState.counter.value}',
                    style: theme.textTheme.displayLarge?.copyWith(
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Last updated: ${_formatDateTime(counterState.counter.lastUpdated)}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onPrimaryContainer.withValues(alpha: 0.7),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 48),

            // Status indicators
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                StatusChip(
                  label: 'Positive',
                  isActive: counterState.counter.isPositive,
                  color: Colors.green,
                ),
                const SizedBox(width: 8),
                StatusChip(
                  label: 'Zero',
                  isActive: counterState.counter.isInitial,
                  color: Colors.grey,
                ),
                const SizedBox(width: 8),
                StatusChip(
                  label: 'Negative',
                  isActive: counterState.counter.isNegative,
                  color: Colors.red,
                ),
              ],
            ),

            const SizedBox(height: 48),

            // Control buttons
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Decrement by 10
                FloatingActionButton(
                  heroTag: 'decrement10',
                  onPressed: counterState.isLoading
                      ? null
                      : () {
                          ref.read(counterProvider.notifier).decrement(amount: 10);
                        },
                  tooltip: 'Decrement by 10',
                  child: const Text('-10'),
                ),
                const SizedBox(width: 16),

                // Decrement by 1
                FloatingActionButton(
                  heroTag: 'decrement1',
                  onPressed: counterState.isLoading
                      ? null
                      : () {
                          ref.read(counterProvider.notifier).decrement();
                        },
                  tooltip: 'Decrement',
                  child: const Icon(Icons.remove),
                ),
                const SizedBox(width: 32),

                // Increment by 1
                FloatingActionButton(
                  heroTag: 'increment1',
                  onPressed: counterState.isLoading
                      ? null
                      : () {
                          ref.read(counterProvider.notifier).increment();
                        },
                  tooltip: 'Increment',
                  child: const Icon(Icons.add),
                ),
                const SizedBox(width: 16),

                // Increment by 10
                FloatingActionButton(
                  heroTag: 'increment10',
                  onPressed: counterState.isLoading
                      ? null
                      : () {
                          ref.read(counterProvider.notifier).increment(amount: 10);
                        },
                  tooltip: 'Increment by 10',
                  child: const Text('+10'),
                ),
              ],
            ),

            const SizedBox(height: 24),

            // Loading indicator
            if (counterState.isLoading)
              const Padding(
                padding: EdgeInsets.all(16.0),
                child: CircularProgressIndicator(),
              ),

            // Error message
            if (counterState.errorMessage != null)
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: Text(
                  counterState.errorMessage!,
                  style: TextStyle(
                    color: theme.colorScheme.error,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _formatDateTime(DateTime dateTime) {
    return DateFormat('HH:mm:ss').format(dateTime);
  }
}
