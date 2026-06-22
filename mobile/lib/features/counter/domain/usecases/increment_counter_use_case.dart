import 'package:fpdart/fpdart.dart';
import 'package:flutter_riverpod_clean_architecture/core/error/failures.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/domain/entities/counter_entity.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/domain/repositories/counter_repository.dart';

/// Use case for incrementing the counter
class IncrementCounterUseCase {
  final CounterRepository _repository;

  IncrementCounterUseCase(this._repository);

  Future<Either<Failure, CounterEntity>> execute({int amount = 1}) {
    // Validation: amount must be positive
    if (amount <= 0) {
      return Future.value(
        const Left(InputFailure(message: 'Increment amount must be positive')),
      );
    }

    return _repository.increment(amount: amount);
  }
}
