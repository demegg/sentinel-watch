import 'package:flutter/material.dart';
import 'package:sentinelwatch_mobile/screens/category_onboarding_screen.dart';
import 'package:sentinelwatch_mobile/screens/home_screen.dart';
import 'package:sentinelwatch_mobile/screens/login_screen.dart';
import 'package:sentinelwatch_mobile/services/auth_service.dart';

class OnboardingGate extends StatelessWidget {
  const OnboardingGate({super.key, required this.auth});

  final AuthService auth;

  @override
  Widget build(BuildContext context) {
    if (!auth.isLoggedIn) {
      return LoginScreen(auth: auth);
    }
    if (!auth.onboarded) {
      return CategoryOnboardingScreen(auth: auth);
    }
    return HomeScreen(auth: auth);
  }
}
