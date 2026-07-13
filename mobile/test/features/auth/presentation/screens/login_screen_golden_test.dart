import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:golden_toolkit/golden_toolkit.dart';
import 'package:flutter_riverpod_clean_architecture/core/theme/app_theme.dart';
import 'package:flutter_riverpod_clean_architecture/features/auth/presentation/screens/login_screen.dart';

void main() {
  testGoldens('LoginScreen golden test', (tester) async {
    final builder = DeviceBuilder()
      ..overrideDevicesForAllScenarios(
        devices: [Device.phone, Device.iphone11, Device.tabletPortrait],
      )
      ..addScenario(
        widget: ProviderScope(
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: AppTheme.lightTheme,
            home: const LoginScreen(),
          ),
        ),
        name: 'default_login_state',
      );

    await tester.pumpDeviceBuilder(builder);

    await screenMatchesGolden(tester, 'login_screen');
  });
}
