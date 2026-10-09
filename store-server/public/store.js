// 스토어 화면의 작은 동작: 첫 화면 진열 넘기기, 상품 그림 고르기, 언어 메뉴 닫기. 없어도 화면은 다 읽힌다.
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  for (const hero of document.querySelectorAll("[data-carousel]")) {
    const slides = [...hero.querySelectorAll(".slide")];
    const thumbs = [...hero.querySelectorAll(".slide-thumb")];
    if (slides.length < 2) continue;
    let current = 0;
    const show = (index) => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => { slide.hidden = i !== current; slide.classList.toggle("is-on", i === current); });
      thumbs.forEach((thumb, i) => {
        thumb.classList.toggle("is-on", i === current);
        if (i === current) thumb.setAttribute("aria-current", "true"); else thumb.removeAttribute("aria-current");
      });
    };
    thumbs.forEach((thumb) => thumb.addEventListener("click", () => { show(Number(thumb.dataset.go)); stop(); }));
    let timer = 0;
    const stop = () => { window.clearInterval(timer); timer = 0; };
    const start = () => { if (!reduceMotion && !timer) timer = window.setInterval(() => show(current + 1), 7000); };
    hero.addEventListener("mouseenter", stop);
    hero.addEventListener("focusin", stop);
    hero.addEventListener("mouseleave", start);
    start();
  }

  for (const gallery of document.querySelectorAll("[data-gallery]")) {
    const main = gallery.querySelector("[data-main]");
    const thumbs = [...gallery.querySelectorAll(".thumb")];
    thumbs.forEach((thumb) => thumb.addEventListener("click", (event) => {
      event.preventDefault();
      main.src = thumb.dataset.src;
      main.alt = thumb.dataset.alt ?? main.alt;
      thumbs.forEach((other) => other.classList.toggle("is-on", other === thumb));
    }));
  }

  const menus = [...document.querySelectorAll("details.lang-menu")];
  document.addEventListener("click", (event) => {
    for (const menu of menus) if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    for (const menu of menus) if (menu.open) { menu.open = false; menu.querySelector("summary")?.focus(); }
  });
})();
