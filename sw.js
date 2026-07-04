const CACHE_NAME = "contractor-v1";
const ASSETS = [
  "./index.html",
  "./app.js",
  "./manifest.json",
  "https://cdn.tailwindcss.com",
  "https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});