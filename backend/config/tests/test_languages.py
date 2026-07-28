"""Language normalization, fallback order and request resolution."""

from django.test import SimpleTestCase

from config.languages import (
    DEFAULT_LANGUAGE_CODE,
    SUPPORTED_LANGUAGE_CODES,
    UI_LANGUAGE_AUTO,
    build_fallback_chain,
    normalize_language_tag,
    normalize_ui_language_preference,
    parse_accept_language,
    resolve_language_tag,
    resolve_translation,
)


class NormalizeLanguageTagTest(SimpleTestCase):
    def test_german_regional_tags_normalize_to_de(self):
        for tag in ('de', 'de-AT', 'de-DE', 'de-CH', 'DE-at', 'de_DE', '  de-AT  '):
            self.assertEqual(normalize_language_tag(tag), 'de', tag)

    def test_english_regional_tags_normalize_to_en(self):
        for tag in ('en', 'en-US', 'en-GB', 'EN-au', 'en_GB'):
            self.assertEqual(normalize_language_tag(tag), 'en', tag)

    def test_unsupported_tags_return_empty(self):
        for tag in ('fr', 'fr-FR', 'zh-Hans', 'xx', '', '   ', None):
            self.assertEqual(normalize_language_tag(tag), '', repr(tag))

    def test_resolve_language_tag_never_returns_empty(self):
        self.assertEqual(resolve_language_tag('fr'), DEFAULT_LANGUAGE_CODE)
        self.assertEqual(resolve_language_tag(None), DEFAULT_LANGUAGE_CODE)
        self.assertEqual(resolve_language_tag('de-AT'), 'de')


class AcceptLanguageTest(SimpleTestCase):
    def test_picks_the_first_supported_language(self):
        self.assertEqual(parse_accept_language('de-AT,de;q=0.9,en;q=0.8'), 'de')
        self.assertEqual(parse_accept_language('en-GB,en;q=0.9'), 'en')

    def test_honours_quality_values_over_position(self):
        # French is unsupported and German outranks English, so German wins
        # even though English appears first among the supported entries.
        self.assertEqual(parse_accept_language('fr;q=1.0, en;q=0.5, de;q=0.9'), 'de')

    def test_returns_empty_for_missing_or_unsupported_headers(self):
        self.assertEqual(parse_accept_language(''), '')
        self.assertEqual(parse_accept_language(None), '')
        self.assertEqual(parse_accept_language('fr-FR,it;q=0.8'), '')


class UiLanguagePreferenceTest(SimpleTestCase):
    def test_accepts_auto_and_every_supported_code(self):
        self.assertEqual(normalize_ui_language_preference(UI_LANGUAGE_AUTO), UI_LANGUAGE_AUTO)
        for code in SUPPORTED_LANGUAGE_CODES:
            self.assertEqual(normalize_ui_language_preference(code.upper()), code)

    def test_rejects_unsupported_values(self):
        for value in ('fr', 'de-AT', '', None, 'nonsense'):
            with self.assertRaises(ValueError, msg=repr(value)):
                normalize_ui_language_preference(value)


class FallbackChainTest(SimpleTestCase):
    def test_requested_language_comes_first_then_english_then_the_rest(self):
        self.assertEqual(build_fallback_chain('de'), ('de', 'en'))
        self.assertEqual(build_fallback_chain('en'), ('en', 'de'))

    def test_unsupported_request_falls_back_to_english_first(self):
        self.assertEqual(build_fallback_chain('fr')[0], DEFAULT_LANGUAGE_CODE)


class ResolveTranslationTest(SimpleTestCase):
    def test_prefers_the_requested_language(self):
        text, used = resolve_translation({'de': 'Tomate', 'en': 'Tomato'}, 'de')
        self.assertEqual((text, used), ('Tomate', 'de'))

    def test_falls_back_to_english_when_the_request_language_is_missing(self):
        text, used = resolve_translation({'en': 'Tomato'}, 'de')
        self.assertEqual((text, used), ('Tomato', 'en'))

    def test_falls_back_to_any_other_translation_before_giving_up(self):
        text, used = resolve_translation({'de': 'Tomate'}, 'en')
        self.assertEqual((text, used), ('Tomate', 'de'))

    def test_blank_values_count_as_missing(self):
        text, used = resolve_translation({'de': '   ', 'en': 'Tomato'}, 'de')
        self.assertEqual((text, used), ('Tomato', 'en'))

    def test_uses_the_technical_fallback_and_reports_no_language(self):
        text, used = resolve_translation({}, 'de', fallback='Solanum lycopersicum')
        self.assertEqual((text, used), ('Solanum lycopersicum', ''))

    def test_never_returns_none_or_a_placeholder_string(self):
        text, used = resolve_translation({}, 'de')
        self.assertEqual(text, '')
        self.assertEqual(used, '')
