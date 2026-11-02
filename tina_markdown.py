"""Safe, dependency-free Markdown renderer for TinaCMS JSON news content.

Tina's rich-text editor serializes its JSON "body" field as Markdown.
Only a restricted Markdown subset and repository-local inline images are
rendered. Never insert raw article HTML into published pages.
"""
import html
import re
from urllib.parse import urlsplit, unquote

_IMAGE = re.compile(r'^/?assets/img/(?!.*\.\.)[A-Za-z0-9_./-]+\.(?:jpg|jpeg|png|webp)$', re.I)
_IMAGE_INLINE = re.compile(r'!\[([^\]]*)\]\((\S+?)(?:\s+["\'][^)]*["\'])?\)')
_URL = re.compile(r'\[([^\]]+)\]\(([^\s)]+)\)')
_FORMATS = re.compile(r'(\*\*([^*\n]+)\*\*|~~([^~\n]+)~~|\*([^*\n]+)\*|\x60([^\x60\n]+)\x60)')
_YOUTUBE = re.compile(r'(?:youtube(?:-nocookie)?\.com/(?:watch\?v=|shorts/|live/|embed/)|youtu\.be/)([A-Za-z0-9_-]{11})', re.I)

def _e(value):
    return html.escape(str(value or ''), quote=True)

def _asset_path(raw):
    if not isinstance(raw, str):
        return ''
    raw = raw.strip()
    if raw.startswith('https://catonpe-droid.github.io/lokhit-maharashtra/'):
        raw = raw.removeprefix('https://catonpe-droid.github.io/lokhit-maharashtra/')
    elif raw.startswith('/lokhit-maharashtra/'):
        raw = raw.removeprefix('/lokhit-maharashtra/')
    if _IMAGE.fullmatch(raw) and '..' not in raw:
        return raw.lstrip('/')
    return ''

def _safe_url(raw):
    try:
        value = html.unescape(str(raw or '')).strip()
        if len(value) > 1600 or any(ord(ch) < 32 for ch in value):
            return ''
        parts = urlsplit(value)
        if parts.scheme == 'https' and parts.netloc and not parts.username and not parts.password:
            return value
        if not parts.scheme and not parts.netloc and (value.startswith('/') or value.startswith('#')):
            return value if not value.startswith('//') else ''
    except ValueError:
        pass
    return ''

def _format(text):
    parts = []
    cursor = 0
    for match in _FORMATS.finditer(text):
        parts.append(_e(text[cursor:match.start()]))
        if match.group(2) is not None:
            parts.append('<strong>'+_e(match.group(2))+'</strong>')
        elif match.group(3) is not None:
            parts.append('<s>'+_e(match.group(3))+'</s>')
        elif match.group(4) is not None:
            parts.append('<em>'+_e(match.group(4))+'</em>')
        else:
            parts.append('<code>'+_e(match.group(5))+'</code>')
        cursor = match.end()
    parts.append(_e(text[cursor:]))
    return ''.join(parts)

def _inline(text):
    """Render links and emphasis; all other source text remains escaped."""
    out, cursor = [], 0
    for match in _URL.finditer(str(text)):
        out.append(_format(text[cursor:match.start()]))
        target = _safe_url(match.group(2))
        if target:
            out.append('<a href="'+_e(target)+'" target="_blank" rel="noopener noreferrer nofollow">'+_format(match.group(1))+'</a>')
        else:
            out.append(_format(match.group(0)))
        cursor = match.end()
    out.append(_format(text[cursor:]))
    return ''.join(out)

def _video(text):
    match = _YOUTUBE.search(text or '')
    if not match:
        return ''
    ident = match.group(1)
    return ('<div class="video-embed"><iframe title="बातमीतील YouTube व्हिडिओ" '
            'loading="lazy" src="https://www.youtube-nocookie.com/embed/'+ident+'" '
            'allow="accelerometer; autoplay; encrypted-media; picture-in-picture; web-share" '
            'referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>')

def _standalone_media(text, site_path):
    stripped = text.strip()
    match = _IMAGE_INLINE.fullmatch(stripped)
    if match:
        src = _asset_path(match.group(2))
        if src:
            return '<figure class="inline-news-photo"><img loading="lazy" src="'+_e(site_path(src))+'" alt="'+_e(match.group(1))+'"></figure>'
        return '<p>'+_e(stripped)+'</p>'
    if stripped.startswith(('https://youtube.com/', 'https://www.youtube.com/', 'https://youtu.be/', 'https://m.youtube.com/')):
        return _video(stripped)
    return ''

def render_markdown(source, site_path):
    """Turn Tina-authored Markdown or existing simple-body text into safe HTML."""
    if not isinstance(source, str):
        return []
    lines = source.replace('\r\n','\n').replace('\r','\n').split('\n')
    out = []
    paragraph = []
    list_kind = None
    quote = []
    def close_para():
        if paragraph:
            out.append('<p>'+'<br>'.join(_inline(x) for x in paragraph)+'</p>')
            paragraph.clear()
    def close_list():
        nonlocal list_kind
        if list_kind:
            out.append('</'+list_kind+'>')
            list_kind = None
    def close_quote():
        if quote:
            out.append('<blockquote>'+'<br>'.join(_inline(x) for x in quote)+'</blockquote>')
            quote.clear()
    def media_line(line):
        # Tina markdown image blocks are normally on their own line.
        standalone = _standalone_media(line, site_path)
        if standalone:
            close_para();close_list();close_quote()
            out.append(standalone)
            return True
        return False
    for raw in lines:
        line=raw.strip()
        if not line:
            close_para();close_list();close_quote()
            continue
        if media_line(line):
            continue
        if line.startswith(('### ','## ','#### ')):
            close_para();close_list();close_quote()
            n=min(4,max(2,len(line)-len(line.lstrip('#'))))
            out.append(f'<h{n}>'+_inline(line[n+1:]) + f'</h{n}>')
            continue
        if line.startswith('# '):
            close_para();close_list();close_quote()
            out.append('<h2>'+_inline(line[2:])+'</h2>')
            continue
        list_match=re.match(r'^([-*+] |\d+\. )(.*)$',line)
        if list_match:
            close_para();close_quote()
            kind='ol' if list_match.group(1)[0].isdigit() else 'ul'
            if kind!=list_kind:
                close_list();out.append('<'+kind+'>');list_kind=kind
            out.append('<li>'+_inline(list_match.group(2))+'</li>')
            continue
        if line.startswith('> '):
            close_para();close_list()
            quote.append(line[2:])
            continue
        if re.fullmatch(r'[-*]{3,}',line):
            close_para();close_list();close_quote()
            out.append('<hr>')
            continue
        close_list();close_quote()
        paragraph.append(line)
    close_para();close_list();close_quote()
    return out
