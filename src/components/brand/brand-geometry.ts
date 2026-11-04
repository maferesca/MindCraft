// Geometry of the approved MindCraft icon, measured from the source artwork.
// Do not adjust these points by eye. The opening and the diagonal gap are left
// out of the shapes, so whatever is behind the icon shows through them.
export const BRAND_FACES = {
  top: "179.5,0 359,101.5 261,152 179.5,105 98,152 0,101.5",
  left: "0,101.5 98,152 98,251 179.5,299 179.5,398 0,296",
  // The diagonal gap splits the right face in two.
  rightUpper: "359,101.5 359,194.5 261,242 261,152",
  rightLower: "179.5,299 359,214.5 359,296 179.5,398",
};

// Square, centered on the 359 × 398 artwork.
export const BRAND_VIEW_BOX = "-19.5 0 398 398";

// Colors of the approved artwork, used where the theme is not available.
export const BRAND_COLORS = { top: "#A5CE91", left: "#3B993D", right: "#026B30" };
