import 'dart:convert';

import 'package:sentinelwatch_mobile/models/crisis_event.dart';
import 'package:shared_preferences/shared_preferences.dart';

class OfflineCacheService {
  static const _eventsKey = 'sw_cached_events';

  Future<void> saveEvents(List<CrisisEvent> events) async {
    final prefs = await SharedPreferences.getInstance();
    final payload = jsonEncode(events.map((e) => e.toJson()).toList());
    await prefs.setString(_eventsKey, payload);
  }

  Future<List<CrisisEvent>> loadEvents() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_eventsKey);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list
          .whereType<Map>()
          .map((e) => CrisisEvent.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (_) {
      return const [];
    }
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_eventsKey);
  }
}
