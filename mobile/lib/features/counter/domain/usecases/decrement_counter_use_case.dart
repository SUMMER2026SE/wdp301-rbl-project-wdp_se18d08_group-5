import 'package:fpdart/fpdart.dart';
import 'package:flutter_riverpod_clean_architecture/core/error/failures.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/domain/entities/counter_entity.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/domain/repositories/counter_repository.dart';

/// Use case for decrementing the counter
class DecrementCounterUseCase {
  final CounterRepository _repository;

  DecrementCounterUseCase(this._repository);

  Future<Either<Failure, CounterEntity>> execute({int amount = 1}) {
    // Validation: amount must be positive
    if (amount <= 0) {
      return Future.value(
        const Left(InputFailure(message: 'Decrement amount must be positive')),
      );
    }

    return _repository.decrement(amount: amount);
  }
}
