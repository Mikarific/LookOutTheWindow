import { Howl } from 'howler';
import { effect } from 'solid-js/web';
import { store } from '../store';

export function AmbientNoise() {
  let audio: Howl | undefined;
  function ensureAudio() {
    if (!audio) {
      audio = new Howl({
        src: [
          'https://cloudy.netux.site/neal_internet_roadtrip/ambient noise.wav',
        ],
        volume: 0,
        loop: true,
        autoplay: false,
      });
    }

    return audio;
  }

  effect(() => {
    if (store.settings.ambientNoise.play) {
      const audio = ensureAudio();
      if (!audio.playing()) {
        audio.play();
      }
    } else {
      audio?.stop();
    }
  });

  effect(() => {
    audio?.volume(store.settings.ambientNoise.volume);
  });

  return null;
}
