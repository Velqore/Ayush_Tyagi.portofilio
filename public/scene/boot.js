// Boot loading display removed — opens directly with the home screen on the TV.
(() => {
  const osd = document.getElementById("osd");
  if (osd) osd.remove();
  const still = document.getElementById("still");
  if (still) still.remove();
  window.__osdFeed = () => {};
  window.__osdStep = () => Promise.resolve();
})();
