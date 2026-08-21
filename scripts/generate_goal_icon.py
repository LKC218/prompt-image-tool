from PIL import Image, ImageDraw

SIZE = 64
PADDING = 8
STROKE = 4
RADIUS = 8

img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

white = (255, 255, 255, 255)

# 左侧勾选框
box_left = PADDING
box_top = PADDING
box_right = SIZE // 2 - 4
box_bottom = SIZE - PADDING
draw.rounded_rectangle(
    [box_left, box_top, box_right, box_bottom],
    radius=RADIUS,
    outline=white,
    width=STROKE
)

# 对勾
check_points = [
    (box_left + 6, box_top + SIZE // 2 - 4),
    (box_left + SIZE // 4 - 2, box_bottom - 8),
    (box_right - 5, box_top + 8),
]
draw.line(check_points, fill=white, width=STROKE, joint='curve')

# 右侧三条横线
line_left = SIZE // 2 + 2
line_right = SIZE - PADDING
line_gap = (SIZE - 2 * PADDING) // 4
for i in range(3):
    y = PADDING + 6 + i * line_gap
    draw.line([(line_left, y), (line_right, y)], fill=white, width=STROKE)

img.save('src/assets/pc/nav-icons/goals.png')
print('Generated src/assets/pc/nav-icons/goals.png')
