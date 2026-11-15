import importlib
import os
from unittest import mock

from django.test import SimpleTestCase

import config.settings as project_settings


class MockPaymentSwitchTests(SimpleTestCase):
    """PAYMENTS_MOCK_ENABLED: (DEBUG yoki DEMO_MODE) va PAYMENTS_MOCK=True bo'lsagina yoqiladi."""

    def _enabled(self, debug, demo, mock_flag):
        env = {"DEBUG": str(debug), "DEMO_MODE": str(demo), "PAYMENTS_MOCK": str(mock_flag)}
        with mock.patch.dict(os.environ, env):
            reloaded = importlib.reload(project_settings)
            return reloaded.PAYMENTS_MOCK_ENABLED

    def setUp(self):
        self.addCleanup(importlib.reload, project_settings)

    def test_production_without_demo_mode_stays_off(self):
        self.assertFalse(self._enabled(debug=False, demo=False, mock_flag=True))

    def test_demo_server_enables_mock_without_debug(self):
        self.assertTrue(self._enabled(debug=False, demo=True, mock_flag=True))

    def test_demo_mode_still_needs_mock_flag(self):
        self.assertFalse(self._enabled(debug=False, demo=True, mock_flag=False))

    def test_local_debug_still_works(self):
        self.assertTrue(self._enabled(debug=True, demo=False, mock_flag=True))

    def test_nothing_enabled_by_default(self):
        self.assertFalse(self._enabled(debug=False, demo=False, mock_flag=False))