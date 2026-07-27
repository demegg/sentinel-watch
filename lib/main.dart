import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Next.js Sentinel Watch web app — loaded in a full-screen WebView.
const String kWebAppUrl = String.fromEnvironment(
  'WEB_APP_URL',
  defaultValue: 'http://10.124.78.236:3100',
);

Uri get _appUri => Uri.parse(kWebAppUrl);

bool _isAllowedNavigation(Uri uri) {
  final base = _appUri;
  // Same origin as the configured app URL (LAN HTTP or future HTTPS).
  if (uri.scheme == base.scheme &&
      uri.host == base.host &&
      (uri.hasPort ? uri.port : _defaultPort(uri.scheme)) ==
          (base.hasPort ? base.port : _defaultPort(base.scheme))) {
    return true;
  }
  // Allow common HTTPS embeds / media the web app opens in-place.
  if (uri.scheme == 'https') {
    const allowed = {
      'www.youtube.com',
      'youtube.com',
      'www.youtube-nocookie.com',
      'www.dailymotion.com',
      'www.google.com',
      'maps.google.com',
      'earth.google.com',
      'webcams.windy.com',
      'embed.windy.com',
    };
    if (allowed.contains(uri.host)) return true;
    if (uri.host.endsWith('.youtube.com')) return true;
    if (uri.host.endsWith('.googleapis.com')) return true;
    if (uri.host.endsWith('.gstatic.com')) return true;
  }
  return false;
}

int _defaultPort(String scheme) => scheme == 'https' ? 443 : 80;

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      systemNavigationBarColor: Color(0xFF0a0e14),
    ),
  );
  runApp(const SentinelWatchWebApp());
}

class SentinelWatchWebApp extends StatelessWidget {
  const SentinelWatchWebApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Sentinel Watch',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0a0e14),
      ),
      home: const WebShellScreen(),
    );
  }
}

class WebShellScreen extends StatefulWidget {
  const WebShellScreen({super.key});

  @override
  State<WebShellScreen> createState() => _WebShellScreenState();
}

class _WebShellScreenState extends State<WebShellScreen> {
  late final WebViewController _controller;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0a0e14))
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri == null) return NavigationDecision.prevent;
            return _isAllowedNavigation(uri)
                ? NavigationDecision.navigate
                : NavigationDecision.prevent;
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
          onWebResourceError: (err) {
            if (mounted) {
              setState(() {
                _loading = false;
                _error = err.description;
              });
            }
          },
        ),
      )
      ..loadRequest(_appUri);
  }

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    await _controller.loadRequest(_appUri);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        top: false,
        child: Stack(
          children: [
            WebViewWidget(controller: _controller),
            if (_loading)
              const Center(
                child: CircularProgressIndicator(color: Color(0xFFef4444)),
              ),
            if (_error != null)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.wifi_off, color: Color(0xFF94a3b8), size: 40),
                      const SizedBox(height: 12),
                      const Text(
                        'Cannot reach Sentinel Watch server',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Color(0xFFe2e8f0), fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Keep your laptop on the same Wi‑Fi and run:\nnpm run dev (port 3100)\n\n$kWebAppUrl',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Color(0xFF64748b), fontSize: 12),
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: _reload,
                        style: FilledButton.styleFrom(backgroundColor: const Color(0xFFef4444)),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
