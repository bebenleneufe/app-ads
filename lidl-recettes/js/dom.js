export function createElement(tagName, { className, text, attributes = {} } = {}, children = []) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  for (const [attributeName, attributeValue] of Object.entries(attributes)) {
    element.setAttribute(attributeName, attributeValue);
  }
  for (const child of children) {
    if (child) {
      element.append(child);
    }
  }
  return element;
}

export function replaceChildrenWithFragment(containerElement, childElements) {
  const fragment = document.createDocumentFragment();
  fragment.append(...childElements);
  containerElement.replaceChildren(fragment);
}

export function debounce(callback, delayMilliseconds) {
  let timeoutId = null;
  let pendingArguments = null;
  const cancel = () => {
    clearTimeout(timeoutId);
    timeoutId = null;
    pendingArguments = null;
  };
  const flush = () => {
    if (timeoutId === null) {
      return;
    }
    const callbackArguments = pendingArguments;
    cancel();
    callback(...callbackArguments);
  };
  const run = (...callbackArguments) => {
    cancel();
    pendingArguments = callbackArguments;
    timeoutId = setTimeout(flush, delayMilliseconds);
  };
  return { run, cancel, flush };
}
