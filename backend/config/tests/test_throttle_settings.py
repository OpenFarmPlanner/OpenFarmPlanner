from __future__ import annotations

import pytest
from django.core.exceptions import ImproperlyConfigured

from config.settings import _guest_demo_throttle_rate_for_env, _loopback_dev_origins


def test_guest_demo_throttle_uses_high_development_default() -> None:
    assert _guest_demo_throttle_rate_for_env('development') == '1000/minute'


def test_guest_demo_throttle_uses_restrictive_non_development_default() -> None:
    assert _guest_demo_throttle_rate_for_env('production') == '10/hour'
    assert _guest_demo_throttle_rate_for_env('test') == '10/hour'


def test_guest_demo_throttle_explicit_rate_overrides_default() -> None:
    assert (
        _guest_demo_throttle_rate_for_env('production', guest_demo_rate='42/minute')
        == '42/minute'
    )


def test_guest_demo_throttle_legacy_env_name_still_overrides_default() -> None:
    assert _guest_demo_throttle_rate_for_env('production', legacy_rate='11/hour') == '11/hour'


def test_guest_demo_throttle_prefers_new_env_name_over_legacy_name() -> None:
    assert (
        _guest_demo_throttle_rate_for_env(
            'production',
            guest_demo_rate='42/minute',
            legacy_rate='11/hour',
        )
        == '42/minute'
    )


def test_loopback_dev_origins_include_localhost_and_127_hosts() -> None:
    assert _loopback_dev_origins((5173,)) == [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ]


@pytest.mark.parametrize('invalid_rate', ['not-a-rate', '10/lightyear', '0/minute'])
def test_guest_demo_throttle_rejects_invalid_rates(invalid_rate: str) -> None:
    with pytest.raises(ImproperlyConfigured):
        _guest_demo_throttle_rate_for_env('production', guest_demo_rate=invalid_rate)
