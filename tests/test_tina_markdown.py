import unittest
from tina_markdown import render_markdown

class TinaMarkdownTests(unittest.TestCase):
    def render(self, value):
        return ''.join(render_markdown(value,lambda p:'/lokhit-maharashtra/'+p))

    def test_bold_heading_link_and_list(self):
        out=self.render('## महत्त्वाची बातमी\n\n**ठळक शब्द** आणि *तिरका मजकूर*\n\n- पहिला मुद्दा\n- दुसरा मुद्दा\n\n[अधिक माहिती](https://example.org/help)')
        self.assertIn('<h2>महत्त्वाची बातमी</h2>',out)
        self.assertIn('<strong>ठळक शब्द</strong>',out)
        self.assertIn('<em>तिरका मजकूर</em>',out)
        self.assertIn('<ul><li>पहिला मुद्दा</li><li>दुसरा मुद्दा</li></ul>',out)
        self.assertIn('href="https://example.org/help"',out)

    def test_multiple_inline_photos(self):
        out=self.render('पहिला परिच्छेद\n\n![शेतकरी](/assets/img/one.jpg)\n\nदुसरा परिच्छेद\n\n![पाणी](assets/img/two.webp)')
        self.assertEqual(out.count('class="inline-news-photo"'),2)
        self.assertIn('/lokhit-maharashtra/assets/img/one.jpg',out)
        self.assertIn('/lokhit-maharashtra/assets/img/two.webp',out)

    def test_youtube_standalone(self):
        out=self.render('व्हिडिओ\n\nhttps://www.youtube.com/watch?v=AbCdEfGhI12')
        self.assertIn('youtube-nocookie.com/embed/AbCdEfGhI12',out)

    def test_reject_script_and_unsafe_url(self):
        out=self.render('<script>alert(1)</script>\n\n[click](javascript:alert(1))\n\n![X](../../private.png)')
        self.assertNotIn('<script>',out)
        self.assertIn('&lt;script&gt;',out)
        self.assertNotIn('href="javascript:',out)
        self.assertNotIn('<img ',out)

if __name__=='__main__':
    unittest.main()
