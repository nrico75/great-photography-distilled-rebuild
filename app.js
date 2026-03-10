(function(){
  const pickerView = document.getElementById("pickerView");
  const stackView = document.getElementById("stackView");
  const stackScroller = document.getElementById("stackScroller");
  const stackTitle = document.getElementById("stackTitle");
  const lessonIndicator = document.getElementById("lessonIndicator");
  const backBtn = document.getElementById("backBtn");

  const panel = document.getElementById("panel");
  const panelScrim = document.getElementById("panelScrim");
  const panelClose = document.getElementById("panelClose");
  const panelTitle = document.getElementById("panelTitle");
  const panelBody = document.getElementById("panelBody");
  const panelTabs = document.querySelector(".panelTabs");
  const tabExercise = document.getElementById("tabExercise");
  const tabDeepDive = document.getElementById("tabDeepDive");

  const JPG_EXCEPTIONS = new Set([
    "Ansel_Adams_and_camera",
    "Peter_Lindbergh_2015",
    "Yousuf_Karsh_Canadian_photographer",
  ]);

  function toAssetPath(path){
    if(typeof path !== "string") return path;
    const m = path.match(/^assets\/(.+)\.(jpg|jpeg|png)$/i);
    if(!m) return path;
    const name = m[1];
    const ext = JPG_EXCEPTIONS.has(name) ? "jpg" : "webp";
    return `assets/${name}.${ext}`;
  }

  function normalize(value){
    if(Array.isArray(value)) return value.map(normalize);
    if(value && typeof value === "object"){
      const out = {};
      Object.keys(value).forEach((k) => { out[k] = normalize(value[k]); });
      return out;
    }
    return toAssetPath(value);
  }

  const BLOCKS = normalize(window.BLOCKS || []);
  const PANELS = normalize(window.PANEL_BY_ID || {});
  const DUMMY_IMAGE = toAssetPath(window.DUMMY_IMAGE || "assets/dummybild-kort.jpg");

  const state = {
    view: "picker",
    panelOpen: false,
    panelTab: "exercise",
    activeBlock: null,
    activeCard: null,
    lessons: [],
    currentLessonIndex: 0,
    currentAccent: "orange",
  };

  const ACCENT_CLASS = new Set(["accent-orange", "accent-yellow", "accent-green", "accent-blue", "accent-purple"]);

  function accentClassFor(block){
    const a = (block && block.accent) ? String(block.accent).toLowerCase() : "orange";
    if(["orange", "yellow", "green", "blue", "purple"].includes(a)) return `accent-${a}`;
    return "accent-orange";
  }

  function clearAccentClasses(el){
    if(!el) return;
    ACCENT_CLASS.forEach((c) => el.classList.remove(c));
  }

  function applyAccent(el, block){
    clearAccentClasses(el);
    if(el) el.classList.add(accentClassFor(block));
  }

  function updateLessonIndicator(){
    if(!lessonIndicator) return;
    const total = state.lessons.length || 1;
    const current = Math.max(1, state.currentLessonIndex + 1);
    lessonIndicator.textContent = `${current} / ${total}`;
  }

  function esc(s){
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderPicker(){
    state.view = "picker";
    pickerView.classList.remove("hidden");
    stackView.classList.add("hidden");
    closePanel();

    const cards = [];
    BLOCKS.forEach((block) => {
      (block.cards || []).forEach((card) => cards.push({ block, card }));
    });

    pickerView.innerHTML = `<div class="pickerGrid">${
      cards.map(({ block, card }, i) => `
        <button class="pickerCard ${accentClassFor(block)}" data-index="${i}" type="button">
          <img loading="lazy" decoding="async" src="${esc(card.coverImage || DUMMY_IMAGE)}" alt="${esc(card.title)}">
          <div class="pickerCardBody">
            <div class="pickerEyebrow">${esc(block.eyebrow || block.title)}</div>
            <div class="pickerTitle">${esc(card.title)}</div>
          </div>
        </button>
      `).join("")
    }</div>`;

    pickerView.querySelectorAll(".pickerCard").forEach((el) => {
      el.addEventListener("click", () => {
        const pair = cards[Number(el.dataset.index)];
        openLessonStack(pair.block, pair.card);
      });
    });
  }

  function openLessonStack(block, card){
    state.view = "lessonStack";
    state.activeBlock = block;
    state.activeCard = card;
    state.lessons = card.lessons || [];
    state.currentLessonIndex = 0;
    state.currentAccent = (block && block.accent) ? String(block.accent).toLowerCase() : "orange";

    pickerView.classList.add("hidden");
    stackView.classList.remove("hidden");
    applyAccent(stackView, block);
    applyAccent(panelTabs, block);
    stackTitle.textContent = `${block.title} · ${card.title}`;
    updateLessonIndicator();

    if(!state.lessons.length){
      stackScroller.innerHTML = "<article class=\"lessonPage\"><section class=\"lessonCard\"><div class=\"lessonBody\"><h2 class=\"lessonTitle\">No lessons found</h2><p class=\"lessonText\">This card has no lessons yet.</p></div></section></article>";
      return;
    }

    stackScroller.innerHTML = state.lessons.map((lesson, i) => {
      return `
      <article class="lessonPage" data-idx="${i}">
        <section class="lessonCard ${accentClassFor(block)}">
          <img class="lessonImage" ${i === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async" src="${esc(lesson.image || DUMMY_IMAGE)}" alt="${esc(lesson.title)}">
          <div class="lessonBody">
            <div class="lessonEyebrow">${esc(lesson.eyebrow || block.eyebrow || block.title)}</div>
            <h2 class="lessonTitle">${esc(lesson.title)}</h2>
            <p class="lessonText">${esc(lesson.body || "")}</p>
            ${lesson.hint ? `<p class="lessonHint">${esc(lesson.hint)}</p>` : ""}
            <div class="lessonActions">
              <button class="uiBtn openPanelBtn" data-tab="exercise" type="button">Exercise</button>
              <button class="uiBtn openPanelBtn" data-tab="deepDive" type="button">Deep Dive</button>
            </div>
          </div>
        </section>
      </article>
    `;
    }).join("");

    stackScroller.scrollTop = 0;
    stackScroller.querySelectorAll(".openPanelBtn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = btn.closest(".lessonPage");
        const idx = Number(page.dataset.idx || 0);
        state.currentLessonIndex = idx;
        openPanel(btn.dataset.tab || "exercise");
      });
    });

    stackScroller.onscroll = onStackScroll;
  }

  function onStackScroll(){
    const first = stackScroller.querySelector(".lessonPage");
    const h = first ? first.offsetHeight : stackScroller.clientHeight;
    if(h <= 0) return;
    const idx = Math.round(stackScroller.scrollTop / h);
    state.currentLessonIndex = Math.max(0, Math.min(state.lessons.length - 1, idx));
    updateLessonIndicator();
  }

  function getCurrentLesson(){
    return state.lessons[state.currentLessonIndex] || state.lessons[0] || null;
  }

  function openPanel(tab){
    const lesson = getCurrentLesson();
    if(!lesson) return;
    const data = PANELS[lesson.id] || {};
    const requestedTab = tab === "deepDive" ? "deepDive" : "exercise";
    const resolvedTab = data[requestedTab]
      ? requestedTab
      : (data.deepDive ? "deepDive" : (data.exercise ? "exercise" : "exercise"));
    state.panelOpen = true;
    state.panelTab = resolvedTab;
    panel.classList.remove("hidden");
    panel.setAttribute("aria-hidden", "false");
    stackScroller.style.overflow = "hidden";
    renderPanel(lesson);
  }

  function closePanel(){
    state.panelOpen = false;
    panel.classList.add("hidden");
    panel.setAttribute("aria-hidden", "true");
    stackScroller.style.overflow = "";
  }

  function sectionHtml(sections){
    return (sections || []).map((s) => `
      <h3>${esc(s.h)}</h3>
      <p>${esc(s.p)}</p>
    `).join("");
  }

  function fallbackSections(lesson, tab){
    if(tab === "exercise"){
      return [
        { h: "1) PRACTICAL DRILL", p: "Use this lesson as a focused exercise. Shoot 8-12 frames with one clear intention and keep all settings/position changes deliberate." },
        { h: "2) EVALUATE", p: "Compare the strongest 3 frames and identify what changed: distance, timing, light, background, or subject relation. Keep what improves readability." },
        { h: "3) ITERATE", p: "Repeat once with one controlled adjustment. Small, intentional changes usually produce the fastest improvement." },
      ];
    }
    return [
      { h: "1) CORE IDEA", p: lesson.body || "This lesson currently has a lighter deep dive. Use the card text as the core concept and study how it appears in your own images." },
      { h: "2) WHAT TO OBSERVE", p: "Look for composition, light, and subject hierarchy in example images. Ask what choice creates the strongest read first." },
      { h: "3) WHY IT MATTERS", p: "Even short concepts become powerful when repeated in practice. Build consistency first, then add complexity." },
    ];
  }

  function renderPanel(lesson){
    const data = PANELS[lesson.id] || {};
    let content = state.panelTab === "exercise" ? data.exercise : data.deepDive;
    const hasExercise = !!data.exercise;
    const hasDeepDive = !!data.deepDive;

    tabExercise.classList.toggle("active", state.panelTab === "exercise");
    tabDeepDive.classList.toggle("active", state.panelTab === "deepDive");
    tabExercise.disabled = !hasExercise;
    tabDeepDive.disabled = !hasDeepDive;
    panelTitle.textContent = `${state.panelTab === "exercise" ? "Exercise" : "Deep Dive"} · ${lesson.title}`;

    if(!content){
      content = { sections: fallbackSections(lesson, state.panelTab) };
    }

    const image = content.imageSrc ? `<img loading="lazy" decoding="async" src="${esc(content.imageSrc)}" alt="">` : "";
    if(content.sections && content.sections.length){
      panelBody.innerHTML = `${image}${sectionHtml(content.sections)}`;
      return;
    }
    if(content.bullets && content.bullets.length){
      panelBody.innerHTML = `${image}<ul>${content.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`;
      return;
    }
    if(content.paragraphs && content.paragraphs.length){
      panelBody.innerHTML = `${image}${content.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}`;
      return;
    }
    panelBody.innerHTML = "<p>No panel details in this format.</p>";
  }

  backBtn.addEventListener("click", () => renderPicker());
  panelClose.addEventListener("click", closePanel);
  panelScrim.addEventListener("click", closePanel);
  tabExercise.addEventListener("click", () => { state.panelTab = "exercise"; renderPanel(getCurrentLesson()); });
  tabDeepDive.addEventListener("click", () => { state.panelTab = "deepDive"; renderPanel(getCurrentLesson()); });
  window.addEventListener("keydown", (e) => { if(e.key === "Escape") closePanel(); });

  document.addEventListener("error", (event) => {
    const img = event.target;
    if(!(img instanceof HTMLImageElement)) return;
    const src = img.getAttribute("src") || "";
    const m = src.match(/^assets\/(.+)\.(webp|jpg)$/i);
    if(!m || img.dataset.fallbackTried === "1") return;
    img.dataset.fallbackTried = "1";
    img.src = `assets/${m[1]}.jpg`;
  }, true);

  renderPicker();
})();
