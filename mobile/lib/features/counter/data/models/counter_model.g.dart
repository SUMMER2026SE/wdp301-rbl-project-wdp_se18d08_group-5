// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'counter_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CounterModel _$CounterModelFromJson(Map<String, dynamic> json) => CounterModel(
  value: (json['value'] as num).toInt(),
  lastUpdated: json['lastUpdated'] as String,
  label: json['label'] as String?,
);

Map<String, dynamic> _$CounterModelToJson(CounterModel instance) =>
    <String, dynamic>{
      'value': instance.value,
      'lastUpdated': instance.lastUpdated,
      'label': instance.label,
    };
