import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ofai_flutter/widgets/tap_scale.dart';

void main() {
  group('TapScale', () {
    testWidgets('renders child widget', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: TapScale(
              child: Text('Tap me'),
            ),
          ),
        ),
      );

      expect(find.text('Tap me'), findsOneWidget);
    });

    testWidgets('calls onTap when tapped', (tester) async {
      var tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TapScale(
              onTap: () => tapped = true,
              child: const Text('Tap me'),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Tap me'));
      await tester.pumpAndSettle();

      expect(tapped, true);
    });

    testWidgets('does not crash when onTap is null', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: TapScale(
              child: Text('No tap handler'),
            ),
          ),
        ),
      );

      await tester.tap(find.text('No tap handler'));
      await tester.pumpAndSettle();

      // No crash = pass
      expect(find.text('No tap handler'), findsOneWidget);
    });

    testWidgets('contains ScaleTransition', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: TapScale(
              child: Text('Scale me'),
            ),
          ),
        ),
      );

      expect(find.byType(ScaleTransition), findsAtLeastNWidgets(1));
    });
  });
}
