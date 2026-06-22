import 'package:flutter_riverpod_clean_architecture/features/counter/domain/entities/counter_entity.dart';
import 'package:json_annotation/json_annotation.dart';

part 'counter_model.g.dart';

/// Data model for counter
@JsonSerializable()
class CounterModel {
  final int value;
  final String lastUpdated;
  final String? label;

  const CounterModel({
    required this.value,
    required this.lastUpdated,
    this.label,
  });

  /// Convert from JSON
  factory CounterModel.fromJson(Map<String, dynamic> json) =>
      _$CounterModelFromJson(json);

  /// Convert to JSON
  Map<String, dynamic> toJson() => _$CounterModelToJson(this);

  /// Convert from entity
  factory CounterModel.fromEntity(CounterEntity entity) {
    return CounterModel(
      value: entity.value,
      lastUpdated: entity.lastUpdated.toIso8601String(),
      label: entity.label,
    );
  }

  /// Convert to entity
  CounterEntity toEntity() {
    return CounterEntity(
      value: value,
      lastUpdated: DateTime.parse(lastUpdated),
      label: label,
    );
  }

  /// CopyWith method
  CounterModel copyWith({
    int? value,
    String? lastUpdated,
    String? label,
  }) {
    return CounterModel(
      value: value ?? this.value,
      lastUpdated: lastUpdated ?? this.lastUpdated,
      label: label ?? this.label,
    );
  }
}
