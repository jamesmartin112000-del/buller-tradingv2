import React from 'react';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ensureSeed } from './lib/db/store';

const SITE_TITLE = 'BULLER TRADING | Gold XAUUSD Signals & Institutional Trading Tools';
const SITE_DESCRIPTION =
'BULLER TRADING provides professional gold trading signals, XAUUSD analysis, SMC, ICT, AMD, institutional order-flow tools, disciplined trade plans, live market news and an economic calendar.';
const SITE_KEYWORDS = [
'BULLER TRADING',
'bullertrading',
'Buller Trading platform',
'gold trading signals',
'XAUUSD signals',
'XAUUSD analysis',
'institutional trading tools',
'forex signals',
'SMC ICT AMD analysis',
'order flow analysis'].
join(', ');
const SITE_IMAGE = "/LOGO_PNG_FINAL.png";


ensureSeed();
applyInitialMetadata();

const container = document.getElementById('root');
if (!container) throw new Error('Application root element was not found.');

createRoot(container).render(
  <ErrorBoundary>
    <MantineProvider defaultColorScheme="dark">
      <App />
    </MantineProvider>
  </ErrorBoundary>
);

function applyInitialMetadata() {
  document.documentElement.lang = 'en';
  document.title = SITE_TITLE;
  setNamedMeta('description', SITE_DESCRIPTION);
  setNamedMeta('author', 'Syed Azhaad Hussain');
  setNamedMeta('keywords', SITE_KEYWORDS);
  setNamedMeta(
    'robots',
    'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
  );
  setNamedMeta('theme-color', '#061f16');
  setNamedMeta('application-name', 'BULLER TRADING');
  setCanonical('https://bullertrading.vercel.app/');
  setPropertyMeta('og:type', 'website');
  setPropertyMeta('og:site_name', 'BULLER TRADING');
  setPropertyMeta('og:locale', 'en_US');
  setPropertyMeta('og:title', SITE_TITLE);
  setPropertyMeta('og:description', SITE_DESCRIPTION);
  setPropertyMeta('og:url', 'https://bullertrading.vercel.app/');
  setPropertyMeta('og:image', SITE_IMAGE);
  setPropertyMeta('og:image:alt', 'BULLER TRADING gold market intelligence platform');
  setNamedMeta('twitter:card', 'summary_large_image');
  setNamedMeta('twitter:title', SITE_TITLE);
  setNamedMeta('twitter:description', SITE_DESCRIPTION);
  setNamedMeta('twitter:image', SITE_IMAGE);
}

function setNamedMeta(name: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.name = name;
    document.head.appendChild(element);
  }
  element.content = content;
}

function setPropertyMeta(property: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`
  );
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('property', property);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }
  element.href = href;
}