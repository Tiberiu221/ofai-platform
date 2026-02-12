import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../network/api_endpoints.dart';

class Launchers {
  Launchers._();

  static Future<void> shareOffer(String title, int offerId) async {
    final url = '${ApiEndpoints.prodUrl}/offer/$offerId';
    await Share.share('$title\n$url', subject: title);
  }

  static Future<void> shareBusiness(String name, int businessId) async {
    final url = '${ApiEndpoints.prodUrl}/business/$businessId';
    await Share.share('$name\n$url', subject: name);
  }

  static Future<void> call(String phone) async {
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  static Future<void> whatsApp(String number) async {
    final cleaned = number.replaceAll(RegExp(r'[^\d+]'), '');
    final uri = Uri.parse('https://wa.me/$cleaned');
    if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  static Future<void> website(String url) async {
    var target = url;
    if (!target.startsWith('http')) target = 'https://$target';
    final uri = Uri.parse(target);
    if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  static Future<void> maps(double lat, double lng, {String? address}) async {
    final query = address != null ? Uri.encodeComponent(address) : '$lat,$lng';
    final uri = Uri.parse('geo:$lat,$lng?q=$query');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      // Fallback to Google Maps web
      final webUri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng');
      if (await canLaunchUrl(webUri)) await launchUrl(webUri, mode: LaunchMode.externalApplication);
    }
  }

  static Future<void> shareText(String text) async {
    await Share.share(text);
  }
}
