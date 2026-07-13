import 'dart:ui';

import 'package:flutter/material.dart';

class DebateColors {
  // Matches frontend/src/styles/global.css.
  static const ink = Color(0xFFE0E0FF);
  static const textSecondary = Color(0xFFB8B8D8);
  static const muted = Color(0xFF9C9CC0);
  static const line = Color(0x3300F5FF);
  static const canvas = Color(0xFF0A0A0F);
  static const surface = Color(0xFF12121F);
  static const cardHover = Color(0xFF1A1A2E);
  static const accent = Color(0xFF00F5FF);
  static const accentDark = Color(0xFF00D4FF);
  static const mint = Color(0xFF39FF14);
  static const amber = Color(0xFFFFD60A);
  static const rose = Color(0xFFFF006E);
  static const indigo = Color(0xFFBF00FF);
}

/// The shared background used by every route. It keeps the dark neon visual
/// system present without competing with the content placed above it.
class CyberBackdrop extends StatelessWidget {
  const CyberBackdrop({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: RadialGradient(
          center: Alignment(-0.85, -0.9),
          radius: 1.25,
          colors: [Color(0xFF10182B), DebateColors.canvas],
          stops: [0, 0.7],
        ),
      ),
      child: Stack(
        children: [
          const Positioned.fill(
            child: IgnorePointer(
              child: RepaintBoundary(
                child: CustomPaint(painter: _CyberGridPainter()),
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

class _CyberGridPainter extends CustomPainter {
  const _CyberGridPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final horizontal = Paint()
      ..color = DebateColors.accent.withValues(alpha: 0.025)
      ..strokeWidth = 1;
    final vertical = Paint()
      ..color = DebateColors.indigo.withValues(alpha: 0.02)
      ..strokeWidth = 1;

    const gap = 44.0;
    for (double y = 0; y < size.height; y += gap) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), horizontal);
    }
    for (double x = 0; x < size.width; x += gap) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), vertical);
    }
  }

  @override
  bool shouldRepaint(covariant _CyberGridPainter oldDelegate) => false;
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
          title: Text(
            title.toUpperCase(),
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: DebateColors.ink,
              letterSpacing: 1.1,
            ),
          ),
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
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'DEBATE NETWORK',
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(
                                  color: DebateColors.accent,
                                  letterSpacing: 1.2,
                                ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            subtitle!,
                            style: Theme.of(context).textTheme.bodyMedium,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
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
      body: CyberBackdrop(
        child: onRefresh == null
            ? content
            : RefreshIndicator(onRefresh: onRefresh!, child: content),
      ),
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
    final radius = BorderRadius.circular(22);
    final card = DecoratedBox(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF17172A), DebateColors.surface],
        ),
        borderRadius: radius,
        border: Border.all(color: DebateColors.line),
        boxShadow: [
          BoxShadow(
            color: DebateColors.accent.withValues(alpha: 0.045),
            blurRadius: 28,
            spreadRadius: -8,
            offset: const Offset(0, 14),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.24),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            left: 22,
            right: 22,
            top: 0,
            child: Container(
              height: 1,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.transparent,
                    DebateColors.accent,
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Padding(padding: padding, child: child),
        ],
      ),
    );
    return Material(
      color: Colors.transparent,
      borderRadius: radius,
      clipBehavior: Clip.antiAlias,
      child: InkWell(onTap: onTap, child: card),
    );
  }
}

class DebateGlassBar extends StatelessWidget {
  const DebateGlassBar({super.key, required this.child});

  final Widget child;

  static const _shape = RoundedRectangleBorder(
    borderRadius: BorderRadius.all(Radius.circular(28)),
  );

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      shape: _shape,
      clipBehavior: Clip.antiAlias,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: DebateColors.cardHover.withValues(alpha: 0.94),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: DebateColors.line),
            boxShadow: [
              BoxShadow(
                color: DebateColors.accent.withValues(alpha: 0.08),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
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
        gradient: LinearGradient(
          colors: [
            color.withValues(alpha: 0.19),
            color.withValues(alpha: 0.08),
          ],
        ),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.28)),
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
      backgroundColor: DebateColors.cardHover,
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
      padding: const EdgeInsets.fromLTRB(2, 10, 2, 10),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 20,
            decoration: BoxDecoration(
              color: DebateColors.accent,
              borderRadius: BorderRadius.circular(4),
              boxShadow: [
                BoxShadow(
                  color: DebateColors.accent.withValues(alpha: 0.5),
                  blurRadius: 8,
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title.toUpperCase(),
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(letterSpacing: 0.8),
            ),
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
