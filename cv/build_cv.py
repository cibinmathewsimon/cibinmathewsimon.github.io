"""Build the resume (1 page) and full CV from cv.json as HTML, PDF and Word.

Public versions (no phone number) go to cv/dist/ and are committed for the website.
Private versions (with the phone number from private/phone.txt) go to private/, which git ignores.

Needs macOS: Google Chrome (headless PDF) and textutil (Word). Run: python3 cv/build_cv.py
"""
import json
import subprocess
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CV = json.loads((ROOT / "cv" / "cv.json").read_text(encoding="utf-8"))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

CSS = """
@page { size: A4; margin: 13mm 14mm; }
* { box-sizing: border-box; }
body { margin: 0; font: 9.4pt/1.42 -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif; color: #1b2233; }
h1 { font-size: 21pt; line-height: 1.05; margin: 0; letter-spacing: -0.01em; }
.headline { font-size: 10.5pt; font-weight: 600; color: #2b40d4; margin: 3px 0 5px; }
.contact { color: #4b5571; font-size: 8.8pt; }
.contact a { color: inherit; text-decoration: none; }
h2 { font-size: 8.6pt; letter-spacing: .12em; text-transform: uppercase; color: #2b40d4; margin: 12px 0 5px; padding-bottom: 3px; border-bottom: 1px solid #c6ceda; }
h3 { font-size: 10pt; margin: 8px 0 1px; }
p { margin: 0 0 4px; }
.row { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
.muted { color: #4b5571; }
.small { font-size: 8.6pt; }
ul { margin: 2px 0 4px; padding-left: 14px; }
li { margin: 0 0 2.5px; }
.ladder { font-size: 8.6pt; color: #4b5571; margin: 1px 0 4px; }
.ladder b { color: #1b2233; font-weight: 600; }
table { border-collapse: collapse; width: 100%; }
td { vertical-align: top; padding: 1.5px 0; }
td.k { width: 92px; font-weight: 600; padding-right: 10px; }
.dec td.k { width: 190px; }
.full body, .full { font-size: 9.8pt; }
.timeline td.k { width: 230px; font-weight: 500; }
"""


def contact(phone):
    bits = [f'<a href="mailto:{CV["email"]}">{CV["email"]}</a>']
    if phone:
        bits.append(escape(phone))
    bits += [f'<a href="https://{CV["linkedin"]}">{CV["linkedin"]}</a>',
             f'<a href="https://{CV["website"]}">{CV["website"]}</a>', escape(CV["location"])]
    return " · ".join(bits)


def header(phone):
    return (f'<h1>{escape(CV["name"])}</h1><div class="headline">{escape(CV["headline"])}</div>'
            f'<div class="contact">{contact(phone)}</div>')


def table(rows, cls=""):
    body = "".join(f'<tr><td class="k">{escape(k)}</td><td>{escape(v)}</td></tr>' for k, v in rows)
    return f'<table class="{cls}">{body}</table>'


def bullets(items):
    return "<ul>" + "".join(f"<li>{escape(i)}</li>" for i in items) + "</ul>"


def edu():
    e = CV["education"]
    return (f'<div class="row"><span><b>{escape(e["degree"])}</b>, {escape(e["school"])}</span>'
            f'<span class="muted">{e["year"]} · {escape(e["grade"])}</span></div>')


def page(title, body, cls=""):
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{escape(title)}</title>'
            f'<style>{CSS}</style></head><body class="{cls}">{body}</body></html>')


def resume(phone):
    ladder = " · ".join(f'<span style="white-space:nowrap"><b>{escape(t)}</b> {escape(d)}</span>' for t, d in CV["roles"])
    projects = "".join(
        f'<h3 class="row"><span>{escape(p["name"])} <span class="muted">· {escape(p["client"])}</span></span>'
        f'<span class="muted small">{escape(p["dates"])}</span></h3>{bullets(p["bullets"])}'
        for p in CV["projects"])
    body = (header(phone)
            + f'<h2>Summary</h2><p>{escape(CV["summary"])}</p>'
            + f'<h2>Experience</h2><div class="row"><b>{escape(CV["company"])}, {escape(CV["company_location"])}</b>'
              f'<span class="muted">{escape(CV["company_dates"])}</span></div>'
            + f'<div class="ladder">{ladder}</div>{projects}'
            + f'<h2>Skills</h2>{table(CV["skills"])}'
            + f'<h2>Also</h2><p>{" · ".join(escape(a) for a in CV["also"])}</p>'
            + f'<h2>Education</h2>{edu()}')
    return page(f'{CV["name"]} — Resume', body)


def full_cv(phone):
    parts = [header(phone), f'<h2>Profile</h2><p>{escape(CV["summary_full"])}</p>',
             f'<h2>Career at {escape(CV["company"])}</h2>{table([(t, d) for t, d in CV["roles"]], "timeline")}']
    for p in CV["projects"]:
        parts.append(
            f'<h2>{escape(p["name"])}</h2>'
            f'<div class="row"><b>{escape(p["client"])} · {escape(p["role"])}</b><span class="muted">{escape(p["dates"])}</span></div>'
            f'<p>{escape(p["context"])}</p>'
            + table([("Team", p["team"]), ("Stack", p["stack"])])
            + "<h3>What I did</h3>" + bullets(p["bullets"]))
        if p.get("decisions"):
            parts.append("<h3>Key architecture decisions</h3>" + table(p["decisions"], "dec"))
        if p.get("apps"):
            parts.append("<h3>Applications</h3>" + table(p["apps"]))
    parts += [f'<h2>Skills</h2>{table(CV["skills"])}', f'<h2>Beyond delivery</h2>{bullets(CV["also"])}',
              f'<h2>Education</h2>{edu()}']
    return page(f'{CV["name"]} — Curriculum Vitae', "".join(parts), "full")


def render(out_dir, phone):
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = "Cibin-Mathew-Simon"
    for kind, html in (("Resume", resume(phone)), ("CV", full_cv(phone))):
        src = out_dir / f"{stem}-{kind}.html"
        src.write_text(html, encoding="utf-8")
        subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                        f"--print-to-pdf={out_dir / (src.stem + '.pdf')}", src.as_uri()],
                       check=True, capture_output=True)
        subprocess.run(["textutil", "-convert", "docx", str(src), "-output", str(out_dir / (src.stem + ".docx"))], check=True)
        print("built", out_dir / src.stem, "(.html .pdf .docx)")


phone_file = ROOT / "private" / "phone.txt"
render(ROOT / "cv" / "dist", None)
if phone_file.exists():
    render(ROOT / "private", phone_file.read_text(encoding="utf-8").strip())
else:
    print("skipped private build: add your phone number to private/phone.txt")
