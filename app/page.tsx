// Static hosting has no server redirect, so pick the language in the browser; fall back to /en.
export default function Root() {
  const script = `var l=(navigator.language||'en').slice(0,2);location.replace('/'+(['en','de','es'].indexOf(l)>-1?l:'en')+'/');`;
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="refresh" content="0; url=/en/" />
        <meta name="robots" content="noindex" />
        <title>Nicolás J. Scatamacchia</title>
        <style>{`html{background:#121110}`}</style>
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: script }} />
        <a href="/en/">English</a> · <a href="/de/">Deutsch</a> · <a href="/es/">Español</a>
      </body>
    </html>
  );
}
