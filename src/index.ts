import './meta.js?userscript-metadata';

import globalCss from './style.css';
import { stylesheet as moduleCss } from './style.module.css';
GM_addStyle(globalCss);
GM_addStyle(moduleCss);

import './pano/scene';
import './ui/settings';
