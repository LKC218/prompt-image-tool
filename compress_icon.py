import base64, re, io, os
from PIL import Image

svg_path = os.path.join(os.path.dirname(__file__), 'src', 'assets', 'icons', '图标.svg')

with open(svg_path, 'r', encoding='utf-8') as f:
    content = f.read()

original_size = os.path.getsize(svg_path)
print(f'Original size: {original_size / 1024:.1f} KB')

match = re.search(r'xlink:href="data:image/png;base64,([A-Za-z0-9+/=\s]+)"', content)
if not match:
    print('ERROR: Could not find base64 data')
    exit(1)

b64_data = match.group(1).replace('\n', '').replace(' ', '')
png_data = base64.b64decode(b64_data)
print(f'Embedded PNG size: {len(png_data) / 1024:.1f} KB')

img = Image.open(io.BytesIO(png_data))
print(f'Original image size: {img.size}')
print(f'Image mode: {img.mode}')

new_size = (256, 256)
img_resized = img.resize(new_size, Image.LANCZOS)

buf = io.BytesIO()
img_resized.save(buf, format='PNG', optimize=True)

new_png_data = buf.getvalue()
print(f'Resized PNG size: {len(new_png_data) / 1024:.1f} KB')

new_b64 = base64.b64encode(new_png_data).decode('ascii')

new_svg = f'''<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="256px" height="256px" viewBox="0 0 256 256">
  <image width="256" height="256" x="0" y="0" xlink:href="data:image/png;base64,{new_b64}"/>
</svg>'''

with open(svg_path, 'w', encoding='utf-8') as f:
    f.write(new_svg)

new_file_size = os.path.getsize(svg_path)
print(f'New SVG size: {new_file_size / 1024:.1f} KB')
print(f'Compression ratio: {new_file_size / original_size * 100:.1f}%')
print('Done!')
