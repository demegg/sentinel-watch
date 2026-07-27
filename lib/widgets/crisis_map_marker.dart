import 'package:flutter/material.dart';
import 'package:sentinelwatch_mobile/models/crisis_event.dart';
import 'package:sentinelwatch_mobile/theme/app_theme.dart';

class CrisisMapMarker extends StatelessWidget {
  const CrisisMapMarker({super.key, required this.event});

  final CrisisEvent event;

  Color get _color {
    switch (event.severity) {
      case 'critical':
        return AppTheme.accent;
      case 'high':
        return AppTheme.accentWarm;
      default:
        return const Color(0xFFFBBF24);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 18,
          height: 18,
          decoration: BoxDecoration(
            color: _color,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: _color.withValues(alpha: 0.45),
                blurRadius: 10,
                spreadRadius: 2,
              ),
            ],
            border: Border.all(color: Colors.white, width: 2),
          ),
        ),
      ],
    );
  }
}
