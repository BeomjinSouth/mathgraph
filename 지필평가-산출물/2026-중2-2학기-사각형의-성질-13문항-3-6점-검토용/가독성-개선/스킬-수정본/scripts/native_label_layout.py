"""Place measured Hancom equations against the actual geometry-only PNG.

Sizes are HWP engine measurements, never estimates from character count.
Coordinates stay relative to the inline picture. No geometry is erased.
"""
import io, math
import numpy as np
from PIL import Image


class NativeLabelLayout:
    def __init__(self, png, width_mm, clearance_mm=0.9):
        rgba = np.asarray(Image.open(io.BytesIO(png)).convert('RGBA'))
        mask = (rgba[:, :, 3] > 20) & (rgba[:, :, :3].min(axis=2) < 235)
        self.height, self.width = mask.shape
        self.px_mm = self.width / width_mm
        self.integral = np.pad(mask.astype(np.int64).cumsum(0).cumsum(1), ((1, 0), (1, 0)))
        self.gap = clearance_mm * self.px_mm
        self.placed = []

    def clear(self, box):
        x, y, w, h = box
        a, b = math.floor(x-self.gap), math.floor(y-self.gap)
        c, d = math.ceil(x+w+self.gap), math.ceil(y+h+self.gap)
        if a < 0 or b < 0 or c > self.width or d > self.height:
            return False
        s = self.integral
        if s[d,c]-s[b,c]-s[d,a]+s[b,a]:
            return False
        return not any(a < ox+ow and c > ox and b < oy+oh and d > oy for ox,oy,ow,oh in self.placed)

    def place(self, label, width_units, height_units):
        w = width_units * 25.4 / 7200 * self.px_mm
        h = height_units * 25.4 / 7200 * self.px_mm
        x, y = label['x'] * self.width, label['y'] * self.width
        # Bounded local search preserves association with the named point/angle.
        limit = 7 if label.get('is_point') else 4
        step = 0.25 * self.px_mm
        offsets = [(0., 0.)]
        for ring in range(1, int(limit/.25)+1):
            offsets.extend((ring*step*math.cos(k*math.pi/16), ring*step*math.sin(k*math.pi/16)) for k in range(32))
        for dx, dy in offsets:
            box = (x+dx, y+dy, w, h)
            if self.clear(box):
                self.placed.append(box)
                return {'x': box[0]/self.width, 'y': box[1]/self.width,
                        'width_units': width_units, 'height_units': height_units,
                        'font_pt': label['font_pt'], 'script': label['script'],
                        'clearance_mm': self.gap/self.px_mm,
                        'shift_mm': math.hypot(dx,dy)/self.px_mm}
        raise RuntimeError('수식 실측 영역이 선·점과 겹칩니다. GraphA의 여백·라벨 위치를 조정하세요: '+label['script'])
