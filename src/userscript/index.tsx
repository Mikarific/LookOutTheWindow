import './meta.js?userscript-metadata';

import IRF from 'internet-roadtrip-framework';
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

type PromiseResult<P> = P extends Promise<infer T> ? T : never;
type ContainerVDOM = PromiseResult<typeof IRF.vdom.container>;

function patchOutPanoUrl(containerVDOM: ContainerVDOM) {
  containerVDOM.state.getPanoUrl = new Proxy(containerVDOM.methods.getPanoUrl, {
    apply: () => 'data:text/plain,',
  });
}

function patchSetCurrentPanoAndHeading(containerVDOM: ContainerVDOM) {
  const { set: currentPanoSetter } = Object.getOwnPropertyDescriptor(
    containerVDOM.state,
    'currentPano',
  )!;
  Object.defineProperty(containerVDOM.state, 'currentPano', {
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
    containerVDOM.state,
    'currentHeading',
  )!;
  Object.defineProperty(containerVDOM.state, 'currentHeading', {
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
    currentPano: containerVDOM.data.currentPano || null,
    currentHeading: containerVDOM.data.currentHeading || 0,
  });
}

function insertAppComponent(containerVDOM: ContainerVDOM) {
  const appContainerEl = document.createElement('div');
  appContainerEl.setAttribute('data-look-out-the-window-root', '');

  const lastOriginalPanoEl = Object.keys(containerVDOM.$refs)
    .filter((key) => key.startsWith('pano'))
    .map((key): HTMLIFrameElement => containerVDOM.$refs[key])
    .at(-1)!;
  lastOriginalPanoEl.insertAdjacentElement('afterend', appContainerEl);

  render(() => <App />, appContainerEl);
}

IRF.vdom.container.then((vdomContainer) => {
  patchOutPanoUrl(vdomContainer);
  patchSetCurrentPanoAndHeading(vdomContainer);
  insertAppComponent(vdomContainer);
});
