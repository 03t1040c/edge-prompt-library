// Event-driven only: no polling, network, installation task, or startup preload.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'open-library') return;
  const { library } = await chrome.storage.local.get('library');
  if (library?.settings?.keyboardEnabled === false) return;
  await chrome.action.openPopup();
});
