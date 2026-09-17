import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_NAME = 'BULLER TRADING';
const SITE_URL = 'https://bullertrading.vercel.app';
const SITE_TITLE =
'BULLER TRADING | Gold XAUUSD Signals & Institutional Trading Tools';
const SITE_DESCRIPTION =
'BULLER TRADING provides professional gold trading signals, XAUUSD analysis, SMC, ICT, AMD, institutional order-flow tools, disciplined trade plans, live market news and an economic calendar.';
const SITE_KEYWORDS =
'BULLER TRADING, bullertrading, Buller Trading platform, gold trading signals, XAUUSD signals, XAUUSD analysis, institutional trading tools, forex signals, SMC ICT AMD analysis, order flow analysis, buy sell levels';
const SITE_IMAGE = "/LOGO_PNG_FINAL.png";


export function SeoMetadata() {
  const location = useLocation();

  useEffect(() => {
    const isLanding = location.pathname === '/';
    const canonicalUrl = `${SITE_URL}${isLanding ? '/' : location.pathname}`;
    document.title = isLanding ? SITE_TITLE : `${pageName(location.pathname)} | ${SITE_NAME}`;
    setCanonical(canonicalUrl);
    setNamedMeta(
      'robots',
      isLanding ?
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' :
      'noindex, nofollow'
    );
    setNamedMeta('description', SITE_DESCRIPTION);
    setNamedMeta('keywords', SITE_KEYWORDS);
    setNamedMeta('author', 'Syed Azhaad Hussain');
    setPropertyMeta('og:url', canonicalUrl);
    setPropertyMeta('og:type', 'website');
    setPropertyMeta('og:site_name', SITE_NAME);
    setPropertyMeta('og:locale', 'en_US');
    setPropertyMeta('og:title', document.title);
    setPropertyMeta('og:description', SITE_DESCRIPTION);
    setPropertyMeta('og:image', SITE_IMAGE);
    setPropertyMeta('og:image:alt', 'BULLER TRADING gold market intelligence platform');
    setNamedMeta('twitter:card', 'summary_large_image');
    setNamedMeta('twitter:title', document.title);
    setNamedMeta('twitter:description', SITE_DESCRIPTION);
    setNamedMeta('twitter:image', SITE_IMAGE);
    updateStructuredData(isLanding);
  }, [location.pathname]);

  return null;
}

function pageName(pathname: string): string {
  const segment = pathname.split('/').filter(Boolean).pop();
  if (!segment) return 'Home';
  return segment.
  split('-').
  map((word) => word.charAt(0).toUpperCase() + word.slice(1)).
  join(' ');
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

function updateStructuredData(isLanding: boolean) {
  const id = 'buller-trading-structured-data';
  document.getElementById(id)?.remove();
  if (!isLanding) return;

  const script = document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.text = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: SITE_IMAGE,
      founder: { '@type': 'Person', name: 'Syed Azhaad Hussain' }
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en'
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#application`,
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      description: SITE_DESCRIPTION,
      publisher: { '@id': `${SITE_URL}/#organization` },
      featureList: [
      'Gold XAUUSD trading signals',
      'SMC, ICT and AMD market analysis',
      'Institutional order-flow intelligence',
      'Economic calendar and market news',
      'Risk-managed trade planning']

    }]

  });
  document.head.appendChild(script);
}