import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/core/constants/app_constants.dart';
import 'package:flutter_riverpod_clean_architecture/core/providers/localization_providers.dart';
import 'package:flutter_riverpod_clean_architecture/core/utils/adaptive_feedback.dart';
import 'package:flutter_riverpod_clean_architecture/features/auth/presentation/providers/auth_provider.dart';
import 'package:flutter_riverpod_clean_architecture/core/localization/language_selector_widget.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/ios_debate_widgets.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/screen_state_widgets.dart';
import 'package:go_router/go_router.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    final confirmed = await AdaptiveFeedback.confirm(
      context,
      title: 'Đăng xuất?',
      message: 'Phiên đăng nhập trên thiết bị này sẽ kết thúc.',
      cancelLabel: 'Ở lại',
      confirmLabel: 'Đăng xuất',
      destructive: true,
    );
    if (!confirmed || !context.mounted) return;

    await ref.read(authProvider.notifier).logout();
    if (!context.mounted) return;
    final error = ref.read(authProvider).errorMessage;
    if (error != null) {
      showDebateSnack(context, error);
      return;
    }
    context.go(AppConstants.loginRoute);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(persistentLocaleProvider);
    final userId = ref.watch(authProvider).user?.id ?? '';

    return DebatePage(
      title: 'Cài đặt',
      subtitle: 'Thiết lập không gian tranh biện của bạn.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const DebateSectionTitle(title: 'Tài khoản'),
          _SettingsTile(
            icon: Icons.person_outline_rounded,
            color: DebateColors.accent,
            title: 'Hồ sơ cá nhân',
            subtitle: 'Cập nhật tên, bio, trường và câu lạc bộ',
            onTap: userId.isEmpty
                ? null
                : () =>
                      context.push('${AppConstants.profileRoute}/$userId/edit'),
          ),
          const SizedBox(height: 10),
          _SettingsTile(
            icon: Icons.lock_reset_rounded,
            color: DebateColors.indigo,
            title: 'Đổi mật khẩu',
            subtitle: 'Bảo vệ tài khoản của bạn',
            onTap: () => context.push(AppConstants.changePasswordRoute),
          ),
          const SizedBox(height: 20),
          const DebateSectionTitle(title: 'Trải nghiệm'),
          _SettingsTile(
            icon: Icons.language_rounded,
            color: DebateColors.amber,
            title: 'Ngôn ngữ',
            subtitle: 'Đang dùng ${locale.languageCode.toUpperCase()}',
            onTap: () async {
              final selected = await LanguageSelectorDialog.show(context);
              if (selected != null && context.mounted) {
                showDebateSnack(
                  context,
                  'Đã chuyển ngôn ngữ sang ${selected.languageCode.toUpperCase()}',
                );
              }
            },
          ),
          const SizedBox(height: 10),
          const _SettingsTile(
            icon: Icons.bolt_rounded,
            color: DebateColors.accent,
            title: 'Giao diện',
            subtitle: 'Cyberpunk Neon Dark · đồng bộ với DebateHub web',
            trailing: DebatePill(label: 'ACTIVE', icon: Icons.check_rounded),
          ),
          const SizedBox(height: 20),
          const DebateSectionTitle(title: 'Hệ thống'),
          const _SettingsTile(
            icon: Icons.memory_rounded,
            color: DebateColors.mint,
            title: 'DebateHub Mobile',
            subtitle: 'Phiên bản ${AppConstants.appVersion}',
            trailing: DebatePill(label: 'ONLINE', icon: Icons.wifi_rounded),
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: DebateColors.rose,
                side: const BorderSide(color: DebateColors.rose),
              ),
              onPressed: () => _signOut(context, ref),
              icon: const Icon(Icons.logout_rounded),
              label: const Text('Đăng xuất khỏi thiết bị này'),
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.onTap,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return DebateCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  color.withValues(alpha: 0.22),
                  color.withValues(alpha: 0.08),
                ],
              ),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: color.withValues(alpha: 0.3)),
            ),
            child: Icon(icon, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          trailing ??
              Icon(
                Icons.chevron_right_rounded,
                color: onTap == null ? DebateColors.muted : color,
              ),
        ],
      ),
    );
  }
}
