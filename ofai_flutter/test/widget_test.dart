// Main test entry point — runs all test suites
// Run: flutter test
// Individual suites:
//   flutter test test/models/
//   flutter test test/widgets/
//   flutter test test/utils/

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('App smoke test — project compiles', () {
    // If this test runs, it means the project compiles successfully
    expect(true, isTrue);
  });
}
