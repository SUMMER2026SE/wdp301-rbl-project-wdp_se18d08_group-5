import 'package:equatable/equatable.dart';

/// Counter entity representing the domain model
class CounterEntity extends Equatable {
  final int value;
  final DateTime lastUpdated;
  final String? label;

  const CounterEntity({
    required this.value,
    required this.lastUpdated,
    this.label,
  });

  @override
  List<Object?> get props => [value, lastUpdated, label];

  /// Factory constructor to create an initial counter
  factory CounterEntity.initial() {
    return CounterEntity(
      value: 0,
      lastUpdated: DateTime.now(),
    );
  }

  /// CopyWith method for creating a new instance with some updated properties
  CounterEntity copyWith({
    int? value,
    DateTime? lastUpdated,
    String? label,
  }) {
    return CounterEntity(
      value: value ?? this.value,
      lastUpdated: lastUpdated ?? this.lastUpdated,
      label: label ?? this.label,
    );
  }

  /// Check if counter is at initial state
  bool get isInitial => value == 0;

  /// Check if counter is positive
  bool get isPositive => value > 0;

  /// Check if counter is negative
  bool get isNegative => value < 0;
}
