import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:sentinelwatch_mobile/models/crisis_event.dart';
import 'package:sentinelwatch_mobile/services/auth_service.dart';
import 'package:sentinelwatch_mobile/services/offline_cache_service.dart';

class CrisisDataService {
  CrisisDataService({
    required this.auth,
    OfflineCacheService? cache,
  }) : cache = cache ?? OfflineCacheService();

  final AuthService auth;
  final OfflineCacheService cache;

  Future<List<CrisisEvent>> fetchEvents({List<String>? categories}) async {
    try {
      final uri = Uri.parse('${AuthService.apiBaseUrl}/crises').replace(
        queryParameters: {
          if (categories != null && categories.isNotEmpty)
            'categories': categories.join(','),
        },
      );
      final res = await http
          .get(
            uri,
            headers: {
              'Accept': 'application/json',
              if (auth.token != null) 'Authorization': 'Bearer ${auth.token}',
            },
          )
          .timeout(const Duration(seconds: 10));
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final decoded = jsonDecode(res.body);
        final list = decoded is List
            ? decoded
            : (decoded['items'] as List? ?? const []);
        final events = list
            .whereType<Map>()
            .map((e) => CrisisEvent.fromJson(Map<String, dynamic>.from(e)))
            .toList();
        await cache.saveEvents(events);
        return events;
      }
    } catch (_) {}

    final cached = await cache.loadEvents();
    if (cached.isNotEmpty) return cached;
    return _demoEvents;
  }

  static final List<CrisisEvent> _demoEvents = [
    CrisisEvent(
      id: '1',
      title: 'Flash flooding advisory',
      category: 'weather',
      latitude: 52.52,
      longitude: 13.405,
      severity: 'high',
      description: 'Heavy rainfall expected across the metro area.',
      updatedAt: DateTime.now().subtract(const Duration(minutes: 12)),
    ),
    CrisisEvent(
      id: '2',
      title: 'Wildfire perimeter update',
      category: 'fire',
      latitude: 34.05,
      longitude: -118.25,
      severity: 'critical',
      description: 'Containment at 35%. Evacuation zone expanded north.',
      updatedAt: DateTime.now().subtract(const Duration(hours: 1)),
    ),
    CrisisEvent(
      id: '3',
      title: 'Civil unrest watch',
      category: 'security',
      latitude: 40.71,
      longitude: -74.01,
      severity: 'moderate',
      description: 'Localized gatherings reported downtown.',
      updatedAt: DateTime.now().subtract(const Duration(hours: 3)),
    ),
  ];
}
