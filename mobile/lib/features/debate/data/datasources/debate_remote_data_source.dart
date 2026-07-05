import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod_clean_architecture/core/constants/app_constants.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/domain/entities/debate_entities.dart';

const _secureStorage = FlutterSecureStorage();

String _readString(Map<String, dynamic> json, List<String> keys) {
  for (final key in keys) {
    final value = json[key];
    if (value != null) return value.toString();
  }
  return '';
}

Map<String, dynamic> _asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return value.map((key, value) => MapEntry('$key', value));
  return <String, dynamic>{};
}

List<dynamic> _asList(dynamic value) => value is List ? value : const [];

class DebateRemoteDataSource {
  DebateRemoteDataSource() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConstants.apiBaseUrl,
        connectTimeout: Duration(milliseconds: AppConstants.connectTimeout),
        receiveTimeout: Duration(milliseconds: AppConstants.receiveTimeout),
        headers: const {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _secureStorage.read(key: AppConstants.tokenKey);
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final status = error.response?.statusCode;
          if (status == 401 &&
              !error.requestOptions.path.contains('/auth/refresh-token')) {
            final refreshed = await refreshToken();
            if (refreshed) {
              final token = await _secureStorage.read(
                key: AppConstants.tokenKey,
              );
              final retryOptions = error.requestOptions;
              retryOptions.headers['Authorization'] = 'Bearer $token';
              try {
                final response = await _dio.fetch<dynamic>(retryOptions);
                return handler.resolve(response);
              } catch (_) {
                return handler.next(error);
              }
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  late final Dio _dio;

  dynamic _data(Response<dynamic> response) {
    final body = response.data;
    if (body is Map && body['success'] == false) {
      throw DebateApiException(body['message']?.toString() ?? 'Request failed');
    }
    if (body is Map && body.containsKey('data')) return body['data'];
    return body;
  }

  DebateApiException _error(Object error) {
    if (error is DebateApiException) return error;
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['message'] != null) {
        return DebateApiException(data['message'].toString());
      }
      final statusCode = error.response?.statusCode;
      if (statusCode == 400) {
        return const DebateApiException('Yêu cầu không hợp lệ');
      }
      if (statusCode == 401) {
        return const DebateApiException('Email hoặc mật khẩu không đúng');
      }
      if (statusCode == 403) {
        return const DebateApiException(
          'Tài khoản không được phép đăng nhập hoặc đã bị khóa',
        );
      }
      if (statusCode == 404) {
        return const DebateApiException('Không tìm thấy API yêu cầu');
      }
      if (statusCode != null && statusCode >= 500) {
        return const DebateApiException('Server đang gặp lỗi');
      }
      return const DebateApiException('Không thể kết nối tới server');
    }
    return DebateApiException(error.toString());
  }

  Future<T> _guard<T>(Future<T> Function() callback) async {
    try {
      return await callback();
    } catch (error) {
      throw _error(error);
    }
  }

  Future<DebateProfile> login(String email, String password) {
    return _guard(() async {
      final data = _asMap(
        _data(
          await _dio.post(
            '/auth/login',
            data: {'email': email, 'password': password},
          ),
        ),
      );
      await _storeTokens(data);
      return DebateProfile.fromJson(_asMap(data['user']));
    });
  }

  Future<DebateProfile> register(
    String username,
    String email,
    String password,
  ) {
    return _guard(() async {
      final data = _asMap(
        _data(
          await _dio.post(
            '/auth/register',
            data: {
              'username': username,
              'email': email,
              'password': password,
              'confirmPassword': password,
            },
          ),
        ),
      );
      await _storeTokens(data);
      return DebateProfile.fromJson(_asMap(data['user']));
    });
  }

  Future<void> forgotPassword(String email) {
    return _guard(() async {
      await _dio.post('/auth/forgot-password', data: {'email': email});
    });
  }

  Future<void> changePassword(String currentPassword, String newPassword) {
    return _guard(() async {
      await _dio.post(
        '/auth/change-password',
        data: {
          'currentPassword': currentPassword,
          'newPassword': newPassword,
          'confirmPassword': newPassword,
        },
      );
    });
  }

  Future<DebateProfile> me() {
    return _guard(
      () async =>
          DebateProfile.fromJson(_asMap(_data(await _dio.get('/auth/me')))),
    );
  }

  Future<bool> hasToken() async {
    final token = await _secureStorage.read(key: AppConstants.tokenKey);
    return token != null && token.isNotEmpty;
  }

  Future<String> accessToken() async {
    return await _secureStorage.read(key: AppConstants.tokenKey) ?? '';
  }

  Future<void> logout() async {
    await _guard(() async {
      try {
        await _dio.post('/auth/logout');
      } catch (_) {}
      await _secureStorage.delete(key: AppConstants.tokenKey);
      await _secureStorage.delete(key: AppConstants.refreshTokenKey);
    });
  }

  Future<bool> refreshToken() async {
    final refreshToken = await _secureStorage.read(
      key: AppConstants.refreshTokenKey,
    );
    if (refreshToken == null || refreshToken.isEmpty) return false;
    try {
      final data = _asMap(
        _data(
          await _dio.post(
            '/auth/refresh-token',
            data: {'refreshToken': refreshToken},
          ),
        ),
      );
      await _storeTokens(data);
      return true;
    } catch (_) {
      await _secureStorage.delete(key: AppConstants.tokenKey);
      await _secureStorage.delete(key: AppConstants.refreshTokenKey);
      return false;
    }
  }

  Future<void> _storeTokens(Map<String, dynamic> data) async {
    final accessToken = _readString(data, ['accessToken', 'token']);
    final refreshToken = _readString(data, ['refreshToken']);
    if (accessToken.isNotEmpty) {
      await _secureStorage.write(
        key: AppConstants.tokenKey,
        value: accessToken,
      );
    }
    if (refreshToken.isNotEmpty) {
      await _secureStorage.write(
        key: AppConstants.refreshTokenKey,
        value: refreshToken,
      );
    }
  }

  Future<RankingSummary> rankingForUser(String userId) {
    return _guard(
      () async => RankingSummary.fromJson(
        _asMap(_data(await _dio.get('/rankings/user/$userId'))),
      ),
    );
  }

  Future<List<LeaderboardEntry>> leaderboard() {
    return _guard(() async {
      final data = _data(
        await _dio.get('/rankings/leaderboard', queryParameters: {'limit': 50}),
      );
      return _asList(
        data,
      ).map((item) => LeaderboardEntry.fromJson(_asMap(item))).toList();
    });
  }

  Future<DebateProfile> profile(String userId) {
    return _guard(
      () async => DebateProfile.fromJson(
        _asMap(_data(await _dio.get('/users/$userId'))),
      ),
    );
  }

  Future<DebateProfile> updateProfile(String userId, Map<String, String> data) {
    return _guard(
      () async => DebateProfile.fromJson(
        _asMap(_data(await _dio.put('/users/$userId/profile', data: data))),
      ),
    );
  }

  Future<List<HistoryItem>> history(String userId) {
    return _guard(() async {
      final data = _data(
        await _dio.get(
          '/users/$userId/history',
          queryParameters: {'limit': 30},
        ),
      );
      return _asList(
        data,
      ).map((item) => HistoryItem.fromJson(_asMap(item))).toList();
    });
  }

  Future<QueueStatus> joinQueue(String format) {
    return _guard(() async {
      final data = _data(
        await _dio.post('/matchmaking/queue', data: {'format': format}),
      );
      return QueueStatus.fromJson(_asMap(data));
    });
  }

  Future<QueueStatus> queueStatus() {
    return _guard(
      () async => QueueStatus.fromJson(
        _asMap(_data(await _dio.get('/matchmaking/status'))),
      ),
    );
  }

  Future<void> leaveQueue() {
    return _guard(() async {
      await _dio.delete('/matchmaking/queue');
    });
  }

  Future<List<DebateRoomModel>> rooms({String? status}) {
    return _guard(() async {
      final data = _data(
        await _dio.get(
          '/rooms',
          queryParameters: {'status': ?status, 'limit': 20},
        ),
      );
      return _asList(
        data,
      ).map((item) => DebateRoomModel.fromJson(_asMap(item))).toList();
    });
  }

  Future<DebateRoomModel> room(String roomId) {
    return _guard(
      () async => DebateRoomModel.fromJson(
        _asMap(_data(await _dio.get('/rooms/$roomId'))),
      ),
    );
  }

  Future<DebateRoomModel> createRoom({
    required String title,
    required String motion,
    required String format,
  }) {
    return _guard(() async {
      final data = _data(
        await _dio.post(
          '/rooms/create',
          data: {
            'title': title,
            'motion': motion,
            'format': format,
            'hostType': 'human',
            'judgeType': 'ai',
            'isPrivate': false,
          },
        ),
      );
      return DebateRoomModel.fromJson(_asMap(data));
    });
  }

  Future<DebateRoomModel> joinRoom(String roomId) {
    return _guard(
      () async => DebateRoomModel.fromJson(
        _asMap(_data(await _dio.post('/rooms/$roomId/join', data: {}))),
      ),
    );
  }

  Future<DebateRoomModel> selectPosition(
    String roomId,
    String team,
    String speakerSlot,
  ) {
    return _guard(() async {
      final data = _data(
        await _dio.post(
          '/rooms/$roomId/position',
          data: {'team': team, 'speakerSlot': speakerSlot},
        ),
      );
      return DebateRoomModel.fromJson(_asMap(data));
    });
  }

  Future<void> lockRoom(String roomId) =>
      _guard(() async => _dio.post('/rooms/$roomId/lock'));

  Future<void> startRoom(String roomId) =>
      _guard(() async => _dio.post('/rooms/$roomId/start'));

  Future<Map<String, dynamic>> session(String roomId) {
    return _guard(
      () async => _asMap(_data(await _dio.get('/rooms/$roomId/session'))),
    );
  }

  Future<void> surrender(String roomId) =>
      _guard(() async => _dio.post('/debate/$roomId/surrender'));

  Future<void> requestDraw(String roomId) =>
      _guard(() async => _dio.post('/debate/$roomId/draw/request'));

  Future<void> submitJudgeScore(String roomId, Map<String, dynamic> data) {
    return _guard(
      () async =>
          _dio.post('/rooms/$roomId/judge/submit-round-scores', data: data),
    );
  }

  Future<SessionResult> result(String roomId) {
    return _guard(() async {
      DebateRoomModel? roomModel;
      Map<String, dynamic> sessionData = {};
      Map<String, dynamic> scoreData = {};
      try {
        roomModel = await room(roomId);
      } catch (_) {}
      try {
        sessionData = await session(roomId);
      } catch (_) {}
      try {
        scoreData = _asMap(_data(await _dio.get('/rooms/$roomId/scores')));
      } catch (_) {}
      return SessionResult(
        room: roomModel,
        session: sessionData,
        finalScores: _asMap(scoreData['finalScores']),
      );
    });
  }
}
