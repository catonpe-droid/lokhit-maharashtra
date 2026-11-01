"""Safe renderer for Quill 2 Delta news bodies (no raw editor HTML is trusted).

Legacy plain-text news remains handled by build.py. Images may reference only
repository-local assets/img files. Inline text and attributes are escaped.
"""
import html
import re
from urllib.parse import urlsplit

_IMAGE = re.compile(r"^assets/img/(?!.*\.\.)[A-Za-z0-9_./-]+\.(?:jpe?g|png|webp)$", re.I)
_YOUTUBE = re.compile(r"(?:youtube(?:-nocookie)?\.com/(?:watch\?v=|embed/|shorts/|live/)|youtu\.be/)([A-Za-z0-9_-]{11})", re.I)

def _esc(value):
    return html.escape(str(value or ""), quote=True)

def _span(value, attrs):
    text=_esc(value)
    if not isinstance(attrs,dict):
        return text
    link=attrs.get("link")
    if isinstance(link,str) and len(link)<=1000:
        try:
            u=urlsplit(link)
            if u.scheme=="https" and u.netloc and not u.username and not u.password:
                text='<a href="'+_esc(link)+'" target="_blank" rel="noopener noreferrer nofollow">'+text+'</a>'
        except ValueError:
            pass
    for key,tag in (("bold","strong"),("italic","em"),("underline","u"),("strike","s")):
        if attrs.get(key) is True:
            text=f"<{tag}>{text}</{tag}>"
    return text

def _video(value):
    match=_YOUTUBE.search(value or "")
    if not match:
        return ""
    ident=match.group(1)
    return ('<div class="video-embed"><iframe title="YouTube व्हिडिओ" loading="lazy" '
        'src="https://www.youtube-nocookie.com/embed/'+ident+'" '
        'referrerpolicy="strict-origin-when-cross-origin" '
        'allow="accelerometer; autoplay; encrypted-media; picture-in-picture; web-share" '
        'allowfullscreen></iframe></div>')

def render_rich(ops, site_path):
    """Return list of safe HTML chunks for build.py (call site_path for assets)."""
    if not isinstance(ops,list):
        return []
    out=[]
    parts=[]
    current_list=None
    def finish(attrs=None):
        nonlocal parts,current_list
        attrs=attrs if isinstance(attrs,dict) else {}
        line=''.join(parts)
        parts=[]
        kind=attrs.get("list") if attrs.get("list") in ("bullet","ordered") else None
        if kind:
            tag="ul" if kind=="bullet" else "ol"
            if current_list!=tag:
                if current_list:out.append(f"</{current_list}>")
                out.append(f"<{tag}>")
                current_list=tag
            out.append("<li>"+(line or "&nbsp;")+"</li>")
            return
        if current_list:
            out.append(f"</{current_list}>")
            current_list=None
        if not line:
            return
        header=attrs.get("header")
        if header in (2,3):
            out.append(f"<h{header}>{line}</h{header}>")
        elif attrs.get("blockquote") is True:
            out.append("<blockquote>"+line+"</blockquote>")
        else:
            out.append("<p>"+line+"</p>")
    for op in ops[:2500]:
        if not isinstance(op,dict):
            continue
        insert=op.get("insert")
        attrs=op.get("attributes")
        if isinstance(insert,str):
            chunks=insert.split("\n")
            for i,chunk in enumerate(chunks):
                if chunk:parts.append(_span(chunk,attrs))
                if i<len(chunks)-1:finish(attrs)
        elif isinstance(insert,dict):
            finish()
            source=insert.get("image")
            if isinstance(source,str) and _IMAGE.fullmatch(source):
                src=site_path(source)
                out.append('<figure class="inline-news-photo"><img loading="lazy" src="'+_esc(src)+'" alt="बातमीतील छायाचित्र"></figure>')
            video=insert.get("video")
            if isinstance(video,str):
                v=_video(video)
                if v:out.append(v)
    finish()
    return out
