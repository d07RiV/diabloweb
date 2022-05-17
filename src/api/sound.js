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

function decodeAudioData(context, buffer) {
  return new Promise((resolve, reject) => {
    context.decodeAudioData(buffer, resolve, reject);
  });
}

export default function init_sound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const StereoPannerNode = window.StereoPannerNode;
  if (!AudioContext) {
    return no_sound();
  }

  let context = null;
  try {
    context = new AudioContext();
    context.resume();
  } catch (e) {
  }
  const sounds = new Map();

  return {
    create_sound_raw(id, data, length, channels, rate) {
      if (!context) {
        return;
      }
      const buffer = context.createBuffer(channels, length, rate);
      for (let i = 0; i < channels; ++i) {
        buffer.getChannelData(i).set(data.subarray(i * length, i * length + length));
      }
      sounds.set(id, {
        buffer: Promise.resolve(buffer),
        gain: context.createGain(),
        panner: StereoPannerNode && new StereoPannerNode(context, {pan: 0}),
      });
    },
    create_sound(id, data) {
      if (!context) {
        return;
      }
      const buffer = decodeAudioData(context, data.buffer);
      sounds.set(id, {
        buffer,
        gain: context.createGain(),
        panner: StereoPannerNode && new StereoPannerNode(context, {pan: 0}),
      });
    },
    duplicate_sound(id, srcId) {
      if (!context) {
        return;
      }
      const src = sounds.get(srcId);
      if (!src) {
        return;
      }
      sounds.set(id, {
        buffer: src.buffer,
        gain: context.createGain(),
        panner: StereoPannerNode && new StereoPannerNode(context, {pan: 0}),
      });
    },
    play_sound(id, volume, pan, loop) {
      const src = sounds.get(id);
      if (src) {
        if (src.source) {
          src.source.then(source => source.stop());
        }
        src.gain.gain.value = Math.pow(2.0, volume / 1000.0);
        const relVolume = Math.pow(2.0, pan / 1000.0);
        if (src.panner) {
          src.panner.pan.value = 1.0 - 2.0 / (1.0 + relVolume);
        }
        src.source = src.buffer.then(buffer => {
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.loop = !!loop;
          let node = source.connect(src.gain);
          if (src.panner) {
            node = node.connect(src.panner);
          }
          node.connect(context.destination);
          source.start();
          return source;
        });
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
        src.source.then(source => source.stop());
        delete src.source;
      }
    },
    delete_sound(id) {
      const src = sounds.get(id);
      if (src && src.source) {
        src.source.then(source => source.stop());
      }
      sounds.delete(id);
    },

    stop_all() {
      for (let [, sound] of sounds) {
        if (sound.source) {
          sound.source.then(source => source.stop());
        }
      }
      sounds.clear();
      context = null;
    }
  };
}
