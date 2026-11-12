import {mount} from 'svelte';
import './app.css';
import {library} from './lib/ldraw.ts';
import App from './routes/+page.svelte';

library.base=new URL('./ldraw/',location.href).href;
mount(App,{target:document.getElementById('app')});
