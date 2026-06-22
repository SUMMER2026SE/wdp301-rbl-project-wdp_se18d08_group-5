import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/data/repositories/counter_repository_impl.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/domain/usecases/decrement_counter_use_case.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/domain/usecases/get_counter_use_case.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/domain/usecases/increment_counter_use_case.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/domain/usecases/reset_counter_use_case.dart';

/// Provider for get counter use case
final getCounterUseCaseProvider = Provider<GetCounterUseCase>((ref) {
  return GetCounterUseCase(ref.watch(counterRepositoryProvider));
});

/// Provider for increment counter use case
final incrementCounterUseCaseProvider = Provider<IncrementCounterUseCase>((ref) {
  return IncrementCounterUseCase(ref.watch(counterRepositoryProvider));
});

/// Provider for decrement counter use case
final decrementCounterUseCaseProvider = Provider<DecrementCounterUseCase>((ref) {
  return DecrementCounterUseCase(ref.watch(counterRepositoryProvider));
});

/// Provider for reset counter use case
final resetCounterUseCaseProvider = Provider<ResetCounterUseCase>((ref) {
  return ResetCounterUseCase(ref.watch(counterRepositoryProvider));
});
