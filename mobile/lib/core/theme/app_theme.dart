import 'package:flutter/material.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/ios_debate_widgets.dart';

/// Mobile implementation of the neon dark palette in frontend/src/styles/global.css.
class AppTheme {
  // Use the platform font so Vietnamese glyphs render consistently on iOS,
  // Android and golden-test environments.
  static const String? _fontFamily = null;

  static final _neonTheme = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    fontFamily: _fontFamily,
    scaffoldBackgroundColor: Colors.transparent,
    colorScheme:
        ColorScheme.fromSeed(
          seedColor: DebateColors.accent,
          brightness: Brightness.dark,
        ).copyWith(
          primary: DebateColors.accent,
          onPrimary: DebateColors.canvas,
          secondary: DebateColors.indigo,
          onSecondary: Colors.white,
          surface: DebateColors.surface,
          onSurface: DebateColors.ink,
          error: DebateColors.rose,
          onError: Colors.white,
        ),
    appBarTheme: const AppBarTheme(
      centerTitle: false,
      elevation: 0,
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      foregroundColor: DebateColors.ink,
      titleTextStyle: TextStyle(
        color: DebateColors.ink,
        fontSize: 18,
        fontWeight: FontWeight.w800,
      ),
    ),
    textTheme: const TextTheme(
      displaySmall: TextStyle(
        fontSize: 34,
        fontWeight: FontWeight.w800,
        color: DebateColors.ink,
      ),
      headlineMedium: TextStyle(
        fontSize: 28,
        fontWeight: FontWeight.w800,
        color: DebateColors.ink,
      ),
      titleLarge: TextStyle(
        fontSize: 22,
        fontWeight: FontWeight.w800,
        color: DebateColors.ink,
      ),
      titleMedium: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        color: DebateColors.ink,
      ),
      bodyLarge: TextStyle(
        fontSize: 16,
        height: 1.45,
        color: DebateColors.textSecondary,
      ),
      bodyMedium: TextStyle(
        fontSize: 14,
        height: 1.45,
        color: DebateColors.muted,
      ),
      labelLarge: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
      labelMedium: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        elevation: 0,
        minimumSize: const Size.fromHeight(52),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: DebateColors.accent,
        foregroundColor: DebateColors.canvas,
        minimumSize: const Size.fromHeight(52),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: DebateColors.accent,
        minimumSize: const Size(44, 44),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: DebateColors.accent,
        minimumSize: const Size.fromHeight(52),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        side: const BorderSide(color: DebateColors.line),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
      ),
    ),
    sliderTheme: SliderThemeData(
      activeTrackColor: DebateColors.accent,
      inactiveTrackColor: DebateColors.line,
      thumbColor: DebateColors.accent,
      overlayColor: DebateColors.accent.withValues(alpha: 0.16),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: DebateColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: DebateColors.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: DebateColors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: DebateColors.accent, width: 1.4),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 17),
    ),
    cardTheme: CardThemeData(
      color: DebateColors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: DebateColors.cardHover,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 70,
      elevation: 0,
      backgroundColor: Colors.transparent,
      indicatorColor: DebateColors.accent.withValues(alpha: 0.14),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 11,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w800
              : FontWeight.w600,
          color: states.contains(WidgetState.selected)
              ? DebateColors.accent
              : DebateColors.muted,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          size: 22,
          color: states.contains(WidgetState.selected)
              ? DebateColors.accent
              : DebateColors.muted,
        ),
      ),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: SegmentedButton.styleFrom(
        backgroundColor: DebateColors.surface,
        selectedBackgroundColor: DebateColors.accent.withValues(alpha: 0.14),
        selectedForegroundColor: DebateColors.accent,
        side: const BorderSide(color: DebateColors.line),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: DebateColors.line,
      thickness: 1,
    ),
  );

  // The web app uses a single neon dark palette, so both platform modes share it.
  static final ThemeData lightTheme = _neonTheme;
  static final ThemeData darkTheme = _neonTheme;
}
