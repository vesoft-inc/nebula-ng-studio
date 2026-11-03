// jsdom has no scrolling implementation.
if (typeof window !== 'undefined') window.scrollTo = () => {};
