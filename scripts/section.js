// section.js
export function sectionImage(main) {
  const sections = document.querySelectorAll('.section');

  sections.forEach((section) => {
    // Find the first image within the section
    const picture = section.querySelector('picture:first-of-type');
    picture?.classList.add('section-main-image');
  });
}
