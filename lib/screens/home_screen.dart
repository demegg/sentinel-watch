import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:sentinelwatch_mobile/models/crisis_event.dart';
import 'package:sentinelwatch_mobile/screens/settings_screen.dart';
import 'package:sentinelwatch_mobile/services/auth_service.dart';
import 'package:sentinelwatch_mobile/services/crisis_data_service.dart';
import 'package:sentinelwatch_mobile/theme/app_theme.dart';
import 'package:sentinelwatch_mobile/widgets/crisis_info_sheet.dart';
import 'package:sentinelwatch_mobile/widgets/crisis_map_marker.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.auth});

  final AuthService auth;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final CrisisDataService _data;
  final MapController _map = MapController();
  List<CrisisEvent> _events = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _data = CrisisDataService(auth: widget.auth);
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final events = await _data.fetchEvents(categories: widget.auth.categories);
      if (!mounted) return;
      setState(() {
        _events = events;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _openEvent(CrisisEvent event) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => CrisisInfoSheet(event: event),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('SentinelWatch'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Settings',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => SettingsScreen(auth: widget.auth),
                ),
              );
            },
            icon: const Icon(Icons.settings_outlined),
          ),
        ],
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _map,
            options: const MapOptions(
              initialCenter: LatLng(20, 0),
              initialZoom: 2.4,
              backgroundColor: AppTheme.bg,
            ),
            children: [
              TileLayer(
                urlTemplate:
                    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                subdomains: const ['a', 'b', 'c', 'd'],
                userAgentPackageName: 'com.sentinelwatch.sentinelwatch_mobile',
              ),
              MarkerLayer(
                markers: _events
                    .map(
                      (e) => Marker(
                        point: LatLng(e.latitude, e.longitude),
                        width: 40,
                        height: 40,
                        child: GestureDetector(
                          onTap: () => _openEvent(e),
                          child: CrisisMapMarker(event: e),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ],
          ),
          if (_loading)
            const Positioned(
              top: 12,
              left: 0,
              right: 0,
              child: Center(
                child: Card(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        SizedBox(width: 10),
                        Text('Syncing crises…'),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          if (_error != null)
            Positioned(
              bottom: 24,
              left: 16,
              right: 16,
              child: Card(
                color: AppTheme.surface,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(_error!, style: const TextStyle(color: AppTheme.accent)),
                ),
              ),
            ),
          Positioned(
            left: 16,
            bottom: 24,
            child: Card(
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Text(
                  '${_events.length} events',
                  style: const TextStyle(color: AppTheme.muted),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
