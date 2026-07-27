import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AuthService {
  static const _tokenKey = 'sw_auth_token';
  static const _emailKey = 'sw_auth_email';
  static const _onboardedKey = 'sw_onboarded';
  static const _categoriesKey = 'sw_categories';

  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8001',
  );

  SharedPreferences? _prefs;
  String? token;
  String? email;
  bool onboarded = false;
  List<String> categories = const [];

  bool get isLoggedIn => token != null && token!.isNotEmpty;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    token = _prefs!.getString(_tokenKey);
    email = _prefs!.getString(_emailKey);
    onboarded = _prefs!.getBool(_onboardedKey) ?? false;
    categories = _prefs!.getStringList(_categoriesKey) ?? const [];
  }

  Future<void> login(String emailInput, String password) async {
    if (emailInput.isEmpty || password.isEmpty) {
      throw Exception('Email and password are required');
    }
    final res = await http
        .post(
          Uri.parse('$apiBaseUrl/auth/login'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'email': emailInput, 'password': password}),
        )
        .timeout(const Duration(seconds: 8));
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Login failed');
    }
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final token = '${body['token'] ?? body['access_token'] ?? ''}';
    if (token.isEmpty || token == 'dev-token') {
      throw Exception('Invalid auth response');
    }
    await _persistSession(token: token, email: emailInput);
  }

  Future<void> register(String emailInput, String password) async {
    if (emailInput.isEmpty || password.isEmpty) {
      throw Exception('Email and password are required');
    }
    final res = await http
        .post(
          Uri.parse('$apiBaseUrl/auth/register'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'email': emailInput, 'password': password}),
        )
        .timeout(const Duration(seconds: 8));
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Registration failed');
    }
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final token = '${body['token'] ?? body['access_token'] ?? ''}';
    if (token.isEmpty || token == 'dev-token') {
      throw Exception('Invalid auth response');
    }
    await _persistSession(token: token, email: emailInput);
  }

  Future<void> requestPasswordReset(String emailInput) async {
    try {
      await http
          .post(
            Uri.parse('$apiBaseUrl/auth/forgot-password'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'email': emailInput}),
          )
          .timeout(const Duration(seconds: 8));
    } catch (_) {}
  }

  Future<void> completeOnboarding(List<String> selected) async {
    categories = List.unmodifiable(selected);
    onboarded = true;
    await _prefs?.setBool(_onboardedKey, true);
    await _prefs?.setStringList(_categoriesKey, selected);
  }

  Future<void> logout() async {
    token = null;
    email = null;
    await _prefs?.remove(_tokenKey);
    await _prefs?.remove(_emailKey);
  }

  Future<void> _persistSession({
    required String token,
    required String email,
  }) async {
    this.token = token;
    this.email = email;
    await _prefs?.setString(_tokenKey, token);
    await _prefs?.setString(_emailKey, email);
  }
}
