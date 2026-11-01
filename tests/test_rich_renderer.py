import unittest
from rich_renderer import render_rich

class RichRendererTests(unittest.TestCase):
    def render(self, ops):
        return "".join(render_rich(ops, lambda path: "/lokhit-maharashtra/"+path))

    def test_typography_heading_and_list(self):
        html=self.render([
            {"insert":"महत्त्वाची ","attributes":{"bold":True}},
            {"insert":"बातमी","attributes":{"italic":True}},
            {"insert":"\n","attributes":{"header":2}},
            {"insert":"पहिला मुद्दा"},
            {"insert":"\n","attributes":{"list":"bullet"}},
            {"insert":"दुसरा मुद्दा"},
            {"insert":"\n","attributes":{"list":"bullet"}},
        ])
        self.assertIn("<h2><strong>महत्त्वाची </strong><em>बातमी</em></h2>",html)
        self.assertIn("<ul><li>पहिला मुद्दा</li><li>दुसरा मुद्दा</li></ul>",html)

    def test_inline_photos_and_youtube(self):
        html=self.render([
            {"insert":{"image":"assets/img/news-test-1.jpg"}},
            {"insert":"\n"},
            {"insert":{"image":"assets/img/news-test-2.webp"}},
            {"insert":"\n"},
            {"insert":{"video":"https://www.youtube-nocookie.com/embed/AbCdEfGhI12"}},
            {"insert":"\n"}
        ])
        self.assertEqual(html.count('class="inline-news-photo"'),2)
        self.assertIn('youtube-nocookie.com/embed/AbCdEfGhI12',html)

    def test_unsafe_html_links_and_images_are_blocked(self):
        html=self.render([
            {"insert":"<script>alert(1)</script>","attributes":{"link":"javascript:alert(1)","bold":True}},
            {"insert":"\n"},
            {"insert":{"image":"../../private/secret.svg"}},
            {"insert":{"image":"javascript:alert(1)"}},
            {"insert":{"video":"https://evil.example/embed/AbCdEfGhI12"}}
        ])
        self.assertIn("&lt;script&gt;",html)
        self.assertNotIn("<script>",html)
        self.assertNotIn("<a ",html)
        self.assertNotIn("<img ",html)
        self.assertNotIn("<iframe",html)

if __name__=="__main__":
    unittest.main()
