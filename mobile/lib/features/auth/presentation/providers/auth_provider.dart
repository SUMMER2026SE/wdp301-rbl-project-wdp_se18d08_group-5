import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/features/auth/domain/entities/user_entity.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/data/repositories/debate_repository_impl.dart';

// Auth state
class AuthState {
  final bool isAuthenticated;
  final bool isLoading;
  final UserEntity? user;
  final String? errorMessage;

  const AuthState({
    this.isAuthenticated = false,
    this.isLoading = false,
    this.user,
    this.errorMessage,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    bool? isLoading,
    UserEntity? user,
    String? errorMessage,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isLoading: isLoading ?? this.isLoading,
      user: user ?? this.user,
      errorMessage: errorMessage,
    );
  }
}

// Auth notifier
// Auth notifier
class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() {
    return const AuthState();
  }

  // Check auth status
  Future<void> checkAuthStatus() async {
    final api = ref.read(debateRepositoryProvider);
    final hasToken = await api.hasToken();
    if (!hasToken) {
      state = const AuthState(isAuthenticated: false, isLoading: false);
      return;
    }
    try {
      final profile = await api.me();
      state = AuthState(
        isAuthenticated: true,
        isLoading: false,
        user: profile.toUserEntity(),
      );
    } catch (error) {
      await api.logout();
      state = AuthState(
        isAuthenticated: false,
        isLoading: false,
        errorMessage: error.toString(),
      );
    }
  }

  // Login
  Future<void> login({required String email, required String password}) async {
    state = state.copyWith(isLoading: true, errorMessage: null);

    try {
      final profile = await ref
          .read(debateRepositoryProvider)
          .login(email, password);
      state = state.copyWith(
        isLoading: false,
        isAuthenticated: true,
        user: profile.toUserEntity(),
        errorMessage: null,
      );
    } catch (error) {
      state = state.copyWith(
        isLoading: false,
        isAuthenticated: false,
        errorMessage: error.toString(),
      );
    }
  }

  // Register
  Future<void> register({
    required String name,
    required String email,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);

    try {
      final profile = await ref
          .read(debateRepositoryProvider)
          .register(name, email, password);
      state = state.copyWith(
        isLoading: false,
        isAuthenticated: true,
        user: profile.toUserEntity(),
        errorMessage: null,
      );
    } catch (error) {
      state = state.copyWith(
        isLoading: false,
        isAuthenticated: false,
        errorMessage: error.toString(),
      );
    }
  }

  // Logout
  Future<void> logout() async {
    state = state.copyWith(isLoading: true, errorMessage: null);

    try {
      await ref.read(debateRepositoryProvider).logout();
      state = state.copyWith(
        isLoading: false,
        isAuthenticated: false,
        user: null,
        errorMessage: null,
      );
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  Future<void> forgotPassword(String email) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await ref.read(debateRepositoryProvider).forgotPassword(email);
      state = state.copyWith(isLoading: false, errorMessage: null);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await ref
          .read(debateRepositoryProvider)
          .changePassword(currentPassword, newPassword);
      state = state.copyWith(isLoading: false, errorMessage: null);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }
}

// Auth provider
final authProvider = NotifierProvider<AuthNotifier, AuthState>(
  AuthNotifier.new,
);
