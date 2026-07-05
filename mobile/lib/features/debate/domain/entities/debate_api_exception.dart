class DebateApiException implements Exception {
  const DebateApiException(this.message);

  final String message;

  @override
  String toString() => message;
}
