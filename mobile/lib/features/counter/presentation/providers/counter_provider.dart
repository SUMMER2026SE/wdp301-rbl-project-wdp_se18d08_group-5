import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/domain/entities/counter_entity.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/providers/counter_providers.dart';

/// Counter state
class CounterState {
  final CounterEntity counter;
  final bool isLoading;
  final String? errorMessage;

  const CounterState({
    required this.counter,
    this.isLoading = false,
    this.errorMessage,
  });

  CounterState copyWith({
    CounterEntity? counter,
    bool? isLoading,
    String? errorMessage,
  }) {
    return CounterState(
      counter: counter ?? this.counter,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }

  /// Initial state
  factory CounterState.initial() {
    return CounterState(
      counter: CounterEntity.initial(),
    );
  }
}

/// Counter notifier
class CounterNotifier extends Notifier<CounterState> {
  @override
  CounterState build() {
    // Load initial counter value
    _loadCounter();
    return CounterState.initial();
  }

  /// Load counter from storage
  Future<void> _loadCounter() async {
    state = state.copyWith(isLoading: true, errorMessage: null);

    final getCounterUseCase = ref.read(getCounterUseCaseProvider);
    final result = await getCounterUseCase.execute();

    result.fold(
      (failure) => state = state.copyWith(
        isLoading: false,
        errorMessage: failure.message,
      ),
      (counter) => state = state.copyWith(
        isLoading: false,
        counter: counter,
        errorMessage: null,
      ),
    );
  }

  /// Increment counter
  Future<void> increment({int amount = 1}) async {
    state = state.copyWith(isLoading: true, errorMessage: null);

    final incrementUseCase = ref.read(incrementCounterUseCaseProvider);
    final result = await incrementUseCase.execute(amount: amount);

    result.fold(
      (failure) => state = state.copyWith(
        isLoading: false,
        errorMessage: failure.message,
      ),
      (counter) => state = state.copyWith(
        isLoading: false,
        counter: counter,
        errorMessage: null,
      ),
    );
  }

  /// Decrement counter
  Future<void> decrement({int amount = 1}) async {
    state = state.copyWith(isLoading: true, errorMessage: null);

    final decrementUseCase = ref.read(decrementCounterUseCaseProvider);
    final result = await decrementUseCase.execute(amount: amount);

    result.fold(
      (failure) => state = state.copyWith(
        isLoading: false,
        errorMessage: failure.message,
      ),
      (counter) => state = state.copyWith(
        isLoading: false,
        counter: counter,
        errorMessage: null,
      ),
    );
  }

  /// Reset counter
  Future<void> reset() async {
    state = state.copyWith(isLoading: true, errorMessage: null);

    final resetUseCase = ref.read(resetCounterUseCaseProvider);
    final result = await resetUseCase.execute();

    result.fold(
      (failure) => state = state.copyWith(
        isLoading: false,
        errorMessage: failure.message,
      ),
      (counter) => state = state.copyWith(
        isLoading: false,
        counter: counter,
        errorMessage: null,
      ),
    );
  }
}

/// Counter provider
final counterProvider = NotifierProvider<CounterNotifier, CounterState>(
  CounterNotifier.new,
);
