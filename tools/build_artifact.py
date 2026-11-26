"""Build the single page used for the Claude artifact copy.

The artifact publisher wraps the page in its own html/head/body, so this writes index.html's body with the
stylesheet inlined and no document tags. The js/ folder and VERSION are published beside it unchanged.
Run from anywhere:  python tools/build_artifact.py
"""
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(rel):
    return io.open(os.path.join(ROOT, rel), encoding="utf-8").read()


html = read("index.html")
css = read("css/style.css")
body = html[html.index("<body>") + len("<body>"):html.index("</body>")]
page = "<title>Fractal Terrain Lab</title>\n<style>\n" + css + "\n</style>\n" + body.strip() + "\n"
out = os.path.join(ROOT, "dist", "artifact")
os.makedirs(out, exist_ok=True)
io.open(os.path.join(out, "fractal-terrain-lab.html"), "w", encoding="utf-8", newline="\n").write(page)
print("wrote", os.path.join(out, "fractal-terrain-lab.html"), len(page), "bytes")
