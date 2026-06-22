import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/core/constants/app_constants.dart';
import 'package:flutter_riverpod_clean_architecture/core/error/exceptions.dart';
import 'package:flutter_riverpod_clean_architecture/core/providers/storage_providers.dart';
import 'package:flutter_riverpod_clean_architecture/core/storage/local_storage_service.dart';
import 'package:flutter_riverpod_clean_architecture/features/counter/data/models/counter_model.dart';

/// Local data source for counter operations
abstract class CounterLocalDataSource {
  /// Get the current counter from local storage
  Future<CounterModel> getCounter();

  /// Save counter to local storage
  Future<void> saveCounter(CounterModel counter);

  /// Clear counter from local storage
  Future<void> clearCounter();
}

/// Implementation of counter local data source
class CounterLocalDataSourceImpl implements CounterLocalDataSource {
  final LocalStorageService _localStorageService;
  static const String _counterKey = '${AppConstants.storagePrefix}counter';

  CounterLocalDataSourceImpl(this._localStorageService);

  @override
  Future<CounterModel> getCounter() async {
    try {
      final data = _localStorageService.getObject(_counterKey);

      if (data == null) {
        // Return initial counter if not found
        return CounterModel(
          value: 0,
          lastUpdated: DateTime.now().toIso8601String(),
        );
      }

      return CounterModel.fromJson(data as Map<String, dynamic>);
    } catch (e) {
      throw CacheException(message: 'Failed to get counter: ${e.toString()}');
    }
  }

  @override
  Future<void> saveCounter(CounterModel counter) async {
    try {
      await _localStorageService.setObject(_counterKey, counter.toJson());
    } catch (e) {
      throw CacheException(message: 'Failed to save counter: ${e.toString()}');
    }
  }

  @override
  Future<void> clearCounter() async {
    try {
      await _localStorageService.remove(_counterKey);
    } catch (e) {
      throw CacheException(message: 'Failed to clear counter: ${e.toString()}');
    }
  }
}

/// Provider for counter local data source
final counterLocalDataSourceProvider = Provider<CounterLocalDataSource>((ref) {
  return CounterLocalDataSourceImpl(
    ref.watch(localStorageServiceProvider),
  );
});
