function no_sound() {
  return {
    create_sound: () => 0,
    duplicate_sound: () => 0,
    play_sound: () => undefined,
    set_volume: () => undefined,
    stop_sound: () => undefined,
    delete_sound: () => undefined,
  };
}

export default async function init_sound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return no_sound();
  }

  const context = new AudioContext();
  const sounds = new Map();
  let nextId = 0;

  return {
    create_sound(data, length, channels, rate) {
      const buffer = context.createBuffer(channels, length, rate);
      for (let i = 0; i < channels; ++i) {
        buffer.copyToChannel(data.subarray(i * length, i * length + length), i);
      }
      const id = nextId++;
      sounds.set(id, {
        buffer,
        gain: context.createGain(),
        panner: new StereoPannerNode(context, {pan: 0}),
      });
      return id;
    },
    duplicate_sound(id) {
      const src = sounds.get(id);
      if (!src) {
        return -1;
      }
      id = nextId++;
      sounds.set(id, {
        buffer: src.buffer,
        gain: context.createGain(),
        panner: new StereoPannerNode(context, {pan: 0}),
      });
      return id;
    },
    play_sound(id, volume, pan, loop) {
      const src = sounds.get(id);
      if (src) {
        if (src.source) {
          src.source.stop();
        }
        src.gain.gain.value = Math.pow(2.0, volume / 1000.0);
        const relVolume = Math.pow(2.0, pan / 1000.0);
        src.panner.pan.value = 1.0 - 2.0 / (1.0 + relVolume);
        src.source = context.createBufferSource();
        src.source.buffer = src.buffer;
        src.source.loop = !!loop;
        src.source.connect(src.gain).connect(src.panner).connect(context.destination);
        src.source.start();
      }
    },
    set_volume(id, volume) {
      const src = sounds.get(id);
      if (src) {
        src.gain.gain.value = Math.pow(2.0, volume / 1000.0);
      }
    },
    stop_sound(id) {
      const src = sounds.get(id);
      if (src && src.source) {
        src.source.stop();
        delete src.source;
      }
    },
    delete_sound(id) {
      const src = sounds.get(id);
      if (src && src.source) {
        src.source.stop();
      }
      sounds.delete(id);
    },
  };
}
