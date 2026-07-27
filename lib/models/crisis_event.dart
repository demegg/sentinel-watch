class CrisisEvent {
  const CrisisEvent({
    required this.id,
    required this.title,
    required this.category,
    required this.latitude,
    required this.longitude,
    required this.severity,
    required this.updatedAt,
    this.description = '',
  });

  final String id;
  final String title;
  final String category;
  final double latitude;
  final double longitude;
  final String severity;
  final DateTime updatedAt;
  final String description;

  factory CrisisEvent.fromJson(Map<String, dynamic> json) {
    return CrisisEvent(
      id: '${json['id']}',
      title: (json['title'] ?? 'Untitled') as String,
      category: (json['category'] ?? 'general') as String,
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0,
      severity: (json['severity'] ?? 'moderate') as String,
      description: (json['description'] ?? '') as String,
      updatedAt: DateTime.tryParse('${json['updated_at'] ?? ''}') ??
          DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'category': category,
        'latitude': latitude,
        'longitude': longitude,
        'severity': severity,
        'description': description,
        'updated_at': updatedAt.toIso8601String(),
      };
}
