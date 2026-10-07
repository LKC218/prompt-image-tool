"""纯尺寸规则；与前端 image-resize.js 使用同一组边界样例。"""
import math
import re

MAX_EDGE = 16384
MAX_PIXELS = 16_000_000


def normalize_resize(values):
    def flag(key, fallback):
        value = values.get(key, fallback)
        if type(value) is bool: return value
        if value in ('true', 'false'): return value == 'true'
        raise ValueError('尺寸开关参数无效')
    if not flag('resize', False): return {'resize': False}
    mode = values.get('resizeMode', 'dimensions')
    if mode not in ('dimensions', 'percent', 'longest'): raise ValueError('尺寸模式无效')
    result = dict(resize=True, resizeMode=mode, lockRatio=flag('lockRatio', True), onlyShrink=flag('onlyShrink', True))
    def number(key, label, maximum, optional=False, decimal=False):
        raw = values.get(key, '')
        value = '' if raw is None else str(raw)
        if optional and value == '': return None
        if not re.fullmatch(r'\d+(\.\d{1,2})?' if decimal else r'\d+', value, re.ASCII) or not 0 < float(value) <= maximum:
            raise ValueError(label + ('须为 0.01–1000，最多两位小数' if decimal else '须为 1–16384 的整数'))
        return float(value) if decimal else int(value)
    if mode == 'dimensions':
        result.update(width=number('width', '宽度', MAX_EDGE, True), height=number('height', '高度', MAX_EDGE, True))
        if not result['width'] and not result['height']: raise ValueError('请至少填写宽度或高度')
        if not result['lockRatio'] and (not result['width'] or not result['height']): raise ValueError('解锁比例时须同时填写宽度和高度')
    elif mode == 'percent': result['percent'] = number('percent', '百分比', 1000, decimal=True)
    else: result['longest'] = number('longest', '最长边', MAX_EDGE)
    return result


def calculate_resize(width, height, values):
    if any(type(x) is not int or x <= 0 for x in (width, height)) or width * height > MAX_PIXELS:
        raise ValueError('输入图片不得超过 1600 万像素')
    config = normalize_resize(values)
    if not config['resize']: return dict(width=width, height=height, changed=False)
    mode = config['resizeMode']
    if mode == 'dimensions' and not config['lockRatio']:
        w = min(width, config['width']) if config['onlyShrink'] else config['width']
        h = min(height, config['height']) if config['onlyShrink'] else config['height']
    else:
        scale = (config['percent'] / 100 if mode == 'percent' else config['longest'] / max(width, height)
                 if mode == 'longest' else min(config['width'] / width if config['width'] else math.inf,
                                              config['height'] / height if config['height'] else math.inf))
        if config['onlyShrink']: scale = min(scale, 1)
        w, h = max(1, math.floor(width * scale + .5)), max(1, math.floor(height * scale + .5))
    if w > MAX_EDGE or h > MAX_EDGE or w * h > MAX_PIXELS:
        raise ValueError('输出不得超过 16384 像素边长或 1600 万像素')
    return dict(width=w, height=h, changed=w != width or h != height)
