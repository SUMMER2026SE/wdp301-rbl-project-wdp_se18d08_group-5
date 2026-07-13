import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

/// Platform-appropriate transient feedback and confirmation prompts.
class AdaptiveFeedback {
  const AdaptiveFeedback._();

  static const _toastSurface = Color(0xFF1A1A2E);
  static const _toastText = Color(0xFFE0E0FF);
  static const _toastAccent = Color(0xFF00F5FF);

  static bool isCupertino(BuildContext context) =>
      Theme.of(context).platform == TargetPlatform.iOS;

  static void showSnackBar(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 2),
    Color? backgroundColor,
    SnackBarAction? action,
  }) {
    if (!isCupertino(context)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          duration: duration,
          backgroundColor: backgroundColor,
          action: action,
        ),
      );
      return;
    }

    final overlay = Overlay.of(context, rootOverlay: true);
    late final OverlayEntry entry;
    entry = OverlayEntry(
      builder: (overlayContext) => Positioned(
        left: 20,
        right: 20,
        bottom: 24,
        child: SafeArea(
          top: false,
          child: Align(
            alignment: Alignment.bottomCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: MediaQuery(
                data: MediaQuery.of(overlayContext).copyWith(
                  textScaler: MediaQuery.textScalerOf(
                    overlayContext,
                  ).clamp(maxScaleFactor: 1.2),
                ),
                child: Semantics(
                  liveRegion: true,
                  label: message,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: backgroundColor ?? _toastSurface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: _toastAccent.withValues(alpha: 0.3),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.32),
                          blurRadius: 18,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            CupertinoIcons.checkmark_circle_fill,
                            color: _toastAccent,
                            size: 20,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              message,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: _toastText,
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                height: 1.25,
                              ),
                            ),
                          ),
                          if (action != null) ...[
                            const SizedBox(width: 4),
                            CupertinoButton(
                              minimumSize: const Size(0, 32),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                              ),
                              onPressed: () {
                                if (entry.mounted) entry.remove();
                                action.onPressed();
                              },
                              child: Text(
                                action.label,
                                style: const TextStyle(
                                  color: _toastAccent,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    overlay.insert(entry);
    Future<void>.delayed(duration, () {
      if (entry.mounted) entry.remove();
    });
  }

  static Future<bool> confirm(
    BuildContext context, {
    required String title,
    required String message,
    required String cancelLabel,
    required String confirmLabel,
    bool destructive = false,
  }) async {
    if (isCupertino(context)) {
      return (await showCupertinoDialog<bool>(
            context: context,
            builder: (dialogContext) => CupertinoAlertDialog(
              title: Text(title),
              content: Text(message),
              actions: [
                CupertinoDialogAction(
                  onPressed: () => Navigator.of(dialogContext).pop(false),
                  child: Text(cancelLabel),
                ),
                CupertinoDialogAction(
                  isDestructiveAction: destructive,
                  onPressed: () => Navigator.of(dialogContext).pop(true),
                  child: Text(confirmLabel),
                ),
              ],
            ),
          )) ??
          false;
    }

    return (await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: Text(title),
            content: Text(message),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: Text(cancelLabel),
              ),
              FilledButton(
                style: destructive
                    ? FilledButton.styleFrom(
                        backgroundColor: Theme.of(context).colorScheme.error,
                      )
                    : null,
                onPressed: () => Navigator.of(dialogContext).pop(true),
                child: Text(confirmLabel),
              ),
            ],
          ),
        )) ??
        false;
  }
}
