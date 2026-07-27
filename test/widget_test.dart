import 'package:flutter_test/flutter_test.dart';
import 'package:sentinelwatch_mobile/app.dart';

void main() {
  testWidgets('App boots to splash / gate', (WidgetTester tester) async {
    await tester.pumpWidget(const SentinelWatchApp());
    expect(find.textContaining('SentinelWatch'), findsWidgets);
    await tester.pump(const Duration(milliseconds: 100));
  });
}
