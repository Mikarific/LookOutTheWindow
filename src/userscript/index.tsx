import './meta.js?userscript-metadata';

import framework from 'internet-roadtrip-framework';
import globalStylesheet from './global.css';
import { stylesheet as moduleStylesheet } from './index.module.css';
import { App } from './App.jsx';
import { render } from 'solid-js/web';
import { setStore } from './store.js';

{
  const styleEl = document.createElement('style');
  styleEl.innerText = [globalStylesheet, moduleStylesheet].join('\n\n');
  document.head.appendChild(styleEl);
}

framework.vdom.container.then(async (vdomContainer) => {
  vdomContainer.state._computedWatchers.panoUrl.getter = () =>
    'data:text/plain,';
});

framework.vdom.container.then((vdomContainer) => {
  const { set: currentPanoSetter } = Object.getOwnPropertyDescriptor(
    vdomContainer.state,
    'currentPano',
  )!;
  Object.defineProperty(vdomContainer.state, 'currentPano', {
    set(currentPano: string) {
      setStore({
        currentPano: currentPano || null,
      });

      return currentPanoSetter!.call(this, currentPano);
    },
    configurable: true,
    enumerable: true,
  });

  const { set: currentHeadingSetter } = Object.getOwnPropertyDescriptor(
    vdomContainer.state,
    'currentHeading',
  )!;
  Object.defineProperty(vdomContainer.state, 'currentHeading', {
    set(currentHeading: number) {
      setStore({
        currentHeading: currentHeading || 0,
      });

      return currentHeadingSetter!.call(this, currentHeading);
    },
    configurable: true,
    enumerable: true,
  });

  setStore({
    currentPano: vdomContainer.data.currentPano || null,
    currentHeading: vdomContainer.data.currentHeading || 0,
  });
});

framework.dom.container.then(async (containerEl) => {
  requestIdleCallback(() => {
    const originalPanoEl = containerEl.querySelector('#pano')!;

    const appContainerEl = document.createElement('div');
    appContainerEl.setAttribute('data-look-out-the-window-root', '');
    originalPanoEl.insertAdjacentElement('afterend', appContainerEl);

    render(() => <App />, appContainerEl);
  });
});
