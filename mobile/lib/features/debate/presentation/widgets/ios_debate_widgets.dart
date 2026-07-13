import 'dart:ui';

import 'package:flutter/material.dart';

class DebateColors {
  static const ink = Color(0xFF111827);
  static const muted = Color(0xFF6B7280);
  static const line = Color(0xFFE5E7EB);
  static const canvas = Color(0xFFF6F7FB);
  static const surface = Color(0xFFFFFFFF);
  static const accent = Color(0xFF2563EB);
  static const accentDark = Color(0xFF1D4ED8);
  static const mint = Color(0xFF10B981);
  static const amber = Color(0xFFF59E0B);
  static const rose = Color(0xFFEF4444);
  static const indigo = Color(0xFF4F46E5);
}

class DebatePage extends StatelessWidget {
  const DebatePage({
    super.key,
    required this.title,
    required this.child,
    this.subtitle,
    this.actions = const [],
    this.padding = const EdgeInsets.fromLTRB(20, 8, 20, 24),
    this.onRefresh,
  });

  final String title;
  final String? subtitle;
  final Widget child;
  final List<Widget> actions;
  final EdgeInsets padding;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    final content = CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      slivers: [
        SliverAppBar.large(
          pinned: true,
          centerTitle: false,
          expandedHeight: subtitle == null ? 104 : 132,
          title: Text(title),
          actions: actions,
          flexibleSpace: FlexibleSpaceBar(
            titlePadding: const EdgeInsetsDirectional.only(
              start: 20,
              bottom: 16,
              end: 20,
            ),
            background: subtitle == null
                ? null
                : SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 76, 20, 0),
                      child: Text(
                        subtitle!,
                        style: Theme.of(context).textTheme.bodyMedium,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
          ),
        ),
        SliverPadding(
          padding: padding,
          sliver: SliverToBoxAdapter(child: child),
        ),
      ],
    );

    return Scaffold(
      body: onRefresh == null
          ? content
          : RefreshIndicator(onRefresh: onRefresh!, child: content),
    );
  }
}

class DebateCard extends StatelessWidget {
  const DebateCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
  });

  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Theme.of(context).dividerColor),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Padding(padding: padding, child: child),
    );
    if (onTap == null) return card;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: card,
      ),
    );
  }
}

class DebateGlassBar extends StatelessWidget {
  const DebateGlassBar({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Theme.of(
              context,
            ).colorScheme.surface.withValues(alpha: 0.88),
            border: Border.all(color: Theme.of(context).dividerColor),
          ),
          child: child,
        ),
      ),
    );
  }
}

class DebatePill extends StatelessWidget {
  const DebatePill({
    super.key,
    required this.label,
    this.icon,
    this.color = DebateColors.accent,
  });

  final String label;
  final IconData? icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.11),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class DebateAvatar extends StatelessWidget {
  const DebateAvatar({
    super.key,
    required this.name,
    this.imageUrl = '',
    this.radius = 28,
  });

  final String name;
  final String imageUrl;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final initial = name.trim().isEmpty ? 'U' : name.trim()[0].toUpperCase();
    return CircleAvatar(
      radius: radius,
      backgroundColor: DebateColors.accent.withValues(alpha: 0.11),
      backgroundImage: imageUrl.isEmpty ? null : NetworkImage(imageUrl),
      child: imageUrl.isEmpty
          ? Text(
              initial,
              style: TextStyle(
                color: DebateColors.accent,
                fontWeight: FontWeight.w800,
                fontSize: radius * 0.7,
              ),
            )
          : null,
    );
  }
}

class DebateSectionTitle extends StatelessWidget {
  const DebateSectionTitle({super.key, required this.title, this.trailing});

  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(2, 6, 2, 10),
      child: Row(
        children: [
          Expanded(
            child: Text(title, style: Theme.of(context).textTheme.titleLarge),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

class DebatePrimaryButton extends StatelessWidget {
  const DebatePrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final child = loading
        ? const SizedBox.square(
            dimension: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 20),
                const SizedBox(width: 8),
              ],
              Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
            ],
          );
    return FilledButton(onPressed: loading ? null : onPressed, child: child);
  }
}

class DebateEmptyState extends StatelessWidget {
  const DebateEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return DebateCard(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Icon(icon, size: 36, color: DebateColors.muted),
          const SizedBox(height: 12),
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}
