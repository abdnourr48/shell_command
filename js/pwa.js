/* Installable on localhost/HTTPS; file:// standalone and folder still work offline. */
'use strict';
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && ['https:', 'http:'].includes(location.protocol) && !document.body.hasAttribute('data-standalone')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { }));
}
