import 'package:flutter/material.dart';
import 'package:sentinelwatch_mobile/screens/onboarding_gate.dart';
import 'package:sentinelwatch_mobile/services/auth_service.dart';
import 'package:sentinelwatch_mobile/theme/app_theme.dart';

class CategoryOnboardingScreen extends StatefulWidget {
  const CategoryOnboardingScreen({super.key, required this.auth});

  final AuthService auth;

  @override
  State<CategoryOnboardingScreen> createState() =>
      _CategoryOnboardingScreenState();
}

class _CategoryOnboardingScreenState extends State<CategoryOnboardingScreen> {
  static const _options = [
    'weather',
    'fire',
    'security',
    'health',
    'quake',
    'flood',
  ];

  final Set<String> _selected = {};

  Future<void> _finish() async {
    await widget.auth.completeOnboarding(_selected.toList());
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => OnboardingGate(auth: widget.auth)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 24),
              const Text(
                'What should we watch?',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.text,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Pick the crisis categories you care about.',
                style: TextStyle(color: AppTheme.muted),
              ),
              const SizedBox(height: 24),
              Expanded(
                child: Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: _options.map((c) {
                    final on = _selected.contains(c);
                    return FilterChip(
                      label: Text(c),
                      selected: on,
                      onSelected: (v) {
                        setState(() {
                          if (v) {
                            _selected.add(c);
                          } else {
                            _selected.remove(c);
                          }
                        });
                      },
                      selectedColor: AppTheme.accent.withValues(alpha: 0.25),
                      checkmarkColor: AppTheme.accent,
                      labelStyle: TextStyle(
                        color: on ? AppTheme.text : AppTheme.muted,
                      ),
                      side: BorderSide(
                        color: on ? AppTheme.accent : AppTheme.border,
                      ),
                      backgroundColor: AppTheme.surface,
                    );
                  }).toList(),
                ),
              ),
              ElevatedButton(
                onPressed: _selected.isEmpty ? null : _finish,
                child: const Text('Start monitoring'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
