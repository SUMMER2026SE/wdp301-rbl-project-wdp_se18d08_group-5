import 'package:fpdart/fpdart.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/core/error/exceptions.dart';
import 'package:flutter_riverpod_clean_architecture/core/error/failures.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/data/datasources/counter_local_data_source.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/data/models/counter_model.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/domain/entities/counter_entity.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/domain/repositories/counter_repository.dart';

/// Implementation of counter repository
class CounterRepositoryImpl implements CounterRepository {
  final CounterLocalDataSource _localDataSource;

  CounterRepositoryImpl({
    required CounterLocalDataSource localDataSource,
  }) : _localDataSource = localDataSource;

  @override
  Future<Either<Failure, CounterEntity>> getCounter() async {
    try {
      final counterModel = await _localDataSource.getCounter();
      return Right(counterModel.toEntity());
    } on CacheException catch (e) {
      return Left(CacheFailure(message: e.message));
    } on Exception catch (e) {
      return Left(CacheFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, CounterEntity>> increment({int amount = 1}) async {
    try {
      final currentCounter = await _localDataSource.getCounter();
      final newCounter = currentCounter.copyWith(
        value: currentCounter.value + amount,
        lastUpdated: DateTime.now().toIso8601String(),
      );
      await _localDataSource.saveCounter(newCounter);
      return Right(newCounter.toEntity());
    } on CacheException catch (e) {
      return Left(CacheFailure(message: e.message));
    } on Exception catch (e) {
      return Left(CacheFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, CounterEntity>> decrement({int amount = 1}) async {
    try {
      final currentCounter = await _localDataSource.getCounter();
      final newCounter = currentCounter.copyWith(
        value: currentCounter.value - amount,
        lastUpdated: DateTime.now().toIso8601String(),
      );
      await _localDataSource.saveCounter(newCounter);
      return Right(newCounter.toEntity());
    } on CacheException catch (e) {
      return Left(CacheFailure(message: e.message));
    } on Exception catch (e) {
      return Left(CacheFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, CounterEntity>> reset() async {
    try {
      final newCounter = CounterModel(
        value: 0,
        lastUpdated: DateTime.now().toIso8601String(),
      );
      await _localDataSource.saveCounter(newCounter);
      return Right(newCounter.toEntity());
    } on CacheException catch (e) {
      return Left(CacheFailure(message: e.message));
    } on Exception catch (e) {
      return Left(CacheFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, CounterEntity>> setValue(int value) async {
    try {
      final newCounter = CounterModel(
        value: value,
        lastUpdated: DateTime.now().toIso8601String(),
      );
      await _localDataSource.saveCounter(newCounter);
      return Right(newCounter.toEntity());
    } on CacheException catch (e) {
      return Left(CacheFailure(message: e.message));
    } on Exception catch (e) {
      return Left(CacheFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, CounterEntity>> saveWithLabel(String label) async {
    try {
      final currentCounter = await _localDataSource.getCounter();
      final newCounter = currentCounter.copyWith(
        label: label,
        lastUpdated: DateTime.now().toIso8601String(),
      );
      await _localDataSource.saveCounter(newCounter);
      return Right(newCounter.toEntity());
    } on CacheException catch (e) {
      return Left(CacheFailure(message: e.message));
    } on Exception catch (e) {
      return Left(CacheFailure(message: e.toString()));
    }
  }
}

/// Provider for counter repository
final counterRepositoryProvider = Provider<CounterRepository>((ref) {
  return CounterRepositoryImpl(
    localDataSource: ref.watch(counterLocalDataSourceProvider),
  );
});
