import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import path from 'node:path';
import deployment from './google/deployment.json';

process.env.VITE_TIKO_GOOGLE_URL||=`https://script.google.com/macros/s/${deployment.deploymentId}/exec`;

export default defineConfig({
 root:path.resolve('pages'),
 base:process.env.TIKO_PAGES_BASE||'/tiko-shabbat-menu/',
 publicDir:path.resolve('public'),
 resolve:{alias:{'@':path.resolve('.')}},
 plugins:[react()],
 css:{postcss:{plugins:[tailwindcss()]}},
 build:{outDir:path.resolve('dist-pages'),emptyOutDir:true},
});
