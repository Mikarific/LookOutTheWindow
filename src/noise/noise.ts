import * as IRF from 'internet-roadtrip-framework';

import { HowlOptions } from 'howler';
import { createEffect, createSignal } from 'solid-js';

export const [getNoiseVolume, setNoiseVolume] = createSignal((GM_getValue('noiseVolume') as number) ?? 25);
export const [getNoiseActive, setNoiseActive] = createSignal((GM_getValue('noiseActive') as boolean) ?? true);

async function websocketConnected(Howl: new (options: HowlOptions) => Howl) {
	const audio = new Howl({
		src: ['https://cloudy.netux.site/neal_internet_roadtrip/ambient%20noise.wav'],
		volume: getNoiseVolume() / 100,
		loop: true,
		autoplay: getNoiseActive(),
		mute: !getNoiseActive(),
	});
	createEffect(() => {
		GM_setValue('noiseVolume', getNoiseVolume());
		audio?.volume(getNoiseVolume() / 100);
	});
	createEffect(() => {
		GM_setValue('noiseActive', getNoiseActive());
		if (getNoiseActive()) {
			audio.mute(false);
			if (!audio.playing()) audio.play();
		}
		if (!getNoiseActive()) audio.mute(true);
	});
}

IRF.modules.howler.then(async ({ Howl }) => {
	const websocket = (await IRF.vdom.container).data.ws;
	if (websocket.readyState === WebSocket.OPEN) websocketConnected(Howl);
	websocket.addEventListener('open', () => websocketConnected(Howl));
});
