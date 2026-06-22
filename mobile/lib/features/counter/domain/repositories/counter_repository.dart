import 'package:fpdart/fpdart.dart';
import 'package:flutter_riverpod_clean_architecture/core/error/failures.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/domain/entities/counter_entity.dart';

/// Abstract repository for counter operations
abstract class CounterRepository {
  /// Get the current counter value
  Future<Either<Failure, CounterEntity>> getCounter();

  /// Increment the counter by a given amount
  Future<Either<Failure, CounterEntity>> increment({int amount = 1});

  /// Decrement the counter by a given amount
  Future<Either<Failure, CounterEntity>> decrement({int amount = 1});

  /// Reset the counter to zero
  Future<Either<Failure, CounterEntity>> reset();

  /// Set the counter to a specific value
  Future<Either<Failure, CounterEntity>> setValue(int value);

  /// Save counter with a label
  Future<Either<Failure, CounterEntity>> saveWithLabel(String label);
}
