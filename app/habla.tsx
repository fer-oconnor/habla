'use client';
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element -- This wrapper hosts the existing DOM router and tiny local SVGs, not Next client navigation. */
import { useEffect } from 'react';
export default function Habla() {
  useEffect(() => {
    if (document.getElementById('habla-module')) return;
    const script = document.createElement('script');
    script.id = 'habla-module'; script.type = 'module'; script.src = '/js/main.js?v=logo20261003';
    document.body.appendChild(script);
  }, []);
  return <>
    <a className="skip-link" href="#main">Saltar al contenido</a>
    <div id="boot" className="boot" role="status"><img className="boot__mascot" src="/assets/logo.svg?v=logo20261003" alt="" width="72" height="72" /><p className="boot__text">Cargando Habla…</p></div>
    <div id="app" className="app" hidden>
      <header id="topbar" className="topbar" hidden><a className="brand brand--small" href="/learn" data-route=""><img src="/assets/logo.svg?v=logo20261003" alt="" width="28" height="28" /><span className="brand__name">Habla</span></a><div id="topbar-stats" className="stats stats--inline" /></header>
      <nav id="sidebar" className="sidebar" aria-label="Navegación principal" hidden><a className="brand" href="/learn" data-route=""><img src="/assets/logo.svg?v=logo20261003" alt="" width="36" height="36" /><span className="brand__name">Habla</span></a><ul className="navlist" id="sidebar-nav" /><div id="sidebar-stats" className="stats stats--stacked" /></nav>
      <main id="main" className="main" tabIndex={-1}><div id="view" className="view" /></main>
      <nav id="bottomnav" className="bottomnav" aria-label="Navegación principal" hidden><ul className="bottomnav__list" id="bottomnav-list" /></nav>
    </div>
    <div id="toasts" className="toasts" role="region" aria-label="Avisos" aria-live="polite" />
    <noscript>Activa JavaScript para practicar con Habla.</noscript>
  </>;
}
