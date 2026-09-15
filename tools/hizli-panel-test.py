"""Gerçek Git geçmişiyle yeni yayın, düzenleme ve sığ klon regresyonları."""
import contextlib
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("panel", Path(__file__).with_name("hizli-panel.py"))
panel = importlib.util.module_from_spec(spec)
spec.loader.exec_module(panel)


class PanelTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / "site"
        self.root.mkdir()
        self.old_root, self.old_page = panel.KOK, panel.SAYFA
        self.addCleanup(self.restore)
        panel.KOK, panel.SAYFA = str(self.root), str(self.root / "index.html")
        self.git("init", "-q")
        self.git("config", "user.name", "Panel test")
        self.git("config", "user.email", "test@example.invalid")
        (self.root / "index.html").write_text(
            '<aside class="hero-quick"></aside>\n          <ul class="hq-yeni">\n          </ul>\n',
            encoding="utf-8")
        self.commit(8)

    def restore(self):
        panel.KOK, panel.SAYFA = self.old_root, self.old_page

    def git(self, *args, env=None):
        return subprocess.run(["git", *args], cwd=self.root, env=env,
                              check=True, capture_output=True, text=True).stdout

    def commit(self, hour):
        self.git("add", ".")
        env = dict(os.environ, GIT_AUTHOR_DATE=f"2026-09-15T{hour:02}:00:00+03:00",
                   GIT_COMMITTER_DATE=f"2026-09-15T{hour:02}:00:00+03:00")
        self.git("commit", "-qm", "fixture", env=env)

    def page(self, slug, hour, title="Yeni sayfa", noindex=False):
        path = self.root / slug / "index.html"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f'<title>{title} | Koray Öner</title>' +
                        ('<meta name="robots" content="noindex">' if noindex else ''), encoding="utf-8")
        self.commit(hour)

    def test_new_pages_refresh_without_manual_labels(self):
        self.page("eski-arac", 9)
        self.page("makaleler/yazi-b", 10)
        self.page("makaleler/yazi-a", 11)
        self.page("yeni-arac", 12, "Uzun finansal başlık: birikim &amp; &lt;getiri&gt; karşılaştırması")
        # Aynı bölümdeki iki makale de gerçek yayın sırasını korur.
        expected = ["yeni-arac", "makaleler/yazi-a", "makaleler/yazi-b"]
        self.assertEqual([s for _, s in panel.toplam()[:3]], expected)
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(panel.main(), 0)
        markup = Path(panel.SAYFA).read_text(encoding="utf-8")
        self.assertIn("&amp; &lt;getiri&gt;", markup)
        self.assertNotIn("&amp;amp;", markup)
        for slug in expected:
            self.assertIn(f'href="{slug}/"', markup)
        # Eski sayfa düzenlemek, onu yeni yayın haline getirmez.
        self.page("eski-arac", 13, "Düzenlenmiş sayfa")
        self.assertEqual([s for _, s in panel.toplam()[:3]], expected)
        # İkinci üretim dosyayı değiştirmez.
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(panel.main(), 0)
        self.assertEqual(Path(panel.SAYFA).read_text(encoding="utf-8"), markup)

    def test_non_content_pages_are_excluded(self):
        self.page("arac", 9)
        self.page("arac/metodoloji", 10)
        self.page("makaleler", 11)
        self.page("hakkimda", 12)
        self.page("taslak", 13, noindex=True)
        self.assertEqual([s for _, s in panel.toplam()], ["arac"])

    def test_shallow_history_is_rejected_without_modifying_page(self):
        self.page("arac", 9)
        clone = Path(self.tmp.name) / "shallow"
        self.git("clone", "--depth=1", self.root.as_uri(), str(clone))
        panel.KOK, panel.SAYFA = str(clone), str(clone / "index.html")
        before = Path(panel.SAYFA).read_bytes()
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(panel.main(), 1)
        self.assertEqual(Path(panel.SAYFA).read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
