// Load EmojiButton as ES module and expose to global scope
(async function() {
  try {
    const module = await import('./emoji-button.min.js');
    window.EmojiButton = module.EmojiButton;
  } catch (error) {
    console.error('Failed to load EmojiButton:', error);
  }
})();

