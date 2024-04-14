// section.js
export default function sectionImage(main) {
  const sections = main.querySelectorAll('.section');

  sections.forEach((section) => {
    // Find the first image within the section
    const picture = section.querySelector('picture:first-of-type');
    picture?.classList.add('section-main-image');
  });
}
