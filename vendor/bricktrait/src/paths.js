// The standalone editor uses relative URLs on localhost, custom domains and GitHub Pages.
export const asset=path=>new URL(path,location.href).href;
