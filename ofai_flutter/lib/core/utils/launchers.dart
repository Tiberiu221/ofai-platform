import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';


class Launchers {
  Launchers._();

  /// Default share origin rect for iPad/iPhone compatibility
  static const _shareOrigin = Rect.fromLTWH(0, 0, 100, 100);

  static Future<void> shareOffer(String title, int offerId) async {
    await Share.shareUri(
      Uri.parse('https://ofai.ro/oferta/$offerId'),
      sharePositionOrigin: _shareOrigin,
    );
  }

  static Future<void> shareBusiness(String name, int businessId) async {
    await Share.shareUri(
      Uri.parse('https://ofai.ro/business/$businessId'),
      sharePositionOrigin: _shareOrigin,
    );
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
    await Share.share(text, sharePositionOrigin: _shareOrigin);
  }
}
