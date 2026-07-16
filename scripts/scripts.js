import {
  sampleRUM,
  buildBlock,
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForLCP,
  loadBlocks,
  loadCSS,
} from './aem.js';

import sectionImage from './section.js';

const LCP_BLOCKS = []; // add your LCP blocks to the list

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
  const h1 = main.querySelector('h1');
  const picture = main.querySelector('picture');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    const section = document.createElement('div');
    section.append(buildBlock('hero', { elems: [picture, h1] }));
    main.prepend(section);
  }
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

// heading id -> chapter class; chapters not listed here stay a plain section
const CHAPTER_CLASSES = {
  'über-uns': 'chapter-ueber-uns',
  jugendfeuerwehr: 'chapter-jugendfeuerwehr',
  förderverein: 'chapter-foerderverein',
};

/**
 * Splits a flat run of content into one section per chapter heading, so each
 * heading and its content becomes its own independently stylable section.
 * The CMS content here isn't authored with section breaks, so this mirrors
 * what decorateSections does for author-separated blocks, automatically.
 * @param {Element} main The container element
 */
function buildChapterSections(main) {
  const isChapterStart = (el) => el.tagName === 'H2' || el.id in CHAPTER_CLASSES;

  main.querySelectorAll(':scope > div').forEach((container) => {
    // drop now-empty leftovers, e.g. the <p> the hero picture was extracted from
    const children = [...container.children]
      .filter((el) => el.textContent.trim() || el.querySelector('img, picture'));
    if (children.filter(isChapterStart).length < 2) return;

    const groups = [];
    children.forEach((el) => {
      if (isChapterStart(el) || groups.length === 0) groups.push([]);
      groups[groups.length - 1].push(el);
    });

    groups.forEach((group) => {
      const section = document.createElement('div');
      group.forEach((el) => section.append(el));

      const chapterClass = CHAPTER_CLASSES[group[0].id];
      if (chapterClass) {
        section.classList.add(chapterClass);
        if (chapterClass !== 'chapter-jugendfeuerwehr') section.classList.add('highlight');
      }

      container.before(section);
    });
    container.remove();
  });
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    buildHeroBlock(main);
    buildChapterSections(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

// which side each chapter's header image sits on; alternates chapter to chapter
const CHAPTER_IMAGE_SIDE = {
  'chapter-ueber-uns': 'right',
  'chapter-jugendfeuerwehr': 'left',
  'chapter-foerderverein': 'right',
};

/**
 * Splits a lone <picture> out of a paragraph that also carries text, so the
 * image can float independently while the text stays in normal flow beside
 * it. Returns the original element unchanged if there's nothing to split.
 * @param {Element} el an element matching `:has(picture)`
 * @returns {Element} a standalone element wrapping just the picture
 */
function extractPicture(el) {
  const picture = el.querySelector(':scope > picture');
  const hasOtherContent = [...el.childNodes]
    .some((node) => node !== picture && (node.textContent || '').trim());
  if (!hasOtherContent) return el;
  const wrapper = document.createElement('p');
  wrapper.append(picture);
  el.before(wrapper);
  return wrapper;
}

/**
 * Lays out each chapter. The heading always stays full-width at the top of
 * the chapter. When an image sits directly below the heading, it is paired
 * with the body text as a [image | text] row (side alternates chapter to
 * chapter) so the image top lines up with the first paragraph, not the
 * heading. Any other image in the chapter is a full-width separator.
 * @param {Element} main The container element
 */
function layoutChapterMedia(main) {
  Object.entries(CHAPTER_IMAGE_SIDE).forEach(([chapterClass, side]) => {
    const section = main.querySelector(`.${chapterClass}`);
    const wrapper = section?.querySelector('.default-content-wrapper');
    const heading = wrapper?.querySelector(':scope > h2, :scope > h3');
    if (!heading) return;

    const pictures = [...wrapper.querySelectorAll(':scope > :has(picture)')]
      .map((el) => extractPicture(el));
    const headerImage = pictures.length && pictures[0].previousElementSibling === heading
      ? pictures[0]
      : null;
    const otherImages = pictures.filter((el) => el !== headerImage);
    otherImages.forEach((el) => el.classList.add('chapter-separator-image'));

    // collect the body (everything after heading/header image, up to a separator)
    const body = [];
    let node = (headerImage || heading).nextElementSibling;
    while (node && !otherImages.includes(node)) {
      const next = node.nextElementSibling;
      body.push(node);
      node = next;
    }
    const text = document.createElement('div');
    text.className = 'chapter-text';
    body.forEach((el) => text.append(el));

    if (headerImage) {
      section.classList.add(`chapter-image-${side}`);
      headerImage.classList.add('chapter-row-image');
      const row = document.createElement('div');
      row.className = 'chapter-row';
      heading.before(row);
      headerImage.remove();
      // grid items: heading and text share a column; the image is the other
      row.append(heading, headerImage, text);
    } else {
      heading.after(text);
    }
  });
}

/**
 * Splits the Förderverein body into a description column (intro + list) and a
 * donation card (the "Jetzt spenden" heading onward: bank details + button),
 * so the call to action reads as one coherent, prominent block.
 * @param {Element} main The container element
 */
function layoutDonation(main) {
  const text = main.querySelector('.chapter-foerderverein .chapter-text');
  const cta = text?.querySelector(':scope > #jetzt-spenden');
  if (!cta) return;

  const desc = document.createElement('div');
  desc.className = 'donation-desc';
  while (text.firstChild !== cta) desc.append(text.firstChild);

  const card = document.createElement('div');
  card.className = 'donation-card';
  while (text.firstChild) card.append(text.firstChild);

  text.classList.add('donation-layout');
  text.append(desc, card);
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  layoutChapterMedia(main);
  layoutDonation(main);

  // custom functions
  sectionImage(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await waitForLCP(LCP_BLOCKS);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadBlocks(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();

  sampleRUM('lazy');
  sampleRUM.observe(main.querySelectorAll('div[data-block-name]'));
  sampleRUM.observe(main.querySelectorAll('picture > img'));
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
