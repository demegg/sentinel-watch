import 'package:flutter/material.dart';
import 'package:sentinelwatch_mobile/screens/onboarding_gate.dart';
import 'package:sentinelwatch_mobile/services/auth_service.dart';
import 'package:sentinelwatch_mobile/services/offline_cache_service.dart';
import 'package:sentinelwatch_mobile/theme/app_theme.dart';
import 'package:url_launcher/url_launcher.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key, required this.auth});

  final AuthService auth;

  Future<void> _logout(BuildContext context) async {
    await auth.logout();
    if (!context.mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => OnboardingGate(auth: auth)),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          ListTile(
            title: const Text('Signed in as'),
            subtitle: Text(auth.email ?? '—'),
          ),
          ListTile(
            title: const Text('Categories'),
            subtitle: Text(
              auth.categories.isEmpty
                  ? 'None selected'
                  : auth.categories.join(', '),
            ),
          ),
          const ListTile(
            title: Text('API base URL'),
            subtitle: Text(AuthService.apiBaseUrl),
          ),
          const Divider(color: AppTheme.border),
          ListTile(
            leading: const Icon(Icons.delete_outline),
            title: const Text('Clear offline cache'),
            onTap: () async {
              await OfflineCacheService().clear();
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Cache cleared')),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.open_in_new),
            title: const Text('Open docs'),
            onTap: () => launchUrl(Uri.parse('https://flutter.dev')),
          ),
          ListTile(
            leading: const Icon(Icons.logout, color: AppTheme.accent),
            title: const Text('Log out', style: TextStyle(color: AppTheme.accent)),
            onTap: () => _logout(context),
          ),
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'SentinelWatch Mobile v1.4.0',
              style: TextStyle(color: AppTheme.muted),
            ),
          ),
        ],
      ),
    );
  }
}
