import { Howl } from 'howler';
import { effect } from 'solid-js/web';
import { store } from '../store';
import { createSignal } from 'solid-js';
import IRF from 'internet-roadtrip-framework';

export function AmbientNoise() {
  const [getIsWebSocketConnected, setIsWebSocketConnected] =
    createSignal(false);

  IRF.vdom.container.then((vdomContainer) => {
    const websocket = vdomContainer.state.ws as WebSocket;

    if (websocket.readyState === WebSocket.OPEN) {
      setIsWebSocketConnected(true);
    }

    websocket.addEventListener('open', () => {
      setIsWebSocketConnected(true);
    });
  });

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
      if (!audio.playing() && getIsWebSocketConnected()) {
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
