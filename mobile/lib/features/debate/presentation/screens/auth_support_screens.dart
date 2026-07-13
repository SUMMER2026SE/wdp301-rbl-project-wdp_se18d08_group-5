import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/features/auth/presentation/providers/auth_provider.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/ios_debate_widgets.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/screen_state_widgets.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _email = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    return DebatePage(
      title: 'Quên mật khẩu',
      subtitle: 'Nhập email để nhận hướng dẫn đặt lại mật khẩu.',
      child: DebateCard(
        child: Column(
          children: [
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Email',
                prefixIcon: Icon(Icons.mail_outline_rounded),
              ),
            ),
            const SizedBox(height: 16),
            DebatePrimaryButton(
              onPressed: auth.isLoading
                  ? null
                  : () async {
                      await ref
                          .read(authProvider.notifier)
                          .forgotPassword(_email.text.trim());
                      if (context.mounted) {
                        showDebateSnack(
                          context,
                          ref.read(authProvider).errorMessage ??
                              'Nếu email tồn tại, hệ thống đã gửi link reset.',
                        );
                      }
                    },
              icon: Icons.email_rounded,
              label: 'Gửi link reset',
              loading: auth.isLoading,
            ),
          ],
        ),
      ),
    );
  }
}

class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() =>
      _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    return DebatePage(
      title: 'Đổi mật khẩu',
      subtitle: 'Cập nhật mật khẩu cho tài khoản hiện tại.',
      child: DebateCard(
        child: Column(
          children: [
            TextField(
              controller: _current,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Mật khẩu hiện tại',
                prefixIcon: Icon(Icons.lock_outline_rounded),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _next,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Mật khẩu mới',
                prefixIcon: Icon(Icons.lock_reset_rounded),
              ),
            ),
            const SizedBox(height: 16),
            DebatePrimaryButton(
              onPressed: auth.isLoading
                  ? null
                  : () async {
                      await ref
                          .read(authProvider.notifier)
                          .changePassword(
                            currentPassword: _current.text,
                            newPassword: _next.text,
                          );
                      if (context.mounted) {
                        showDebateSnack(
                          context,
                          ref.read(authProvider).errorMessage ??
                              'Đã đổi mật khẩu',
                        );
                      }
                    },
              icon: Icons.lock_reset_rounded,
              label: 'Cập nhật',
              loading: auth.isLoading,
            ),
          ],
        ),
      ),
    );
  }
}
