export default async function init_graphics(api) {
  return {
    draw_unlock(image) {
      if (api.renderer) {
        const data = api.renderer.createImageData(640, 480);
        data.data.set(image);
        api.renderer.putImageData(data, 0, 0);
        api.renderer.save();
      }
    },
    draw_flush() {
      api.renderer.restore();
    },
    draw_clip_text(x0, y0, x1, y1) {
      const ctx = api.renderer;
      if (x0 > 0 || y0 > 0 || x1 < 640 || y1 < 480) {
        ctx.beginPath();
        ctx.rect(x0, y0, x1 - x0, y1 - y0);
        ctx.clip();
      }
    },
    draw_text(x, y, text, color) {
      if (api.renderer) {
        api.renderer.font = 'bold 13px Times New Roman';
        const r = ((color >> 16) & 0xFF);
        const g = ((color >> 8) & 0xFF);
        const b = (color & 0xFF);
        api.renderer.fillStyle = `rgb(${r}, ${g}, ${b})`;
        api.renderer.fillText(text, x, y + 22);
      }
    },
    set_cursor(x, y) {
      api.setCursorPos(x, y);
    },
  };
}
