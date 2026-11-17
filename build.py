# -*- coding: utf-8 -*-
"""把 src/ 下的 CSS/JS 内联成单文件，便于直接分发与预览。"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
OUT_DIR = os.path.join(ROOT, 'dist')
OUT = os.path.join(OUT_DIR, '药企模拟器.html')


def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()


def main():
    html = read(os.path.join(SRC, 'index.html'))

    def css_repl(m):
        return '<style>\n' + read(os.path.join(SRC, m.group(1))) + '\n</style>'

    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css_repl, html)

    def js_repl(m):
        code = read(os.path.join(SRC, m.group(1)))
        # 防止 </script> 提前闭合
        code = code.replace('</script>', '<\\/script>')
        return '<script>\n' + code + '\n</script>'

    html = re.sub(r'<script src="([^"]+)"></script>', js_repl, html)

    if not os.path.isdir(OUT_DIR):
        os.makedirs(OUT_DIR)
    with io.open(OUT, 'w', encoding='utf-8') as f:
        f.write(html)
    size = os.path.getsize(OUT) / 1024
    print('built: %s  (%.1f KB)' % (OUT, size))


if __name__ == '__main__':
    main()
