import 'package:fpdart/fpdart.dart';
import 'package:flutter_riverpod_clean_architecture/core/error/failures.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/domain/entities/counter_entity.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/domain/repositories/counter_repository.dart';

/// Use case for getting the current counter value
class GetCounterUseCase {
  final CounterRepository _repository;

  GetCounterUseCase(this._repository);

  Future<Either<Failure, CounterEntity>> execute() {
    return _repository.getCounter();
  }
}
