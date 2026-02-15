import 'package:intl/intl.dart';

class Formatters {
  Formatters._();

  static final _dateFormat = DateFormat('dd MMM yyyy', 'ro');
  static final _dateTimeFormat = DateFormat('dd MMM yyyy, HH:mm', 'ro');

  static String date(DateTime? date) {
    if (date == null) return '';
    return _dateFormat.format(date);
  }

  static String dateTime(DateTime? date) {
    if (date == null) return '';
    return _dateTimeFormat.format(date);
  }

  static String discount(num? percent) {
    if (percent == null) return '';
    return '-${percent.toStringAsFixed(0)}%';
  }

  static String price(num? price, {String currency = 'RON'}) {
    if (price == null) return '';
    return '${price.toStringAsFixed(2)} $currency';
  }

  static String compactNumber(int? count) {
    if (count == null) return '0';
    if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(1)}k';
    }
    return count.toString();
  }

  /// Returns urgency text for offers ending soon, null if > 7 days away
  static String? timeLeft(String? endDateStr) {
    if (endDateStr == null) return null;
    final endDate = DateTime.tryParse(endDateStr);
    if (endDate == null) return null;
    final now = DateTime.now();
    final diff = endDate.difference(now);
    if (diff.isNegative) return 'Expirata';
    if (diff.inHours < 24) return 'Ultima zi!';
    if (diff.inDays == 1) return '1 zi ramasa';
    if (diff.inDays <= 7) return '${diff.inDays} zile ramase';
    return null;
  }

  /// Returns urgency level: 0=none, 1=warning (2-7 days), 2=danger (0-1 day)
  static int urgencyLevel(String? endDateStr) {
    if (endDateStr == null) return 0;
    final endDate = DateTime.tryParse(endDateStr);
    if (endDate == null) return 0;
    final diff = endDate.difference(DateTime.now());
    if (diff.isNegative) return 2;
    if (diff.inHours < 48) return 2;
    if (diff.inDays <= 7) return 1;
    return 0;
  }

  static String timeAgo(DateTime? date) {
    if (date == null) return '';
    final diff = DateTime.now().difference(date);

    if (diff.inDays > 365) return 'acum ${diff.inDays ~/ 365} an${diff.inDays ~/ 365 > 1 ? "i" : ""}';
    if (diff.inDays > 30) return 'acum ${diff.inDays ~/ 30} lun${diff.inDays ~/ 30 > 1 ? "i" : "ă"}';
    if (diff.inDays > 0) return 'acum ${diff.inDays} zi${diff.inDays > 1 ? "le" : ""}';
    if (diff.inHours > 0) return 'acum ${diff.inHours} or${diff.inHours > 1 ? "e" : "ă"}';
    if (diff.inMinutes > 0) return 'acum ${diff.inMinutes} min';
    return 'acum';
  }
}
