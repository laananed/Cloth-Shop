export function resetScrollPositionToTop(scrollContainer, update) {
  update();

  if (!scrollContainer) {
    return;
  }

  scrollContainer.scrollTop = 0;
  scrollContainer.scrollLeft = 0;
}
