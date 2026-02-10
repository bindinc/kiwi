import os
import re
import unittest


class FrontendAppJsStructureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        app_js_path = os.path.join(root_dir, "app", "static", "assets", "js", "app.js")
        with open(app_js_path, "r", encoding="utf-8") as app_js_file:
            cls.app_js_content = app_js_file.read()

    def assert_pattern_absent(self, pattern):
        self.assertIsNone(re.search(pattern, self.app_js_content, flags=re.MULTILINE | re.DOTALL), pattern)

    def test_no_raw_html_inner_html_assignments(self):
        self.assert_pattern_absent(r"innerHTML\s*=\s*`[^`]*<")
        self.assert_pattern_absent(r"innerHTML\s*=\s*'[^']*<")
        self.assert_pattern_absent(r'innerHTML\s*=\s*"[^"]*<')

    def test_no_inline_style_or_style_mutation_patterns(self):
        self.assert_pattern_absent(r'style\s*=\s*["\']')
        self.assert_pattern_absent(r"\.style\.display")
        self.assert_pattern_absent(r"\.style\.opacity")
        self.assert_pattern_absent(r"\.style\.backgroundColor")
        self.assert_pattern_absent(r"\.style\.color")

    def test_no_inline_handler_markup_strings(self):
        self.assert_pattern_absent(r'onclick\s*=')
        self.assert_pattern_absent(r'onchange\s*=')
        self.assert_pattern_absent(r'oninput\s*=')
        self.assert_pattern_absent(r'onkeydown\s*=')


if __name__ == "__main__":
    unittest.main()
