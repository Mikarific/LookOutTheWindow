import * as IRF from 'internet-roadtrip-framework';
import { render } from 'solid-js/web';

import styles, { stylesheet as moduleCss } from '../style.module.css';
import { getVehicle, setVehicle } from '../pano/vehicle';
import { getNoiseActive, setNoiseActive, getNoiseVolume, setNoiseVolume } from '../noise/noise';
import { getWheelRotation, setWheelRotation } from '../pano/wheel';
import { getOptionsRotation, setOptionsRotation } from '../pano/options';
import { getMaxZoom, setMaxZoom } from '../pano/scene';

if (IRF.isInternetRoadtrip) {
	const { container: settings } = IRF.ui.panel.createTabFor(
		{ ...GM.info, script: { name: 'LOtW' } },
		{ tabName: 'LOtW', style: moduleCss },
	);

	function SettingsPanel() {
		return (
			<div>
				<div class={styles['settings-item']}>
					<span class={styles['setting']}>Vehicle</span>
					<hr />
					<div class={styles['setting']}>
						<input
							type="checkbox"
							class={IRF.ui.panel.styles.toggle}
							checked={getVehicle()}
							onClick={() => setVehicle(!getVehicle())}
						/>
					</div>
				</div>
				<div class={styles['settings-item']}>
					<span class={styles['setting']}>Rotate Wheel w/ Camera</span>
					<hr />
					<div class={styles['setting']}>
						<input
							type="checkbox"
							class={IRF.ui.panel.styles.toggle}
							checked={getWheelRotation()}
							onClick={() => setWheelRotation(!getWheelRotation())}
						/>
					</div>
				</div>
				<div class={styles['settings-item']}>
					<span class={styles['setting']}>Rotate Options w/ Camera</span>
					<hr />
					<div class={styles['setting']}>
						<input
							type="checkbox"
							class={IRF.ui.panel.styles.toggle}
							checked={getOptionsRotation()}
							onClick={() => setOptionsRotation(!getOptionsRotation())}
						/>
					</div>
				</div>
				<div class={styles['settings-item']}>
					<span class={styles['setting']}>Ambient Noise</span>
					<hr />
					<div class={styles['setting']}>
						<input
							type="checkbox"
							class={IRF.ui.panel.styles.toggle}
							checked={getNoiseActive()}
							onClick={() => setNoiseActive(!getNoiseActive())}
						/>
					</div>
				</div>
				<div class={styles['settings-item']}>
					<span class={styles['setting']}>Noise Volume</span>
					<div class={styles['setting']}>
						<input
							type="range"
							class={IRF.ui.panel.styles.slider}
							min="0"
							max="100"
							step="1"
							value={getNoiseVolume()}
							onInput={({ target }) => setNoiseVolume(parseInt(target.value))}
							disabled={!getNoiseActive()}
						/>
					</div>
					<span class={styles['slider-value']}>{getNoiseVolume() + '%'}</span>
				</div>
				<div class={styles['settings-item']}>
					<span class={styles['setting']}>Panorama Quality</span>
					<div class={styles['setting']}>
						<input
							type="range"
							class={IRF.ui.panel.styles.slider}
							min="0"
							max="5"
							step="1"
							value={getMaxZoom()}
							onInput={({ target }) => setMaxZoom(parseInt(target.value))}
						/>
						<div class={styles['slider-stops']}>
							<span class={getMaxZoom() >= 0 ? styles['active'] : ''}>0</span>
							<span class={getMaxZoom() >= 1 ? styles['active'] : ''}>1</span>
							<span class={getMaxZoom() >= 2 ? styles['active'] : ''}>2</span>
							<span class={getMaxZoom() >= 3 ? styles['active'] : ''}>3</span>
							<span class={getMaxZoom() >= 4 ? styles['active'] : ''}>4</span>
							<span class={getMaxZoom() >= 5 ? styles['active'] : ''}>5</span>
						</div>
					</div>
				</div>
				{/* TODO: Add setting to change Vehicle */}
			</div>
		);
	}

	render(SettingsPanel, settings);
}
