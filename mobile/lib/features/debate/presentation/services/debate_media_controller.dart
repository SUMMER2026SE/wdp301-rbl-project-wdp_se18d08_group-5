import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:google_mlkit_translation/google_mlkit_translation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart'
    show SpeechListenOptions, SpeechToText;

class DebateCaption {
  const DebateCaption({
    required this.senderName,
    required this.kind,
    required this.language,
    required this.text,
  });

  final String senderName;
  final String kind;
  final String language;
  final String text;
}

class DebateMediaController extends ChangeNotifier {
  DebateMediaController({
    required this.roomId,
    required this.socketBaseUrl,
    required this.accessToken,
  });

  static const _videoChannel = 'video';
  static const _rtcConfig = <String, dynamic>{
    'iceServers': [
      {'urls': 'stun:stun.l.google.com:19302'},
    ],
    'sdpSemantics': 'unified-plan',
  };

  final String roomId;
  final String socketBaseUrl;
  final String accessToken;
  final RTCVideoRenderer localRenderer = RTCVideoRenderer();
  final Map<String, RTCVideoRenderer> remoteRenderers = {};
  final Map<String, RTCPeerConnection> _peers = {};
  final Map<String, List<RTCIceCandidate>> _pendingCandidates = {};
  final SpeechToText _speech = SpeechToText();
  final OnDeviceTranslatorModelManager _models =
      OnDeviceTranslatorModelManager();
  final List<DebateCaption> captions = [];

  io.Socket? _socket;
  MediaStream? _localStream;
  bool _disposed = false;
  bool _speechReady = false;
  bool _micOn = false;
  bool _cameraOn = false;
  bool showTranslations = true;
  String sourceLanguage = 'vi';
  String? errorMessage;

  bool get micOn => _micOn;
  bool get cameraOn => _cameraOn;
  bool get isConnected => _socket?.connected ?? false;

  Future<void> initialize() async {
    await localRenderer.initialize();
    _socket = io.io(
      socketBaseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': accessToken})
          .enableReconnection()
          .setReconnectionAttempts(8)
          .setReconnectionDelay(800)
          .build(),
    );
    _socket!
      ..onConnect(_joinChannels)
      ..on('voice:user-joined', _onUserJoined)
      ..on('voice:user-left', _onUserLeft)
      ..on('voice:offer', _onOffer)
      ..on('voice:answer', _onAnswer)
      ..on('voice:ice-candidate', _onIceCandidate)
      ..on('translation:caption', _onCaption)
      ..on(
        'connect_error',
        (_) => _setError('Không thể kết nối realtime debate.'),
      )
      ..connect();
  }

  String _key(String? team, String socketId) => '${team ?? 'voice'}:$socketId';

  void _joinChannels([dynamic _]) {
    _joinChannel(null);
    _joinChannel(_videoChannel);
    _safeNotify();
  }

  void _joinChannel(String? team) {
    _socket?.emitWithAck(
      'voice:join',
      {'roomId': roomId, 'team': ?team},
      ack: (data) {
        final peers = data is Map && data['peers'] is List
            ? data['peers'] as List
            : const [];
        for (final value in peers) {
          if (value is Map && value['socketId'] is String) {
            _ensurePeer(team, value['socketId'] as String);
          }
        }
      },
    );
  }

  Future<RTCPeerConnection> _ensurePeer(String? team, String socketId) async {
    final key = _key(team, socketId);
    final current = _peers[key];
    if (current != null) return current;

    final peer = await createPeerConnection(_rtcConfig);
    peer.onIceCandidate = (candidate) {
      if (candidate.candidate == null) return;
      _socket?.emit('voice:ice-candidate', {
        'roomId': roomId,
        'team': ?team,
        'targetSocketId': socketId,
        'candidate': candidate.toMap(),
      });
    };
    peer.onTrack = (event) async {
      if (event.streams.isEmpty || event.track.kind != 'video') return;
      final renderer = remoteRenderers.putIfAbsent(key, RTCVideoRenderer.new);
      await renderer.initialize();
      renderer.srcObject = event.streams.first;
      _safeNotify();
    };
    peer.onConnectionState = (state) {
      if (state == RTCPeerConnectionState.RTCPeerConnectionStateFailed ||
          state == RTCPeerConnectionState.RTCPeerConnectionStateClosed) {
        unawaited(_closePeer(key));
      }
    };
    _peers[key] = peer;
    await _addLocalTracks(peer, team);
    return peer;
  }

  Future<void> _addLocalTracks(RTCPeerConnection peer, String? team) async {
    final stream = _localStream;
    if (stream == null) return;
    final tracks = team == _videoChannel
        ? stream.getVideoTracks()
        : stream.getAudioTracks();
    final senders = await peer.getSenders();
    for (final track in tracks) {
      final sender = senders
          .where((item) => item.track?.kind == track.kind)
          .cast<RTCRtpSender?>()
          .firstWhere((item) => item != null, orElse: () => null);
      if (sender == null) {
        await peer.addTrack(track, stream);
      } else {
        await sender.replaceTrack(track);
      }
    }
  }

  Future<void> _sendOffer(String? team, String socketId) async {
    final peer = await _ensurePeer(team, socketId);
    final offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    _socket?.emit('voice:offer', {
      'roomId': roomId,
      'team': ?team,
      'targetSocketId': socketId,
      'offer': offer.toMap(),
    });
  }

  void _onUserJoined(dynamic payload) {
    if (payload is! Map ||
        payload['roomId'] != roomId ||
        payload['socketId'] is! String) {
      return;
    }
    final team = payload['team'] == _videoChannel ? _videoChannel : null;
    final socketId = payload['socketId'] as String;
    _ensurePeer(team, socketId).then((_) => _sendOffer(team, socketId));
  }

  void _onUserLeft(dynamic payload) {
    if (payload is! Map || payload['socketId'] is! String) return;
    final team = payload['team'] == _videoChannel ? _videoChannel : null;
    unawaited(_closePeer(_key(team, payload['socketId'] as String)));
  }

  Future<void> _onOffer(dynamic payload) async {
    if (payload is! Map ||
        payload['roomId'] != roomId ||
        payload['fromSocketId'] is! String) {
      return;
    }
    final team = payload['team'] == _videoChannel ? _videoChannel : null;
    final socketId = payload['fromSocketId'] as String;
    final offer = payload['offer'];
    if (offer is! Map) return;
    final peer = await _ensurePeer(team, socketId);
    await peer.setRemoteDescription(
      RTCSessionDescription(offer['sdp'] as String?, offer['type'] as String?),
    );
    await _flushCandidates(_key(team, socketId), peer);
    final answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    _socket?.emit('voice:answer', {
      'roomId': roomId,
      'team': ?team,
      'targetSocketId': socketId,
      'answer': answer.toMap(),
    });
  }

  Future<void> _onAnswer(dynamic payload) async {
    if (payload is! Map ||
        payload['roomId'] != roomId ||
        payload['fromSocketId'] is! String) {
      return;
    }
    final answer = payload['answer'];
    if (answer is! Map) return;
    final team = payload['team'] == _videoChannel ? _videoChannel : null;
    final peer = await _ensurePeer(team, payload['fromSocketId'] as String);
    await peer.setRemoteDescription(
      RTCSessionDescription(
        answer['sdp'] as String?,
        answer['type'] as String?,
      ),
    );
    await _flushCandidates(_key(team, payload['fromSocketId'] as String), peer);
  }

  Future<void> _onIceCandidate(dynamic payload) async {
    if (payload is! Map ||
        payload['roomId'] != roomId ||
        payload['fromSocketId'] is! String) {
      return;
    }
    final raw = payload['candidate'];
    if (raw is! Map || raw['candidate'] is! String) return;
    final team = payload['team'] == _videoChannel ? _videoChannel : null;
    final key = _key(team, payload['fromSocketId'] as String);
    final candidate = RTCIceCandidate(
      raw['candidate'] as String,
      raw['sdpMid'] as String?,
      raw['sdpMLineIndex'] as int?,
    );
    final peer = await _ensurePeer(team, payload['fromSocketId'] as String);
    if (await peer.getRemoteDescription() == null) {
      (_pendingCandidates[key] ??= []).add(candidate);
    } else {
      await peer.addCandidate(candidate);
    }
  }

  Future<void> _flushCandidates(String key, RTCPeerConnection peer) async {
    final candidates = _pendingCandidates.remove(key) ?? const [];
    for (final candidate in candidates) {
      await peer.addCandidate(candidate);
    }
  }

  Future<void> toggleMic() => _micOn ? stopMic() : startMic();

  Future<void> startMic() async {
    try {
      await _ensureLocalStream(audio: true);
      _micOn = true;
      await _refreshTrackForChannel(null);
      await _startSpeechCaptions();
      _safeNotify();
    } catch (_) {
      _setError('Không thể bật micro. Hãy kiểm tra quyền Microphone.');
    }
  }

  Future<void> stopMic() async {
    await _stopTracks(kind: 'audio');
    await _refreshTrackForChannel(null);
    await _speech.stop();
    _micOn = false;
    _safeNotify();
  }

  Future<void> toggleCamera() => _cameraOn ? stopCamera() : startCamera();

  Future<void> startCamera() async {
    try {
      await _ensureLocalStream(video: true);
      localRenderer.srcObject = _localStream;
      _cameraOn = true;
      await _refreshTrackForChannel(_videoChannel);
      _socket?.emit('video:state', {
        'roomId': roomId,
        'team': _videoChannel,
        'active': true,
      });
      _safeNotify();
    } catch (_) {
      _setError('Không thể bật camera. Hãy kiểm tra quyền Camera.');
    }
  }

  Future<void> stopCamera() async {
    await _stopTracks(kind: 'video');
    await _refreshTrackForChannel(_videoChannel);
    _cameraOn = false;
    localRenderer.srcObject = null;
    _socket?.emit('video:state', {
      'roomId': roomId,
      'team': _videoChannel,
      'active': false,
    });
    _safeNotify();
  }

  Future<void> _ensureLocalStream({
    bool audio = false,
    bool video = false,
  }) async {
    final current = _localStream;
    final needsAudio =
        audio && (current == null || current.getAudioTracks().isEmpty);
    final needsVideo =
        video && (current == null || current.getVideoTracks().isEmpty);
    if (!needsAudio && !needsVideo) return;
    final captured = await navigator.mediaDevices.getUserMedia({
      'audio': needsAudio
          ? {
              'echoCancellation': true,
              'noiseSuppression': true,
              'autoGainControl': true,
            }
          : false,
      'video': needsVideo
          ? {
              'facingMode': 'user',
              'width': {'ideal': 640},
              'height': {'ideal': 480},
            }
          : false,
    });
    _localStream ??= await createLocalMediaStream('debate-local');
    for (final track in captured.getTracks()) {
      await _localStream!.addTrack(track);
    }
  }

  Future<void> _stopTracks({required String kind}) async {
    final stream = _localStream;
    if (stream == null) return;
    final tracks = kind == 'video'
        ? stream.getVideoTracks()
        : stream.getAudioTracks();
    for (final track in tracks) {
      track.stop();
      await stream.removeTrack(track);
    }
  }

  Future<void> _refreshTrackForChannel(String? team) async {
    for (final entry in _peers.entries.where(
      (entry) => entry.key.startsWith('${team ?? 'voice'}:'),
    )) {
      await _addLocalTracks(entry.value, team);
      final socketId = entry.key.substring(entry.key.indexOf(':') + 1);
      await _sendOffer(team, socketId);
    }
  }

  Future<void> _startSpeechCaptions() async {
    _speechReady =
        _speechReady ||
        await _speech.initialize(
          onError: (_) {},
          onStatus: (status) {
            if (_micOn && status == 'done') {
              unawaited(_startSpeechCaptions());
            }
          },
        );
    if (!_speechReady || _speech.isListening) return;
    await _speech.listen(
      onResult: _onSpeechResult,
      listenOptions: SpeechListenOptions(
        localeId: sourceLanguage == 'vi' ? 'vi_VN' : 'en_US',
        partialResults: true,
        listenFor: const Duration(minutes: 1),
        pauseFor: const Duration(seconds: 3),
      ),
    );
  }

  Future<void> _onSpeechResult(SpeechRecognitionResult result) async {
    if (!result.finalResult || result.recognizedWords.trim().isEmpty) return;
    final source = result.recognizedWords.trim();
    final from = sourceLanguage == 'vi'
        ? TranslateLanguage.vietnamese
        : TranslateLanguage.english;
    final to = sourceLanguage == 'vi'
        ? TranslateLanguage.english
        : TranslateLanguage.vietnamese;
    try {
      await _models.downloadModel(from.bcpCode, isWifiRequired: false);
      await _models.downloadModel(to.bcpCode, isWifiRequired: false);
      final translator = OnDeviceTranslator(
        sourceLanguage: from,
        targetLanguage: to,
      );
      final translated = await translator.translateText(source);
      await translator.close();
      _socket?.emit('translation:text', {
        'roomId': roomId,
        'sourceLanguage': sourceLanguage,
        'sourceText': source,
        'translatedLanguage': sourceLanguage == 'vi' ? 'en' : 'vi',
        'translatedText': translated,
      });
    } catch (_) {
      _socket?.emit('translation:text', {
        'roomId': roomId,
        'sourceLanguage': sourceLanguage,
        'sourceText': source,
      });
      _setError('Phụ đề đã gửi, nhưng chưa tải được model dịch offline.');
    }
  }

  void _onCaption(dynamic payload) {
    if (payload is! Map ||
        payload['roomId'] != roomId ||
        payload['text'] is! String) {
      return;
    }
    captions.insert(
      0,
      DebateCaption(
        senderName: payload['senderName']?.toString() ?? 'Participant',
        kind: payload['kind']?.toString() ?? 'source',
        language: payload['language']?.toString() ?? 'und',
        text: payload['text'] as String,
      ),
    );
    if (captions.length > 12) captions.removeRange(12, captions.length);
    _safeNotify();
  }

  Future<void> _closePeer(String key) async {
    final peer = _peers.remove(key);
    await peer?.close();
    final renderer = remoteRenderers.remove(key);
    await renderer?.dispose();
    _safeNotify();
  }

  void _setError(String message) {
    errorMessage = message;
    _safeNotify();
  }

  void clearError() {
    errorMessage = null;
    _safeNotify();
  }

  void setSourceLanguage(String language) {
    sourceLanguage = language == 'en' ? 'en' : 'vi';
    _safeNotify();
  }

  void setShowTranslations(bool value) {
    showTranslations = value;
    _safeNotify();
  }

  void _safeNotify() {
    if (!_disposed) notifyListeners();
  }

  @override
  Future<void> dispose() async {
    _disposed = true;
    await _speech.stop();
    await _stopTracks(kind: 'audio');
    await _stopTracks(kind: 'video');
    await _localStream?.dispose();
    for (final key in _peers.keys.toList()) {
      await _closePeer(key);
    }
    for (final renderer in remoteRenderers.values) {
      await renderer.dispose();
    }
    await localRenderer.dispose();
    _socket
      ?..emit('voice:leave', {'roomId': roomId})
      ..emit('voice:leave', {'roomId': roomId, 'team': _videoChannel})
      ..dispose();
    super.dispose();
  }
}
